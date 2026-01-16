import { useEffect, useRef } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { useCommandPalette } from '../hooks/useCommandPalette'
import { getDisciplineColor } from '../utils/discipline'
import type { CommandPaletteResult } from '@/types'
import type { CommandPaletteDataProvider } from '@/types/command-palette'

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
}

export function CommandPalette({ 
  projectId, 
  dataProvider, 
  usePortal = true,
  initialIsOpen = false,
  onClose,
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

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  const handleResultClick = async (result: CommandPaletteResult) => {
    try {
      // Use OPEN_DRAWING action - background script handles storage access
      // This works in both sidepanel and overlay contexts
      const response = await chrome.runtime.sendMessage({
        action: 'OPEN_DRAWING',
        projectId,
        drawingId: result.drawing.id,
      })
      
      if (response?.success) {
        close()
      } else {
        console.error('Failed to open drawing:', response?.error)
      }
    } catch (error) {
      console.error('Failed to open drawing:', error)
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

  // Group results by discipline
  const groupedResults = new Map<string, CommandPaletteResult[]>()
  searchResults.forEach(r => {
    if (!groupedResults.has(r.discipline)) {
      groupedResults.set(r.discipline, [])
    }
    groupedResults.get(r.discipline)!.push(r)
  })

  let resultIndex = 0

  const paletteContent = (
    <div
      data-pp-overlay
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleEnter()
        }
      }}
    >
      <div className="w-full max-w-2xl max-h-[60vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          placeholder="Jump to drawing... (Type to search, * for favorites, @ for discipline)"
          className="w-full px-4 py-3 text-base border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
          autoComplete="off"
        />

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400 mr-2" />
              <span>Searching...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchQuery.trim() ? 'No drawings found' : 'No recent drawings'}
            </div>
          ) : (
            Array.from(groupedResults.entries()).map(([discipline, results]) => (
              <div key={discipline} className="mb-3">
                {/* Discipline header with colored tag - matches v2 sidebar style */}
                <div className="px-2 py-1.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded mb-1">
                  {/* Colored discipline tag with first letter */}
                  <span 
                    className={`w-5 h-5 rounded text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${getDisciplineColor(discipline)}`}
                  >
                    {discipline.charAt(0).toUpperCase()}
                  </span>
                  {/* Discipline name */}
                  <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    {discipline}
                  </span>
                  {/* Result count badge */}
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full ml-auto">
                    {results.length}
                  </span>
                </div>
                <ul className="space-y-1">
                  {results.map(result => {
                    const index = resultIndex++
                    const isSelected = index === selectedIndex
                    
                    return (
                      <li
                        key={`${result.drawing.id}-${index}`}
                        onClick={() => handleResultClick(result)}
                        className={`px-3 py-2 rounded cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium min-w-[70px]">
                          {result.drawing.num}
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                          {result.drawing.title}
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
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
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
