/**
 * User Preferences Types
 * 
 * Centralized type definitions for all user preferences.
 * Follows Single Responsibility Principle - types only.
 */

import type { ToolId } from './tools'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'
export type AnimationLevel = 'off' | 'subtle' | 'normal'

export interface UserPreferences {
  theme: ThemeMode
  openInBackground: boolean
  showRFIsTab: boolean
  showCostTab: boolean
  animationLevel: AnimationLevel
  showHeaderToolButtons: boolean
  visibleTools: ToolId[]
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  openInBackground: false,
  showRFIsTab: false,
  showCostTab: false,
  animationLevel: 'normal',
  showHeaderToolButtons: true,
  visibleTools: ['home', 'drawings', 'submittals', 'rfis', 'directory'],
}

/**
 * Preference storage keys
 * Centralized to avoid typos and ensure consistency
 */
export const PREFERENCE_KEYS = {
  theme: 'theme',
  openInBackground: 'openInBackground',
  showRFIsTab: 'showRFIsTab',
  showCostTab: 'showCostTab',
  recentsExpanded: 'recentsExpanded',
  favoritesExpanded: 'favoritesExpanded',
  animationLevel: 'animationLevel',
  // Quick Nav toolbar
  showHeaderToolButtons: 'showHeaderToolButtons',
  visibleTools: 'visibleTools',
  // Settings collapsible sections
  settingsAppearanceExpanded: 'settingsAppearanceExpanded',
  settingsProjectsExpanded: 'settingsProjectsExpanded',
  settingsDataSyncExpanded: 'settingsDataSyncExpanded',
  settingsPreferencesExpanded: 'settingsPreferencesExpanded',
  settingsFavoritesExpanded: 'settingsFavoritesExpanded',
  settingsQuickNavExpanded: 'settingsQuickNavExpanded',
} as const
