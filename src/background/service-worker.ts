/**
 * Background Service Worker
 * 
 * Handles:
 * - Side panel lifecycle
 * - Message routing between content scripts and side panel
 * - Pop-out window creation
 * - WIRETAP DATA STORAGE (always running, even when side panel is closed)
 * - API SCANNING (has host_permissions, can fetch from Procore)
 */

import { StorageService } from '../services/storage'
import { ApiService } from '../services/api'
import { PREFERENCE_KEYS } from '../types/preferences'
import type { WiretapMessage, Drawing, Commitment, DisciplineMap } from '../types'

// ============================================
// DATA DETECTION FUNCTIONS (ported from v1)
// ============================================

interface RawDataItem {
  id?: number | string
  name?: string  // Used by discipline items
  number?: string
  drawing_number?: string
  title?: string
  vendor?: string
  vendor_name?: string
  contract_date?: string
  type?: string
  discipline?: number | { id?: number; name?: string }
  discipline_name?: string
  subject?: string
  status?: string
  total_revisions?: number  // Used by discipline items
  [key: string]: unknown
}

function isCommitment(item: RawDataItem): boolean {
  if (!item || !item.id) return false
  if (item.drawing_number) return false
  const hasInfo = item.number || item.title || item.contract_date
  const hasContext = item.vendor || item.vendor_name || 
    (item.type && String(item.type).includes('Contract'))
  return !!(hasInfo && hasContext)
}

function isDrawing(item: RawDataItem): boolean {
  if (!item || !item.id) return false
  const hasNum = item.number || item.drawing_number
  if (!hasNum) return false
  if (item.vendor || item.vendor_name || item.contract_date) return false
  return true
}

function isRFI(item: RawDataItem): boolean {
  return !(!item || !item.id || item.drawing_number || item.vendor || item.vendor_name) && 
    !!(item.subject && item.status && item.number !== undefined)
}

function findDataInObject(obj: unknown): RawDataItem[] {
  if (!obj) return []
  if (Array.isArray(obj)) return obj as RawDataItem[]
  const record = obj as Record<string, unknown>
  if (record.data && Array.isArray(record.data)) return record.data as RawDataItem[]
  if (record.entities && Array.isArray(record.entities)) return record.entities as RawDataItem[]
  for (const key in record) {
    if (Array.isArray(record[key]) && (record[key] as unknown[]).length > 0) {
      return record[key] as RawDataItem[]
    }
  }
  return []
}

function normalizeDrawing(item: RawDataItem): Drawing {
  // Keep discipline as-is (could be object {id, name} or number)
  // This matches v1 behavior
  const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id!
  const drawing: Drawing = {
    id: numericId as number,
    num: (item.number || item.drawing_number || '') as string,
    title: (item.title || '') as string,
  }
  
  // Store discipline - keep the whole object if it exists
  if (item.discipline) {
    drawing.discipline = item.discipline as Drawing['discipline']
  }
  
  // Also capture discipline_name if present directly
  if (item.discipline_name) {
    drawing.discipline_name = item.discipline_name as string
  } else if (typeof item.discipline === 'object' && item.discipline !== null) {
    const disc = item.discipline as { name?: string }
    if (disc.name) {
      drawing.discipline_name = disc.name
    }
  }
  
  return drawing
}

function normalizeCommitment(item: RawDataItem): Commitment {
  const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id!
  return {
    id: numericId as number,
    number: (item.number || '') as string,
    title: (item.title || '') as string,
    vendor: item.vendor as string | undefined,
    vendor_name: item.vendor_name || 
      (typeof item.vendor === 'object' ? (item.vendor as { name?: string })?.name : undefined),
    status: item.status as string | undefined,
    contract_date: item.contract_date as string | undefined,
    type: item.type as string | undefined,
    approved_amount: item.approved_amount as number | undefined,
    pending_amount: item.pending_amount as number | undefined,
    draft_amount: item.draft_amount as number | undefined,
  }
}

function findDisciplinesRecursive(obj: unknown, map: DisciplineMap, sortCounter: number, depth: number): void {
  if (depth > 5 || !obj || typeof obj !== 'object') return
  const item = obj as Record<string, unknown>
  if (item.id && item.name && typeof item.name === 'string' && !item.drawing_number && !item.number) {
    // Convert string IDs to numbers (discipline API returns string IDs like "10931276")
    const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id as number
    if (!isNaN(numericId)) {
      map[numericId] = { name: item.name as string, index: sortCounter }
    }
  }
  if (Array.isArray(obj)) {
    obj.forEach((child, index) => findDisciplinesRecursive(child, map, index, depth + 1))
  } else {
    for (const key in item) {
      if (!['permissions', 'metadata', 'view_options'].includes(key)) {
        findDisciplinesRecursive(item[key], map, sortCounter, depth + 1)
      }
    }
  }
}

