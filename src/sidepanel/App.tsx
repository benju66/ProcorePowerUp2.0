import { useState, useEffect, useCallback } from 'preact/hooks'
import type { TabInfo, Project, WiretapMessage, Drawing, Commitment, DisciplineMap } from '@/types'
import { StorageService } from '@/services'
import { Header } from './components/Header'
import { TabBar } from './components/TabBar'
import { DrawingsTab } from './components/DrawingsTab'
import { RFIsTab } from './components/RFIsTab'
import { CostTab } from './components/CostTab'
import { ProjectSelector } from './components/ProjectSelector'

const TABS: TabInfo[] = [
  { id: 'drawings', label: 'Drawings', icon: '📐' },
  { id: 'rfis', label: 'RFIs', icon: '❓' },
  { id: 'cost', label: 'Cost', icon: '💰' },
]

// Helper to extract IDs from URL (matches v1 logic)
function extractIdsFromUrl(url: string): { 
  companyId: string | null
  projectId: string | null
  drawingAreaId: string | null 
} {
  const projectMatch = url.match(/projects\/(\d+)/) || url.match(/\/(\d+)\/project/)
  const areaMatch = url.match(/areas\/(\d+)/) || url.match(/drawing_areas\/(\d+)/)
  const companyMatch = url.match(/companies\/(\d+)/)
  
  return {
    companyId: companyMatch?.[1] ?? null,
    projectId: projectMatch?.[1] ?? null,
    drawingAreaId: areaMatch?.[1] ?? null,
  }
}

// ============================================
// DATA DETECTION FUNCTIONS (ported from v1)
// ============================================

interface RawDataItem {
  id?: number
  number?: string
  drawing_number?: string
  title?: string
  vendor?: string
  vendor_name?: string
  contract_date?: string
  type?: string
  discipline?: number | { id?: number; name?: string }
  discipline_name?: string
  subject?: string
  status?: string
  [key: string]: unknown
}

function isCommitment(item: RawDataItem): boolean {
  if (!item || !item.id) return false
  
  // EXCLUDE Drawings: If it has drawing_number, skip it
  if (item.drawing_number) return false

  const hasInfo = item.number || item.title || item.contract_date
  const hasContext = item.vendor || item.vendor_name || 
    (item.type && String(item.type).includes('Contract'))
  
  return !!(hasInfo && hasContext)
}

function isDrawing(item: RawDataItem): boolean {
  if (!item || !item.id) return false
  
  // Must have a drawing number
  const hasNum = item.number || item.drawing_number
  if (!hasNum) return false
  
  // STRICT EXCLUSION: If it has a vendor or contract_date, it is NOT a drawing
  if (item.vendor || item.vendor_name || item.contract_date) return false
  
  return true
}

function isRFI(item: RawDataItem): boolean {
  if (!item || !item.id) return false
  
  // RFIs have subject and status, no drawing_number
  if (item.drawing_number) return false
  if (item.vendor || item.vendor_name) return false
  
  const hasSubject = !!item.subject
  const hasStatus = !!item.status
  const hasNumber = item.number !== undefined
  
  return hasSubject && hasStatus && hasNumber
}

function findDataInObject(obj: unknown): RawDataItem[] {
  if (!obj) return []
  
  // If it's an array, return it
  if (Array.isArray(obj)) return obj as RawDataItem[]
  
  // Check common response structures
  const record = obj as Record<string, unknown>
  if (record.data && Array.isArray(record.data)) return record.data as RawDataItem[]
  if (record.entities && Array.isArray(record.entities)) return record.entities as RawDataItem[]
  
  // Search for arrays in object properties
  for (const key in record) {
    if (Array.isArray(record[key]) && (record[key] as unknown[]).length > 0) {
      return record[key] as RawDataItem[]
    }
  }
  
  return []
}

function normalizeDrawing(item: RawDataItem): Drawing {
  return {
    id: item.id!,
    num: (item.number || item.drawing_number || '') as string,
    title: (item.title || '') as string,
    discipline: typeof item.discipline === 'number' 
      ? item.discipline 
      : (item.discipline as { id?: number })?.id,
    discipline_name: item.discipline_name || 
      (typeof item.discipline === 'object' ? (item.discipline as { name?: string })?.name : undefined),
  }
}

