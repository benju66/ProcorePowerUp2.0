import { useState, useRef } from 'preact/hooks'
import { Settings } from './Settings'
import { useMascot } from '../contexts/MascotContext'

interface HeaderProps {
  onPopOut: () => void
  currentProjectId?: string | null
}

export function Header({ onPopOut, currentProjectId }: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  
  // Get mascot state from context
  const { mood, animationLevel, triggerMood } = useMascot()

  // Calculate CSS class based on current mood and animation level
  const getMascotClass = () => {
    // Base tier class for CSS targeting
    const tierClass = `mascot-${animationLevel}`
    
    // If animations are off, only show static colors
    if (animationLevel === 'off') {
      switch (mood) {
        case 'happy':
        case 'super':
          return `${tierClass} text-yellow-500`
        case 'sleeping':
          return `${tierClass} text-yellow-500/60`
        default:
          return `${tierClass} text-gray-400 dark:text-gray-500`
      }
    }
    
    // Subtle and Normal tiers get animation classes
    switch (mood) {
      case 'happy': 
        return `${tierClass} animate-happy-zap text-yellow-500`
      case 'super': 
        return `${tierClass} animate-super-shimmer text-yellow-500`
      case 'sleeping': 
        return `${tierClass} animate-idle text-yellow-500/80`
      default: 
        return `${tierClass} text-gray-400 dark:text-gray-500 group-hover:text-yellow-500 transition-colors`
    }
  }

  return (
    <header className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative z-30">
      
      {/* ⚡ MASCOT ICON ⚡ */}
      <div 
        className="flex items-center gap-2 cursor-default group select-none"
        onMouseEnter={() => {
          // Only trigger hover animation if not in active animation
          if (mood !== 'happy' && mood !== 'super') {
            triggerMood('happy', 600)
          }
        }}
        title={mood === 'sleeping' ? "Zzz..." : "Procore Power-Up"}
      >
        <div className={`text-xl transition-all duration-300 ${getMascotClass()}`}>
          ⚡
        </div>
        <span className="font-bold text-sm text-gray-700 dark:text-gray-200 tracking-tight">
          Power-Up
        </span>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-1">
        <button
          ref={settingsButtonRef}
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Settings"
          aria-label="Settings"
          aria-expanded={settingsOpen}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        
        <button
          onClick={onPopOut}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Pop out to window"
          aria-label="Pop out to window"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        buttonRef={settingsButtonRef}
        currentProjectId={currentProjectId}
      />
    </header>
  )
}
