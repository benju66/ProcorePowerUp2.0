import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { Settings } from './Settings'

interface HeaderProps {
  onPopOut: () => void
  currentProjectId?: string | null
}

type MascotMood = 'idle' | 'happy' | 'super' | 'sleeping'

export function Header({ onPopOut, currentProjectId }: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  
  // Mascot State
  const [mood, setMood] = useState<MascotMood>('idle')
  const idleTimerRef = useRef<number | null>(null)
  const moodRef = useRef<MascotMood>('idle') // Track current mood for priority checks
  
  // Keep moodRef in sync
  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  // Trigger mood animation with priority handling
  const triggerMood = useCallback((newMood: MascotMood, duration: number) => {
    // Don't interrupt super shimmer with lower priority animations
    // Use ref to get current value without causing re-renders
    if (moodRef.current === 'super' && newMood === 'happy') {
      return
    }
    
    setMood(newMood)
    
    // Clear any existing idle timer when active animation starts
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    
    setTimeout(() => {
      setMood(prev => prev === newMood ? 'idle' : prev)
    }, duration)
  }, []) // No dependencies - uses refs for current values

  // 1. Listen for Extension Events (Data Saved, Scan Complete)
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      // Data Saved -> Happy Zap (Small)
      if (message.type === 'DATA_SAVED') {
        triggerMood('happy', 1000)
      }
      
      // Scan Progress -> Check for Complete -> Super Shimmer (Big)
      if (message.type === 'SCAN_PROGRESS') {
        const payload = message.payload as { status?: string; scanType?: string }
        if (payload.status === 'complete' || payload.status === 'timeout') {
          triggerMood('super', 2000)
        }
      }
    }
    
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [triggerMood])

  // 2. Idle Timer Logic - Uses functional updates to avoid stale closures
  useEffect(() => {
    const resetIdleTimer = () => {
      // Clear any existing timer
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      
      // Only set idle if not in active animation - use functional update to get current state
      setMood(prev => {
        // Don't interrupt active animations
        if (prev === 'happy' || prev === 'super') {
          return prev
        }
        return 'idle'
      })
      
      // Set new timer for sleeping state
      idleTimerRef.current = window.setTimeout(() => {
        // Only set sleeping if still idle (check current state)
        setMood(prev => prev === 'idle' ? 'sleeping' : prev)
      }, 10000)
    }

    // Reset timer on interaction
    window.addEventListener('mousemove', resetIdleTimer)
    window.addEventListener('click', resetIdleTimer)
    window.addEventListener('keydown', resetIdleTimer)
    
    resetIdleTimer() // Start initial timer

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer)
      window.removeEventListener('click', resetIdleTimer)
      window.removeEventListener('keydown', resetIdleTimer)
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
    }
  }, []) // Empty deps - only run once on mount

  // Calculate CSS class based on current mood
  const getMascotClass = () => {
    switch (mood) {
      case 'happy': 
        return 'animate-happy-zap text-yellow-500'
      case 'super': 
        return 'animate-super-shimmer text-yellow-500'
      case 'sleeping': 
        return 'animate-idle text-yellow-500/80' // Dimmer when sleeping
      default: 
        return 'text-gray-400 dark:text-gray-500 group-hover:text-yellow-500 transition-colors'
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
