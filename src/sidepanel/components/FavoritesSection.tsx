import { useState, useCallback, useEffect } from 'preact/hooks'
import type { Drawing, FavoriteFolder, StatusColor } from '@/types'
import { StatusDot } from './StatusDot'
import { FolderInput } from './FolderInput'
import { useStatusColors } from '../hooks/useStatusColors'
import { useFavorites } from '../hooks/useFavorites'
import { navigateToNext, findParentHeader } from '../hooks/useKeyboardNavigation'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { Star, Folder, ChevronRight, Plus, X, GripVertical } from 'lucide-preact'

// @dnd-kit imports for drag-and-drop reordering
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface FavoritesSectionProps {
  folders: FavoriteFolder[]
  drawings: Drawing[]
  projectId: string
  onDrawingClick: (drawing: Drawing) => void
  scrollContainerRef?: { current: HTMLElement | null }
}

export function FavoritesSection({ folders, drawings, projectId, onDrawingClick, scrollContainerRef }: FavoritesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)
  const [showFolderInput, setShowFolderInput] = useState(false)
  const { colors: statusColors, cycleColor } = useStatusColors(projectId)
  const { addDrawingToFolder, removeDrawingFromFolder, removeFolder, addFolder, reorderFolders } = useFavorites()

  // Ensure folders is always an array (defensive check)
  const safeFolders = folders || []

  // Configure sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end - reorder folders
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const folderIds = safeFolders.map(f => f.id)
      const oldIndex = folderIds.indexOf(active.id as number)
      const newIndex = folderIds.indexOf(over.id as number)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(folderIds, oldIndex, newIndex)
        reorderFolders(newOrder)
      }
    }
  }, [safeFolders, reorderFolders])

  // Load persisted expanded state
  useEffect(() => {
    async function loadExpandedState() {
      const expanded = await StorageService.getPreferences<boolean>(
        PREFERENCE_KEYS.favoritesExpanded,
        false // Default to collapsed
      )
      setIsExpanded(expanded)
    }
    loadExpandedState()
  }, [])

  // Save expanded state when it changes
  useEffect(() => {
    StorageService.savePreference(PREFERENCE_KEYS.favoritesExpanded, isExpanded)
  }, [isExpanded])
  
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
    <div className="border-b border-gray-200 dark:border-gray-700" data-testid="favorites-section" data-section>
      <div className="flex items-center bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 px-3 py-2 flex items-center gap-2 text-left"
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
          <ChevronRight
            size={16}
            className={`transition-transform text-gray-400 dark:text-gray-500 ${isExpanded ? 'rotate-90' : ''}`}
          />
          <Star size={16} />
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
            className="px-2 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="New Folder"
          >
            <Plus size={16} />
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
        <div className="bg-white dark:bg-gray-900">
          {safeFolders.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
              No folders yet. Click the + button above or create one in Settings.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={safeFolders.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {safeFolders.map(folder => (
                  <SortableFolderItem
                    key={folder.id}
                    folder={folder}
                    drawings={drawings}
                    expandedFolders={expandedFolders}
                    dragOverFolderId={dragOverFolderId}
                    statusColors={statusColors}
                    scrollContainerRef={scrollContainerRef}
                    onToggleFolder={toggleFolder}
                    onRemoveFolder={handleRemoveFolder}
                    onRemoveFromFolder={handleRemoveFromFolder}
                    onDrawingClick={onDrawingClick}
                    onCycleColor={cycleColor}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverFolderId(folder.id)
                    }}
                    onDragLeave={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const mouseY = e.clientY
                      if (mouseY < rect.top || mouseY > rect.bottom) {
                        setDragOverFolderId(null)
                      }
                    }}
                    onDragEnd={() => setDragOverFolderId(null)}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverFolderId(null)
                      const drawingNum = e.dataTransfer?.getData("text/plain")
                      if (drawingNum) {
                        const success = await addDrawingToFolder(folder.id, drawingNum)
                        if (success) {
                          setExpandedFolders(prev => {
                            const next = new Set(prev)
                            next.add(folder.id)
                            return next
                          })
                        }
                      }
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>

          )}
        </div>
      )}
    </div>
  )
}

