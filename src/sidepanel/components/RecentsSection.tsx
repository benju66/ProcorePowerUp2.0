import { useState, useEffect } from 'preact/hooks'
import type { Drawing, StatusColor } from '@/types'
import { StatusDot } from './StatusDot'
import { useStatusColors } from '../hooks/useStatusColors'
import { navigateToNext, findParentHeader } from '../hooks/useKeyboardNavigation'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'

interface RecentsSectionProps {
  recents: string[]
  drawings: Drawing[]
  projectId: string
  onDrawingClick: (drawing: Drawing) => void
  scrollContainerRef?: { current: HTMLElement | null }
}

export function RecentsSection({ recents, drawings, projectId, onDrawingClick, scrollContainerRef }: RecentsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { colors: statusColors, cycleColor } = useStatusColors(projectId)

  // Load persisted expanded state
  useEffect(() => {
    async function loadExpandedState() {
      const expanded = await StorageService.getPreferences<boolean>(
        PREFERENCE_KEYS.recentsExpanded,
        false // Default to collapsed
      )
      setIsExpanded(expanded)
    }
    loadExpandedState()
  }, [])

  // Save expanded state when it changes
  useEffect(() => {
    StorageService.savePreference(PREFERENCE_KEYS.recentsExpanded, isExpanded)
  }, [isExpanded])

  // Get drawing objects for recent numbers
  const recentDrawings = recents
    .map(num => drawings.find(d => d.num === num))
    .filter((d): d is Drawing => d !== undefined)

  // Hide section if no recents (like v1)
  if (recentDrawings.length === 0) return null

  return (
    <div data-section className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
        tabIndex={0}
        data-focusable
        data-section-header
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          const target = e.currentTarget as HTMLElement
          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault()
              if (scrollContainerRef?.current) {
                navigateToNext(scrollContainerRef.current, target, 'down')
              }
              break
            case 'ArrowUp':
              e.preventDefault()
              if (scrollContainerRef?.current) {
                navigateToNext(scrollContainerRef.current, target, 'up')
              }
              break
            case 'ArrowLeft':
              e.preventDefault()
              if (isExpanded) {
                setIsExpanded(false)
              }
              break
            case 'ArrowRight':
              e.preventDefault()
              if (!isExpanded) {
                setIsExpanded(true)
              }
              break
            case 'Enter':
            case ' ':
              e.preventDefault()
              setIsExpanded(!isExpanded)
              break
          }
        }}
      >
        <span className={`transition-transform text-xs text-gray-400 dark:text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        <span className="text-base">🕒</span>
        <span className="font-medium text-sm text-gray-700 dark:text-gray-300 flex-1">
          Recent
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          {recentDrawings.length}
        </span>
      </button>

      {isExpanded && (
        <div className="bg-white dark:bg-gray-900">
          {recentDrawings.map(drawing => {
            const statusColor: StatusColor | undefined = statusColors[drawing.num]
            const rowColorClasses: Record<StatusColor, string> = {
              green: 'bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500',
              red: 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500',
              yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-500',
              blue: 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500',
              orange: 'bg-orange-50 dark:bg-orange-900/20 border-l-2 border-orange-500',
              pink: 'bg-pink-50 dark:bg-pink-900/20 border-l-2 border-pink-500',
            }

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
                onClick={() => onDrawingClick(drawing)}
                onKeyDown={(e) => {
                  const target = e.currentTarget as HTMLElement
                  switch (e.key) {
                    case 'Enter':
                      e.preventDefault()
                      onDrawingClick(drawing)
                      break
                    case 'ArrowDown':
                      e.preventDefault()
                      if (scrollContainerRef?.current) {
                        navigateToNext(scrollContainerRef.current, target, 'down')
                      }
                      break
                    case 'ArrowUp':
                      e.preventDefault()
                      if (scrollContainerRef?.current) {
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
                className={`drawing-row px-3 py-2 pl-10 border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center gap-2 group ${
                  statusColor ? rowColorClasses[statusColor] : ''
                }`}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
