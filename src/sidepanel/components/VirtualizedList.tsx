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
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    updateHeight()
    
    const observer = new ResizeObserver(updateHeight)
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
    <div ref={containerRef} className={`flex-1 overflow-hidden ${className}`}>
      <VirtualList
        height={containerHeight}
        count={items.length}
        itemSize={itemHeight}
        width="100%"
      >
        {Row}
      </VirtualList>
    </div>
  )
}
