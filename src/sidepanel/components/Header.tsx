interface HeaderProps {
  onPopOut: () => void
}

export function Header({ onPopOut }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚡</span>
        <h1 className="text-lg font-semibold text-gray-900">Power-Up</h1>
        <span className="text-xs text-gray-400 font-mono">2.0</span>
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={onPopOut}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title="Pop out to window"
          aria-label="Pop out to window"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
    </header>
  )
}
