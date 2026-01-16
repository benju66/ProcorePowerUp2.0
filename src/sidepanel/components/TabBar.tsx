import { useRef, useEffect } from 'preact/hooks'
import type { TabInfo } from '@/types'

interface TabBarProps {
  tabs: TabInfo[]
  activeTab: TabInfo['id']
  onTabChange: (tab: TabInfo['id']) => void
  onExitDown?: () => void
  autoFocus?: boolean
}

export function TabBar({ tabs, activeTab, onTabChange, onExitDown, autoFocus = false }: TabBarProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const activeTabRef = useRef<HTMLButtonElement | null>(null)

  // Auto-focus active tab on mount if requested
  useEffect(() => {
    if (autoFocus && activeTabRef.current) {
      // Small delay to ensure layout is ready
      setTimeout(() => {
        activeTabRef.current?.focus()
      }, 100)
    }
  }, [autoFocus])

  const handleKeyDown = (e: KeyboardEvent, tabId: TabInfo['id']) => {
    const currentIndex = tabs.findIndex(t => t.id === tabId)
    
    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault()
        // Move to previous tab (wrap around)
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        const prevTab = tabs[prevIndex]
        onTabChange(prevTab.id)
        // Focus the new tab button
        setTimeout(() => {
          tabRefs.current.get(prevTab.id)?.focus()
        }, 0)
        break
      }
      
      case 'ArrowRight': {
        e.preventDefault()
        // Move to next tab (wrap around)
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        const nextTab = tabs[nextIndex]
        onTabChange(nextTab.id)
        // Focus the new tab button
        setTimeout(() => {
          tabRefs.current.get(nextTab.id)?.focus()
        }, 0)
        break
      }
      
      case 'ArrowDown': {
        e.preventDefault()
        // Exit to search input
        onExitDown?.()
        break
      }
      
      case 'Home': {
        e.preventDefault()
        // Go to first tab
        const firstTab = tabs[0]
        onTabChange(firstTab.id)
        setTimeout(() => {
          tabRefs.current.get(firstTab.id)?.focus()
        }, 0)
        break
      }
      
      case 'End': {
        e.preventDefault()
        // Go to last tab
        const lastTab = tabs[tabs.length - 1]
        onTabChange(lastTab.id)
        setTimeout(() => {
          tabRefs.current.get(lastTab.id)?.focus()
        }, 0)
        break
      }
    }
  }

  // Store ref to active tab for auto-focus
  const setTabRef = (tabId: string, el: HTMLButtonElement | null) => {
    if (el) {
      tabRefs.current.set(tabId, el)
      if (tabId === activeTab) {
        activeTabRef.current = el
      }
    }
  }

  return (
    <nav 
      className="flex bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative z-20"
      role="tablist"
      data-tabbar
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => setTabRef(tab.id, el)}
          onClick={(e) => {
            e.stopPropagation()
            onTabChange(tab.id)
          }}
          onKeyDown={(e) => handleKeyDown(e, tab.id)}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium
            relative transition-colors
            ${activeTab === tab.id 
              ? 'text-blue-600 dark:text-blue-400 tab-active' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }
          `}
          style={{ pointerEvents: 'auto', zIndex: 21 }}
          tabIndex={activeTab === tab.id ? 0 : -1}
          aria-selected={activeTab === tab.id}
          role="tab"
          data-tab-button={tab.id}
        >
          <span className="text-base">{tab.icon}</span>
          <span>{tab.label}</span>
          
          {/* Active indicator */}
          <div 
            className={`
              absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 tab-underline
            `}
          />
        </button>
      ))}
    </nav>
  )
}

/**
 * Focus the active tab button. Call this from parent to return focus to tabs.
 */
export function focusTabBar(): void {
  const activeTabButton = document.querySelector<HTMLElement>('[data-tab-button][aria-selected="true"]')
  activeTabButton?.focus()
}