// Check if an item looks like a discipline object (has id + name, but no drawing fields)
function isDisciplineItem(item: RawDataItem): boolean {
  if (!item || !item.id) return false
  // Must have a name
  if (!item.name || typeof item.name !== 'string') return false
  // Must NOT have drawing-specific fields
  if (item.number || item.drawing_number) return false
  // Must NOT have commitment-specific fields
  if (item.vendor || item.vendor_name || item.contract_date) return false
  return true
}

// ============================================
// WIRETAP DATA HANDLER
// ============================================

async function handleWiretapData(wiretapMessage: WiretapMessage): Promise<{ saved: boolean; type?: string; count?: number }> {
  const { payload, ids, source } = wiretapMessage
  
  console.log('PP Background: Wiretap received', {
    source,
    ids,
    payloadType: Array.isArray(payload) ? 'array' : typeof payload,
    payloadLength: Array.isArray(payload) ? payload.length : 'N/A'
  })
  
  const activeProjectId = ids.projectId
  if (!activeProjectId) {
    console.log('PP Background: No project ID, skipping')
    return { saved: false }
  }

  console.log('PP Background: Processing wiretap from:', source, 'for project:', activeProjectId)

  // Only update IDs that are actually present (don't overwrite with undefined)
  const projectUpdates: Partial<{ companyId: string; drawingAreaId: string }> = {}
  if (ids.companyId) projectUpdates.companyId = ids.companyId
  if (ids.drawingAreaId) projectUpdates.drawingAreaId = ids.drawingAreaId
  
  if (Object.keys(projectUpdates).length > 0) {
    await StorageService.updateProjectAccess(activeProjectId, projectUpdates)
  }

  const dataItems = findDataInObject(payload)
  console.log('PP Background: Found', dataItems.length, 'data items')
  
  if (dataItems.length === 0) {
    console.log('PP Background: No data items found in payload')
    return { saved: false }
  }

  const sourceLower = (source || '').toLowerCase()
  const firstItem = dataItems[0]
  
  console.log('PP Background: First item sample:', {
    id: firstItem?.id,
    name: firstItem?.name,
    number: firstItem?.number,
    drawing_number: firstItem?.drawing_number,
    title: firstItem?.title,
    subject: firstItem?.subject,
    vendor: firstItem?.vendor,
  })

  const isCommitmentSrc = sourceLower.includes('commitment') || sourceLower.includes('contract')
  const isDrawingSrc = sourceLower.includes('drawing') || sourceLower.includes('discipline') || sourceLower.includes('groups')
  const isRFISrc = sourceLower.includes('/rfis')
  const isDisciplineSrc = sourceLower.includes('discipline') || sourceLower.includes('groups/discipline')
  
  console.log('PP Background: Source detection:', { isCommitmentSrc, isDrawingSrc, isRFISrc, isDisciplineSrc })
  
  // PRIORITY 1: Check for discipline data FIRST (before drawings)
  // Discipline responses have items with {id, name} but no drawing_number/number
  if (isDisciplineSrc && isDisciplineItem(firstItem)) {
    console.log('PP Background: Detected discipline data!')
    const disciplineMap: DisciplineMap = {}
    
    dataItems.forEach((item, index) => {
      if (item.id && item.name && typeof item.name === 'string') {
        // Convert string IDs to numbers
        const numericId = typeof item.id === 'string' ? parseInt(item.id as string, 10) : item.id
        if (!isNaN(numericId)) {
          disciplineMap[numericId] = { 
            name: item.name as string, 
            index 
          }
        }
      }
    })
    
    if (Object.keys(disciplineMap).length > 0) {
      const existing = await StorageService.getDisciplineMap(activeProjectId)
      const merged = { ...existing, ...disciplineMap }
      await StorageService.saveDisciplineMap(activeProjectId, merged)
      console.log('PP Background: Saved', Object.keys(disciplineMap).length, 'disciplines:', 
        Object.entries(disciplineMap).map(([id, d]) => `${id}:${d.name}`).join(', '))
      return { saved: true, type: 'disciplines', count: Object.keys(disciplineMap).length }
    }
  }

  // Process RFIs
  if (isRFISrc && isRFI(firstItem)) {
    const rfis = dataItems.filter(isRFI).map(item => {
      const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id!
      return {
        id: numericId as number,
        number: (item.number || '') as string,
        subject: (item.subject || '') as string,
        status: (item.status || 'unknown') as string,
        created_at: (item.created_at || '') as string,
        due_date: item.due_date as string | undefined,
        assignee: item.assignee as string | undefined,
        ball_in_court: item.ball_in_court as string | undefined,
      }
    })
    
    if (rfis.length > 0) {
      await StorageService.mergeRFIs(activeProjectId, rfis)
      console.log('PP Background: Saved', rfis.length, 'RFIs')
      return { saved: true, type: 'rfis', count: rfis.length }
    }
  }
  
  // Process Commitments
  if (isCommitmentSrc && isCommitment(firstItem)) {
    const commitments = dataItems.filter(isCommitment).map(normalizeCommitment)
    if (commitments.length > 0) {
      await StorageService.mergeCommitments(activeProjectId, commitments)
      console.log('PP Background: Saved', commitments.length, 'commitments')
      return { saved: true, type: 'commitments', count: commitments.length }
    }
  }
  
  // Process Drawings (default)
  console.log('PP Background: Checking if drawings...', {
    isDrawingSrc,
    isCommitmentSrc,
    isDrawingCheck: isDrawing(firstItem),
    condition: (isDrawingSrc || !isCommitmentSrc) && isDrawing(firstItem)
  })
  
  if ((isDrawingSrc || !isCommitmentSrc) && isDrawing(firstItem)) {
    const drawings = dataItems.filter(isDrawing).map(normalizeDrawing)
    console.log('PP Background: Filtered to', drawings.length, 'valid drawings')
    
    // Log sample drawing with discipline info
    if (drawings.length > 0) {
      console.log('PP Background: Sample normalized drawing:', JSON.stringify(drawings[0], null, 2))
    }
    
    if (drawings.length > 0) {
      await StorageService.mergeDrawings(activeProjectId, drawings)
      console.log('PP Background: Saved', drawings.length, 'drawings to project', activeProjectId)
      
      // Build discipline map from the payload (finds {id, name} objects)
      const disciplineMap: DisciplineMap = {}
      findDisciplinesRecursive(payload, disciplineMap, 0, 0)
      
      // Also extract disciplines directly from drawings that have discipline objects
      for (const drawing of drawings) {
        // Handle discipline as object {id, name}
        if (drawing.discipline && typeof drawing.discipline === 'object') {
          const disc = drawing.discipline as { id?: number; name?: string }
          if (disc.id && disc.name && !disciplineMap[disc.id]) {
            disciplineMap[disc.id] = { 
              name: disc.name, 
              index: Object.keys(disciplineMap).length 
            }
          }
        }
        // Handle discipline as number with discipline_name
        else if (typeof drawing.discipline === 'number' && drawing.discipline_name) {
          if (!disciplineMap[drawing.discipline]) {
            disciplineMap[drawing.discipline] = { 
              name: drawing.discipline_name, 
              index: Object.keys(disciplineMap).length 
            }
          }
        }
      }
      
      console.log('PP Background: Found', Object.keys(disciplineMap).length, 'disciplines:', Object.entries(disciplineMap).map(([id, d]) => `${id}:${d.name}`).join(', '))
      
      if (Object.keys(disciplineMap).length > 0) {
        const existing = await StorageService.getDisciplineMap(activeProjectId)
        const merged = { ...existing, ...disciplineMap }
        await StorageService.saveDisciplineMap(activeProjectId, merged)
        console.log('PP Background: Saved discipline map with', Object.keys(merged).length, 'entries')
      }
      
      return { saved: true, type: 'drawings', count: drawings.length }
    }
  }

  return { saved: false }
}

