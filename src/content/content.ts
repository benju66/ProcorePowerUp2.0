/**
 * Content Script (ISOLATED world)
 * 
 * Bridges communication between the MAIN world wiretap and the extension.
 * Also handles page-based scanning (expand + auto-scroll) like v1.
 * Initializes the floating toggle button.
 */

import type { WiretapMessage } from '@/types'
import { initToggleButton } from './toggle-button'

console.log('Procore Power-Up 2.0: Content script loaded')

// ============================================
// TOGGLE BUTTON INITIALIZATION
// ============================================

// Initialize toggle button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initToggleButton()
  })
} else {
  // DOM already loaded
  initToggleButton()
}

// ============================================
// SCAN STATE
// ============================================

let isScanning = false
let scanStableCount = 0
let rowObserver: MutationObserver | null = null
let scrollInterval: ReturnType<typeof setInterval> | null = null

// ============================================
// WIRETAP MESSAGE FORWARDING
// ============================================

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return
  if (event.source !== window) return
  if (event.data?.type !== 'PP_DATA') return

  const message = event.data as WiretapMessage

  chrome.runtime.sendMessage({
    type: 'WIRETAP_DATA',
    payload: message,
  }).catch(() => {})
})

// ============================================
// PAGE-BASED SCANNING (like v1)
// ============================================

function findScrollContainer(): Element | Window {
  const candidates = ['.ag-body-viewport', '.main-content', '#main_content', 'body']
  for (const sel of candidates) {
    const el = document.querySelector(sel)
    if (el && el.scrollHeight > el.clientHeight + 100) return el
  }
  return window
}

function setupRowObserver(scrollTarget: Element | Window): void {
  const viewport = document.querySelector('.ag-body-viewport') || 
                   document.querySelector('.ag-center-cols-viewport') ||
                   (scrollTarget instanceof Element ? scrollTarget : null)
  
  if (!viewport) return

  cleanupRowObserver()

  rowObserver = new MutationObserver((mutations) => {
    const hasNewRows = mutations.some(m => m.addedNodes.length > 0)
    if (hasNewRows) {
      scanStableCount = 0 // Reset stability counter when new rows appear
    }
  })

  rowObserver.observe(viewport, {
    childList: true,
    subtree: true
  })
}

function cleanupRowObserver(): void {
  if (rowObserver) {
    rowObserver.disconnect()
    rowObserver = null
  }
}

function cleanupScan(): void {
  if (scrollInterval) {
    clearInterval(scrollInterval)
    scrollInterval = null
  }
  cleanupRowObserver()
  isScanning = false
}

