import { useRef, useEffect, useState, type CSSProperties } from 'preact/compat'
import type { ComponentChild, VNode } from 'preact'
import { List } from 'react-window'

interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  renderItem: (item: T, index: number) => ComponentChild
  className?: string
}

// Cast List to any to avoid type conflicts between react-window and Preact
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VirtualList: any = List

export function VirtualizedList<T>({ 
  items, 
  itemHeight, 
  renderItem,
  className = '' 
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight
        // Ensure height is valid and positive
        if (height > 0 && height < 10000) {
          setContainerHeight(height)
        }
      }
    }

    // Initial height calculation with a small delay to ensure layout is ready
    requestAnimationFrame(() => {
      updateHeight()
    })
    
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateHeight)
    })
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Row renderer for react-window v2
  const Row = ({ index, style }: { index: number; style: CSSProperties }): VNode => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  )

  return (
    <div 
      ref={containerRef} 
      className={`flex-1 overflow-hidden ${className}`} 
      style={{ 
        position: 'relative', 
        zIndex: 1,
        contain: 'layout style paint',
        isolation: 'isolate',
        maxHeight: '100%',
        pointerEvents: 'auto'
      }}
    >
      {containerHeight > 0 && (
        <VirtualList
          height={containerHeight}
          count={items.length}
          itemSize={itemHeight}
          width="100%"
          style={{ 
            position: 'relative',
            maxHeight: '100%',
            overflow: 'hidden'
          }}
        >
          {Row}
        </VirtualList>
      )}
    </div>
  )
}
