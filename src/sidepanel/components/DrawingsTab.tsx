import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks'
import type { Drawing, DisciplineMap, StatusColor } from '@/types'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { SearchInput } from './SearchInput'
import { StatusDot } from './StatusDot'
import { ContextMenu } from './ContextMenu'
import { RecentsSection } from './RecentsSection'
import { FavoritesSection } from './FavoritesSection'
import { focusTabBar } from './TabBar'
import { useStatusColors } from '../hooks/useStatusColors'
import { useRecents } from '../hooks/useRecents'
import { useFavorites } from '../hooks/useFavorites'
import { 
  focusFirst, 
  navigateToNext,
  findParentHeader
} from '../hooks/useKeyboardNavigation'
import { useDragAutoScroll } from '../hooks/useDragAutoScroll'
import { getDisciplineColor } from '../utils/discipline'

interface DrawingsTabProps {
  projectId: string
  dataVersion?: number
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
  const [activeDisciplineFilter, setActiveDisciplineFilter] = useState<string | null>(null)

  // Ref to scrollable container for drag auto-scroll and keyboard navigation
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll hook for drag and drop - attached at container level for full coverage
  const { handleDragOver: handleAutoScrollDragOver, handleDragEnd: handleAutoScrollDragEnd } = useDragAutoScroll(
    scrollContainerRef,
    { threshold: 50, scrollSpeed: 8, enabled: true }
  )

