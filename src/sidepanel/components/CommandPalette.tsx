import { useEffect, useRef } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { useCommandPalette, RFI_GROUP_KEY } from '../hooks/useCommandPalette'
import { getDisciplineColor } from '../utils/discipline'
import { Loader2, HelpCircle } from 'lucide-preact'
import type { CommandPaletteItem, Project } from '@/types'
import type { CommandPaletteDataProvider } from '@/types/command-palette'

// RFI status badge colors
const RFI_STATUS_COLORS: Record<string, string> = {
  'open': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'closed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'draft': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  'void': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

interface CommandPaletteProps {
  projectId: string | null
  dataProvider?: CommandPaletteDataProvider
  /**
   * Whether to use createPortal for rendering.
   * Set to false when rendering in Shadow DOM (overlay).
   * Defaults to true for side panel usage.
   */
  usePortal?: boolean
  /**
   * Initial open state. Set to true when rendering in overlay.
   * Defaults to false for side panel usage.
   */
  initialIsOpen?: boolean
  /**
   * Callback when the command palette closes.
   * Used by overlay to hide the container.
   */
  onClose?: () => void
  /**
   * List of available projects for the project switcher.
   * When provided with onProjectChange, shows a dropdown in the header.
   */
  availableProjects?: Project[]
  /**
   * Callback when user switches project in the palette.
   */
  onProjectChange?: (projectId: string) => void
}

export function CommandPalette({ 
  projectId, 
  dataProvider, 
  usePortal = true,
  initialIsOpen = false,
  onClose,
  availableProjects = [],
  onProjectChange,
}: CommandPaletteProps) {
  const {
    isOpen,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    searchResults,
    isSearching,
    open,
    close,
    handleKeyDown,
  } = useCommandPalette(projectId, dataProvider, { 
    defaultOpen: initialIsOpen,
    onClose,
  })

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 10)
    }
  }, [isOpen])

  // Listen for OPEN_COMMAND_PALETTE message from background script
  // (Kept for backward compatibility - Alt+P now triggers overlay, not side panel)
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'OPEN_COMMAND_PALETTE') {
        open()
      }
    }
    
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [open])

  // Handle keyboard events locally on the container to prevent Procore interference
  // This stops events from bubbling to Procore's document listeners which would
  // otherwise intercept arrow keys (page navigation) and potentially other keys
  const onContainerKeyDown = (e: KeyboardEvent) => {
    // CRITICAL: Stop ALL keyboard events from reaching Procore's document listeners
    // This prevents arrow keys from changing drawing pages and allows Backspace/Delete to work
    e.stopPropagation()

    // Handle navigation keys
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
      handleKeyDown(e)
    } 
    // Handle Enter for selection
    else if (e.key === 'Enter') {
      e.preventDefault()
      handleEnter()
    }
    // All other keys (typing, Backspace, Delete, etc.) proceed normally
    // but stopPropagation above ensures Procore doesn't intercept them
  }

  const handleResultClick = async (result: CommandPaletteItem) => {
    try {
      if (result.type === 'drawing') {
        // Use OPEN_DRAWING action - background script handles storage access
        // This works in both sidepanel and overlay contexts
        const response = await chrome.runtime.sendMessage({
          action: 'OPEN_DRAWING',
          projectId,
          drawingId: result.data.id,
          drawingNum: result.data.num,
        })
        
        if (response?.success) {
          close()
        } else {
          console.error('Failed to open drawing:', response?.error)
        }
      } else if (result.type === 'rfi') {
        // Open RFI using OPEN_TAB action (handles openInBackground preference internally)
        const url = `https://app.procore.com/${projectId}/project/rfi/show/${result.data.id}`
        await chrome.runtime.sendMessage({
          action: 'OPEN_TAB',
          url,
        })
        close()
      }
    } catch (error) {
      console.error('Failed to open item:', error)
    }
  }

  const handleEnter = () => {
    if (searchResults.length > 0 && selectedIndex >= 0 && selectedIndex < searchResults.length) {
      handleResultClick(searchResults[selectedIndex])
    } else if (searchResults.length > 0) {
      handleResultClick(searchResults[0])
    }
  }

  if (!isOpen) return null

  // Group results by discipline (for drawings) or RFI_GROUP_KEY (for RFIs)
  const groupedResults = new Map<string, CommandPaletteItem[]>()
  searchResults.forEach(r => {
    const groupKey = r.type === 'drawing' ? r.discipline : RFI_GROUP_KEY
    if (!groupedResults.has(groupKey)) {
      groupedResults.set(groupKey, [])
    }
    groupedResults.get(groupKey)!.push(r)
  })

  let resultIndex = 0

  // Get empty state message
  const getEmptyStateMessage = () => {
    if (!searchQuery.trim()) {
      return 'No recent drawings'
    }
    if (searchQuery.startsWith('?')) {
      return 'No RFIs found'
    }
    return 'No results found'
  }

  const paletteContent = (
    <div
      data-pp-overlay
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close()
        }
      }}
      onKeyDown={onContainerKeyDown as any}
    >
      <div className="w-full max-w-2xl max-h-[60vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Project Switcher (shown when multiple projects available) */}
        {availableProjects.length > 1 && onProjectChange && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Project</span>
            <select
              value={projectId || ''}
              onChange={(e) => {
                const newProjectId = e.currentTarget.value
                if (newProjectId) {
                  onProjectChange(newProjectId)
                  setSearchQuery('')
                }
              }}
              className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[200px] truncate"
            >
              {availableProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name || `Project ${p.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          placeholder="Jump to drawing or RFI... (? for RFIs, * favorites, @ discipline)"
          className="w-full px-4 py-3 text-base border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
          autoComplete="off"
        />

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <Loader2 className="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
              <span>Searching...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {getEmptyStateMessage()}
            </div>
          ) : (
            Array.from(groupedResults.entries()).map(([groupName, results]) => {
              const isRFIGroup = groupName === RFI_GROUP_KEY
              
              return (
                <div key={groupName} className="mb-3">
                  {/* Group header */}
                  <div className="px-2 py-1.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded mb-1">
                    {isRFIGroup ? (
                      // RFI group header with HelpCircle icon
                      <>
                        <span className="w-5 h-5 rounded bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                          <HelpCircle size={14} />
                        </span>
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                          RFIs
                        </span>
                      </>
                    ) : (
                      // Discipline header with colored tag
                      <>
                        <span 
                          className={`w-5 h-5 rounded text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${getDisciplineColor(groupName)}`}
                        >
                          {groupName.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                          {groupName}
                        </span>
                      </>
                    )}
                    {/* Result count badge */}
                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full ml-auto">
                      {results.length}
                    </span>
                  </div>
                  
                  <ul className="space-y-1">
                    {results.map(result => {
                      const index = resultIndex++
                      const isSelected = index === selectedIndex
                      
                      if (result.type === 'drawing') {
                        // Drawing row
                        return (
                          <li
                            key={`drawing-${result.data.id}-${index}`}
                            onClick={() => handleResultClick(result)}
                            className={`px-3 py-2 rounded cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium min-w-[70px]">
                              {result.data.num}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                              {result.data.title}
                            </span>
                            <div className="flex items-center gap-1">
                              {result.isFavorite && (
                                <span className="text-yellow-500 text-xs" title="Favorite">★</span>
                              )}
                              {result.isRecent && (
                                <span className="text-gray-400 dark:text-gray-500 text-xs" title="Recent">●</span>
                              )}
                            </div>
                          </li>
                        )
                      } else {
                        // RFI row
                        const statusClass = RFI_STATUS_COLORS[result.data.status?.toLowerCase()] || RFI_STATUS_COLORS['draft']
                        
                        return (
                          <li
                            key={`rfi-${result.data.id}-${index}`}
                            onClick={() => handleResultClick(result)}
                            className={`px-3 py-2 rounded cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {/* Status badge */}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusClass}`}>
                              {result.data.status}
                            </span>
                            {/* RFI number */}
                            <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium">
                              #{result.data.number}
                            </span>
                            {/* Subject */}
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                              {result.data.subject}
                            </span>
                          </li>
                        )
                      }
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span><b>?</b> RFIs</span>
            <span><b>@</b> Discipline</span>
            <span><b>*</b> Favorites</span>
          </div>
          <div className="flex items-center gap-4">
            <span><b>↑↓</b> Nav</span>
            <span><b>Enter</b> Open</span>
            <span><b>Esc</b> Close</span>
          </div>
        </div>
      </div>
    </div>
  )

  // Use portal for side panel, direct render for Shadow DOM overlay
  if (usePortal && typeof document !== 'undefined') {
    return createPortal(paletteContent, document.body)
  }
  
  // Direct render (for Shadow DOM overlay)
  return paletteContent
}
