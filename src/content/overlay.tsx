/**
 * Command Palette Overlay
 * 
 * Renders the Command Palette as a centered modal overlay on the Procore webpage.
 * Uses Shadow DOM for style isolation and Preact for rendering.
 */

import { render } from 'preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { CommandPalette } from '../sidepanel/components/CommandPalette'
import type { CommandPaletteDataProvider } from '@/types/command-palette'
import type { Drawing, DisciplineMap, RecentsList, Project, RFI } from '@/types'

// Import CSS as inline string
// @ts-ignore - Vite handles ?inline imports
import styles from '../sidepanel/index.css?inline'

// Extract project ID from current URL
function extractProjectIdFromUrl(): string | null {
  const url = window.location.href
  const projectMatch = url.match(/projects\/(\d+)/) || url.match(/\/(\d+)\/project/)
  return projectMatch?.[1] ?? null
}

/**
 * Data provider that fetches data from background service worker
 */
class OverlayDataProvider implements CommandPaletteDataProvider {
  async getDrawings(projectId: string): Promise<Drawing[]> {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_PROJECT_DATA',
      projectId,
    })
    
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to get drawings')
    }
    
    return response.drawings || []
  }

  async getDisciplineMap(projectId: string): Promise<DisciplineMap> {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_PROJECT_DATA',
      projectId,
    })
    
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to get discipline map')
    }
    
    return response.disciplineMap || {}
  }

  async getAllFavoriteDrawings(projectId: string): Promise<Set<string>> {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_PROJECT_DATA',
      projectId,
    })
    
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to get favorites')
    }
    
    // Convert array back to Set
    return new Set(response.favorites || [])
  }

  async getRecents(projectId: string): Promise<RecentsList> {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_PROJECT_DATA',
      projectId,
    })
    
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to get recents')
    }
    
    return response.recents || []
  }

  async getRFIs(projectId: string): Promise<RFI[]> {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_PROJECT_DATA',
      projectId,
    })
    
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to get RFIs')
    }
    
    return response.rfis || []
  }
}

/**
 * Overlay App Component
 * Manages visibility and project ID state
 */
function OverlayApp({ onVisibilityChange }: { onVisibilityChange: (visible: boolean) => void }) {
  console.log('PP Overlay: OverlayApp component rendering')
  const [isVisible, setIsVisible] = useState(false)
  const [urlProjectId, setUrlProjectId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [availableProjects, setAvailableProjects] = useState<Project[]>([])
  const dataProvider = new OverlayDataProvider()

  // The active project is the user's selection, or fallback to URL-detected project
  const projectId = selectedProjectId || urlProjectId

  // Extract project ID from URL
  useEffect(() => {
    console.log('PP Overlay: Setting up project ID extraction')
    const updateProjectId = () => {
      const id = extractProjectIdFromUrl()
      setUrlProjectId(id)
      // Reset selection when URL changes (navigating to different project)
      setSelectedProjectId(null)
    }
    
    // Initial extraction
    updateProjectId()
    
    // Listen for URL changes (SPA navigation)
    const observer = new MutationObserver(updateProjectId)
    observer.observe(document.body, { childList: true, subtree: true })
    
    // Also listen for popstate (browser back/forward)
    window.addEventListener('popstate', updateProjectId)
    
    return () => {
      observer.disconnect()
      window.removeEventListener('popstate', updateProjectId)
    }
  }, [])

  // Fetch available projects when overlay becomes visible
  useEffect(() => {
    if (!isVisible) return
    
    async function fetchProjects() {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_ALL_PROJECTS' })
        if (response?.success) {
          setAvailableProjects(response.projects || [])
        }
      } catch (error) {
        console.error('PP Overlay: Failed to fetch projects:', error)
      }
    }
    
    fetchProjects()
  }, [isVisible])

  // Handle project change from CommandPalette dropdown
  const handleProjectChange = useCallback((newProjectId: string) => {
    setSelectedProjectId(newProjectId)
  }, [])

  // Listen for toggle event from Shadow DOM
  useEffect(() => {
    console.log('PP Overlay: Setting up toggle event listener in Shadow DOM')
    
    // Get the shadow root's host element to listen for events dispatched to shadow root
    const shadowHost = document.getElementById('pp-overlay-root')
    const shadowRoot = shadowHost?.shadowRoot
    
    const handleToggle = (e: Event) => {
      e.stopPropagation() // Prevent any further propagation
      console.log('PP Overlay: Received pp-toggle-overlay event in component')
      setIsVisible(prev => {
        const newValue = !prev
        console.log('PP Overlay: Toggling visibility from', prev, 'to', newValue)
        return newValue
      })
    }
    
    // Only listen on the shadow root (events are bridged from setupShadowRoot)
    if (shadowRoot) {
      console.log('PP Overlay: Adding listener to shadow root only')
      shadowRoot.addEventListener('pp-toggle-overlay', handleToggle)
    } else {
      console.warn('PP Overlay: Shadow root not found, cannot set up event listener')
    }
    
    return () => {
      console.log('PP Overlay: Removing event listener')
      if (shadowRoot) {
        shadowRoot.removeEventListener('pp-toggle-overlay', handleToggle)
      }
    }
  }, []) // Empty dependency array - only set up listener once

  // Sync visibility with host element
  useEffect(() => {
    onVisibilityChange(isVisible)
  }, [isVisible, onVisibilityChange])

  // Close on Escape key
  useEffect(() => {
    if (!isVisible) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <CommandPalette 
      projectId={projectId} 
      dataProvider={dataProvider}
      usePortal={false}
      initialIsOpen={true}
      onClose={() => setIsVisible(false)}
      availableProjects={availableProjects}
      onProjectChange={handleProjectChange}
    />
  )
}

// Initialize overlay
function initOverlay() {
  // Check if already initialized
  if (document.getElementById('pp-overlay-root')) {
    return
  }

  // Create host element
  const host = document.createElement('div')
  host.id = 'pp-overlay-root'
  host.style.display = 'none' // Hidden by default
  host.style.position = 'fixed'
  host.style.inset = '0'
  host.style.zIndex = '999999' // Very high z-index to appear above Procore UI
  host.style.pointerEvents = 'none' // Allow clicks to pass through when hidden
  
  // Wait for body to be available
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(host)
      setupShadowRoot(host)
    })
  } else {
    document.body.appendChild(host)
    setupShadowRoot(host)
  }
}

