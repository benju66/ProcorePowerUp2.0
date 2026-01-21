import { useState, useEffect, useMemo, useCallback } from 'preact/hooks'
import type { Commitment } from '@/types'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { SearchInput } from './SearchInput'
import { Check, Loader2 } from 'lucide-preact'

interface CostTabProps {
  projectId: string
  dataVersion?: number
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Determine the URL path type for a commitment based on its type field or number prefix.
 * Procore uses different URL paths for different commitment types:
 * - Purchase Orders: /purchase_order_contracts/
 * - Work Orders/Subcontracts: /work_order_contracts/
 */
function getCommitmentUrlType(commitment: Commitment): string {
  const type = commitment.type?.toLowerCase() || ''
  const number = commitment.number?.toUpperCase() || ''
  
  // Check type field first (API may return values like 'PurchaseOrderContract', 'WorkOrderContract')
  if (type.includes('purchase') || type.includes('purchaseorder')) {
    return 'purchase_order_contracts'
  }
  if (type.includes('work') || type.includes('subcontract') || type.includes('workorder')) {
    return 'work_order_contracts'
  }
  
  // Fallback: check commitment number prefix
  if (number.startsWith('PO-') || number.startsWith('PO ')) {
    return 'purchase_order_contracts'
  }
  if (number.startsWith('WO-') || number.startsWith('SC-') || number.startsWith('SUB-')) {
    return 'work_order_contracts'
  }
  
  // Default to purchase order contracts
  return 'purchase_order_contracts'
}

export function CostTab({ projectId, dataVersion = 0 }: CostTabProps) {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [scanPercent, setScanPercent] = useState(0)
  const [lastCaptureCount, setLastCaptureCount] = useState<number | null>(null)

  useEffect(() => {
    async function loadData() {
      if (commitments.length === 0) {
        setIsLoading(true)
      }
      
      const cached = await StorageService.getCommitments(projectId)
      
      if (dataVersion > 0 && cached.length > commitments.length) {
        const newCount = cached.length - commitments.length
        setLastCaptureCount(newCount)
        setTimeout(() => setLastCaptureCount(null), 3000)
      }
      
      setCommitments(cached)
      setIsLoading(false)
    }
    loadData()
  }, [projectId, dataVersion])

  // Listen for scan progress
  useEffect(() => {
    const handleMessage = async (message: { type: string; payload?: unknown }) => {
      if (message.type === 'SCAN_PROGRESS') {
        const payload = message.payload as { status: string; scanType: string; percent: number }
        if (payload.scanType === 'commitments') {
          setScanPercent(payload.percent)
          
          if (payload.status === 'complete' || payload.status === 'timeout') {
            setIsScanning(false)
            setScanStatus('Scan complete!')
            const newCommitments = await StorageService.getCommitments(projectId)
            setCommitments(newCommitments)
            setTimeout(() => setScanStatus(null), 3000)
          }
        }
      }
      
      if (message.type === 'DATA_SAVED' && isScanning) {
        const payload = message.payload as { type?: string }
        if (payload.type === 'commitments') {
          const newCommitments = await StorageService.getCommitments(projectId)
          setCommitments(newCommitments)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [projectId, isScanning])

  const filteredCommitments = useMemo(() => {
    if (!searchQuery.trim()) return commitments
    const query = searchQuery.toLowerCase()
    return commitments.filter(c => {
      // Handle vendor which might be a string or object from Procore API
      const vendorStr = typeof c.vendor === 'string' ? c.vendor : 
        (c.vendor && typeof c.vendor === 'object' ? (c.vendor as { name?: string }).name : undefined)
      
      return (
        c.number?.toLowerCase().includes(query) ||
        c.title?.toLowerCase().includes(query) ||
        c.vendor_name?.toLowerCase().includes(query) ||
        vendorStr?.toLowerCase().includes(query)
      )
    })
  }, [commitments, searchQuery])

  // TODO: Future enhancement - Calculate and display commitment totals
  // Currently disabled because the Procore API data captured via wiretap
  // doesn't reliably include the approved_amount, pending_amount, and draft_amount fields.
  // To re-enable, uncomment the totals calculation and the corresponding JSX section below.
  // const totals = useMemo(() => {
  //   return commitments.reduce((acc, c) => ({
  //     approved: acc.approved + (c.approved_amount ?? 0),
  //     pending: acc.pending + (c.pending_amount ?? 0),
  //     draft: acc.draft + (c.draft_amount ?? 0),
  //   }), { approved: 0, pending: 0, draft: 0 })
  // }, [commitments])


  const handleCommitmentClick = useCallback(async (commitment: Commitment) => {
    try {
      const openInBackground = await StorageService.getPreferences<boolean>(
        PREFERENCE_KEYS.openInBackground,
        false
      )
      // Use correct Procore URL format with commitment type
      const commitmentType = getCommitmentUrlType(commitment)
      const url = `https://app.procore.com/${projectId}/project/contracts/commitments/${commitmentType}/${commitment.id}`
      chrome.runtime.sendMessage({ 
        action: 'OPEN_TAB', 
        url, 
        background: openInBackground 
      })
    } catch (error) {
      console.error('Failed to open commitment:', error)
    }
  }, [projectId])

  const renderItem = useCallback((commitment: Commitment) => {
    return (
      <div onClick={() => handleCommitmentClick(commitment)} className="list-item">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium">
            #{commitment.number}
          </span>
          {commitment.approved_amount !== undefined && (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {formatCurrency(commitment.approved_amount)}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
          {commitment.title}
        </div>
        {(commitment.vendor_name || commitment.vendor) && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {commitment.vendor_name || commitment.vendor}
          </div>
        )}
      </div>
    )
  }, [handleCommitmentClick])

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
        <div className="px-3 py-2 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <Check size={16} className="text-green-500 dark:text-green-400" />
          <span>Captured {lastCaptureCount} new commitment{lastCaptureCount !== 1 ? 's' : ''}</span>
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
            {isScanning && <span className="ml-auto">{commitments.length} found</span>}
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
      
      {/* TODO: Future enhancement - Commitment totals display
          Currently disabled - see comment above for details.
      {commitments.length > 0 && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">Approved</div>
            <div className="text-sm font-bold text-green-700 dark:text-green-300">{formatCurrency(totals.approved)}</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
            <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Pending</div>
            <div className="text-sm font-bold text-yellow-700 dark:text-yellow-300">{formatCurrency(totals.pending)}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Draft</div>
            <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatCurrency(totals.draft)}</div>
          </div>
        </div>
      )}
      */}

      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search commitments..."
            />
          </div>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {filteredCommitments.length} of {commitments.length} commitments
        </div>
      </div>

      {commitments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <p className="mb-2">No commitments cached</p>
          <p className="text-sm text-center px-4">
            Open the Commitments page in Procore,<br />
            then use Settings to scan and capture all commitments.
          </p>
        </div>
      ) : filteredCommitments.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          No commitments match your search
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filteredCommitments.map((commitment) => (
            <div key={commitment.id}>
              {renderItem(commitment)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
