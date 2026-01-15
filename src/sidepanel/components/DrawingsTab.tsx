import { useState, useEffect, useMemo, useCallback } from 'preact/hooks'
import type { Drawing, DisciplineMap } from '@/types'
import { StorageService, ApiService } from '@/services'
import { SearchInput } from './SearchInput'
import { VirtualizedList } from './VirtualizedList'

interface DrawingsTabProps {
  projectId: string
}

export function DrawingsTab({ projectId }: DrawingsTabProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [disciplineMap, setDisciplineMap] = useState<DisciplineMap>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ loaded: number; total: number | null } | null>(null)

  // Load cached data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      const [cachedDrawings, cachedMap] = await Promise.all([
        StorageService.getDrawings(projectId),
        StorageService.getDisciplineMap(projectId),
      ])
      setDrawings(cachedDrawings)
      setDisciplineMap(cachedMap)
      setIsLoading(false)
    }
    loadData()
  }, [projectId])

  // Filter drawings based on search
  const filteredDrawings = useMemo(() => {
    if (!searchQuery.trim()) return drawings
    
    const query = searchQuery.toLowerCase()
    return drawings.filter(d => 
      d.num?.toLowerCase().includes(query) ||
      d.title?.toLowerCase().includes(query) ||
      d.discipline_name?.toLowerCase().includes(query)
    )
  }, [drawings, searchQuery])

  // Group by discipline
  const groupedDrawings = useMemo(() => {
    const groups: Map<string, Drawing[]> = new Map()
    
    for (const drawing of filteredDrawings) {
      const disciplineName = drawing.discipline_name || 
        (drawing.discipline && disciplineMap[drawing.discipline]?.name) || 
        'Uncategorized'
      
      if (!groups.has(disciplineName)) {
        groups.set(disciplineName, [])
      }
      groups.get(disciplineName)!.push(drawing)
    }
    
    // Sort groups by discipline map index
    return Array.from(groups.entries()).sort((a, b) => {
      const aIndex = Object.values(disciplineMap).find(d => d.name === a[0])?.index ?? 999
      const bIndex = Object.values(disciplineMap).find(d => d.name === b[0])?.index ?? 999
      return aIndex - bIndex
    })
  }, [filteredDrawings, disciplineMap])

  // Flatten for virtualization with headers
  const flatList = useMemo(() => {
    const items: Array<{ type: 'header' | 'drawing'; data: string | Drawing }> = []
    
    for (const [discipline, drawingList] of groupedDrawings) {
      items.push({ type: 'header', data: `${discipline} (${drawingList.length})` })
      for (const drawing of drawingList) {
        items.push({ type: 'drawing', data: drawing })
      }
    }
    
    return items
  }, [groupedDrawings])

  const handleScan = useCallback(async () => {
    setIsScanning(true)
    setScanProgress({ loaded: 0, total: null })
    
    try {
      // Get drawing area ID from project data or fetch it
      const project = await StorageService.getProject(projectId)
      let drawingAreaId = project?.drawingAreaId
      
      if (!drawingAreaId) {
        // Try to fetch drawing areas
        const areas = await ApiService.fetchDrawingAreas(projectId)
        if (areas.length > 0) {
          drawingAreaId = String(areas[0].id)
          await StorageService.updateProjectAccess(projectId, { drawingAreaId })
        }
      }
      
      if (!drawingAreaId) {
        console.error('No drawing area ID available')
        return
      }

      // Fetch drawings
      const newDrawings = await ApiService.fetchDrawings(projectId, drawingAreaId, {
        onProgress: (loaded, total) => setScanProgress({ loaded, total }),
      })
      
      // Save and update state
      const merged = await StorageService.mergeDrawings(projectId, newDrawings)
      setDrawings(merged)

      // Also fetch disciplines
      const disciplines = await ApiService.fetchDisciplines(projectId, drawingAreaId)
      if (Object.keys(disciplines).length > 0) {
        await StorageService.saveDisciplineMap(projectId, disciplines)
        setDisciplineMap(disciplines)
      }
    } catch (error) {
      console.error('Scan failed:', error)
    } finally {
      setIsScanning(false)
      setScanProgress(null)
    }
  }, [projectId])

  const handleDrawingClick = useCallback((drawing: Drawing) => {
    // Open drawing in new tab
    StorageService.getProject(projectId).then(project => {
      if (project?.drawingAreaId) {
        const url = `https://app.procore.com/${projectId}/project/drawing_areas/${project.drawingAreaId}/drawing_log/view_fullscreen/${drawing.id}`
        chrome.runtime.sendMessage({ action: 'OPEN_TAB', url, background: false })
      }
    })
  }, [projectId])

  const renderItem = useCallback((item: { type: 'header' | 'drawing'; data: string | Drawing }) => {
    if (item.type === 'header') {
      return (
        <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide sticky top-0">
          {item.data as string}
        </div>
      )
    }

    const drawing = item.data as Drawing
    return (
      <div
        onClick={() => handleDrawingClick(drawing)}
        className="list-item flex items-center gap-2"
      >
        <span className="font-mono text-sm text-blue-600 font-medium min-w-[60px]">
          {drawing.num}
        </span>
        <span className="text-sm text-gray-700 truncate flex-1">
          {drawing.title}
        </span>
      </div>
    )
  }, [handleDrawingClick])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search and actions bar */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search drawings..."
            />
          </div>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isScanning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>
                  {scanProgress?.total 
                    ? `${scanProgress.loaded}/${scanProgress.total}`
                    : `${scanProgress?.loaded ?? 0}...`
                  }
                </span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Scan</span>
              </>
            )}
          </button>
        </div>
        
        {/* Stats bar */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredDrawings.length} of {drawings.length} drawings</span>
          <span>{groupedDrawings.length} disciplines</span>
        </div>
      </div>

      {/* Virtualized list */}
      {drawings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <p className="mb-2">No drawings cached</p>
          <p className="text-sm">Click Scan to fetch drawings from Procore</p>
        </div>
      ) : filteredDrawings.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No drawings match your search
        </div>
      ) : (
        <VirtualizedList
          items={flatList}
          itemHeight={40}
          renderItem={renderItem}
        />
      )}
    </div>
  )
}
