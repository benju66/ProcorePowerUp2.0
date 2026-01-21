/**
 * Settings Component
 * 
 * Dropdown menu for user preferences.
 * Follows SRP - handles UI only, delegates logic to hooks/services.
 */

import { useState, useEffect, useRef } from 'preact/hooks'
import { useTheme } from '../contexts/ThemeContext'
import { useTabVisibility } from '../contexts/TabVisibilityContext'
import { useMascot } from '../contexts/MascotContext'
import { useFavorites } from '../hooks/useFavorites'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { FolderInput } from './FolderInput'
import { CollapsibleSection } from './CollapsibleSection'
import { AVAILABLE_TOOLS } from '../utils/tools'
import { FolderOpen, Rocket, Palette, RefreshCcw, SlidersHorizontal, Star, Trash2, Plus, X, Folder, Loader2 } from 'lucide-preact'
import type { Project } from '@/types'
import type { ToolId } from '@/types/tools'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  buttonRef?: { current: HTMLElement | null }
  currentProjectId?: string | null
  projects?: Project[]
  onProjectDeleted?: (projectId: string) => Promise<void>
  // Quick Nav props
  showToolButtons?: boolean
  visibleTools?: ToolId[]
  onToggleMaster?: (enabled: boolean) => void
  onToggleTool?: (toolId: ToolId, checked: boolean) => void
}

