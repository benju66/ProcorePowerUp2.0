import { useState, useEffect, useMemo, useCallback } from 'preact/hooks'
import type { Commitment } from '@/types'
import { StorageService, ApiService } from '@/services'
import { SearchInput } from './SearchInput'
import { VirtualizedList } from './VirtualizedList'

interface CostTabProps {
  projectId: string
  dataVersion?: number  // Increment to trigger refresh from wiretap data
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

export function CostTab({ projectId, dataVersion = 0 }: CostTabProps) {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [lastCaptureCount, setLastCaptureCount] = useState<number | null>(null)

  // Load cached data - triggers on projectId change OR dataVersion change (wiretap updates)
  useEffect(() => {
    async function loadData() {
      if (commitments.length === 0) {
        setIsLoading(true)
      }
      
      const cached = await StorageService.getCommitments(projectId)
      
      // Show capture notification if count increased due to wiretap
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

  // Filter commitments based on search
  const filteredCommitments = useMemo(() => {
    if (!searchQuery.trim()) return commitments
    
    const query = searchQuery.toLowerCase()
    return commitments.filter(c => 
      c.number?.toLowerCase().includes(query) ||
      c.title?.toLowerCase().includes(query) ||
      c.vendor_name?.toLowerCase().includes(query) ||
      c.vendor?.toLowerCase().includes(query)
    )
  }, [commitments, searchQuery])

  // Calculate totals
  const totals = useMemo(() => {
    return commitments.reduce((acc, c) => ({
      approved: acc.approved + (c.approved_amount ?? 0),
      pending: acc.pending + (c.pending_amount ?? 0),
      draft: acc.draft + (c.draft_amount ?? 0),
    }), { approved: 0, pending: 0, draft: 0 })
  }, [commitments])

  const handleScan = useCallback(async () => {
    setIsScanning(true)
    
    try {
      const newCommitments = await ApiService.fetchCommitments(projectId)
      const merged = await StorageService.mergeCommitments(projectId, newCommitments)
      setCommitments(merged)
    } catch (error) {
      console.error('Commitments scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }, [projectId])

  const handleCommitmentClick = useCallback((commitment: Commitment) => {
    const url = `https://app.procore.com/${projectId}/project/contracts/commitments/${commitment.id}`
    chrome.runtime.sendMessage({ action: 'OPEN_TAB', url, background: false })
  }, [projectId])

  const renderItem = useCallback((commitment: Commitment) => {
    return (
      <div
        onClick={() => handleCommitmentClick(commitment)}
        className="list-item"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-sm text-blue-600 font-medium">
            #{commitment.number}
          </span>
          {commitment.approved_amount !== undefined && (
            <span className="text-sm font-medium text-green-600">
              {formatCurrency(commitment.approved_amount)}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-700 truncate">
          {commitment.title}
        </div>
        {(commitment.vendor_name || commitment.vendor) && (
          <div className="text-xs text-gray-500 mt-0.5">
            {commitment.vendor_name || commitment.vendor}
          </div>
        )}
      </div>
    )
  }, [handleCommitmentClick])

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
          <span>Captured {lastCaptureCount} new commitment{lastCaptureCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      
      {/* Summary cards */}
      {commitments.length > 0 && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-white border-b border-gray-200">
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-xs text-green-600 font-medium">Approved</div>
            <div className="text-sm font-bold text-green-700">{formatCurrency(totals.approved)}</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded-lg">
            <div className="text-xs text-yellow-600 font-medium">Pending</div>
            <div className="text-sm font-bold text-yellow-700">{formatCurrency(totals.pending)}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-600 font-medium">Draft</div>
            <div className="text-sm font-bold text-gray-700">{formatCurrency(totals.draft)}</div>
          </div>
        </div>
      )}

      {/* Search and actions bar */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search commitments..."
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
                <span>Scanning...</span>
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
        <div className="text-xs text-gray-500">
          {filteredCommitments.length} of {commitments.length} commitments
        </div>
      </div>

      {/* List */}
      {commitments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <p className="mb-2">No commitments cached</p>
          <p className="text-sm text-center px-4">
            Browse the Commitments page in Procore to auto-capture,<br />
            or click Scan to fetch directly.
          </p>
        </div>
      ) : filteredCommitments.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No commitments match your search
        </div>
      ) : (
        <VirtualizedList
          items={filteredCommitments}
          itemHeight={72}
          renderItem={renderItem}
        />
      )}
    </div>
  )
}
