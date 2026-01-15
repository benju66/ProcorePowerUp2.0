/**
 * Command Palette Overlay
 * 
 * Renders the Command Palette as a centered modal overlay on the Procore webpage.
 * Uses Shadow DOM for style isolation and Preact for rendering.
 */

import { render } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { CommandPalette } from '../sidepanel/components/CommandPalette'
import type { CommandPaletteDataProvider } from '@/types/command-palette'
import type { Drawing, DisciplineMap, RecentsList } from '@/types'

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
}

/**
 * Overlay App Component
 * Manages visibility and project ID state
 */
function OverlayApp({ onVisibilityChange }: { onVisibilityChange: (visible: boolean) => void }) {
  const [isVisible, setIsVisible] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const dataProvider = new OverlayDataProvider()

  // Extract project ID from URL
  useEffect(() => {
    const updateProjectId = () => {
      const id = extractProjectIdFromUrl()
      setProjectId(id)
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

  // Listen for toggle event
  useEffect(() => {
    const handleToggle = () => {
      setIsVisible(prev => !prev)
    }
    
    window.addEventListener('pp-toggle-overlay', handleToggle)
    
    return () => {
      window.removeEventListener('pp-toggle-overlay', handleToggle)
    }
  }, [])

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
  shadowRoot.appendChild(appContainer)

  // Handle visibility changes from the app
  const handleVisibilityChange = (visible: boolean) => {
    host.style.display = visible ? 'block' : 'none'
    host.style.pointerEvents = visible ? 'auto' : 'none'
  }

  // Render Preact app into Shadow DOM
  render(<OverlayApp onVisibilityChange={handleVisibilityChange} />, appContainer)

  console.log('PP: Command Palette overlay initialized')
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOverlay)
} else {
  initOverlay()
}