export function Settings({ 
  isOpen, 
  onClose, 
  buttonRef, 
  currentProjectId, 
  projects = [], 
  onProjectDeleted,
  showToolButtons = true,
  visibleTools = [],
  onToggleMaster,
  onToggleTool,
}: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const { showRFIsTab, showCostTab, showSpecificationsTab, setShowRFIsTab, setShowCostTab, setShowSpecificationsTab } = useTabVisibility()
  const { animationLevel, setAnimationLevel, triggerMood } = useMascot()
  const { folders, addFolder, removeFolder, addDrawingToFolder, isLoading: favoritesLoading } = useFavorites()
  const [openInBackground, setOpenInBackground] = useState(false)
  const [showFloatingButton, setShowFloatingButton] = useState(true)
  const [showFolderInput, setShowFolderInput] = useState(false)
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Scan state
  const [scanState, setScanState] = useState<{
    type: 'drawings' | 'rfis' | 'commitments' | 'specifications' | null
    isScanning: boolean
    percent: number
    status: string | null
  }>({
    type: null,
    isScanning: false,
    percent: 0,
    status: null
  })

  // Delete project state
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const displayName = projectName || `Project ${projectId}`
    if (!confirm(`Delete "${displayName}"? All cached data will be removed.`)) {
      return
    }
    
    setDeletingProjectId(projectId)
    try {
      await onProjectDeleted?.(projectId)
    } catch (error) {
      console.error('Failed to delete project:', error)
    } finally {
      setDeletingProjectId(null)
    }
  }

  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const [bg, buttonPrefs] = await Promise.all([
          StorageService.getPreferences<boolean>(
            PREFERENCE_KEYS.openInBackground,
            false
          ),
          chrome.storage.local.get(['pp_button_prefs']).then(result => {
            const prefs = (result.pp_button_prefs || {}) as { showFloatingButton?: boolean }
            // Default to true if not set
            return prefs.showFloatingButton !== false
          })
        ])
        setOpenInBackground(bg)
        setShowFloatingButton(buttonPrefs)
      } catch (error) {
        console.error('Failed to load preferences:', error)
      }
    }
    if (isOpen) {
      loadPreferences()
    }
  }, [isOpen])

  // Listen for scan progress updates
  useEffect(() => {
    const handleMessage = async (message: { type: string; payload?: unknown }) => {
      if (message.type === 'SCAN_PROGRESS') {
        const payload = message.payload as { 
          status: string
          scanType: string
          percent: number
          message?: string
        }
        
        setScanState({
          type: payload.scanType as 'drawings' | 'rfis' | 'commitments',
          isScanning: payload.status !== 'complete' && payload.status !== 'timeout',
          percent: payload.percent,
          status: payload.message || `Scanning... ${payload.percent}%`
        })

        if (payload.status === 'complete' || payload.status === 'timeout') {
          setTimeout(() => {
            setScanState(prev => ({
              ...prev,
              isScanning: false,
              status: payload.status === 'timeout' ? 'Scan complete (timeout)' : 'Scan complete!'
            }))
            setTimeout(() => {
              setScanState({
                type: null,
                isScanning: false,
                percent: 0,
                status: null
              })
            }, 3000)
          }, 500)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  // Position dropdown relative to button
  useEffect(() => {
    if (!isOpen || !buttonRef?.current || !dropdownRef.current) return
    
    const buttonRect = buttonRef.current.getBoundingClientRect()
    const dropdown = dropdownRef.current
    
    dropdown.style.top = `${buttonRect.bottom + 8}px`
    dropdown.style.right = `${window.innerWidth - buttonRect.right}px`
  }, [isOpen, buttonRef])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        dropdownRef.current?.contains(target) ||
        buttonRef?.current?.contains(target)
      ) {
        return
      }
      onClose()
    }
    
    // Use mousedown to catch clicks before they bubble
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, buttonRef])

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return
    
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    await setTheme(newTheme)
  }

  const handleOpenInBackgroundChange = async (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked
    setOpenInBackground(checked)
    try {
      await StorageService.savePreference(PREFERENCE_KEYS.openInBackground, checked)
    } catch (error) {
      console.error('Failed to save preference:', error)
      // Revert on error
      setOpenInBackground(!checked)
    }
  }

  const handleShowFloatingButtonChange = async (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked
    setShowFloatingButton(checked)
    try {
      // Save to chrome.storage.local (same as button position preference)
      const result = await chrome.storage.local.get(['pp_button_prefs'])
      const existingPrefs = result.pp_button_prefs || {}
      await chrome.storage.local.set({
        pp_button_prefs: {
          ...existingPrefs,
          showFloatingButton: checked
        }
      })
    } catch (error) {
      console.error('Failed to save floating button preference:', error)
      // Revert on error
      setShowFloatingButton(!checked)
    }
  }

  const handleFolderSubmit = async (name: string) => {
    try {
      await addFolder(name)
      setShowFolderInput(false)
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleRemoveFolder = async (folderId: number) => {
    if (confirm('Delete this folder? Drawings will remain but folder will be removed.')) {
      await removeFolder(folderId)
    }
  }

  const handleScan = async (scanType: 'drawings' | 'rfis' | 'commitments' | 'specifications') => {
    if (scanState.isScanning) return

    setScanState({
      type: scanType,
      isScanning: true,
      percent: 0,
      status: 'Starting scan...'
    })

    try {
      const tabResponse = await chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB' }) as { 
        tabId?: number
        isProcoreTab?: boolean 
      }
      
      if (!tabResponse?.isProcoreTab || !tabResponse.tabId) {
        const pageNames: Record<string, string> = {
          drawings: 'Drawings',
          rfis: 'RFIs',
          commitments: 'Commitments',
          specifications: 'Specifications'
        }
        setScanState({
          type: scanType,
          isScanning: false,
          percent: 0,
          status: `Error: Open Procore ${pageNames[scanType]} page first`
        })
        setTimeout(() => {
          setScanState({
            type: null,
            isScanning: false,
            percent: 0,
            status: null
          })
        }, 3000)
        return
      }

      const result = await chrome.tabs.sendMessage(tabResponse.tabId, {
        action: 'PAGE_SCAN',
        scanType
      }) as { success: boolean; message: string }

      if (!result.success) {
        setScanState({
          type: scanType,
          isScanning: false,
          percent: 0,
          status: `Error: ${result.message}`
        })
        setTimeout(() => {
          setScanState({
            type: null,
            isScanning: false,
            percent: 0,
            status: null
          })
        }, 3000)
      } else {
        setScanState(prev => ({
          ...prev,
          status: 'Scanning page...'
        }))
      }
    } catch (error) {
      console.error(`${scanType} scan failed:`, error)
      setScanState({
        type: scanType,
        isScanning: false,
        percent: 0,
        status: 'Error: Could not connect to page'
      })
      setTimeout(() => {
        setScanState({
          type: null,
          isScanning: false,
          percent: 0,
          status: null
        })
      }, 3000)
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[260px] max-h-[calc(100vh-60px)] overflow-y-auto"
      role="menu"
      aria-label="Settings"
    >
      {/* Projects Section - Always visible, expanded by default */}
      {projects.length > 0 && (
        <CollapsibleSection
          title="Projects"
          icon={<FolderOpen size={16} />}
          preferenceKey={PREFERENCE_KEYS.settingsProjectsExpanded}
          defaultExpanded={true}
          badge={projects.length}
        >
          <div className="px-2 space-y-1 max-h-40 overflow-y-auto">
            {projects.map(project => (
              <div
                key={project.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-sm group ${
                  project.id === currentProjectId 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">
                    {project.name || `Project ${project.id}`}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(project.lastAccessed).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteProject(project.id, project.name || '')}
                  disabled={deletingProjectId === project.id}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity disabled:opacity-50"
                  title="Delete project"
                >
                  {deletingProjectId === project.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Quick Nav Section */}
      <CollapsibleSection
        title="Quick Nav"
        icon={<Rocket size={16} />}
        preferenceKey={PREFERENCE_KEYS.settingsQuickNavExpanded}
        defaultExpanded={false}
      >
        <div className="px-2 space-y-3">
          {/* Master Toggle */}
          <label className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
            <span>Show Toolbar</span>
            <input
              type="checkbox"
              checked={showToolButtons}
              onChange={(e) => onToggleMaster?.((e.target as HTMLInputElement).checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>
          
          {/* Tool Checklist - only show when master toggle is ON */}
          {showToolButtons && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">Visible Tools</div>
              <div className="grid grid-cols-2 gap-1">
                {AVAILABLE_TOOLS.map((tool) => (
                  <label
                    key={tool.id}
                    className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleTools.includes(tool.id)}
                      onChange={(e) => onToggleTool?.(tool.id, (e.target as HTMLInputElement).checked)}
                      className="w-3 h-3 text-blue-600 rounded"
                    />
                    <span className="truncate text-xs">{tool.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Appearance Section */}
      <CollapsibleSection
        title="Appearance"
        icon={<Palette size={16} />}
        preferenceKey={PREFERENCE_KEYS.settingsAppearanceExpanded}
        defaultExpanded={false}
      >
        <div className="px-2 space-y-3">
          {/* Theme */}
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">Theme</div>
            <div className="space-y-1">
              {(['light', 'dark', 'auto'] as const).map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="theme"
                    checked={theme === option}
                    onChange={() => handleThemeChange(option)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="capitalize">{option === 'auto' ? 'Auto' : option}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Mascot */}
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">Mascot</div>
            <div className="space-y-1">
              {(['off', 'subtle', 'normal'] as const).map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="animationLevel"
                    checked={animationLevel === option}
                    onChange={() => setAnimationLevel(option)}
                    className="w-3 h-3 text-blue-600"
                  />
                  <span className="capitalize">{option}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => triggerMood('happy', 1000)}
              className="mt-2 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Test Animation
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Data Sync Section */}
      {currentProjectId && (
        <CollapsibleSection
          title="Data Sync"
          icon={<RefreshCcw size={16} />}
          preferenceKey={PREFERENCE_KEYS.settingsDataSyncExpanded}
          defaultExpanded={false}
        >
          <div className="px-2 space-y-2">
            <button
              onClick={() => handleScan('drawings')}
              disabled={scanState.isScanning}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {scanState.isScanning && scanState.type === 'drawings' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{scanState.percent}%</span>
                </>
              ) : (
                <span>Scan Drawings</span>
              )}
            </button>
            
            {showRFIsTab && (
              <button
                onClick={() => handleScan('rfis')}
                disabled={scanState.isScanning}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {scanState.isScanning && scanState.type === 'rfis' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>{scanState.percent}%</span>
                  </>
                ) : (
                  <span>Scan RFIs</span>
                )}
              </button>
            )}
            
            {showCostTab && (
              <button
                onClick={() => handleScan('commitments')}
                disabled={scanState.isScanning}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {scanState.isScanning && scanState.type === 'commitments' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{scanState.percent}%</span>
                  </>
                ) : (
                  <span>Scan Commitments</span>
                )}
              </button>
            )}
            
            {showSpecificationsTab && (
              <button
                onClick={() => handleScan('specifications')}
                disabled={scanState.isScanning}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {scanState.isScanning && scanState.type === 'specifications' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{scanState.percent}%</span>
                  </>
                ) : (
                  <span>Scan Specifications</span>
                )}
              </button>
            )}
            
            {scanState.status && (
              <div className={`px-2 py-1.5 text-xs rounded ${
                scanState.status.startsWith('Error') 
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                  : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              }`}>
                {scanState.status}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Preferences Section */}
      <CollapsibleSection
        title="Preferences"
        icon={<SlidersHorizontal size={16} />}
        preferenceKey={PREFERENCE_KEYS.settingsPreferencesExpanded}
        defaultExpanded={false}
      >
        <div className="px-2 space-y-2">
          <label className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
            <span>Open in Background</span>
            <input
              type="checkbox"
              checked={openInBackground}
              onChange={handleOpenInBackgroundChange}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>
          
          <label className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
            <span>Floating Button</span>
            <input
              type="checkbox"
              checked={showFloatingButton}
              onChange={handleShowFloatingButtonChange}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">Tab Visibility</div>
            <label className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
              <span>Show RFIs Tab</span>
              <input
                type="checkbox"
                checked={showRFIsTab}
                onChange={(e) => setShowRFIsTab((e.target as HTMLInputElement).checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>
            <label className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
              <span>Show Cost Tab</span>
              <input
                type="checkbox"
                checked={showCostTab}
                onChange={(e) => setShowCostTab((e.target as HTMLInputElement).checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>
            <label className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
              <span>Show Specifications Tab</span>
              <input
                type="checkbox"
                checked={showSpecificationsTab}
                onChange={(e) => setShowSpecificationsTab((e.target as HTMLInputElement).checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {/* Favorites Section */}
      {currentProjectId && (
        <CollapsibleSection
          title="Favorites"
          icon={<Star size={16} />}
          preferenceKey={PREFERENCE_KEYS.settingsFavoritesExpanded}
          defaultExpanded={false}
          badge={folders.length}
        >
          <div className="px-2">
            {showFolderInput ? (
              <FolderInput
                onSubmit={handleFolderSubmit}
                onCancel={() => setShowFolderInput(false)}
              />
            ) : (
              <button
                onClick={() => setShowFolderInput(true)}
                className="w-full px-2 py-1.5 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded flex items-center gap-2"
              >
                <Plus size={16} />
                <span>New Folder</span>
              </button>
            )}

            {!favoritesLoading && folders.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverFolderId(folder.id)
                    }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverFolderId(null)
                      const drawingNum = e.dataTransfer?.getData("text/plain")
                      if (drawingNum) {
                        await addDrawingToFolder(folder.id, drawingNum)
                      }
                    }}
                    className={`px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group transition-colors ${
                      dragOverFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Folder size={16} className="text-yellow-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{folder.name}</span>
                      <span className="text-xs text-gray-400">({folder.drawings.length})</span>
                    </div>
                    <button
                      onClick={() => handleRemoveFolder(folder.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 px-1"
                      title="Delete folder"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!favoritesLoading && folders.length === 0 && !showFolderInput && (
              <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                No folders yet.
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
