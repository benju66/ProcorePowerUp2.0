import type { TabInfo } from '@/types'

interface TabBarProps {
  tabs: TabInfo[]
  activeTab: TabInfo['id']
  onTabChange: (tab: TabInfo['id']) => void
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="flex bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative z-20">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={(e) => {
            e.stopPropagation()
            onTabChange(tab.id)
          }}
          className={`
            flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium
            relative transition-colors
            ${activeTab === tab.id 
              ? 'text-blue-600 dark:text-blue-400 tab-active' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }
          `}
          style={{ pointerEvents: 'auto', zIndex: 21 }}
          aria-selected={activeTab === tab.id}
          role="tab"
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
