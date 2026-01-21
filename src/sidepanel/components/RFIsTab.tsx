import { useState, useEffect, useMemo, useCallback } from 'preact/hooks'
import type { RFI } from '@/types'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { SearchInput } from './SearchInput'
import { Check, Loader2 } from 'lucide-preact'

interface RFIsTabProps {
  projectId: string
  dataVersion?: number
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
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanPercent, setScanPercent] = useState(0)
  const [lastCaptureCount, setLastCaptureCount] = useState<number | null>(null)

  useEffect(() => {
    async function loadData() {
      if (rfis.length === 0) {
        setIsLoading(true)
      }
      
      const cachedRFIs = await StorageService.getRFIs(projectId)
      
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

  // Listen for scan progress
  useEffect(() => {
    const handleMessage = async (message: { type: string; payload?: unknown }) => {
      if (message.type === 'SCAN_PROGRESS') {
        const payload = message.payload as { status: string; scanType: string; percent: number }
        if (payload.scanType === 'rfis') {
          setScanPercent(payload.percent)
          
          if (payload.status === 'complete' || payload.status === 'timeout') {
            setIsScanning(false)
            setScanStatus('Scan complete!')
            const newRFIs = await StorageService.getRFIs(projectId)
            setRFIs(newRFIs)
            setTimeout(() => setScanStatus(null), 3000)
          }
        }
      }
      
      if (message.type === 'DATA_SAVED' && isScanning) {
        const payload = message.payload as { type?: string }
        if (payload.type === 'rfis') {
          const newRFIs = await StorageService.getRFIs(projectId)
          setRFIs(newRFIs)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [projectId, isScanning])

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


  const handleRFIClick = useCallback(async (rfi: RFI) => {
    try {
      const openInBackground = await StorageService.getPreferences<boolean>(
        PREFERENCE_KEYS.openInBackground,
        false
      )
      const url = `https://app.procore.com/${projectId}/project/rfi/show/${rfi.id}`
      chrome.runtime.sendMessage({ 
        action: 'OPEN_TAB', 
        url, 
        background: openInBackground 
      })
    } catch (error) {
      console.error('Failed to open RFI:', error)
    }
  }, [projectId])

  const renderItem = useCallback((rfi: RFI) => {
    const statusClass = STATUS_COLORS[rfi.status?.toLowerCase()] || 'badge-gray'
    
    return (
      <div onClick={() => handleRFIClick(rfi)} className="list-item">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium">
            RFI #{rfi.number}
          </span>
          <span className={`badge ${statusClass}`}>
            {rfi.status}
          </span>
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {rfi.subject}
        </div>
        {rfi.assignee && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Assigned to: {rfi.assignee}
          </div>
        )}
      </div>
    )
  }, [handleRFIClick])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {lastCaptureCount !== null && (
        <div className="px-3 py-2 bg-green-50 border-b border-green-200 text-sm text-green-700 flex items-center gap-2">
          <Check size={16} className="text-green-500" />
          <span>Captured {lastCaptureCount} new RFI{lastCaptureCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      
      {scanStatus && (
        <div className={`px-3 py-2 border-b text-sm ${
          scanStatus.startsWith('Error') 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isScanning && <Loader2 size={12} className="animate-spin" />}
            <span>{scanStatus}</span>
            {isScanning && <span className="ml-auto">{rfis.length} found</span>}
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
      
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search RFIs..."
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{filteredRFIs.length} of {rfis.length} RFIs</span>
          <span>{rfis.filter(r => r.status?.toLowerCase() === 'open').length} open</span>
        </div>
      </div>

      {rfis.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <p className="mb-2">No RFIs cached</p>
          <p className="text-sm text-center px-4">
            Open the RFIs page in Procore,<br />
            then use Settings to scan and capture all RFIs.
          </p>
        </div>
      ) : filteredRFIs.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          No RFIs match your search
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filteredRFIs.map((rfi) => (
            <div key={rfi.id}>
              {renderItem(rfi)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
