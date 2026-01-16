/**
 * Tab Visibility Context Provider
 * 
 * Manages visibility state for RFIs and Cost tabs.
 * Follows the same pattern as ThemeContext:
 * - Persists preferences to IndexedDB
 * - Provides setters that update state and persist
 */

import { createContext } from 'preact'
import { useContext, useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS, DEFAULT_PREFERENCES } from '@/types/preferences'

interface TabVisibilityContextValue {
  showRFIsTab: boolean
  showCostTab: boolean
  setShowRFIsTab: (visible: boolean) => Promise<void>
  setShowCostTab: (visible: boolean) => Promise<void>
}

const TabVisibilityContext = createContext<TabVisibilityContextValue | undefined>(undefined)

interface TabVisibilityProviderProps {
  children: preact.ComponentChildren
}

export function TabVisibilityProvider({ children }: TabVisibilityProviderProps) {
  const [showRFIsTab, setShowRFIsTabState] = useState(DEFAULT_PREFERENCES.showRFIsTab)
  const [showCostTab, setShowCostTabState] = useState(DEFAULT_PREFERENCES.showCostTab)

  // Load preferences from storage on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const [rfis, cost] = await Promise.all([
          StorageService.getPreferences<boolean>(
            PREFERENCE_KEYS.showRFIsTab,
            DEFAULT_PREFERENCES.showRFIsTab
          ),
          StorageService.getPreferences<boolean>(
            PREFERENCE_KEYS.showCostTab,
            DEFAULT_PREFERENCES.showCostTab
          ),
        ])
        setShowRFIsTabState(rfis)
        setShowCostTabState(cost)
      } catch (error) {
        console.error('Failed to load tab visibility preferences:', error)
      }
    }
    loadPreferences()
  }, [])

  const setShowRFIsTab = useCallback(async (visible: boolean) => {
    setShowRFIsTabState(visible)
    try {
      await StorageService.savePreference(PREFERENCE_KEYS.showRFIsTab, visible)
    } catch (error) {
      console.error('Failed to save RFIs tab preference:', error)
      // Revert on error
      setShowRFIsTabState(!visible)
    }
  }, [])

  const setShowCostTab = useCallback(async (visible: boolean) => {
    setShowCostTabState(visible)
    try {
      await StorageService.savePreference(PREFERENCE_KEYS.showCostTab, visible)
    } catch (error) {
      console.error('Failed to save Cost tab preference:', error)
      // Revert on error
      setShowCostTabState(!visible)
    }
  }, [])

  return (
    <TabVisibilityContext.Provider value={{
      showRFIsTab,
      showCostTab,
      setShowRFIsTab,
      setShowCostTab,
    }}>
      {children}
    </TabVisibilityContext.Provider>
  )
}

/**
 * Hook to access tab visibility context
 * Throws error if used outside TabVisibilityProvider
 */
export function useTabVisibility() {
  const context = useContext(TabVisibilityContext)
  if (!context) {
    throw new Error('useTabVisibility must be used within TabVisibilityProvider')
  }
  return context
}
