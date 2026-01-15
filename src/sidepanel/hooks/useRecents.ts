import { useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import type { RecentsList } from '@/types'

export function useRecents(projectId: string | null) {
  const [recents, setRecents] = useState<RecentsList>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load recents when project changes
  useEffect(() => {
    async function loadRecents() {
      if (!projectId) {
        setRecents([])
        setIsLoading(false)
        return
      }
      
      setIsLoading(true)
      const loaded = await StorageService.getRecents(projectId)
      setRecents(loaded)
      setIsLoading(false)
    }
    
    loadRecents()
  }, [projectId])

  const addRecent = useCallback(async (drawingNum: string) => {
    if (!projectId || !drawingNum) return
    
    // Optimistically update
    const current = recents.filter(num => num !== drawingNum)
    const updated = [drawingNum, ...current].slice(0, 5)
    setRecents(updated)
    
    // Persist to storage
    await StorageService.addRecent(projectId, drawingNum)
  }, [projectId, recents])

  return { recents, addRecent, isLoading }
}
