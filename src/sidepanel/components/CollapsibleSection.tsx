/**
 * CollapsibleSection Component
 * 
 * Reusable collapsible section for Settings and other menus.
 * Follows the same pattern as RecentsSection/FavoritesSection.
 */

import { useState, useEffect } from 'preact/hooks'
import type { ComponentChildren, VNode } from 'preact'
import { StorageService } from '@/services'
import { ChevronRight } from 'lucide-preact'

interface CollapsibleSectionProps {
  title: string
  icon?: VNode
  preferenceKey?: string
  defaultExpanded?: boolean
  children: ComponentChildren
  badge?: string | number
}

export function CollapsibleSection({
  title,
  icon,
  preferenceKey,
  defaultExpanded = false,
  children,
  badge,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Load persisted expanded state
  useEffect(() => {
    if (!preferenceKey) return
    
    async function loadExpandedState() {
      const expanded = await StorageService.getPreferences<boolean>(
        preferenceKey!,
        defaultExpanded
      )
      setIsExpanded(expanded)
    }
    loadExpandedState()
  }, [preferenceKey, defaultExpanded])

  // Save expanded state when it changes
  useEffect(() => {
    if (!preferenceKey) return
    StorageService.savePreference(preferenceKey, isExpanded)
  }, [isExpanded, preferenceKey])

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded"
        aria-expanded={isExpanded}
      >
        <ChevronRight
          size={16}
          className={`transition-transform text-gray-400 dark:text-gray-500 ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
        {icon && <span className="text-sm">{icon}</span>}
        <span className="flex-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        {badge !== undefined && (
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="pb-2">
          {children}
        </div>
      )}
    </div>
  )
}
