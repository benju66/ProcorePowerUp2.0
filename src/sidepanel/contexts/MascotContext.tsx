/**
 * Mascot Context Provider
 * 
 * Manages the mascot animation state and user preferences.
 * - Persists animation level preference to IndexedDB
 * - Listens to prefers-reduced-motion and auto-adjusts
 * - Provides centralized mood triggering with priority handling
 * - Manages idle/sleeping state transitions
 */

import { createContext } from 'preact'
import { useContext, useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import type { AnimationLevel } from '@/types/preferences'
import { PREFERENCE_KEYS, DEFAULT_PREFERENCES } from '@/types/preferences'

export type MascotMood = 'idle' | 'happy' | 'super' | 'sleeping'

interface MascotContextValue {
  mood: MascotMood
  animationLevel: AnimationLevel
  triggerMood: (mood: MascotMood, duration: number) => void
  setAnimationLevel: (level: AnimationLevel) => Promise<void>
}

const MascotContext = createContext<MascotContextValue | undefined>(undefined)

interface MascotProviderProps {
  children: preact.ComponentChildren
}

// Priority map - higher number = higher priority
const MOOD_PRIORITY: Record<MascotMood, number> = {
  idle: 0,
  sleeping: 0,
  happy: 1,
  super: 2,
}

export function MascotProvider({ children }: MascotProviderProps) {
  const [mood, setMood] = useState<MascotMood>('idle')
  const [animationLevel, setAnimationLevelState] = useState<AnimationLevel>(DEFAULT_PREFERENCES.animationLevel)
  
  const moodRef = useRef<MascotMood>('idle')
  const idleTimerRef = useRef<number | null>(null)
  
  // Keep moodRef in sync for priority checks
  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  // Load animation level from storage on mount
  useEffect(() => {
    async function loadAnimationLevel() {
      try {
        // Check if user prefers reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        
        const saved = await StorageService.getPreferences<AnimationLevel>(
          PREFERENCE_KEYS.animationLevel,
          prefersReducedMotion ? 'subtle' : DEFAULT_PREFERENCES.animationLevel
        )
        setAnimationLevelState(saved)
      } catch (error) {
        console.error('Failed to load animation level preference:', error)
      }
    }
    loadAnimationLevel()
  }, [])

  // Listen for prefers-reduced-motion changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handler = (e: MediaQueryListEvent) => {
      // If user enables reduced motion and current setting is 'normal', auto-switch to 'subtle'
      if (e.matches && animationLevel === 'normal') {
        setAnimationLevelState('subtle')
        StorageService.savePreference(PREFERENCE_KEYS.animationLevel, 'subtle')
      }
    }
    
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [animationLevel])

  // Trigger mood animation with priority handling
  const triggerMood = useCallback((newMood: MascotMood, duration: number) => {
    // If animations are off, only allow color changes (handled in Header via CSS)
    // Still update mood state so Header can show static color
    
    // Don't interrupt higher priority animations
    const currentPriority = MOOD_PRIORITY[moodRef.current]
    const newPriority = MOOD_PRIORITY[newMood]
    
    if (newPriority < currentPriority) {
      return
    }
    
    setMood(newMood)
    
    // Clear any existing idle timer when active animation starts
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    
    // Return to idle after duration
    setTimeout(() => {
      setMood(prev => prev === newMood ? 'idle' : prev)
    }, duration)
  }, [])

  // Listen for extension events (Data Saved, Scan Complete)
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      // Data Saved -> Happy Zap
      if (message.type === 'DATA_SAVED') {
        triggerMood('happy', 1000)
      }
      
      // Scan Progress -> Check for Complete -> Super Shimmer
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

  // Idle timer logic - transition to sleeping after inactivity
  useEffect(() => {
    const resetIdleTimer = () => {
      // Clear any existing timer
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      
      // Only set idle if not in active animation
      setMood(prev => {
        if (prev === 'happy' || prev === 'super') {
          return prev
        }
        return 'idle'
      })
      
      // Set timer for sleeping state (10 seconds of inactivity)
      idleTimerRef.current = window.setTimeout(() => {
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
  }, [])

  // Save animation level preference
  const setAnimationLevel = useCallback(async (level: AnimationLevel) => {
    setAnimationLevelState(level)
    try {
      await StorageService.savePreference(PREFERENCE_KEYS.animationLevel, level)
    } catch (error) {
      console.error('Failed to save animation level preference:', error)
      // Revert on error
      setAnimationLevelState(animationLevel)
    }
  }, [animationLevel])

  return (
    <MascotContext.Provider value={{
      mood,
      animationLevel,
      triggerMood,
      setAnimationLevel,
    }}>
      {children}
    </MascotContext.Provider>
  )
}

/**
 * Hook to access mascot context
 * Throws error if used outside MascotProvider
 */
export function useMascot() {
  const context = useContext(MascotContext)
  if (!context) {
    throw new Error('useMascot must be used within MascotProvider')
  }
  return context
}
