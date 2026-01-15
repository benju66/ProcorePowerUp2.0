import { useState, useCallback, useEffect, useRef } from 'preact/hooks'
import type { Drawing, FavoriteFolder, StatusColor } from '@/types'
import { StatusDot } from './StatusDot'
import { FolderInput } from './FolderInput'
import { useStatusColors } from '../hooks/useStatusColors'
import { useFavorites } from '../hooks/useFavorites'
import { useDragAutoScroll } from '../hooks/useDragAutoScroll'

interface FavoritesSectionProps {
  folders: FavoriteFolder[]
  drawings: Drawing[]
  projectId: string
  onDrawingClick: (drawing: Drawing) => void
  scrollContainerRef?: { current: HTMLElement | null }
}

export function FavoritesSection({ folders, drawings, projectId, onDrawingClick, scrollContainerRef }: FavoritesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)
  const [showFolderInput, setShowFolderInput] = useState(false)
  const { colors: statusColors, cycleColor } = useStatusColors(projectId)
  const { addDrawingToFolder, removeDrawingFromFolder, removeFolder, addFolder } = useFavorites()

  // Ensure folders is always an array (defensive check)
  const safeFolders = folders || []
  
  // Auto-scroll hook for drag and drop
  const defaultScrollRef = useRef<HTMLElement | null>(null)
  const effectiveScrollRef = scrollContainerRef || defaultScrollRef
  const { handleDragOver: handleAutoScrollDragOver, handleDragEnd: handleAutoScrollDragEnd } = useDragAutoScroll(
    effectiveScrollRef,
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
  
  // Debug logging
  useEffect(() => {
    console.log('[FavoritesSection] Rendering with folders:', safeFolders)
    console.log('[FavoritesSection] Folders count:', safeFolders.length)
  }, [safeFolders])

  const toggleFolder = useCallback((folderId: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  const handleRemoveFromFolder = useCallback(async (e: Event, folderId: number, drawingNum: string) => {
    e.preventDefault()
    e.stopPropagation()
    await removeDrawingFromFolder(folderId, drawingNum)
  }, [removeDrawingFromFolder])

  const handleRemoveFolder = useCallback(async (e: Event, folderId: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm('Delete this folder? Drawings will remain but folder will be removed.')) {
      await removeFolder(folderId)
    }
  }, [removeFolder])

  const handleFolderSubmit = useCallback(async (name: string) => {
    try {
      await addFolder(name)
      setShowFolderInput(false)
      // Auto-expand the section when a folder is created
      setIsExpanded(true)
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }, [addFolder])

  // Always render the favorites section header, even when empty
  return (
    <div className="border-b border-gray-200 dark:border-gray-700" data-testid="favorites-section">
      <div className="flex items-center bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 px-3 py-2 flex items-center gap-2 text-left"
        >
          <span className={`transition-transform text-xs text-gray-400 dark:text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className="text-base">⭐</span>
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300 flex-1">
            Favorites
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {safeFolders.length}
          </span>
        </button>
        {!showFolderInput && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowFolderInput(true)
              setIsExpanded(true)
            }}
            className="px-2 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
            title="New Folder"
          >
            +
          </button>
        )}
      </div>

      {showFolderInput && (
        <FolderInput
          onSubmit={handleFolderSubmit}
          onCancel={() => setShowFolderInput(false)}
        />
      )}

      {isExpanded && (
        <div 
          className="bg-white dark:bg-gray-900"
          onDragOver={(e) => {
            // Enable auto-scroll when dragging anywhere in the favorites section
            e.preventDefault()
            handleAutoScrollDragOver(e as DragEvent)
          }}
        >
          {safeFolders.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
              No folders yet. Click the + button above or create one in Settings.
            </div>
          ) : (
            safeFolders.map(folder => {
            const folderDrawings = folder.drawings
              .map(num => drawings.find(d => d.num === num))
              .filter((d): d is Drawing => d !== undefined)
            const isFolderExpanded = expandedFolders.has(folder.id)

            return (
              <div
                key={folder.id}
                className="border-b border-gray-100 dark:border-gray-800"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOverFolderId(folder.id)
                  // Enable auto-scroll when dragging over folder
                  handleAutoScrollDragOver(e as DragEvent)
                }}
                onDragLeave={(e) => {
                  // Only clear drag state if actually leaving the folder element
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const mouseY = e.clientY
                  if (mouseY < rect.top || mouseY > rect.bottom) {
                    setDragOverFolderId(null)
                  }
                }}
                onDragEnd={() => {
                  handleAutoScrollDragEnd()
                  setDragOverFolderId(null)
                }}
                onDrop={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAutoScrollDragEnd()
                  setDragOverFolderId(null)
                  const drawingNum = e.dataTransfer?.getData("text/plain")
                  if (drawingNum) {
                    const success = await addDrawingToFolder(folder.id, drawingNum)
                    if (success) {
                      // Auto-expand folder when drawing is added
                      setExpandedFolders(prev => {
                        const next = new Set(prev)
                        next.add(folder.id)
                        return next
                      })
                    }
                  }
                }}
              >
                {/* Folder Header */}
                <div
                  className={`px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group ${
                    dragOverFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500 dark:border-blue-400' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <span className={`transition-transform text-xs text-gray-400 dark:text-gray-500 ${isFolderExpanded ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    <span className="text-yellow-500">📁</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {folder.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {folder.drawings.length}
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleRemoveFolder(e, folder.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs px-2"
                    title="Delete folder"
                  >
                    ×
                  </button>
                </div>

                {/* Folder Drawings */}
                {isFolderExpanded && (
                  <div className="bg-gray-50 dark:bg-gray-900">
                    {folderDrawings.length === 0 ? (
                      <div className="px-3 py-2 pl-10 text-xs text-gray-400 dark:text-gray-500">
                        Empty folder. Drag drawings here or use right-click menu.
                      </div>
                    ) : (
                      folderDrawings.map(drawing => {
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
                            onClick={() => onDrawingClick(drawing)}
                            className={`px-3 py-2 pl-10 border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center gap-2 group ${
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
                            <button
                              onClick={(e) => handleRemoveFromFolder(e, folder.id, drawing.num)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs px-2"
                              title="Remove from folder"
                            >
                              ×
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          }))}
        </div>
      )}
    </div>
  )
}