// ============================================
// API SCAN HANDLERS (background has host_permissions)
// ============================================

async function handleScanDrawings(projectId: string, drawingAreaId?: string, disciplinesOnly = false): Promise<{ success: boolean; count?: number; error?: string }> {
  console.log('PP Background: Scanning', disciplinesOnly ? 'disciplines only' : 'drawings', 'for project', projectId)
  
  try {
    // Get drawing area ID if not provided
    let areaId = drawingAreaId
    if (!areaId) {
      const project = await StorageService.getProject(projectId)
      areaId = project?.drawingAreaId
    }
    
    if (!areaId) {
      // Try to fetch drawing areas
      const areas = await ApiService.fetchDrawingAreas(projectId)
      if (areas.length > 0) {
        areaId = String(areas[0].id)
        await StorageService.updateProjectAccess(projectId, { drawingAreaId: areaId })
      }
    }
    
    if (!areaId) {
      return { success: false, error: 'No drawing area found' }
    }

    // Fetch disciplines (always)
    const disciplines = await ApiService.fetchDisciplines(projectId, areaId)
    if (Object.keys(disciplines).length > 0) {
      // Merge with existing to preserve any manually captured data
      const existing = await StorageService.getDisciplineMap(projectId)
      const merged = { ...existing, ...disciplines }
      await StorageService.saveDisciplineMap(projectId, merged)
      console.log('PP Background: Saved', Object.keys(disciplines).length, 'disciplines (merged total:', Object.keys(merged).length, ')')
    }

    // Fetch drawings only if not disciplines-only mode
    let drawingCount = 0
    if (!disciplinesOnly) {
      const drawings = await ApiService.fetchDrawings(projectId, areaId)
      if (drawings.length > 0) {
        await StorageService.mergeDrawings(projectId, drawings)
        drawingCount = drawings.length
      }
      console.log('PP Background: Scan complete, found', drawingCount, 'drawings')
    }

    return { success: true, count: disciplinesOnly ? Object.keys(disciplines).length : drawingCount }
  } catch (error) {
    console.error('PP Background: Scan failed', error)
    return { success: false, error: String(error) }
  }
}

