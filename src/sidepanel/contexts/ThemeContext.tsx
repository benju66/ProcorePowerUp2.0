/**
 * Theme Context Provider
 * 
 * Manages theme state (light/dark/auto) and applies it to the DOM.
 * Follows best practices for Chrome extension side panels:
 * - Persists preference to IndexedDB
 * - Listens to system preference changes
 * - Applies theme immediately to prevent flash
 */

import { createContext } from 'preact'
import { useContext, useState, useEffect } from 'preact/hooks'
import { StorageService } from '@/services'
import type { ThemeMode, ResolvedTheme } from '@/types/preferences'
import { PREFERENCE_KEYS } from '@/types/preferences'

interface ThemeContextValue {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: preact.ComponentChildren
}

/**
 * Applies theme class to document root
 */
function applyThemeToDOM(mode: ThemeMode): ResolvedTheme {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  
  let resolved: ResolvedTheme
  if (mode === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    resolved = prefersDark ? 'dark' : 'light'
  } else {
    resolved = mode
  }
  
  root.classList.add(resolved)
  return resolved
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>('auto')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  // Load theme from storage on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await StorageService.getPreferences<ThemeMode>(
          PREFERENCE_KEYS.theme,
          'auto'
        )
        setThemeState(saved)
        const resolved = applyThemeToDOM(saved)
        setResolvedTheme(resolved)
      } catch (error) {
        console.error('Failed to load theme preference:', error)
        // Fallback to auto mode
        const resolved = applyThemeToDOM('auto')
        setResolvedTheme(resolved)
      }
    }
    loadTheme()
  }, [])

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== 'auto') return
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const resolved = applyThemeToDOM('auto')
      setResolvedTheme(resolved)
    }
    
    // Check initial value
    handler()
    
    // Listen for changes
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const setTheme = async (newTheme: ThemeMode) => {
    try {
      setThemeState(newTheme)
      await StorageService.savePreference(PREFERENCE_KEYS.theme, newTheme)
      const resolved = applyThemeToDOM(newTheme)
      setResolvedTheme(resolved)
    } catch (error) {
      console.error('Failed to save theme preference:', error)
      // Still apply theme even if save fails
      const resolved = applyThemeToDOM(newTheme)
      setResolvedTheme(resolved)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access theme context
 * Throws error if used outside ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
