import { useRef, useCallback, useEffect } from 'preact/hooks'

interface UseDragAutoScrollOptions {
  /**
   * Distance from edge (in pixels) to trigger auto-scroll
   * @default 50
   */
  threshold?: number
  /**
   * Scroll speed in pixels per frame
   * @default 5
   */
  scrollSpeed?: number
  /**
   * Whether auto-scroll is enabled
   * @default true
   */
  enabled?: boolean
}

/**
 * Hook to enable auto-scrolling when dragging near the edges of a scrollable container
 */
export function useDragAutoScroll(
  scrollContainerRef: { current: HTMLElement | null },
  options: UseDragAutoScrollOptions = {}
) {
  const {
    threshold = 50,
    scrollSpeed = 5,
    enabled = true,
  } = options

  const scrollIntervalRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current !== null) {
      cancelAnimationFrame(scrollIntervalRef.current)
      scrollIntervalRef.current = null
    }
    isDraggingRef.current = false
  }, [])

  const startAutoScroll = useCallback((direction: 'up' | 'down') => {
    if (!enabled || !scrollContainerRef.current) return

    const container = scrollContainerRef.current

    const scroll = () => {
      if (!isDraggingRef.current || !container) {
        stopAutoScroll()
        return
      }

      const scrollTop = container.scrollTop
      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight

      if (direction === 'up' && scrollTop > 0) {
        container.scrollTop = Math.max(0, scrollTop - scrollSpeed)
      } else if (direction === 'down' && scrollTop < scrollHeight - clientHeight) {
        container.scrollTop = Math.min(
          scrollHeight - clientHeight,
          scrollTop + scrollSpeed
        )
      } else {
        stopAutoScroll()
        return
      }

      scrollIntervalRef.current = requestAnimationFrame(scroll)
    }

    if (scrollIntervalRef.current === null) {
      isDraggingRef.current = true
      scrollIntervalRef.current = requestAnimationFrame(scroll)
    }
  }, [enabled, scrollContainerRef, scrollSpeed, stopAutoScroll])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!enabled || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const rect = container.getBoundingClientRect()
    const mouseY = e.clientY

    // Calculate distance from top and bottom edges
    const distanceFromTop = mouseY - rect.top
    const distanceFromBottom = rect.bottom - mouseY

    // Check if near edges
    if (distanceFromTop < threshold && distanceFromTop > 0) {
      // Near top edge - scroll up
      startAutoScroll('up')
    } else if (distanceFromBottom < threshold && distanceFromBottom > 0) {
      // Near bottom edge - scroll down
      startAutoScroll('down')
    } else {
      // Not near edges - stop scrolling
      stopAutoScroll()
    }
  }, [enabled, scrollContainerRef, threshold, startAutoScroll, stopAutoScroll])

  const handleDragEnd = useCallback(() => {
    stopAutoScroll()
  }, [stopAutoScroll])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoScroll()
    }
  }, [stopAutoScroll])

  return {
    handleDragOver,
    handleDragEnd,
    stopAutoScroll,
  }
}
