/**
 * User Preferences Types
 * 
 * Centralized type definitions for all user preferences.
 * Follows Single Responsibility Principle - types only.
 */

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

export interface UserPreferences {
  theme: ThemeMode
  openInBackground: boolean
  showRFIsTab: boolean
  showCostTab: boolean
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  openInBackground: false,
  showRFIsTab: false,
  showCostTab: false,
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
} as const
