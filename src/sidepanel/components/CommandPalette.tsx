import { useEffect, useRef } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { useCommandPalette } from '../hooks/useCommandPalette'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import type { CommandPaletteResult } from '@/types'

interface CommandPaletteProps {
  projectId: string | null
}

export function CommandPalette({ projectId }: CommandPaletteProps) {
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
  } = useCommandPalette(projectId)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 10)
    }
  }, [isOpen])

  // Global keyboard shortcut (Alt+P)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      // Don't trigger in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      if (e.altKey && e.code === 'KeyP') {
        e.preventDefault()
        if (isOpen) {
          close()
        } else {
          open()
        }
      }
    }
    
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, open, close])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  const handleResultClick = async (result: CommandPaletteResult) => {
    try {
      const openInBackground = await StorageService.getPreferences<boolean>(
        PREFERENCE_KEYS.openInBackground,
        false
      )
      
      const project = await StorageService.getProject(projectId!)
      if (project?.drawingAreaId) {
        const url = `https://app.procore.com/${projectId}/project/drawing_areas/${project.drawingAreaId}/drawing_log/view_fullscreen/${result.drawing.id}`
        chrome.runtime.sendMessage({ 
          action: 'OPEN_TAB', 
          url, 
          background: openInBackground 
        })
        close()
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

  return createPortal(
    <div
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
              <div key={discipline} className="mb-4">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {discipline}
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
    </div>,
    document.body
  )
}