async function handleScanRFIs(projectId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  console.log('PP Background: Scanning RFIs for project', projectId)
  
  try {
    const rfis = await ApiService.fetchRFIs(projectId)
    if (rfis.length > 0) {
      await StorageService.mergeRFIs(projectId, rfis)
    }
    
    console.log('PP Background: Scan complete, found', rfis.length, 'RFIs')
    return { success: true, count: rfis.length }
  } catch (error) {
    console.error('PP Background: RFI scan failed', error)
    return { success: false, error: String(error) }
  }
}

async function handleScanCommitments(projectId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  console.log('PP Background: Scanning commitments for project', projectId)
  
  try {
    const commitments = await ApiService.fetchCommitments(projectId)
    if (commitments.length > 0) {
      await StorageService.mergeCommitments(projectId, commitments)
    }
    
    console.log('PP Background: Scan complete, found', commitments.length, 'commitments')
    return { success: true, count: commitments.length }
  } catch (error) {
    console.error('PP Background: Commitment scan failed', error)
    return { success: false, error: String(error) }
  }
}

// ============================================
// SIDE PANEL LIFECYCLE & STATE TRACKING (Port-based)
// ============================================

// Track panel state using port connections (more reliable than events)
// Map of tabId -> port for connected side panels
const panelPorts = new Map<number, chrome.runtime.Port>()

// Notify content script of panel state change
async function notifyPanelState(tabId: number, isOpen: boolean): Promise<void> {
  console.log(`PP: Notifying tab ${tabId} panel state: ${isOpen ? 'open' : 'closed'}`)
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SIDEPANEL_STATE', isOpen })
  } catch {
    // Tab may not have content script loaded
  }
}

// Handle port connections from side panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return
  
  console.log('PP: Side panel connected')
  let associatedTabId: number | null = null
  
  // Listen for messages from the side panel
  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'PANEL_OPENED') {
      // Side panel sent its tab ID, or we need to determine it
      if (msg.tabId) {
        associatedTabId = msg.tabId
      } else {
        // Fallback: query for active tab
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.id) {
            associatedTabId = tab.id
          }
        } catch {
          console.error('PP: Could not determine tab ID for panel')
        }
      }
      
      if (associatedTabId) {
        console.log('PP: Panel opened for tab:', associatedTabId)
        panelPorts.set(associatedTabId, port)
        await notifyPanelState(associatedTabId, true)
      }
    }
  })
  
  // When port disconnects, the panel has closed
  port.onDisconnect.addListener(() => {
    console.log('PP: Side panel disconnected, tab:', associatedTabId)
    
    if (associatedTabId) {
      panelPorts.delete(associatedTabId)
      notifyPanelState(associatedTabId, false)
    } else {
      // Fallback: if we never got tab ID, notify all Procore tabs
      chrome.tabs.query({ url: '*://*.procore.com/*' })
        .then((tabs) => {
          for (const tab of tabs) {
            if (tab.id && !panelPorts.has(tab.id)) {
              notifyPanelState(tab.id, false)
            }
          }
        })
        .catch(() => {})
    }
  })
})

