import type { StatusColor } from '@/types'

interface StatusDotProps {
  color: StatusColor | undefined
  onClick: () => void
  className?: string
}

const COLOR_CLASSES: Record<StatusColor, string> = {
  green: 'bg-green-500 border-green-600',
  red: 'bg-red-500 border-red-600',
  yellow: 'bg-yellow-500 border-yellow-600',
  blue: 'bg-blue-500 border-blue-600',
  orange: 'bg-orange-500 border-orange-600',
  pink: 'bg-pink-500 border-pink-600',
}

export function StatusDot({ color, onClick, className = '' }: StatusDotProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={`
        w-3.5 h-3.5 rounded-full border-2 cursor-pointer
        transition-all hover:scale-110 flex-shrink-0
        ${color ? COLOR_CLASSES[color] : 'bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 opacity-0 group-hover:opacity-100'}
        ${className}
      `}
      title="Click to cycle status color"
      aria-label="Status color"
    />
  )
}
