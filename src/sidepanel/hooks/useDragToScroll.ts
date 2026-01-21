/**
 * useDragToScroll Hook
 * 
 * Enables click-and-drag horizontal scrolling for a container.
 * Distinguishes between clicks and drags using a movement threshold.
 */

import { useRef, useCallback } from 'preact/hooks'

interface UseDragToScrollOptions {
  /**
   * Movement threshold in pixels to distinguish drag from click
   * @default 3
   */
  threshold?: number
  /**
   * Scroll speed multiplier
   * @default 1.5
   */
  speedMultiplier?: number
}

export function useDragToScroll(
  containerRef: { current: HTMLElement | null },
  options: UseDragToScrollOptions = {}
) {
  const { threshold = 3, speedMultiplier = 1.5 } = options
  
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const hasDragged = useRef(false)

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return
    
    isDragging.current = true
    hasDragged.current = false
    startX.current = e.pageX - containerRef.current.offsetLeft
    scrollLeft.current = containerRef.current.scrollLeft
    containerRef.current.style.cursor = 'grabbing'
    containerRef.current.style.userSelect = 'none'
  }, [containerRef])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startX.current) * speedMultiplier
    
    // If moved more than threshold, it's a drag not a click
    if (Math.abs(x - startX.current) > threshold) {
      hasDragged.current = true
    }
    
    containerRef.current.scrollLeft = scrollLeft.current - walk
  }, [containerRef, speedMultiplier, threshold])

  const onMouseUp = useCallback(() => {
    if (!containerRef.current) return
    
    isDragging.current = false
    containerRef.current.style.cursor = 'grab'
    containerRef.current.style.userSelect = ''
  }, [containerRef])

  const onMouseLeave = useCallback(() => {
    if (!containerRef.current) return
    
    if (isDragging.current) {
      isDragging.current = false
      containerRef.current.style.cursor = 'grab'
      containerRef.current.style.userSelect = ''
    }
  }, [containerRef])

  /**
   * Call this in button onClick to prevent activation during drag
   * Returns true if the click should be prevented (was a drag)
   */
  const shouldPreventClick = useCallback(() => {
    return hasDragged.current
  }, [])

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    shouldPreventClick,
  }
}