// Check if panel is open for a tab
function isPanelOpen(tabId: number): boolean {
  return panelPorts.has(tabId)
}

// Open side panel for a tab
async function openSidePanel(tabId: number): Promise<boolean> {
  try {
    await chrome.sidePanel.open({ tabId })
    // Note: notifyPanelState will be called when panel connects via port
    return true
  } catch (error) {
    console.error('PP: Failed to open side panel:', error)
    return false
  }
}

// Close side panel by sending message to panel to close itself
async function closeSidePanel(_tabId: number): Promise<boolean> {
  try {
    // Send message to the side panel to close itself
    await chrome.runtime.sendMessage({ type: 'CLOSE_SIDEPANEL' })
    // Note: notifyPanelState will be called when port disconnects
    return true
  } catch (error) {
    console.error('PP: Failed to close side panel:', error)
    return false
  }
}

// Toggle side panel for a tab
async function toggleSidePanel(tabId: number): Promise<{ success: boolean; isOpen: boolean }> {
  const isCurrentlyOpen = isPanelOpen(tabId)
  
  if (isCurrentlyOpen) {
    const success = await closeSidePanel(tabId)
    return { success, isOpen: !success }
  } else {
    const success = await openSidePanel(tabId)
    return { success, isOpen: success }
  }
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  panelPorts.delete(tabId)
})

// Extension icon click toggles the panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await toggleSidePanel(tab.id)
  }
})

// Don't auto-open on click - let our code handle it for proper state tracking
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle WIRETAP_DATA
  if (message.type === 'WIRETAP_DATA') {
    handleWiretapData(message.payload as WiretapMessage)
      .then((result) => {
        if (result.saved) {
          chrome.runtime.sendMessage({ type: 'DATA_SAVED', payload: result }).catch(() => {})
        }
        sendResponse(result)
      })
      .catch((err) => {
        console.error('PP Background: Error handling wiretap:', err)
        sendResponse({ saved: false, error: err.message })
      })
    return true
  }

  // Handle SCAN requests from side panel
  if (message.action === 'SCAN_DRAWINGS') {
    handleScanDrawings(message.projectId, message.drawingAreaId, message.disciplinesOnly ?? false)
      .then((result) => {
        if (result.success) {
          const dataType = message.disciplinesOnly ? 'disciplines' : 'drawings'
          chrome.runtime.sendMessage({ type: 'DATA_SAVED', payload: { type: dataType, count: result.count } }).catch(() => {})
        }
        sendResponse(result)
      })
      .catch((err) => sendResponse({ success: false, error: String(err) }))
    return true
  }

  if (message.action === 'SCAN_RFIS') {
    handleScanRFIs(message.projectId)
      .then((result) => {
        if (result.success) {
          chrome.runtime.sendMessage({ type: 'DATA_SAVED', payload: { type: 'rfis', count: result.count } }).catch(() => {})
        }
        sendResponse(result)
      })
      .catch((err) => sendResponse({ success: false, error: String(err) }))
    return true
  }

  if (message.action === 'SCAN_COMMITMENTS') {
    handleScanCommitments(message.projectId)
      .then((result) => {
        if (result.success) {
          chrome.runtime.sendMessage({ type: 'DATA_SAVED', payload: { type: 'commitments', count: result.count } }).catch(() => {})
        }
        sendResponse(result)
      })
      .catch((err) => sendResponse({ success: false, error: String(err) }))
    return true
  }

  // Handle TOGGLE_SIDEPANEL from content script
  if (message.action === 'TOGGLE_SIDEPANEL') {
    const tabId = sender.tab?.id
    if (tabId) {
      toggleSidePanel(tabId)
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: String(err) }))
    } else {
      // No tab context, try to get active tab
      chrome.tabs.query({ active: true, currentWindow: true })
        .then(([tab]) => {
          if (tab?.id) {
            return toggleSidePanel(tab.id)
          }
          return { success: false, isOpen: false }
        })
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: String(err) }))
    }
    return true
  }

  // Handle GET_SIDEPANEL_STATE from content script
  if (message.action === 'GET_SIDEPANEL_STATE') {
    const tabId = sender.tab?.id
    const isOpen = tabId ? isPanelOpen(tabId) : false
    sendResponse({ isOpen })
    return true
  }

  // Handle GET_PROJECT_DATA from content script (for overlay command palette)
  if (message.action === 'GET_PROJECT_DATA') {
    const projectId = message.projectId as string | undefined
    if (!projectId) {
      sendResponse({ success: false, error: 'No project ID provided' })
      return true
    }
    
    (async () => {
      try {
        const [drawings, disciplineMap, favorites, recents] = await Promise.all([
          StorageService.getDrawings(projectId),
          StorageService.getDisciplineMap(projectId),
          StorageService.getAllFavoriteDrawings(projectId),
          StorageService.getRecents(projectId),
        ])
        
        sendResponse({
          success: true,
          drawings,
          disciplineMap,
          favorites: Array.from(favorites), // Convert Set to Array for JSON serialization
          recents,
        })
      } catch (error) {
        console.error('PP Background: Error getting project data:', error)
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    })()
    
    return true // Indicates we will send response asynchronously
  }

  // Handle OPEN_COMMAND_PALETTE from content script
  if (message.action === 'OPEN_COMMAND_PALETTE') {
    (async () => {
      const tabId = sender.tab?.id || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
      
      if (!tabId) {
        sendResponse({ success: false, error: 'No tab ID' })
        return
      }
      
      // Ensure side panel is open
      if (!isPanelOpen(tabId)) {
        await openSidePanel(tabId)
        // Wait for panel to connect via port
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      // Send message via port if available
      const port = panelPorts.get(tabId)
      if (port) {
        port.postMessage({ type: 'OPEN_COMMAND_PALETTE' })
        sendResponse({ success: true })
      } else {
        // Fallback: use runtime message (panel might not have connected yet)
        // Retry a few times with delays
        let retries = 3
        const trySend = () => {
          chrome.runtime.sendMessage({ type: 'OPEN_COMMAND_PALETTE' }).catch(() => {
            if (retries > 0) {
              retries--
              setTimeout(trySend, 200)
            } else {
              console.error('PP: Failed to send OPEN_COMMAND_PALETTE to side panel after retries')
            }
          })
        }
        trySend()
        sendResponse({ success: true })
      }
    })().catch((err) => {
      console.error('PP: Error handling OPEN_COMMAND_PALETTE:', err)
      sendResponse({ success: false, error: String(err) })
    })
    
    return true
  }

  // Handle other messages
  handleMessage(message, sender).then(sendResponse).catch(console.error)
  return true
})

