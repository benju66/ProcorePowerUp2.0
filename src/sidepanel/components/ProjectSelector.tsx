import type { Project } from '@/types'

interface ProjectSelectorProps {
  projects: Project[]
  currentProjectId: string | null
  onProjectChange: (projectId: string) => void
}

export function ProjectSelector({ projects, currentProjectId, onProjectChange }: ProjectSelectorProps) {
  if (projects.length === 0) return null

  return (
    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2">
        <span className="text-amber-600 dark:text-amber-400 text-sm">🌐</span>
        <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Offline Mode</span>
      </div>
      <select
        value={currentProjectId ?? ''}
        onChange={(e) => onProjectChange(e.currentTarget.value)}
        className="mt-1 w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-700 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 text-gray-900 dark:text-gray-100"
      >
        <option value="">Select a project...</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name ?? `Project ${project.id}`}
          </option>
        ))}
      </select>
    </div>
  )
}
