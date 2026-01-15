import { useState, useEffect, useCallback } from 'preact/hooks'
import type { TabInfo, Project } from '@/types'
import { StorageService } from '@/services'
import { Header } from './components/Header'
import { TabBar } from './components/TabBar'
import { DrawingsTab } from './components/DrawingsTab'
import { RFIsTab } from './components/RFIsTab'
import { CostTab } from './components/CostTab'
import { ProjectSelector } from './components/ProjectSelector'

const TABS: TabInfo[] = [
  { id: 'drawings', label: 'Drawings', icon: '📐' },
  { id: 'rfis', label: 'RFIs', icon: '❓' },
  { id: 'cost', label: 'Cost', icon: '💰' },
]

// Helper to extract IDs from URL
function extractIdsFromUrl(url: string): { 
  companyId: string | null
  projectId: string | null
  drawingAreaId: string | null 
} {
  const projectMatch = url.match(/projects\/(\d+)/) || url.match(/\/(\d+)\/project/)
  const areaMatch = url.match(/areas\/(\d+)/) || url.match(/drawing_areas\/(\d+)/)
  const companyMatch = url.match(/companies\/(\d+)/)
  
  return {
    companyId: companyMatch?.[1] ?? null,
    projectId: projectMatch?.[1] ?? null,
    drawingAreaId: areaMatch?.[1] ?? null,
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabInfo['id']>('drawings')
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isProcoreTab, setIsProcoreTab] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Data version counter - increment to trigger tab refreshes
  const [dataVersion, setDataVersion] = useState(0)

  // Initialize and detect current project
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      
      // Load saved projects
      const savedProjects = await StorageService.getAllProjects()
      setProjects(savedProjects)

      // Try to get current tab info
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB' })
        if (response?.isProcoreTab && response.url) {
          setIsProcoreTab(true)
          
          // Extract ALL IDs from URL
          const ids = extractIdsFromUrl(response.url)
          
          if (ids.projectId) {
            setCurrentProjectId(ids.projectId)
            
            // Update project access with captured IDs
            // Only include IDs that are actually present (don't overwrite with undefined)
            const updates: Partial<{ companyId: string; drawingAreaId: string }> = {}
            if (ids.companyId) updates.companyId = ids.companyId
            if (ids.drawingAreaId) updates.drawingAreaId = ids.drawingAreaId
            
            await StorageService.updateProjectAccess(ids.projectId, updates)
          }
        }
      } catch {
        // Not in a tab context (e.g., popped out window)
      }

      setIsLoading(false)
    }

    init()
  }, [])

  // Establish port connection to background for reliable lifecycle tracking
  // When this port disconnects (panel closes), background will notify content script
  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'sidepanel' })
    
    // Get the associated tab ID and send it to background
    chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB' })
      .then((response) => {
        if (response?.tabId) {
          port.postMessage({ type: 'PANEL_OPENED', tabId: response.tabId })
        }
      })
      .catch(() => {
        // Couldn't get tab ID, background will try to determine it
        port.postMessage({ type: 'PANEL_OPENED' })
      })
    
    // Port automatically disconnects when panel closes - no cleanup needed
    // Chrome handles this reliably, unlike pagehide/beforeunload
    return () => {
      port.disconnect()
    }
  }, [])

  // Listen for messages from background service worker
  useEffect(() => {
    const handleMessage = async (message: { type: string; payload?: unknown }) => {
      console.log('Side panel received message:', message.type)
      
      // Handle close request from toggle button
      if (message.type === 'CLOSE_SIDEPANEL') {
        console.log('PP: Closing side panel')
        window.close()
        return
      }
      
      if (message.type === 'TAB_UPDATED') {
        const payload = message.payload as { url: string }
        const ids = extractIdsFromUrl(payload.url)
        
        if (ids.projectId) {
          setCurrentProjectId(ids.projectId)
          setIsProcoreTab(true)
          
          // Update project with new IDs
          // Only include IDs that are actually present (don't overwrite with undefined)
          const updates: Partial<{ companyId: string; drawingAreaId: string }> = {}
          if (ids.companyId) updates.companyId = ids.companyId
          if (ids.drawingAreaId) updates.drawingAreaId = ids.drawingAreaId
          
          await StorageService.updateProjectAccess(ids.projectId, updates)
        }
      }

      // Background service worker saved new data - refresh the UI
      if (message.type === 'DATA_SAVED') {
        const payload = message.payload as { type?: string; count?: number }
        console.log('PP: Data saved notification:', payload)
        
        // Increment data version to trigger tab refresh
        setDataVersion(v => v + 1)
        
        // Refresh projects list
        const updatedProjects = await StorageService.getAllProjects()
        setProjects(updatedProjects)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  const handlePopOut = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'POP_OUT' })
    } catch (error) {
      console.error('Failed to pop out:', error)
    }
  }, [])

  const handleProjectChange = useCallback((projectId: string) => {
    setCurrentProjectId(projectId)
    StorageService.updateProjectAccess(projectId, {})
  }, [])

  const renderActiveTab = () => {
    if (!currentProjectId) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center px-4">
          <p className="text-lg font-medium mb-2">No Project Selected</p>
          <p className="text-sm">
            {isProcoreTab 
              ? 'Navigate to a project in Procore to get started.'
              : 'Select a project from the dropdown above, or open Procore.'}
          </p>
        </div>
      )
    }

    switch (activeTab) {
      case 'drawings':
        return <DrawingsTab projectId={currentProjectId} dataVersion={dataVersion} />
      case 'rfis':
        return <RFIsTab projectId={currentProjectId} dataVersion={dataVersion} />
      case 'cost':
        return <CostTab projectId={currentProjectId} dataVersion={dataVersion} />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header onPopOut={handlePopOut} />
      
      {/* Global Project Selector (shown when not on Procore tab) */}
      {!isProcoreTab && projects.length > 0 && (
        <ProjectSelector
          projects={projects}
          currentProjectId={currentProjectId}
          onProjectChange={handleProjectChange}
        />
      )}

      <TabBar 
        tabs={TABS} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      <main className="flex-1 overflow-hidden">
        {renderActiveTab()}
      </main>
    </div>
  )
}
