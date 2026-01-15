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

export function App() {
  const [activeTab, setActiveTab] = useState<TabInfo['id']>('drawings')
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [isProcoreTab, setIsProcoreTab] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
          
          // Extract project ID from URL
          const match = response.url.match(/projects\/(\d+)/) || response.url.match(/\/(\d+)\/project/)
          if (match?.[1]) {
            setCurrentProjectId(match[1])
            
            // Update project access timestamp
            await StorageService.updateProjectAccess(match[1], {})
          }
        }
      } catch {
        // Not in a tab context (e.g., popped out window)
      }

      setIsLoading(false)
    }

    init()
  }, [])

  // Listen for tab updates and wiretap data
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'TAB_UPDATED') {
        const payload = message.payload as { url: string }
        const match = payload.url.match(/projects\/(\d+)/) || payload.url.match(/\/(\d+)\/project/)
        if (match?.[1]) {
          setCurrentProjectId(match[1])
          setIsProcoreTab(true)
        }
      }

      if (message.type === 'WIRETAP_DATA') {
        // Handle incoming wiretap data
        handleWiretapData(message.payload)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [currentProjectId])

  const handleWiretapData = useCallback(async (payload: unknown) => {
    // Process wiretap data and save to storage
    // This will be called when the wiretap captures API responses
    console.log('Wiretap data received:', payload)
    
    // Refresh projects list in case new data was saved
    const updatedProjects = await StorageService.getAllProjects()
    setProjects(updatedProjects)
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
        return <DrawingsTab projectId={currentProjectId} />
      case 'rfis':
        return <RFIsTab projectId={currentProjectId} />
      case 'cost':
        return <CostTab projectId={currentProjectId} />
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