async function handleMessage(
  message: { action?: string; type?: string; [key: string]: unknown },
  _sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.action) {
    case 'OPEN_TAB': {
      const tab = await chrome.tabs.create({
        url: message.url as string,
        active: !(message.background as boolean),
      })
      return { success: true, tabId: tab.id }
    }

    case 'OPEN_DRAWING': {
      // Handle drawing open request - used by command palette overlay
      // Background has full storage access, so we look up drawingAreaId and preferences here
      const projectId = message.projectId as string
      const drawingId = message.drawingId as number
      
      if (!projectId || !drawingId) {
        return { success: false, error: 'Missing projectId or drawingId' }
      }
      
      try {
        const [project, openInBackground] = await Promise.all([
          StorageService.getProject(projectId),
          StorageService.getPreferences<boolean>(PREFERENCE_KEYS.openInBackground, false)
        ])
        
        if (!project?.drawingAreaId) {
          return { success: false, error: 'Drawing area ID not found for project' }
        }
        
        const url = `https://app.procore.com/${projectId}/project/drawing_areas/${project.drawingAreaId}/drawing_log/view_fullscreen/${drawingId}`
        const tab = await chrome.tabs.create({ 
          url, 
          active: !openInBackground 
        })
        return { success: true, tabId: tab.id }
      } catch (error) {
        console.error('PP Background: Failed to open drawing:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }

    case 'POP_OUT': {
      const popupWindow = await chrome.windows.create({
        url: chrome.runtime.getURL('sidepanel.html'),
        type: 'popup',
        width: 420,
        height: 700,
      })
      return { success: true, windowId: popupWindow?.id }
    }

    case 'GET_ACTIVE_TAB': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      return tab ? { 
        url: tab.url, 
        tabId: tab.id,
        isProcoreTab: tab.url?.includes('procore.com') ?? false,
      } : null
    }

    default:
      return { error: 'Unknown action' }
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url?.includes('procore.com')) {
    chrome.runtime.sendMessage({
      type: 'TAB_UPDATED',
      payload: { tabId, url: tab.url },
    }).catch(() => {})
  }
})

console.log('Procore Power-Up 2.0: Background service worker initialized')
