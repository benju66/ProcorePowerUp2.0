/**
 * Background Service Worker
 * 
 * Handles:
 * - Side panel lifecycle
 * - Message routing between content scripts and side panel
 * - Pop-out window creation
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id })
    } catch (error) {
      console.error('Failed to open side panel:', error)
    }
  }
})

// Set side panel behavior - open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// Message handler for communication between extension parts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(console.error)
  return true // Keep message channel open for async response
})

async function handleMessage(
  message: { action: string; [key: string]: unknown },
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

    case 'POP_OUT': {
      // Create a standalone popup window with the side panel content
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

    case 'FORWARD_TO_SIDEPANEL': {
      // Forward message to side panel (if open)
      try {
        await chrome.runtime.sendMessage(message.data)
      } catch {
        // Side panel might not be open
      }
      return { success: true }
    }

    default:
      return { error: 'Unknown action' }
  }
}

// Listen for tab updates to notify side panel of navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.url?.includes('procore.com')) {
    // Notify side panel of URL change
    chrome.runtime.sendMessage({
      type: 'TAB_UPDATED',
      payload: {
        tabId,
        url: tab.url,
      },
    }).catch(() => {
      // Side panel might not be open
    })
  }
})

console.log('Procore Power-Up 2.0: Background service worker initialized')
