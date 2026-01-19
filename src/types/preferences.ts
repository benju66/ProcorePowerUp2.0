/**
 * User Preferences Types
 * 
 * Centralized type definitions for all user preferences.
 * Follows Single Responsibility Principle - types only.
 */

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'
export type AnimationLevel = 'off' | 'subtle' | 'normal'

export interface UserPreferences {
  theme: ThemeMode
  openInBackground: boolean
  showRFIsTab: boolean
  showCostTab: boolean
  animationLevel: AnimationLevel
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  openInBackground: false,
  showRFIsTab: false,
  showCostTab: false,
  animationLevel: 'normal',
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
} as const
