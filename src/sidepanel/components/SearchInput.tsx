import { Search, X } from 'lucide-preact'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onArrowDown?: () => void
  onArrowUp?: () => void
}

export function SearchInput({ value, onChange, placeholder = 'Search...', onArrowDown, onArrowUp }: SearchInputProps) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
      />
      <input
        type="text"
        value={value}
        onInput={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && onArrowDown) {
            e.preventDefault()
            onArrowDown()
          }
          if (e.key === 'ArrowUp' && onArrowUp) {
            e.preventDefault()
            onArrowUp()
          }
        }}
        placeholder={placeholder}
        className="search-input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:ring-blue-400"
        data-search-input
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