async function performPageScan(scanType: 'drawings' | 'rfis' | 'commitments'): Promise<{ success: boolean; message: string }> {
  if (isScanning) {
    return { success: false, message: 'Scan already in progress' }
  }

  // Check we're on the right page
  const currentUrl = window.location.href.toLowerCase()
  
  if (scanType === 'drawings') {
    if (!currentUrl.includes('/drawing_log') && !currentUrl.includes('/drawings')) {
      return { success: false, message: 'Navigate to the Drawings page first' }
    }
  } else if (scanType === 'rfis') {
    if (!currentUrl.includes('/rfis')) {
      return { success: false, message: 'Navigate to the RFIs page first' }
    }
  } else if (scanType === 'commitments') {
    if (!currentUrl.includes('/commitments') && !currentUrl.includes('/contracts')) {
      return { success: false, message: 'Navigate to the Commitments page first' }
    }
  }

  isScanning = true
  scanStableCount = 0

  // Send scan started notification
  chrome.runtime.sendMessage({
    type: 'SCAN_PROGRESS',
    payload: { status: 'started', scanType, percent: 0 }
  }).catch(() => {})

  // For drawings, we need to properly expand disciplines to capture their data
  if (scanType === 'drawings') {
    chrome.runtime.sendMessage({
      type: 'SCAN_PROGRESS',
      payload: { status: 'expanding', scanType, percent: 2, message: 'Expanding disciplines...' }
    }).catch(() => {})
    
    // Try to expand disciplines individually for better lazy-load capture
    const disciplineRows = document.querySelectorAll('[data-testid="ag-grid-row-group"]') as NodeListOf<HTMLElement>
    
    if (disciplineRows.length > 0) {
      console.log('PP: Found', disciplineRows.length, 'discipline rows to expand')
      
      // Expand each discipline one by one to ensure all API calls are triggered
      for (let i = 0; i < disciplineRows.length; i++) {
        const row = disciplineRows[i]
        const expandIcon = row.querySelector('.ag-group-contracted, .ag-icon-tree-closed, [aria-label*="expand"]') as HTMLElement
        
        if (expandIcon) {
          expandIcon.click()
          // Wait for each discipline's data to load
          await new Promise(r => setTimeout(r, 500))
        }
        
        // Update progress during discipline expansion
        const expandPercent = Math.floor((i / disciplineRows.length) * 12) + 2
        chrome.runtime.sendMessage({
          type: 'SCAN_PROGRESS',
          payload: { status: 'expanding', scanType, percent: expandPercent, message: `Expanding disciplines... (${i + 1}/${disciplineRows.length})` }
        }).catch(() => {})
      }
      
      // Extra wait for final API calls to complete
      await new Promise(r => setTimeout(r, 1500))
    } else {
      // Fallback to "Expand All" button if no individual rows found
      const expandAllBtn = document.querySelector('.expand-button, [aria-label*="Expand All"], [aria-label*="expand all"]') as HTMLElement
      if (expandAllBtn) {
        const ariaLabel = expandAllBtn.getAttribute('aria-label') || ''
        
        // First, collapse everything to reset state
        if (ariaLabel.toLowerCase().includes('close') || ariaLabel.toLowerCase().includes('collapse')) {
          console.log('PP: Collapsing all disciplines...')
          expandAllBtn.click()
          await new Promise(r => setTimeout(r, 1500))
        }
        
        // Now expand all - this triggers the discipline/groups API calls
        console.log('PP: Expanding all disciplines...')
        expandAllBtn.click()
        // Wait longer to allow all lazy-loaded discipline data to load
        await new Promise(r => setTimeout(r, 4000))
      }
    }
    
    chrome.runtime.sendMessage({
      type: 'SCAN_PROGRESS',
      payload: { status: 'scanning', scanType, percent: 15, message: 'Scrolling to load all drawings...' }
    }).catch(() => {})
  }

  const scrollTarget = findScrollContainer()
  let currentScroll = 0
  const scrollStep = 800 // Slower scroll step
  
  setupRowObserver(scrollTarget)

  return new Promise((resolve) => {
    scrollInterval = setInterval(() => {
      if (scrollTarget === window) {
        window.scrollTo(0, currentScroll)
      } else {
        (scrollTarget as Element).scrollTop = currentScroll
      }

      currentScroll += scrollStep
      
      const scrollHeight = scrollTarget === window 
        ? document.body.scrollHeight 
        : (scrollTarget as Element).scrollHeight
      const scrollTop = scrollTarget === window 
        ? window.scrollY 
        : (scrollTarget as Element).scrollTop
      const clientHeight = scrollTarget === window 
        ? window.innerHeight 
        : (scrollTarget as Element).clientHeight

      // Adjust percent to account for the discipline expansion phase (15% already used)
      const scrollPercent = Math.floor((scrollTop / Math.max(1, scrollHeight - clientHeight)) * 85)
      const percent = Math.min(99, 15 + scrollPercent)

      // Send progress update
      chrome.runtime.sendMessage({
        type: 'SCAN_PROGRESS',
        payload: { status: 'scanning', scanType, percent }
      }).catch(() => {})

      // Check if we've reached the bottom
      if ((clientHeight + scrollTop) >= scrollHeight - 100) {
        scanStableCount++

        // Wait for stability (no new rows appearing for 5 cycles for more reliability)
        if (scanStableCount >= 5) {
          cleanupScan()
          
          // Scroll back to top
          if (scrollTarget === window) {
            window.scrollTo(0, 0)
          } else {
            (scrollTarget as Element).scrollTop = 0
          }
          
          chrome.runtime.sendMessage({
            type: 'SCAN_PROGRESS',
            payload: { status: 'complete', scanType, percent: 100 }
          }).catch(() => {})

          resolve({ success: true, message: 'Scan complete' })
        }
      }
    }, 600) // Slower interval - 600ms instead of 400ms

    // Safety timeout - max 60 seconds
    setTimeout(() => {
      if (isScanning) {
        cleanupScan()
        chrome.runtime.sendMessage({
          type: 'SCAN_PROGRESS',
          payload: { status: 'timeout', scanType, percent: 100 }
        }).catch(() => {})
        resolve({ success: true, message: 'Scan complete (timeout)' })
      }
    }, 60000)
  })
}

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {
    case 'GET_PAGE_INFO': {
      const url = window.location.href
      const projectMatch = url.match(/projects\/(\d+)/) || url.match(/\/(\d+)\/project/)
      const areaMatch = url.match(/areas\/(\d+)/) || url.match(/drawing_areas\/(\d+)/)
      const companyMatch = url.match(/companies\/(\d+)/)

      sendResponse({
        url,
        companyId: companyMatch?.[1] ?? null,
        projectId: projectMatch?.[1] ?? null,
        drawingAreaId: areaMatch?.[1] ?? null,
        isProcorePage: url.includes('procore.com'),
      })
      break
    }

    case 'PAGE_SCAN': {
      // Trigger page-based scanning (expand + auto-scroll)
      performPageScan(message.scanType as 'drawings' | 'rfis' | 'commitments')
        .then(sendResponse)
        .catch(err => sendResponse({ success: false, message: String(err) }))
      return true // Keep channel open for async
    }

    case 'STOP_SCAN': {
      cleanupScan()
      sendResponse({ success: true })
      break
    }

    case 'TOGGLE_OVERLAY': {
      // Dispatch event for overlay.tsx to handle
      console.log('PP Content: TOGGLE_OVERLAY received, dispatching event')
      window.dispatchEvent(new CustomEvent('pp-toggle-overlay'))
      sendResponse({ success: true })
      break
    }

    default:
      sendResponse({ error: 'Unknown action' })
  }

  return true
})
