import { useState, useEffect, useMemo, useCallback } from 'preact/hooks'
import type { RFI } from '@/types'
import { StorageService, ApiService } from '@/services'
import { SearchInput } from './SearchInput'
import { VirtualizedList } from './VirtualizedList'

interface RFIsTabProps {
  projectId: string
  dataVersion?: number  // Increment to trigger refresh from wiretap data
}

const STATUS_COLORS: Record<string, string> = {
  'open': 'badge-yellow',
  'draft': 'badge-gray',
  'closed': 'badge-green',
  'void': 'badge-red',
}

export function RFIsTab({ projectId, dataVersion = 0 }: RFIsTabProps) {
  const [rfis, setRFIs] = useState<RFI[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ loaded: number; total: number | null } | null>(null)
  const [lastCaptureCount, setLastCaptureCount] = useState<number | null>(null)

  // Load cached data - triggers on projectId change OR dataVersion change (wiretap updates)
  useEffect(() => {
    async function loadData() {
      if (rfis.length === 0) {
        setIsLoading(true)
      }
      
      const cachedRFIs = await StorageService.getRFIs(projectId)
      
      // Show capture notification if count increased due to wiretap
      if (dataVersion > 0 && cachedRFIs.length > rfis.length) {
        const newCount = cachedRFIs.length - rfis.length
        setLastCaptureCount(newCount)
        setTimeout(() => setLastCaptureCount(null), 3000)
      }
      
      setRFIs(cachedRFIs)
      setIsLoading(false)
    }
    loadData()
  }, [projectId, dataVersion])

  // Filter RFIs based on search
  const filteredRFIs = useMemo(() => {
    if (!searchQuery.trim()) return rfis
    
    const query = searchQuery.toLowerCase()
    return rfis.filter(r => 
      r.number?.toLowerCase().includes(query) ||
      r.subject?.toLowerCase().includes(query) ||
      r.status?.toLowerCase().includes(query) ||
      r.assignee?.toLowerCase().includes(query)
    )
  }, [rfis, searchQuery])

  const handleScan = useCallback(async () => {
    setIsScanning(true)
    setScanProgress({ loaded: 0, total: null })
    
    try {
      const newRFIs = await ApiService.fetchRFIs(projectId, {
        onProgress: (loaded, total) => setScanProgress({ loaded, total }),
      })
      
      const merged = await StorageService.mergeRFIs(projectId, newRFIs)
      setRFIs(merged)
    } catch (error) {
      console.error('RFI scan failed:', error)
    } finally {
      setIsScanning(false)
      setScanProgress(null)
    }
  }, [projectId])

  const handleRFIClick = useCallback((rfi: RFI) => {
    const url = `https://app.procore.com/${projectId}/project/rfi/show/${rfi.id}`
    chrome.runtime.sendMessage({ action: 'OPEN_TAB', url, background: false })
  }, [projectId])

  const renderItem = useCallback((rfi: RFI) => {
    const statusClass = STATUS_COLORS[rfi.status?.toLowerCase()] || 'badge-gray'
    
    return (
      <div
        onClick={() => handleRFIClick(rfi)}
        className="list-item"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm text-blue-600 font-medium">
            RFI #{rfi.number}
          </span>
          <span className={`badge ${statusClass}`}>
            {rfi.status}
          </span>
        </div>
        <div className="text-sm text-gray-700 truncate">
          {rfi.subject}
        </div>
        {rfi.assignee && (
          <div className="text-xs text-gray-500 mt-0.5">
            Assigned to: {rfi.assignee}
          </div>
        )}
      </div>
    )
  }, [handleRFIClick])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Passive capture notification */}
      {lastCaptureCount !== null && (
        <div className="px-3 py-2 bg-green-50 border-b border-green-200 text-sm text-green-700 flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span>Captured {lastCaptureCount} new RFI{lastCaptureCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      
      {/* Search and actions bar */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search RFIs..."
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
          <span>{filteredRFIs.length} of {rfis.length} RFIs</span>
          <span>
            {rfis.filter(r => r.status?.toLowerCase() === 'open').length} open
          </span>
        </div>
      </div>

      {/* List */}
      {rfis.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <p className="mb-2">No RFIs cached</p>
          <p className="text-sm text-center px-4">
            Browse the RFIs page in Procore to auto-capture,<br />
            or click Scan to fetch directly.
          </p>
        </div>
      ) : filteredRFIs.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No RFIs match your search
        </div>
      ) : (
        <VirtualizedList
          items={filteredRFIs}
          itemHeight={72}
          renderItem={renderItem}
        />
      )}
    </div>
  )
}