// Sortable folder item component
interface SortableFolderItemProps {
  folder: FavoriteFolder
  drawings: Drawing[]
  expandedFolders: Set<number>
  dragOverFolderId: number | null
  statusColors: Record<string, StatusColor>
  scrollContainerRef?: { current: HTMLElement | null }
  onToggleFolder: (folderId: number) => void
  onRemoveFolder: (e: Event, folderId: number) => void
  onRemoveFromFolder: (e: Event, folderId: number, drawingNum: string) => void
  onDrawingClick: (drawing: Drawing) => void
  onCycleColor: (drawingNum: string) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDragEnd: () => void
  onDrop: (e: DragEvent) => void
}

function SortableFolderItem({
  folder,
  drawings,
  expandedFolders,
  dragOverFolderId,
  statusColors,
  scrollContainerRef,
  onToggleFolder,
  onRemoveFolder,
  onRemoveFromFolder,
  onDrawingClick,
  onCycleColor,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
}: SortableFolderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Cast attributes and listeners for Preact compatibility
  const dragHandleProps = {
    ...(attributes as unknown as Record<string, unknown>),
    ...(listeners as unknown as Record<string, unknown>),
  }

  const folderDrawings = folder.drawings
    .map(num => drawings.find(d => d.num === num))
    .filter((d): d is Drawing => d !== undefined)
  const isFolderExpanded = expandedFolders.has(folder.id)

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
      ref={setNodeRef}
      style={style}
      data-section
      className={`border-b border-gray-100 dark:border-gray-800 ${isDragging ? 'z-50 bg-white dark:bg-gray-800 shadow-lg' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Folder Header */}
      <div
        className={`px-3 py-2 flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group ${
          dragOverFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500 dark:border-blue-400' : ''
        }`}
      >
        {/* Drag Handle */}
        <button
          type="button"
          className="p-0.5 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
          {...dragHandleProps}
        >
          <GripVertical size={14} />
        </button>
        
        <button
          onClick={() => onToggleFolder(folder.id)}
          className="flex items-center gap-2 flex-1 text-left"
          tabIndex={0}
          data-focusable
          data-section-header
          aria-expanded={isFolderExpanded}
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
                if (isFolderExpanded) {
                  onToggleFolder(folder.id)
                } else {
                  const parentHeader = findParentHeader(target)
                  if (parentHeader) {
                    parentHeader.focus()
                    parentHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                  }
                }
                break
              case 'ArrowRight':
                e.preventDefault()
                if (!isFolderExpanded) {
                  onToggleFolder(folder.id)
                }
                break
              case 'Enter':
              case ' ':
                e.preventDefault()
                onToggleFolder(folder.id)
                break
            }
          }}
        >
          <ChevronRight
            size={16}
            className={`transition-transform text-gray-400 dark:text-gray-500 ${isFolderExpanded ? 'rotate-90' : ''}`}
          />
          <Folder size={16} className="text-yellow-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {folder.name}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {folder.drawings.length}
          </span>
        </button>
        <button
          onClick={(e) => onRemoveFolder(e, folder.id)}
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
                    onClick={() => onCycleColor(drawing.num)}
                    className="mr-1"
                  />
                  <span className="font-mono text-sm text-blue-600 dark:text-blue-400 font-medium min-w-[70px] group-hover:text-blue-800 dark:group-hover:text-blue-300">
                    {drawing.num}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 group-hover:text-gray-800 dark:group-hover:text-gray-100">
                    {drawing.title}
                  </span>
                  <button
                    onClick={(e) => onRemoveFromFolder(e, folder.id, drawing.num)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2"
                    title="Remove from folder"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
