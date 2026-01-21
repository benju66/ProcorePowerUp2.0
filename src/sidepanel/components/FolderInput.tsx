import { useState, useEffect, useRef } from 'preact/hooks'
import { X } from 'lucide-preact'

interface FolderInputProps {
  onSubmit: (name: string) => void
  onCancel: () => void
}

export function FolderInput({ onSubmit, onCancel }: FolderInputProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input on mount
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 10)
  }, [])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (trimmed) {
      onSubmit(trimmed)
      setName('')
    } else {
      onCancel()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 animate-slide-down">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter folder name..."
        maxLength={50}
        className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-gray-100"
      />
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        title="Cancel (Esc)"
      >
        <X size={16} />
      </button>
    </div>
  )
}
