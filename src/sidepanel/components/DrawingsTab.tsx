import { useState, useEffect, useMemo, useCallback } from 'preact/hooks'
import type { Drawing, DisciplineMap } from '@/types'
import { StorageService } from '@/services'
import { SearchInput } from './SearchInput'

interface DrawingsTabProps {
  projectId: string
  dataVersion?: number
}

// Discipline color mapping (like v1)
function getDisciplineColor(name: string): string {
  if (!name) return 'bg-gray-400'
  const n = name.toUpperCase()
  if (n.includes('ARCH') || n.startsWith('A')) return 'bg-red-500'
  if (n.includes('STR') || n.startsWith('S')) return 'bg-blue-500'
  if (n.includes('MECH') || n.startsWith('M')) return 'bg-green-500'
  if (n.includes('ELEC') || n.startsWith('E')) return 'bg-yellow-500'
  if (n.includes('PLUM') || n.startsWith('P')) return 'bg-cyan-500'
  if (n.includes('CIV') || n.startsWith('C')) return 'bg-amber-700'
  if (n.includes('FIRE') || n.startsWith('F')) return 'bg-orange-500'
  if (n.includes('LAND') || n.startsWith('L')) return 'bg-lime-500'
  return 'bg-gray-400'
}

export function DrawingsTab({ projectId, dataVersion = 0 }: DrawingsTabProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [disciplineMap, setDisciplineMap] = useState<DisciplineMap>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanPercent, setScanPercent] = useState(0)
  const [lastCaptureCount, setLastCaptureCount] = useState<number | null>(null)
  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  // Load cached data
  useEffect(() => {
    async function loadData() {
      if (drawings.length === 0) {
        setIsLoading(true)
      }
      
      const [cachedDrawings, cachedMap] = await Promise.all([
        StorageService.getDrawings(projectId),
        StorageService.getDisciplineMap(projectId),
      ])
      
      console.log('DrawingsTab: Loaded', cachedDrawings.length, 'drawings,', Object.keys(cachedMap).length, 'disciplines in map')
      
      // Debug: log first drawing to see discipline info
      if (cachedDrawings.length > 0) {
        console.log('DrawingsTab: Sample drawing:', cachedDrawings[0])
      }
      
      if (dataVersion > 0 && cachedDrawings.length > drawings.length) {
        const newCount = cachedDrawings.length - drawings.length
        setLastCaptureCount(newCount)
        setTimeout(() => setLastCaptureCount(null), 3000)
      }
      
      setDrawings(cachedDrawings)
      setDisciplineMap(cachedMap)
      setIsLoading(false)
    }
    loadData()
  }, [projectId, dataVersion])

  // Listen for scan progress updates
  useEffect(() => {
    let refreshInterval: ReturnType<typeof setInterval> | null = null
    
    const handleMessage = async (message: { type: string; payload?: unknown }) => {
      console.log('DrawingsTab received message:', message.type, message.payload)
      
      if (message.type === 'SCAN_PROGRESS') {
        const payload = message.payload as { status: string; scanType: string; percent: number; message?: string }
        if (payload.scanType === 'drawings') {
          setScanPercent(payload.percent)
          // Use custom message if provided, otherwise default to percentage
          setScanStatus(payload.message || `Scanning... ${payload.percent}%`)
          
          if (payload.status === 'complete' || payload.status === 'timeout') {
            // Clear the refresh interval
            if (refreshInterval) {
              clearInterval(refreshInterval)
              refreshInterval = null
            }
            
            // Final reload from storage
            const [newDrawings, newMap] = await Promise.all([
              StorageService.getDrawings(projectId),
              StorageService.getDisciplineMap(projectId),
            ])
            console.log('DrawingsTab: Final load -', newDrawings.length, 'drawings,', Object.keys(newMap).length, 'disciplines')
            setDrawings(newDrawings)
            setDisciplineMap(newMap)
            
            // Check if disciplines are missing - if so, trigger API fallback
            const uniqueDisciplineIds = new Set<number>()
            for (const d of newDrawings) {
              if (typeof d.discipline === 'number') uniqueDisciplineIds.add(d.discipline)
              else if (d.discipline && typeof d.discipline === 'object') {
                const disc = d.discipline as { id?: number }
                if (disc.id) uniqueDisciplineIds.add(disc.id)
              }
            }
            
            const missingDisciplines = Array.from(uniqueDisciplineIds).filter(id => !newMap[id])
            
            if (missingDisciplines.length > 0) {
              console.log('DrawingsTab: Missing', missingDisciplines.length, 'disciplines, triggering API fetch...')
              setScanStatus('Fetching discipline names...')
              
              // Trigger background API scan for disciplines
              try {
                await chrome.runtime.sendMessage({ 
                  action: 'SCAN_DRAWINGS', 
                  projectId,
                  disciplinesOnly: true 
                })
                
                // Reload discipline map after API fetch
                const updatedMap = await StorageService.getDisciplineMap(projectId)
                console.log('DrawingsTab: Updated discipline map has', Object.keys(updatedMap).length, 'entries')
                setDisciplineMap(updatedMap)
              } catch (error) {
                console.error('DrawingsTab: Failed to fetch disciplines via API:', error)
              }
            }
            
            setIsScanning(false)
            setScanStatus(payload.status === 'timeout' ? 'Scan complete (timeout)' : 'Scan complete!')
            
            setTimeout(() => setScanStatus(null), 3000)
          }
        }
      }
      
      // Also refresh on DATA_SAVED
      if (message.type === 'DATA_SAVED') {
        const payload = message.payload as { type?: string; count?: number }
        if (payload.type === 'drawings') {
          console.log('DrawingsTab: DATA_SAVED received, reloading...')
          const [newDrawings, newMap] = await Promise.all([
            StorageService.getDrawings(projectId),
            StorageService.getDisciplineMap(projectId),
          ])
          console.log('DrawingsTab: Loaded', newDrawings.length, 'drawings from storage')
          setDrawings(newDrawings)
          setDisciplineMap(newMap)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    
    // While scanning, poll storage every 1.5 seconds as backup
    // (in case messages aren't being received)
    if (isScanning) {
      const pollStorage = async () => {
        const [newDrawings, newMap] = await Promise.all([
          StorageService.getDrawings(projectId),
          StorageService.getDisciplineMap(projectId),
        ])
        console.log('DrawingsTab: Polling storage, found', newDrawings.length, 'drawings')
        setDrawings(newDrawings)
        setDisciplineMap(newMap)
      }
      
      refreshInterval = setInterval(pollStorage, 1500)
      // Also poll immediately when starting
      pollStorage()
    }
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [projectId, isScanning])

  const filteredDrawings = useMemo(() => {
    if (!searchQuery.trim()) return drawings
    const query = searchQuery.toLowerCase()
    return drawings.filter(d => 
      d.num?.toLowerCase().includes(query) ||
      d.title?.toLowerCase().includes(query) ||
      d.discipline_name?.toLowerCase().includes(query)
    )
  }, [drawings, searchQuery])

  // Group drawings by discipline - matches v1 logic
  const groupedDrawings = useMemo(() => {
    const groups: Map<string, { drawings: Drawing[]; sortIndex: number }> = new Map()
    
    for (const drawing of filteredDrawings) {
      let disciplineName = 'General'
      let sortIndex = 9999
      
      // Check discipline object first (v1 style: discipline.id and discipline.name)
      if (drawing.discipline && typeof drawing.discipline === 'object') {
        const disc = drawing.discipline as { id?: number; name?: string }
        if (disc.id && disciplineMap[disc.id]) {
          // Look up in discipline map
          const mapEntry = disciplineMap[disc.id]
          disciplineName = mapEntry.name
          sortIndex = mapEntry.index ?? 9999
        } else if (disc.name) {
          // Use name from discipline object directly
          disciplineName = disc.name
        }
      } else if (typeof drawing.discipline === 'number' && disciplineMap[drawing.discipline]) {
        // Discipline is just an ID number
        const mapEntry = disciplineMap[drawing.discipline]
        disciplineName = mapEntry.name
        sortIndex = mapEntry.index ?? 9999
      }
      
      // Fallback to discipline_name if set
      if (disciplineName === 'General' && drawing.discipline_name) {
        disciplineName = drawing.discipline_name
      }
      
      if (!groups.has(disciplineName)) {
        groups.set(disciplineName, { drawings: [], sortIndex })
      }
      groups.get(disciplineName)!.drawings.push(drawing)
    }
    
    // Sort groups by sortIndex, then alphabetically
    return Array.from(groups.entries())
      .sort((a, b) => {
        if (a[1].sortIndex !== b[1].sortIndex) {
          return a[1].sortIndex - b[1].sortIndex
        }
        return a[0].localeCompare(b[0])
      })
      .map(([name, data]) => ({
        name,
        drawings: data.drawings.sort((a, b) => 
          (a.num || '').localeCompare(b.num || '', undefined, { numeric: true })
        )
      }))
  }, [filteredDrawings, disciplineMap])

  // Page-based scan: send message to content script to expand & scroll
  const handleScan = useCallback(async () => {
    setIsScanning(true)
    setScanStatus('Expanding disciplines...')
    setScanPercent(0)
    
    try {
      // Get active tab to send message to content script
      const tabResponse = await chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB' }) as { 
        tabId?: number
        isProcoreTab?: boolean 
      }
      
      if (!tabResponse?.isProcoreTab || !tabResponse.tabId) {
        setScanStatus('Error: Open Procore Drawings page first')
        setIsScanning(false)
        setTimeout(() => setScanStatus(null), 3000)
        return
      }

      // Send scan command to content script (don't await - progress updates come via messages)
      chrome.tabs.sendMessage(tabResponse.tabId, {
        action: 'PAGE_SCAN',
        scanType: 'drawings'
      }).then((result: { success: boolean; message: string }) => {
        if (!result.success) {
          setScanStatus(`Error: ${result.message}`)
          setIsScanning(false)
          setTimeout(() => setScanStatus(null), 3000)
        }
        // Success is handled by SCAN_PROGRESS messages
      }).catch((error) => {
        console.error('Scan command failed:', error)
        setScanStatus('Error: Could not connect to page')
        setIsScanning(false)
        setTimeout(() => setScanStatus(null), 3000)
      })
    } catch (error) {
      console.error('Scan failed:', error)
      setScanStatus('Error: Could not connect to page')
      setIsScanning(false)
      setTimeout(() => setScanStatus(null), 3000)
    }
  }, [])

  const handleDrawingClick = useCallback((drawing: Drawing) => {
    StorageService.getProject(projectId).then(project => {
      if (project?.drawingAreaId) {
        const url = `https://app.procore.com/${projectId}/project/drawing_areas/${project.drawingAreaId}/drawing_log/view_fullscreen/${drawing.id}`
        chrome.runtime.sendMessage({ action: 'OPEN_TAB', url, background: false })
      }
    })
  }, [projectId])

  const toggleDiscipline = useCallback((name: string) => {
    setExpandedDisciplines(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const toggleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedDisciplines(new Set())
    } else {
      setExpandedDisciplines(new Set(groupedDrawings.map(g => g.name)))
    }
    setAllExpanded(!allExpanded)
  }, [allExpanded, groupedDrawings])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Notifications */}
      {lastCaptureCount !== null && (
        <div className="px-3 py-2 bg-green-50 border-b border-green-200 text-sm text-green-700 flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span>Captured {lastCaptureCount} new drawing{lastCaptureCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      
      {scanStatus && (
        <div className={`px-3 py-2 border-b text-sm ${
          scanStatus.startsWith('Error') 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isScanning && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />}
            <span>{scanStatus}</span>
            {isScanning && <span className="ml-auto">{drawings.length} found</span>}
          </div>
          {isScanning && (
            <div className="w-full bg-blue-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${scanPercent}%` }}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Search and actions bar */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Filter drawings..."
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
                <span>{scanPercent}%</span>
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
        
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {filteredDrawings.length} of {drawings.length} drawings
          </span>
          <button
            onClick={toggleExpandAll}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span className={`transition-transform ${allExpanded ? 'rotate-180' : ''}`}>▼</span>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* List */}
      {drawings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 px-4">
          <p className="font-medium mb-2">No drawings found</p>
          <p className="text-sm text-center">
            Open the Drawings page in Procore,<br />
            then click <strong>Scan</strong> to capture data.
          </p>
        </div>
      ) : filteredDrawings.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No drawings match "{searchQuery}"
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {groupedDrawings.map(({ name, drawings: groupDrawings }) => {
            const isExpanded = expandedDisciplines.has(name) || searchQuery.trim() !== ''
            const colorClass = getDisciplineColor(name)
            
            return (
              <div key={name} className="border-b border-gray-100">
                {/* Discipline Header */}
                <button
                  onClick={() => toggleDiscipline(name)}
                  className="w-full px-3 py-2 flex items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <span className={`transition-transform text-xs text-gray-400 ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <span 
                    className={`w-5 h-5 rounded text-white text-xs font-bold flex items-center justify-center ${colorClass}`}
                    title={name}
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-sm text-gray-700 flex-1">
                    {name}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    {groupDrawings.length}
                  </span>
                </button>
                
                {/* Drawings in this discipline */}
                {isExpanded && (
                  <div className="bg-white">
                    {groupDrawings.map(drawing => (
                      <div
                        key={drawing.id}
                        onClick={() => handleDrawingClick(drawing)}
                        className="px-3 py-2 pl-10 border-b border-gray-50 hover:bg-blue-50 cursor-pointer flex items-center gap-2 group"
                      >
                        <span className="font-mono text-sm text-blue-600 font-medium min-w-[70px] group-hover:text-blue-800">
                          {drawing.num}
                        </span>
                        <span className="text-sm text-gray-600 truncate flex-1 group-hover:text-gray-800">
                          {drawing.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Footer stats */}
          <div className="px-3 py-2 text-xs text-gray-400 text-center bg-gray-50">
            {groupedDrawings.length} discipline{groupedDrawings.length !== 1 ? 's' : ''} • {drawings.length} total drawings
          </div>
        </div>
      )}
    </div>
  )
}
