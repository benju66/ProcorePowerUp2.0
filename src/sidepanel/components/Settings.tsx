/**
 * Settings Component
 * 
 * Dropdown menu for user preferences.
 * Follows SRP - handles UI only, delegates logic to hooks/services.
 */

import { useState, useEffect, useRef } from 'preact/hooks'
import { useTheme } from '../contexts/ThemeContext'
import { useFavorites } from '../hooks/useFavorites'
import { StorageService } from '@/services'
import { PREFERENCE_KEYS } from '@/types/preferences'
import { FolderInput } from './FolderInput'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  buttonRef?: { current: HTMLElement | null }
  currentProjectId?: string | null
}

export function Settings({ isOpen, onClose, buttonRef, currentProjectId }: SettingsProps) {
  const { theme, setTheme } = useTheme()
  const { folders, addFolder, removeFolder, addDrawingToFolder, isLoading: favoritesLoading } = useFavorites()
  const [openInBackground, setOpenInBackground] = useState(false)
  const [showFolderInput, setShowFolderInput] = useState(false)
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Scan state
  const [scanState, setScanState] = useState<{
    type: 'drawings' | 'rfis' | 'commitments' | null
    isScanning: boolean
    percent: number
    status: string | null
  }>({
    type: null,
    isScanning: false,
    percent: 0,
    status: null
  })

  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const bg = await StorageService.getPreferences<boolean>(
          PREFERENCE_KEYS.openInBackground,
          false
        )
        setOpenInBackground(bg)
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

  const handleScan = async (scanType: 'drawings' | 'rfis' | 'commitments') => {
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
        setScanState({
          type: scanType,
          isScanning: false,
          percent: 0,
          status: `Error: Open Procore ${scanType === 'drawings' ? 'Drawings' : scanType === 'rfis' ? 'RFIs' : 'Commitments'} page first`
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
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[220px] p-3"
      role="menu"
      aria-label="Settings"
    >
      <div className="space-y-3">
        {/* Theme Section */}
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            Theme
          </div>
          <div className="space-y-1">
            {(['light', 'dark', 'auto'] as const).map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
                role="menuitemradio"
                aria-checked={theme === option}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option}
                  checked={theme === option}
                  onChange={() => handleThemeChange(option)}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <span className="capitalize">{option === 'auto' ? 'Auto (System)' : option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Data Sync Section */}
        {currentProjectId && (
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
              Data Sync
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleScan('drawings')}
                disabled={scanState.isScanning}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                role="menuitem"
              >
                {scanState.isScanning && scanState.type === 'drawings' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>{scanState.percent}%</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Scan Drawings</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleScan('rfis')}
                disabled={scanState.isScanning}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                role="menuitem"
              >
                {scanState.isScanning && scanState.type === 'rfis' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>{scanState.percent}%</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Scan RFIs</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleScan('commitments')}
                disabled={scanState.isScanning}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                role="menuitem"
              >
                {scanState.isScanning && scanState.type === 'commitments' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>{scanState.percent}%</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Scan Commitments</span>
                  </>
                )}
              </button>
            </div>
            
            {scanState.status && (
              <div className={`mt-2 px-2 py-1.5 text-xs rounded ${
                scanState.status.startsWith('Error') 
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                  : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              }`}>
                {scanState.status}
              </div>
            )}
          </div>
        )}

        {/* Preferences Section */}
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            Preferences
          </div>
          <label 
            className="flex items-center justify-between px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
            role="menuitemcheckbox"
            aria-checked={openInBackground}
          >
            <span>Open in Background Tab</span>
            <input
              type="checkbox"
              checked={openInBackground}
              onChange={handleOpenInBackgroundChange}
              className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </label>
          <div className="px-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            When enabled, links open without switching tabs
          </div>
        </div>

        {/* Favorites Section */}
        {currentProjectId && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
            <div className="px-3 mb-2">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Favorites
              </h3>
            </div>
            
            {showFolderInput ? (
              <FolderInput
                onSubmit={handleFolderSubmit}
                onCancel={() => setShowFolderInput(false)}
              />
            ) : (
              <button
                onClick={() => setShowFolderInput(true)}
                className="w-full px-3 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <span>+</span>
                <span>New Folder</span>
              </button>
            )}

            {!favoritesLoading && folders.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto">
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
                    className={`px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group transition-colors ${
                      dragOverFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-yellow-500">📁</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{folder.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        ({folder.drawings.length})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFolder(folder.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs px-2"
                      title="Delete folder"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!favoritesLoading && folders.length === 0 && !showFolderInput && (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                No folders yet. Create one to organize your favorite drawings.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
