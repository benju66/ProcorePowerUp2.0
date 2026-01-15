import { useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import type { StatusColor, DrawingStatusColors } from '@/types'

export function useStatusColors(projectId: string | null) {
  const [colors, setColors] = useState<DrawingStatusColors>({})
  const [isLoading, setIsLoading] = useState(true)

  // Load colors when project changes
  useEffect(() => {
    async function loadColors() {
      if (!projectId) {
        setColors({})
        setIsLoading(false)
        return
      }
      
      setIsLoading(true)
      const loaded = await StorageService.getStatusColors(projectId)
      setColors(loaded)
      setIsLoading(false)
    }
    
    loadColors()
  }, [projectId])

  // Cycle color: green -> red -> yellow -> blue -> orange -> pink -> (remove)
  const cycleColor = useCallback(async (drawingNum: string) => {
    if (!projectId || !drawingNum) return

    const colorOrder: StatusColor[] = ['green', 'red', 'yellow', 'blue', 'orange', 'pink']
    const current = colors[drawingNum]
    const currentIndex = current ? colorOrder.indexOf(current) : -1
    const nextIndex = currentIndex < colorOrder.length - 1 ? currentIndex + 1 : -1
    const nextColor = nextIndex >= 0 ? colorOrder[nextIndex] : null

    // Optimistically update UI
    const updated = { ...colors }
    if (nextColor) {
      updated[drawingNum] = nextColor
    } else {
      delete updated[drawingNum]
    }
    setColors(updated)

    // Persist to storage
    await StorageService.setDrawingStatusColor(projectId, drawingNum, nextColor)
  }, [projectId, colors])

  return { colors, cycleColor, isLoading }
}
