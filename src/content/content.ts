/**
 * Content Script (ISOLATED world)
 * 
 * Bridges communication between the MAIN world wiretap and the extension.
 * Receives data from window.postMessage and forwards to service worker/side panel.
 */

import type { WiretapMessage } from '@/types'

console.log('Procore Power-Up 2.0: Content script loaded')

// Listen for messages from the wiretap (MAIN world)
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.origin !== window.location.origin) return
  if (event.source !== window) return
  if (event.data?.type !== 'PP_DATA') return

  const message = event.data as WiretapMessage

  // Forward to extension (service worker / side panel)
  chrome.runtime.sendMessage({
    type: 'WIRETAP_DATA',
    payload: message,
  }).catch(() => {
    // Extension might not be ready or side panel closed
  })
})

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {
    case 'GET_PAGE_INFO': {
      // Extract IDs from current URL
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

    case 'TRIGGER_SCAN': {
      // Inject a scroll scan trigger into the page
      window.postMessage({
        type: 'PP_TRIGGER_SCAN',
        scanType: message.scanType,
      }, window.location.origin)
      sendResponse({ success: true })
      break
    }

    default:
      sendResponse({ error: 'Unknown action' })
  }

  return true
})