function setupShadowRoot(host: HTMLElement) {
  // Create Shadow DOM root
  const shadowRoot = host.attachShadow({ mode: 'open' })

  // Inject styles into Shadow DOM
  const styleElement = document.createElement('style')
  styleElement.textContent = styles
  shadowRoot.appendChild(styleElement)

  // Create container for Preact app
  const appContainer = document.createElement('div')
  appContainer.id = 'pp-overlay-app'
  
  // Apply theme to container (Shadow DOM doesn't inherit from document.documentElement)
  // This must happen BEFORE render to prevent flash of wrong theme
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const applyTheme = (prefersDark: boolean) => {
    if (prefersDark) {
      appContainer.classList.add('dark')
      appContainer.classList.remove('light')
    } else {
      appContainer.classList.add('light')
      appContainer.classList.remove('dark')
    }
  }
  
  // Apply initial theme
  applyTheme(mediaQuery.matches)
  
  // Listen for system theme changes
  const handleThemeChange = (e: MediaQueryListEvent) => {
    applyTheme(e.matches)
  }
  mediaQuery.addEventListener('change', handleThemeChange)
  
  shadowRoot.appendChild(appContainer)

  // Handle visibility changes from the app
  const handleVisibilityChange = (visible: boolean) => {
    console.log('PP: handleVisibilityChange called with:', visible)
    host.style.display = visible ? 'block' : 'none'
    host.style.pointerEvents = visible ? 'auto' : 'none'
  }

  // Set up event listener OUTSIDE Shadow DOM (in content script context)
  // This ensures events from toggle-button.ts can reach us
  const handleToggleEvent = (e: Event) => {
    console.log('PP: Toggle event received in setupShadowRoot')
    e.stopPropagation() // Prevent event from bubbling further
    // Dispatch event into Shadow DOM so Preact component can receive it
    shadowRoot.dispatchEvent(new CustomEvent('pp-toggle-overlay', { bubbles: false }))
  }
  
  console.log('PP: Setting up event listener on main window')
  window.addEventListener('pp-toggle-overlay', handleToggleEvent, true) // Use capture phase

  // Render Preact app into Shadow DOM
  console.log('PP: Rendering OverlayApp component')
  render(<OverlayApp onVisibilityChange={handleVisibilityChange} />, appContainer)

  console.log('PP: Command Palette overlay initialized')
  console.log('PP: Shadow root created, overlay app rendered')
  
  // Store cleanup function
  ;(host as any)._ppCleanup = () => {
    window.removeEventListener('pp-toggle-overlay', handleToggleEvent, true)
    mediaQuery.removeEventListener('change', handleThemeChange)
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOverlay)
} else {
  initOverlay()
}