  // Global drag end handler to stop auto-scroll
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      handleAutoScrollDragEnd()
    }
    
    document.addEventListener('dragend', handleGlobalDragEnd)
    return () => {
      document.removeEventListener('dragend', handleGlobalDragEnd)
    }
  }, [handleAutoScrollDragEnd])

  // Status colors and recents hooks
  const { colors: statusColors, cycleColor } = useStatusColors(projectId)
  const { recents, addRecent } = useRecents(projectId)
  const { folders, addDrawingToFolder, getAllFavoriteDrawings } = useFavorites()
  
  // Debug logging
  useEffect(() => {
    console.log('[DrawingsTab] Folders:', folders)
    console.log('[DrawingsTab] Folders length:', folders?.length)
  }, [folders])
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; drawing: Drawing } | null>(null)

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

  // Helper to check if a drawing matches the search query
  const drawingMatchesSearch = useCallback((drawing: Drawing) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      drawing.num?.toLowerCase().includes(query) ||
      drawing.title?.toLowerCase().includes(query) ||
      drawing.discipline_name?.toLowerCase().includes(query)
    )
  }, [searchQuery])

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

  // Filter grouped drawings by active discipline filter
  const filteredGroupedDrawings = useMemo(() => {
    if (!activeDisciplineFilter) return groupedDrawings
    return groupedDrawings.filter(g => g.name === activeDisciplineFilter)
  }, [groupedDrawings, activeDisciplineFilter])


  const handleDrawingClick = useCallback(async (drawing: Drawing) => {
    try {
      // Add to recents first (optimistic update)
      if (drawing.num) {
        await addRecent(drawing.num)
      }
      
      const openInBackground = await StorageService.getPreferences<boolean>(
        PREFERENCE_KEYS.openInBackground,
        false
      )
      
      const project = await StorageService.getProject(projectId)
      if (project?.drawingAreaId) {
        const url = `https://app.procore.com/${projectId}/project/drawing_areas/${project.drawingAreaId}/drawing_log/view_fullscreen/${drawing.id}`
        chrome.runtime.sendMessage({ 
          action: 'OPEN_TAB', 
          url, 
          background: openInBackground 
        })
      }
    } catch (error) {
      console.error('Failed to open drawing:', error)
    }
  }, [projectId, addRecent])

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

  const toggleDisciplineFilter = useCallback((name: string) => {
    setActiveDisciplineFilter(prev => {
      if (prev === name) {
        return null // Clear filter if clicking same discipline
      }
      return name // Set filter to clicked discipline
    })
    setSearchQuery('') // Clear search when filtering
  }, [])

  const toggleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedDisciplines(new Set())
    } else {
      setExpandedDisciplines(new Set(filteredGroupedDrawings.map(g => g.name)))
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
        <div className="px-3 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <span className="text-green-500 dark:text-green-400">✓</span>
          <span>Captured {lastCaptureCount} new drawing{lastCaptureCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      
      {scanStatus && (
        <div className={`px-3 py-2 border-b text-sm ${
          scanStatus.startsWith('Error') 
            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' 
            : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isScanning && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />}
            <span>{scanStatus}</span>
            {isScanning && <span className="ml-auto">{drawings.length} found</span>}
          </div>
          {isScanning && (
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
              <div 
                className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${scanPercent}%` }}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Search bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={activeDisciplineFilter ? `Filtered: ${activeDisciplineFilter}` : 'Filter drawings...'}
              onArrowDown={() => {
                if (scrollContainerRef.current) {
                  focusFirst(scrollContainerRef.current)
                }
              }}
              onArrowUp={() => {
                focusTabBar()
              }}
            />
          </div>
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center justify-end">
          <button
            onClick={toggleExpandAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
          >
            <span className={`transition-transform ${allExpanded ? 'rotate-180' : ''}`}>▼</span>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* List */}
      {drawings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 px-4">
          <p className="font-medium mb-2">No drawings found</p>
          <p className="text-sm text-center">
            Open the Drawings page in Procore,<br />
            then use Settings to scan and capture data.
          </p>
        </div>
      ) : filteredDrawings.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          No drawings match "{searchQuery}"
        </div>
      ) : (
        <div 
          ref={scrollContainerRef} 
          className="flex-1 overflow-y-auto"
          onDragOverCapture={(e) => {
            // Auto-scroll during drag - uses capture phase to run before child handlers
            // This ensures scrolling works regardless of which element is under the cursor
            e.preventDefault()
            handleAutoScrollDragOver(e as DragEvent)
          }}
          onClick={(e) => {
            // Click-to-focus: Focus first element when clicking on non-interactive area
            const target = e.target as HTMLElement
            if (!target.closest('button, a, input, [data-focusable]')) {
              if (scrollContainerRef.current) {
                focusFirst(scrollContainerRef.current)
              }
            }
          }}
        >
          {/* Favorites Section - Always show, even when empty */}
          <FavoritesSection
            folders={folders || []}
            drawings={drawings}
            projectId={projectId}
            onDrawingClick={handleDrawingClick}
            scrollContainerRef={scrollContainerRef}
          />

          {/* Recents Section */}
          {recents.length > 0 && (
            <RecentsSection
              recents={recents}
              drawings={drawings}
              projectId={projectId}
              onDrawingClick={handleDrawingClick}
              scrollContainerRef={scrollContainerRef}
            />
          )}

          {/* Discipline Groups */}
          {filteredGroupedDrawings.map(({ name, drawings: groupDrawings }) => {
            const isExpanded = expandedDisciplines.has(name) || searchQuery.trim() !== ''
            const colorClass = getDisciplineColor(name)
            
            return (
              <div key={name} data-section className="border-b border-gray-100 dark:border-gray-700">
                {/* Discipline Header - STICKY */}
                <button
                  onClick={() => toggleDiscipline(name)}
                  className="sticky top-0 z-10 w-full px-3 py-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  tabIndex={0}
                  data-focusable
                  data-section-header
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    const target = e.currentTarget as HTMLElement
                    switch (e.key) {
                      case 'ArrowDown':
                        e.preventDefault()
                        if (scrollContainerRef.current) {
                          navigateToNext(scrollContainerRef.current, target, 'down')
                        }
                        break
                      case 'ArrowUp':
                        e.preventDefault()
                        if (scrollContainerRef.current) {
                          navigateToNext(scrollContainerRef.current, target, 'up')
                        }
                        break
                      case 'ArrowLeft':
                        e.preventDefault()
                        if (isExpanded) {
                          toggleDiscipline(name)
                        }
                        break
                      case 'ArrowRight':
                        e.preventDefault()
                        if (!isExpanded) {
                          toggleDiscipline(name)
                        }
                        break
                      case 'Enter':
                      case ' ':
                        e.preventDefault()
                        toggleDiscipline(name)
                        break
                    }
                  }}
                >
                  <span className={`transition-transform text-xs text-gray-400 dark:text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <span 
                    className={`w-5 h-5 rounded text-white text-xs font-bold flex items-center justify-center ${colorClass} cursor-pointer transition-transform hover:scale-110 hover:shadow-md ${
                      activeDisciplineFilter === name ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-1' : ''
                    }`}
                    title={activeDisciplineFilter === name ? `Filtered: ${name} (click to clear)` : `Click to filter: ${name}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleDisciplineFilter(name)
                    }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-sm text-gray-700 dark:text-gray-300 flex-1">
                    {name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {groupDrawings.length}
                  </span>
                </button>
                
                {/* Drawings in this discipline */}
                {isExpanded && (
                  <div className="bg-white dark:bg-gray-900">
                    {groupDrawings.map(drawing => {
                      const statusColor: StatusColor | undefined = statusColors[drawing.num]
                      const isFavorite = getAllFavoriteDrawings().has(drawing.num)
                      const rowColorClasses: Record<StatusColor, string> = {
                        green: 'bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500',
                        red: 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500',
                        yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-500',
                        blue: 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500',
                        orange: 'bg-orange-50 dark:bg-orange-900/20 border-l-2 border-orange-500',
                        pink: 'bg-pink-50 dark:bg-pink-900/20 border-l-2 border-pink-500',
                      }
                      
                      const matchesSearch = drawingMatchesSearch(drawing)
                      
                      return (
                        <div
                          key={drawing.id}
                          tabIndex={0}
                          data-focusable
                          draggable={true}
                          onDragStart={(e) => {
                            e.stopPropagation()
                            if (e.dataTransfer) {
                              e.dataTransfer.setData("text/plain", drawing.num)
                              e.dataTransfer.effectAllowed = "copy"
                            }
                          }}
                          onDragEnd={() => {
                            // Drag ended - auto-scroll will be handled by drop target
                          }}
                          onClick={() => handleDrawingClick(drawing)}
                          onKeyDown={(e) => {
                            const target = e.currentTarget as HTMLElement
                            switch (e.key) {
                              case 'Enter':
                                e.preventDefault()
                                handleDrawingClick(drawing)
                                break
                              case 'ArrowDown':
                                e.preventDefault()
                                if (scrollContainerRef.current) {
                                  navigateToNext(scrollContainerRef.current, target, 'down')
                                }
                                break
                              case 'ArrowUp':
                                e.preventDefault()
                                if (scrollContainerRef.current) {
                                  navigateToNext(scrollContainerRef.current, target, 'up')
                                }
                                break
                              case 'ArrowLeft':
                                e.preventDefault()
                                const parentHeader = findParentHeader(target)
                                if (parentHeader) {
                                  parentHeader.focus()
                                  parentHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                                }
                                break
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setContextMenu({ x: e.clientX, y: e.clientY, drawing })
                          }}
                          className={`drawing-row px-3 py-2 pl-10 border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center gap-2 group ${
                            statusColor ? rowColorClasses[statusColor] : ''
                          } ${searchQuery.trim() && !matchesSearch ? 'squeeze-out' : ''}`}
                        >
                          <StatusDot
                            color={statusColor}
                            onClick={() => cycleColor(drawing.num)}
                            className="mr-1"
                          />
                          <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium min-w-[70px] group-hover:text-blue-800 dark:group-hover:text-blue-300">
                            {drawing.num}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 group-hover:text-gray-800 dark:group-hover:text-gray-100">
                            {drawing.title}
                          </span>
                          {isFavorite && (
                            <span className="text-yellow-500 dark:text-yellow-400 text-xs" title="In favorites">
                              ★
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Footer stats */}
          <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 text-center bg-gray-50 dark:bg-gray-800">
            {filteredDrawings.length} of {drawings.length} drawings
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <div className="py-1">
            {folders.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                No folders. Create one in Settings.
              </div>
            ) : (
              folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={async () => {
                    await addDrawingToFolder(folder.id, contextMenu.drawing.num)
                    setContextMenu(null)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="text-yellow-500">📁</span>
                  <span>{folder.name}</span>
                  {folder.drawings.includes(contextMenu.drawing.num) && (
                    <span className="ml-auto text-xs text-gray-400">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </ContextMenu>
      )}
    </div>
  )
}
