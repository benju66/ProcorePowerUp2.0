import { useState } from 'preact/hooks'
import type { Project } from '@/types'
import { StorageService } from '@/services'
import { Globe, Pencil, Trash2, Check, X, Loader2 } from 'lucide-preact'

interface ProjectSelectorProps {
  projects: Project[]
  currentProjectId: string | null
  onProjectChange: (projectId: string) => void
  onProjectUpdated?: () => void
  onProjectDeleted?: (projectId: string) => Promise<void>
}

export function ProjectSelector({ projects, currentProjectId, onProjectChange, onProjectUpdated, onProjectDeleted }: ProjectSelectorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (projects.length === 0) return null

  const activeProject = projects.find(p => p.id === currentProjectId)

  const handleStartEdit = () => {
    setEditName(activeProject?.name || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    const trimmed = editName.trim()
    if (!currentProjectId || !trimmed) return

    setIsSaving(true)
    try {
      await StorageService.updateProjectAccess(currentProjectId, { name: trimmed })
      onProjectUpdated?.()
    } catch (error) {
      console.error('Failed to save project name:', error)
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditName('')
  }

  const handleDelete = async () => {
    if (!currentProjectId || !onProjectDeleted) return
    
    const displayName = activeProject?.name || `Project ${currentProjectId}`
    if (!confirm(`Delete "${displayName}"? This will remove all cached drawings, RFIs, and settings.`)) {
      return
    }
    
    setIsDeleting(true)
    try {
      await onProjectDeleted(currentProjectId)
    } catch (error) {
      console.error('Failed to delete project:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2">
        <Globe size={14} className="text-amber-600 dark:text-amber-400" />
        <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Offline Mode</span>
      </div>
      
      {isEditing ? (
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={editName}
            onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter project name..."
            autoFocus
            className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-700 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={handleSave}
            disabled={isSaving || !editName.trim()}
            className="px-2 py-1 text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-md transition-colors"
            title="Save"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
            title="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="mt-1 flex gap-2">
          <select
            value={currentProjectId ?? ''}
            onChange={(e) => onProjectChange(e.currentTarget.value)}
            className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-700 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 text-gray-900 dark:text-gray-100"
          >
            <option value="">Select a project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name ?? `Project ${project.id}`}
              </option>
            ))}
          </select>
          {currentProjectId && (
            <>
              <button
                onClick={handleStartEdit}
                className="px-2 py-1 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-md transition-colors"
                title="Rename project"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2 py-1 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors disabled:opacity-50"
                title="Delete project"
              >
                {isDeleting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
