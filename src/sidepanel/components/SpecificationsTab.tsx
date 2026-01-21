/**
 * SpecificationsTab Component
 * 
 * Displays specifications grouped by division (similar to DrawingsTab with disciplines).
 * Simple implementation without favorites or status colors (like RFIsTab).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks'
import type { Specification, DivisionMap } from '@/types'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { SearchInput } from './SearchInput'
import { focusTabBar } from './TabBar'
import { 
  focusFirst, 
  navigateToNext,
  findParentHeader
} from '../hooks/useKeyboardNavigation'
import { ChevronRight, ChevronDown, Loader2, FileText } from 'lucide-preact'

interface SpecificationsTabProps {
  projectId: string
  dataVersion?: number
}

export function SpecificationsTab({ projectId, dataVersion = 0 }: SpecificationsTabProps) {
  const [specifications, setSpecifications] = useState<Specification[]>([])
  const [divisionMap, setDivisionMap] = useState<DivisionMap>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanPercent, setScanPercent] = useState(0)
  const [lastCaptureCount, setLastCaptureCount] = useState<number | null>(null)
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  // Ref to scrollable container for keyboard navigation
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Load cached data
  useEffect(() => {
    async function loadData() {
      if (specifications.length === 0) {
        setIsLoading(true)
      }
      
      const [cachedSpecifications, cachedMap] = await Promise.all([
        StorageService.getSpecifications(projectId),
        StorageService.getDivisionMap(projectId),
      ])
      
      console.log('SpecificationsTab: Loaded', cachedSpecifications.length, 'specifications,', Object.keys(cachedMap).length, 'divisions in map')
      
      if (dataVersion > 0 && cachedSpecifications.length > specifications.length) {
        const newCount = cachedSpecifications.length - specifications.length
        setLastCaptureCount(newCount)
        setTimeout(() => setLastCaptureCount(null), 3000)
      }
      
      setSpecifications(cachedSpecifications)
      setDivisionMap(cachedMap)
      setIsLoading(false)
    }
    loadData()
  }, [projectId, dataVersion])

  // Listen for scan progress updates
  useEffect(() => {
    let refreshInterval: ReturnType<typeof setInterval> | null = null
    
    const handleMessage = async (message: { type: string; payload?: unknown }) => {
      console.log('SpecificationsTab received message:', message.type, message.payload)
      
      if (message.type === 'SCAN_PROGRESS') {
        const payload = message.payload as { status: string; scanType: string; percent: number; message?: string }
        if (payload.scanType === 'specifications') {
          setScanPercent(payload.percent)
          setScanStatus(payload.message || `Scanning... ${payload.percent}%`)
          
          if (payload.status === 'complete' || payload.status === 'timeout') {
            if (refreshInterval) {
              clearInterval(refreshInterval)
              refreshInterval = null
            }
            
            const [newSpecifications, newMap] = await Promise.all([
              StorageService.getSpecifications(projectId),
              StorageService.getDivisionMap(projectId),
            ])
            console.log('SpecificationsTab: Final load -', newSpecifications.length, 'specifications,', Object.keys(newMap).length, 'divisions')
            setSpecifications(newSpecifications)
            setDivisionMap(newMap)
            
            setIsScanning(false)
            setScanStatus(payload.status === 'timeout' ? 'Scan complete (timeout)' : 'Scan complete!')
            
            setTimeout(() => setScanStatus(null), 3000)
          }
        }
      }
      
      if (message.type === 'DATA_SAVED') {
        const payload = message.payload as { type?: string; count?: number }
        if (payload.type === 'specifications' || payload.type === 'divisions') {
          console.log('SpecificationsTab: DATA_SAVED received, reloading...')
          const [newSpecifications, newMap] = await Promise.all([
            StorageService.getSpecifications(projectId),
            StorageService.getDivisionMap(projectId),
          ])
          console.log('SpecificationsTab: Loaded', newSpecifications.length, 'specifications from storage')
          setSpecifications(newSpecifications)
          setDivisionMap(newMap)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    
    if (isScanning) {
      const pollStorage = async () => {
        const [newSpecifications, newMap] = await Promise.all([
          StorageService.getSpecifications(projectId),
          StorageService.getDivisionMap(projectId),
        ])
        console.log('SpecificationsTab: Polling storage, found', newSpecifications.length, 'specifications')
        setSpecifications(newSpecifications)
        setDivisionMap(newMap)
      }
      
      refreshInterval = setInterval(pollStorage, 1500)
      pollStorage()
    }
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [projectId, isScanning])

  // Filter specifications by search query
  const filteredSpecifications = useMemo(() => {
    if (!searchQuery.trim()) return specifications

    const query = searchQuery.toLowerCase()
    return specifications.filter(spec => 
      spec.number?.toLowerCase().includes(query) ||
      spec.title?.toLowerCase().includes(query)
    )
  }, [specifications, searchQuery])

  // Group specifications by division
  const groupedSpecifications = useMemo(() => {
    const groups: Map<string, { specifications: Specification[]; sortIndex: number; displayName: string }> = new Map()
    
    for (const spec of filteredSpecifications) {
      const divisionId = spec.divisionId || 'unknown'
      let displayName = 'Unknown Division'
      let sortIndex = 9999
      
      if (divisionId !== 'unknown' && divisionMap[divisionId]) {
        const division = divisionMap[divisionId]
        displayName = division.displayName
        sortIndex = division.index
      }
      
      if (!groups.has(divisionId)) {
        groups.set(divisionId, { specifications: [], sortIndex, displayName })
      }
      groups.get(divisionId)!.specifications.push(spec)
    }
    
    // Sort groups by index, then alphabetically
    return Array.from(groups.entries())
      .sort((a, b) => {
        if (a[1].sortIndex !== b[1].sortIndex) {
          return a[1].sortIndex - b[1].sortIndex
        }
        return a[1].displayName.localeCompare(b[1].displayName)
      })
      .map(([divisionId, data]) => ({
        divisionId,
        displayName: data.displayName,
        specifications: data.specifications.sort((a, b) => 
          (a.number || '').localeCompare(b.number || '', undefined, { numeric: true })
        )
      }))
  }, [filteredSpecifications, divisionMap])

  const handleSpecificationClick = useCallback(async (specification: Specification) => {
    try {
      const openInBackground = await StorageService.getPreferences<boolean>(
        PREFERENCE_KEYS.openInBackground,
        false
      )
      
      // URL format: /{projectId}/project/specification_section_revisions/{id}?open_viewer=true&mfe_view=true
      const url = `https://app.procore.com/${projectId}/project/specification_section_revisions/${specification.id}?open_viewer=true&mfe_view=true`
      
      chrome.runtime.sendMessage({ 
        action: 'OPEN_TAB', 
        url, 
        background: openInBackground 
      })
    } catch (error) {
      console.error('Failed to open specification:', error)
    }
  }, [projectId])

  const toggleDivision = useCallback((divisionId: string) => {
    setExpandedDivisions(prev => {
      const next = new Set(prev)
      if (next.has(divisionId)) {
        next.delete(divisionId)
      } else {
        next.add(divisionId)
      }
      return next
    })
  }, [])

  const toggleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedDivisions(new Set())
    } else {
      setExpandedDivisions(new Set(groupedSpecifications.map(g => g.divisionId)))
    }
    setAllExpanded(!allExpanded)
  }, [allExpanded, groupedSpecifications])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Notifications */}
      {lastCaptureCount !== null && (
        <div className="px-3 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <span className="text-green-500 dark:text-green-400">✓</span>
          <span>Captured {lastCaptureCount} new specification{lastCaptureCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      
      {scanStatus && (
        <div className={`px-3 py-2 border-b text-sm ${
          scanStatus.startsWith('Error') 
            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' 
            : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isScanning && <Loader2 size={12} className="animate-spin" />}
            <span>{scanStatus}</span>
            {isScanning && <span className="ml-auto">{specifications.length} found</span>}
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
              placeholder="Search specifications..."
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
            <ChevronDown size={14} className={`transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* List */}
      {specifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 px-4">
          <FileText size={48} className="mb-4 opacity-50" />
          <p className="font-medium mb-2">No specifications found</p>
          <p className="text-sm text-center">
            Open the Specifications page in Procore,<br />
            then use Settings to scan and capture data.
          </p>
        </div>
      ) : filteredSpecifications.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          No specifications match "{searchQuery}"
        </div>
      ) : (
        <div 
          ref={scrollContainerRef} 
          className="flex-1 overflow-y-auto"
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (!target.closest('button, a, input, [data-focusable]')) {
              if (scrollContainerRef.current) {
                focusFirst(scrollContainerRef.current)
              }
            }
          }}
        >
          {/* Division Groups */}
          {groupedSpecifications.map(({ divisionId, displayName, specifications: groupSpecs }) => {
            const isExpanded = expandedDivisions.has(divisionId) || searchQuery.trim() !== ''
            
            return (
              <div key={divisionId} data-section className="border-b border-gray-100 dark:border-gray-700">
                {/* Division Header - STICKY */}
                <button
                  onClick={() => toggleDivision(divisionId)}
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
                          toggleDivision(divisionId)
                        }
                        break
                      case 'ArrowRight':
                        e.preventDefault()
                        if (!isExpanded) {
                          toggleDivision(divisionId)
                        }
                        break
                      case 'Enter':
                      case ' ':
                        e.preventDefault()
                        toggleDivision(divisionId)
                        break
                    }
                  }}
                >
                  <ChevronRight
                    size={16}
                    className={`transition-transform text-gray-400 dark:text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <FileText size={16} className="text-blue-500" />
                  <span className="font-medium text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {groupSpecs.length}
                  </span>
                </button>
                
                {/* Specifications in this division */}
                {isExpanded && (
                  <div className="bg-white dark:bg-gray-900">
                    {groupSpecs.map(spec => (
                      <div
                        key={spec.id}
                        tabIndex={0}
                        data-focusable
                        onClick={() => handleSpecificationClick(spec)}
                        onKeyDown={(e) => {
                          const target = e.currentTarget as HTMLElement
                          switch (e.key) {
                            case 'Enter':
                              e.preventDefault()
                              handleSpecificationClick(spec)
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
                        className="px-3 py-2 pl-10 border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center gap-2 group"
                      >
                        <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium min-w-[70px] group-hover:text-blue-800 dark:group-hover:text-blue-300">
                          {spec.number}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 group-hover:text-gray-800 dark:group-hover:text-gray-100">
                          {spec.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Footer stats */}
          <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 text-center bg-gray-50 dark:bg-gray-800">
            {filteredSpecifications.length} of {specifications.length} specifications
          </div>
        </div>
      )}
    </div>
  )
}