function normalizeCommitment(item: RawDataItem): Commitment {
  return {
    id: item.id!,
    number: (item.number || '') as string,
    title: (item.title || '') as string,
    vendor: item.vendor as string | undefined,
    vendor_name: item.vendor_name || 
      (typeof item.vendor === 'object' ? (item.vendor as { name?: string })?.name : undefined),
    status: item.status as string | undefined,
    contract_date: item.contract_date as string | undefined,
    type: item.type as string | undefined,
    approved_amount: item.approved_amount as number | undefined,
    pending_amount: item.pending_amount as number | undefined,
    draft_amount: item.draft_amount as number | undefined,
  }
}

// Find disciplines in nested objects (ported from v1)
function findDisciplinesRecursive(
  obj: unknown, 
  map: DisciplineMap, 
  sortCounter: number, 
  depth: number
): void {
  if (depth > 5) return
  if (!obj || typeof obj !== 'object') return
  
  const item = obj as Record<string, unknown>
  
  // Check if this is a discipline object
  if (item.id && item.name && typeof item.name === 'string' && 
      !item.drawing_number && !item.number) {
    map[item.id as number] = { name: item.name as string, index: sortCounter }
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((child, index) => {
      findDisciplinesRecursive(child, map, index, depth + 1)
    })
  } else {
    for (const key in item) {
      if (['permissions', 'metadata', 'view_options'].includes(key)) continue
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        findDisciplinesRecursive(item[key], map, sortCounter, depth + 1)
      }
    }
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabInfo['id']>('drawings')
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [currentDrawingAreaId, setCurrentDrawingAreaId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isProcoreTab, setIsProcoreTab] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Data version counter - increment to trigger tab refreshes
  const [dataVersion, setDataVersion] = useState(0)

  // Initialize and detect current project
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      
      // Load saved projects
      const savedProjects = await StorageService.getAllProjects()
      setProjects(savedProjects)

      // Try to get current tab info
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB' })
        if (response?.isProcoreTab && response.url) {
          setIsProcoreTab(true)
          
          // Extract ALL IDs from URL (projectId AND drawingAreaId)
          const ids = extractIdsFromUrl(response.url)
          
          if (ids.projectId) {
            setCurrentProjectId(ids.projectId)
            setCurrentDrawingAreaId(ids.drawingAreaId)
            
            // Update project access with all captured IDs
            await StorageService.updateProjectAccess(ids.projectId, {
              companyId: ids.companyId ?? undefined,
              drawingAreaId: ids.drawingAreaId ?? undefined,
            })
          }
        }
      } catch {
        // Not in a tab context (e.g., popped out window)
      }

      setIsLoading(false)
    }

    init()
  }, [])

  // Listen for tab updates and wiretap data
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'TAB_UPDATED') {
        const payload = message.payload as { url: string }
        const ids = extractIdsFromUrl(payload.url)
        
        if (ids.projectId) {
          setCurrentProjectId(ids.projectId)
          setCurrentDrawingAreaId(ids.drawingAreaId)
          setIsProcoreTab(true)
          
          // Update project with new IDs
          StorageService.updateProjectAccess(ids.projectId, {
            companyId: ids.companyId ?? undefined,
            drawingAreaId: ids.drawingAreaId ?? undefined,
          })
        }
      }

      if (message.type === 'WIRETAP_DATA') {
        // Handle incoming wiretap data
        handleWiretapData(message.payload as WiretapMessage)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [currentProjectId])

  const handleWiretapData = useCallback(async (wiretapMessage: WiretapMessage) => {
    const { payload, ids, source } = wiretapMessage
    
    // Determine active project ID (prefer wiretap IDs, fallback to current)
    const activeProjectId = ids.projectId || currentProjectId
    if (!activeProjectId) {
      console.log('PP: No project ID available, skipping wiretap data')
      return
    }

    console.log('PP: Processing wiretap data from:', source)

    // Update project with captured IDs from wiretap
    if (ids.companyId || ids.drawingAreaId) {
      await StorageService.updateProjectAccess(activeProjectId, {
        companyId: ids.companyId ?? undefined,
        drawingAreaId: ids.drawingAreaId ?? undefined,
      })
      
      // Update local state if drawingAreaId changed
      if (ids.drawingAreaId && ids.drawingAreaId !== currentDrawingAreaId) {
        setCurrentDrawingAreaId(ids.drawingAreaId)
      }
    }

    // Extract data array from payload
    const dataItems = findDataInObject(payload)
    if (dataItems.length === 0) {
      console.log('PP: No data items found in payload')
      return
    }

    // Detect data type based on URL source and first item
    const sourceLower = (source || '').toLowerCase()
    const firstItem = dataItems[0]

    // Check source URL to determine context
    const isCommitmentSrc = sourceLower.includes('commitment') || sourceLower.includes('contract')
    const isDrawingSrc = sourceLower.includes('drawing') || sourceLower.includes('discipline') || sourceLower.includes('groups')
    const isRFISrc = sourceLower.includes('/rfis')

    // Process based on detected type
    if (isRFISrc && isRFI(firstItem)) {
      // RFI data
      console.log('PP: Detected RFI data, count:', dataItems.length)
      const rfis = dataItems.filter(isRFI).map(item => ({
        id: item.id!,
        number: (item.number || '') as string,
        subject: (item.subject || '') as string,
        status: (item.status || 'unknown') as string,
        created_at: (item.created_at || '') as string,
        due_date: item.due_date as string | undefined,
        assignee: item.assignee as string | undefined,
        ball_in_court: item.ball_in_court as string | undefined,
      }))
      
      if (rfis.length > 0) {
        const merged = await StorageService.mergeRFIs(activeProjectId, rfis)
        console.log('PP: Saved', rfis.length, 'RFIs, total:', merged.length)
        setDataVersion(v => v + 1)
      }
    } else if (isCommitmentSrc && isCommitment(firstItem)) {
      // Commitment data
      console.log('PP: Detected Commitment data, count:', dataItems.length)
      const commitments = dataItems.filter(isCommitment).map(normalizeCommitment)
      
      if (commitments.length > 0) {
        const merged = await StorageService.mergeCommitments(activeProjectId, commitments)
        console.log('PP: Saved', commitments.length, 'commitments, total:', merged.length)
        setDataVersion(v => v + 1)
      }
    } else if ((isDrawingSrc || !isCommitmentSrc) && isDrawing(firstItem)) {
      // Drawing data (default if not commitment source)
      console.log('PP: Detected Drawing data, count:', dataItems.length)
      const drawings = dataItems.filter(isDrawing).map(normalizeDrawing)
      
      if (drawings.length > 0) {
        const merged = await StorageService.mergeDrawings(activeProjectId, drawings)
        console.log('PP: Saved', drawings.length, 'drawings, total:', merged.length)
        setDataVersion(v => v + 1)
      }
      
      // Also extract discipline map from payload
      const disciplineMap: DisciplineMap = {}
      findDisciplinesRecursive(payload, disciplineMap, 0, 0)
      
      if (Object.keys(disciplineMap).length > 0) {
        // Merge with existing discipline map
        const existing = await StorageService.getDisciplineMap(activeProjectId)
        const merged = { ...existing, ...disciplineMap }
        await StorageService.saveDisciplineMap(activeProjectId, merged)
        console.log('PP: Updated discipline map with', Object.keys(disciplineMap).length, 'entries')
      }
    }

    // Refresh projects list in case new data was saved
    const updatedProjects = await StorageService.getAllProjects()
    setProjects(updatedProjects)
  }, [currentProjectId, currentDrawingAreaId])

  const handlePopOut = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'POP_OUT' })
    } catch (error) {
      console.error('Failed to pop out:', error)
    }
  }, [])

  const handleProjectChange = useCallback((projectId: string) => {
    setCurrentProjectId(projectId)
    StorageService.updateProjectAccess(projectId, {})
  }, [])

  const renderActiveTab = () => {
    if (!currentProjectId) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center px-4">
          <p className="text-lg font-medium mb-2">No Project Selected</p>
          <p className="text-sm">
            {isProcoreTab 
              ? 'Navigate to a project in Procore to get started.'
              : 'Select a project from the dropdown above, or open Procore.'}
          </p>
        </div>
      )
    }

    switch (activeTab) {
      case 'drawings':
        return <DrawingsTab projectId={currentProjectId} dataVersion={dataVersion} />
      case 'rfis':
        return <RFIsTab projectId={currentProjectId} dataVersion={dataVersion} />
      case 'cost':
        return <CostTab projectId={currentProjectId} dataVersion={dataVersion} />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header onPopOut={handlePopOut} />
      
      {/* Global Project Selector (shown when not on Procore tab) */}
      {!isProcoreTab && projects.length > 0 && (
        <ProjectSelector
          projects={projects}
          currentProjectId={currentProjectId}
          onProjectChange={handleProjectChange}
        />
      )}

      <TabBar 
        tabs={TABS} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      <main className="flex-1 overflow-hidden">
        {renderActiveTab()}
      </main>
    </div>
  )
}
