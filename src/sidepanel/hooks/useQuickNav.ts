/**
 * useQuickNav Hook
 * 
 * Manages state for the Quick Navigation toolbar in the header.
 * Handles persistence to storage and provides toggle functions.
 */

import { useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS, DEFAULT_PREFERENCES } from '@/types/preferences'
import type { ToolId } from '@/types/tools'

export function useQuickNav() {
  const [showToolButtons, setShowToolButtons] = useState(DEFAULT_PREFERENCES.showHeaderToolButtons)
  const [visibleTools, setVisibleTools] = useState<ToolId[]>(DEFAULT_PREFERENCES.visibleTools)
  const [isLoading, setIsLoading] = useState(true)

  // Load preferences from storage on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const [showButtons, tools] = await Promise.all([
          StorageService.getPreferences<boolean>(
            PREFERENCE_KEYS.showHeaderToolButtons,
            DEFAULT_PREFERENCES.showHeaderToolButtons
          ),
          StorageService.getPreferences<ToolId[]>(
            PREFERENCE_KEYS.visibleTools,
            DEFAULT_PREFERENCES.visibleTools
          ),
        ])
        setShowToolButtons(showButtons)
        setVisibleTools(tools)
      } catch (error) {
        console.error('Failed to load Quick Nav preferences:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadPreferences()
  }, [])

  // Toggle master switch (show/hide entire toolbar)
  const toggleMaster = useCallback(async (enabled: boolean) => {
    setShowToolButtons(enabled)
    try {
      await StorageService.savePreference(PREFERENCE_KEYS.showHeaderToolButtons, enabled)
    } catch (error) {
      console.error('Failed to save showHeaderToolButtons preference:', error)
      // Revert on error
      setShowToolButtons(!enabled)
    }
  }, [])

  // Toggle individual tool visibility
  const toggleTool = useCallback(async (toolId: ToolId, checked: boolean) => {
    // Use functional state update to prevent stale closures
    setVisibleTools(prev => {
      const newTools = checked
        ? (prev.includes(toolId) ? prev : [...prev, toolId])  // Add if not already present
        : prev.filter(t => t !== toolId)  // Remove
      
      // Save to storage (fire and forget, errors logged)
      StorageService.savePreference(PREFERENCE_KEYS.visibleTools, newTools)
        .catch(error => console.error('Failed to save visibleTools preference:', error))
      
      return newTools
    })
  }, [])

  // Reorder tools (for drag-and-drop)
  const reorderTools = useCallback((newOrder: ToolId[]) => {
    setVisibleTools(newOrder)
    // Save to storage (fire and forget, errors logged)
    StorageService.savePreference(PREFERENCE_KEYS.visibleTools, newOrder)
      .catch(error => console.error('Failed to save visibleTools order:', error))
  }, [])

  return {
    showToolButtons,
    visibleTools,
    toggleMaster,
    toggleTool,
    reorderTools,
    isLoading,
  }
}
