import { useState, useRef, useEffect, useCallback, useMemo } from 'preact/hooks'
import { Settings as SettingsPanel } from './Settings'
import { useMascot } from '../contexts/MascotContext'
import { useQuickNav } from '../hooks/useQuickNav'
import { useDragToScroll } from '../hooks/useDragToScroll'
import { AVAILABLE_TOOLS } from '../utils/tools'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { Settings as SettingsIcon, ExternalLink } from 'lucide-preact'
import type { Project } from '@/types'

interface HeaderProps {
  onPopOut: () => void
  currentProjectId?: string | null
  projects?: Project[]
  onProjectDeleted?: (projectId: string) => Promise<void>
}

export function Header({ onPopOut, currentProjectId, projects = [], onProjectDeleted }: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [openInBackground, setOpenInBackground] = useState(false)
  const [focusedToolIndex, setFocusedToolIndex] = useState(0)
  
  // Get mascot state from context
  const { mood, animationLevel, triggerMood } = useMascot()
  
  // Get Quick Nav state from hook
  const { showToolButtons, visibleTools, toggleMaster, toggleTool } = useQuickNav()
  
  // Derive active project from props
  const activeProject = projects.find(p => p.id === currentProjectId)

  // Get visible tools with valid URLs
  const visibleToolsWithUrls = useMemo(() => {
    if (!activeProject) return []
    return AVAILABLE_TOOLS
      .filter(tool => visibleTools.includes(tool.id))
      .map(tool => ({ ...tool, url: tool.getUrl(activeProject) }))
      .filter(tool => tool.url !== null)
  }, [activeProject, visibleTools])

  // Drag-to-scroll functionality
  const { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, shouldPreventClick } = useDragToScroll(toolbarRef)

  // Load openInBackground preference on mount
  useEffect(() => {
    StorageService.getPreferences<boolean>(PREFERENCE_KEYS.openInBackground, false)
      .then(setOpenInBackground)
      .catch(console.error)
  }, [])

  // Handle navigation button click
  const handleNavClick = useCallback((url: string) => {
    // Prevent click if it was actually a drag
    if (shouldPreventClick()) return
    
    chrome.runtime.sendMessage({
      action: 'OPEN_TAB',
      url,
      background: openInBackground
    })
  }, [openInBackground, shouldPreventClick])

  // Keyboard navigation for toolbar
  const handleToolbarKeyDown = useCallback((e: KeyboardEvent) => {
    const toolCount = visibleToolsWithUrls.length
    if (toolCount === 0) return

    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault()
        // Stop at start (non-circular)
        if (focusedToolIndex === 0) return
        const prevIndex = focusedToolIndex - 1
        setFocusedToolIndex(prevIndex)
        // Focus the button and scroll into view
        const buttons = toolbarRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool-button]')
        const button = buttons?.[prevIndex]
        button?.focus()
        button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        break
      }
      
      case 'ArrowRight': {
        e.preventDefault()
        // Stop at end (non-circular)
        if (focusedToolIndex === toolCount - 1) return
        const nextIndex = focusedToolIndex + 1
        setFocusedToolIndex(nextIndex)
        // Focus the button and scroll into view
        const buttons = toolbarRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool-button]')
        const button = buttons?.[nextIndex]
        button?.focus()
        button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        break
      }
      
      case 'ArrowDown': {
        e.preventDefault()
        // Exit to TabBar
        const activeTabButton = document.querySelector<HTMLElement>('[data-tab-button][aria-selected="true"]')
        activeTabButton?.focus()
        break
      }
      
      case 'Enter':
      case ' ': {
        e.preventDefault()
        const tool = visibleToolsWithUrls[focusedToolIndex]
        if (tool?.url) {
          handleNavClick(tool.url)
        }
        break
      }
      
      case 'Home': {
        e.preventDefault()
        setFocusedToolIndex(0)
        const buttons = toolbarRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool-button]')
        const button = buttons?.[0]
        button?.focus()
        button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        break
      }
      
      case 'End': {
        e.preventDefault()
        const lastIndex = toolCount - 1
        setFocusedToolIndex(lastIndex)
        const buttons = toolbarRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool-button]')
        const button = buttons?.[lastIndex]
        button?.focus()
        button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        break
      }
    }
  }, [focusedToolIndex, visibleToolsWithUrls, handleNavClick])

  // Calculate CSS class based on current mood and animation level
  const getMascotClass = () => {
    // Base tier class for CSS targeting
    const tierClass = `mascot-${animationLevel}`
    
    // If animations are off, only show static colors
    if (animationLevel === 'off') {
      switch (mood) {
        case 'happy':
        case 'super':
          return `${tierClass} text-yellow-500`
        case 'sleeping':
          return `${tierClass} text-yellow-500/60`
        default:
          return `${tierClass} text-gray-400 dark:text-gray-500`
      }
    }
    
    // Subtle and Normal tiers get animation classes
    switch (mood) {
      case 'happy': 
        return `${tierClass} animate-happy-zap text-yellow-500`
      case 'super': 
        return `${tierClass} animate-super-shimmer text-yellow-500`
      case 'sleeping': 
        return `${tierClass} animate-idle text-yellow-500/80`
      default: 
        return `${tierClass} text-gray-400 dark:text-gray-500 group-hover:text-yellow-500 transition-colors`
    }
  }

  // Check if toolbar is visible and has tools
  const showToolbar = activeProject && showToolButtons && visibleToolsWithUrls.length > 0

  return (
    <header className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative z-30">
      
      {/* ⚡ MASCOT ICON ⚡ */}
      <div 
        className="flex items-center cursor-default group select-none shrink-0"
        onMouseEnter={() => {
          // Only trigger hover animation if not in active animation
          if (mood !== 'happy' && mood !== 'super') {
            triggerMood('happy', 600)
          }
        }}
        title={mood === 'sleeping' ? "Zzz..." : "Procore Power-Up"}
      >
        <div className={`text-xl transition-all duration-300 ${getMascotClass()}`}>
          ⚡
        </div>
      </div>

      {/* Quick Navigation Toolbar */}
      {showToolbar && (
        <div 
          ref={toolbarRef}
          className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar mx-2 cursor-grab"
          role="toolbar"
          aria-label="Quick navigation"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        >
          <div className="flex items-center gap-0.5">
            {visibleToolsWithUrls.map((tool, index) => (
              <button
                key={tool.id}
                data-tool-button={tool.id}
                onClick={() => handleNavClick(tool.url!)}
                onKeyDown={handleToolbarKeyDown}
                onFocus={() => setFocusedToolIndex(index)}
                className={`p-1.5 rounded-md text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${tool.colorClass}`}
                title={tool.label}
                aria-label={tool.label}
                tabIndex={index === focusedToolIndex ? 0 : -1}
              >
                <tool.icon size={20} className="pointer-events-none" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Side Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          ref={settingsButtonRef}
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Settings"
          aria-label="Settings"
          aria-expanded={settingsOpen}
        >
          <SettingsIcon size={20} />
        </button>
        
        <button
          onClick={onPopOut}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="Pop out to window"
          aria-label="Pop out to window"
        >
          <ExternalLink size={20} />
        </button>
      </div>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        buttonRef={settingsButtonRef}
        currentProjectId={currentProjectId}
        projects={projects}
        onProjectDeleted={onProjectDeleted}
        showToolButtons={showToolButtons}
        visibleTools={visibleTools}
        onToggleMaster={toggleMaster}
        onToggleTool={toggleTool}
      />
    </header>
  )
}

/**
 * Focus the first tool button in the toolbar.
 * Call this from other components to move focus to toolbar.
 */
export function focusToolbar(): void {
  const firstToolButton = document.querySelector<HTMLElement>('[data-tool-button]')
  firstToolButton?.focus()
}
