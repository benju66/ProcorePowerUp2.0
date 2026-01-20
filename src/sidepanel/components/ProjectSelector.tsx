import { useState } from 'preact/hooks'
import type { Project } from '@/types'
import { StorageService } from '@/services'

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
        <span className="text-amber-600 dark:text-amber-400 text-sm">🌐</span>
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
            {isSaving ? '...' : '✓'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-md transition-colors"
            title="Cancel"
          >
            ✕
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2 py-1 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors disabled:opacity-50"
                title="Delete project"
              >
                {isDeleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
