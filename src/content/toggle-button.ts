/**
 * Toggle Button Module
 * 
 * Creates a floating toggle button on Procore pages that opens/closes the side panel.
 * Features:
 * - Draggable vertical positioning (persisted to storage)
 * - Alt+S keyboard shortcut
 * - Smooth animations and hover effects
 * - Light/dark theme support
 */

// ============================================
// STYLES
// ============================================

const STYLES = `
/* Procore Power-Up Toggle Button */
#pp-toggle-btn {
  position: fixed;
  top: 65%;
  right: 0;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #ddd;
  border-right: none;
  border-radius: 5px 0 0 5px;
  cursor: pointer;
  z-index: 99999;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: -2px 2px 5px rgba(0,0,0,0.1);
  user-select: none;
  color: #333;
  transition: background 0.2s, transform 0.2s;
}

#pp-toggle-btn:hover {
  background: #f5f5f5;
  animation: pp-wiggle 0.5s ease-in-out;
}

#pp-toggle-btn.pp-panel-open {
  background: #f47b20;
  color: white;
  border-color: #d66410;
}

#pp-toggle-btn.pp-panel-open:hover {
  background: #d66410;
}

@keyframes pp-wiggle {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
  75% { transform: rotate(-5deg); }
  100% { transform: rotate(0deg); }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  #pp-toggle-btn {
    background: rgba(30, 30, 30, 0.98);
    border-color: #555;
    color: #e0e0e0;
    box-shadow: -2px 2px 5px rgba(0,0,0,0.5);
  }
  
  #pp-toggle-btn:hover {
    background: #3a3a3a;
  }
  
  #pp-toggle-btn.pp-panel-open {
    background: #f47b20;
    color: white;
    border-color: #d66410;
  }
}
`

// ============================================
// STORAGE HELPERS
// ============================================

interface ToggleButtonPrefs {
  buttonTop?: string
  showFloatingButton?: boolean
}

async function getPreferences(): Promise<ToggleButtonPrefs> {
  try {
    const result = await chrome.storage.local.get(['pp_button_prefs'])
    const prefs = (result.pp_button_prefs || {}) as ToggleButtonPrefs
    // Default showFloatingButton to true for backward compatibility
    if (prefs.showFloatingButton === undefined) {
      prefs.showFloatingButton = true
    }
    return prefs
  } catch {
    return { showFloatingButton: true }
  }
}

async function savePreferences(prefs: Partial<ToggleButtonPrefs>): Promise<void> {
  try {
    const existing = await getPreferences()
    await chrome.storage.local.set({ pp_button_prefs: { ...existing, ...prefs } })
  } catch (error) {
    console.error('PP: Failed to save button preferences:', error)
  }
}

// ============================================
// BUTTON CREATION
// ============================================

let buttonElement: HTMLElement | null = null

function injectStyles(): void {
  if (document.getElementById('pp-toggle-styles')) return
  
  const styleEl = document.createElement('style')
  styleEl.id = 'pp-toggle-styles'
  styleEl.textContent = STYLES
  document.head.appendChild(styleEl)
}

async function createButton(): Promise<HTMLElement> {
  const prefs = await getPreferences()
  
  const btn = document.createElement('div')
  btn.id = 'pp-toggle-btn'
  btn.textContent = '⚡'
  btn.title = 'Toggle Procore Power-Up (Alt+S)'
  
  // Restore saved position
  if (prefs.buttonTop) {
    btn.style.top = prefs.buttonTop
  }
  
  // Set initial visibility based on preference
  // Will be overridden by updatePanelState if panel is open
  if (prefs.showFloatingButton === false) {
    btn.style.display = 'none'
  }
  
  // Click handler
  btn.addEventListener('click', (e) => {
    // Don't trigger if this was a drag
    if (btn.getAttribute('data-dragged') === 'true') {
      btn.setAttribute('data-dragged', 'false')
      return
    }
    e.preventDefault()
    e.stopPropagation()
    toggleSidePanel()
  })
  
  // Make draggable
  makeDraggable(btn)
  
  return btn
}

// ============================================
// DRAGGING
// ============================================

function makeDraggable(element: HTMLElement): void {
  let isDragging = false
  let startY = 0
  let startTop = 0
  
  element.addEventListener('mousedown', (e) => {
    isDragging = true
    startY = e.clientY
    startTop = element.offsetTop
    element.setAttribute('data-dragged', 'false')
    element.style.transition = 'none'
    e.preventDefault()
  })
  
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const deltaY = e.clientY - startY
    
    // If moved more than 3px, it's a drag not a click
    if (Math.abs(deltaY) > 3) {
      element.setAttribute('data-dragged', 'true')
    }
    
    // Calculate new position, keeping button on screen
    const newTop = Math.max(10, Math.min(window.innerHeight - 50, startTop + deltaY))
    element.style.top = `${newTop}px`
  }
  
  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false
      element.style.transition = ''
      
      // Save position if it was dragged
      if (element.getAttribute('data-dragged') === 'true') {
        savePreferences({ buttonTop: element.style.top })
      }
    }
  }
  
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// ============================================
// KEYBOARD SHORTCUT
// ============================================

function setupKeyboardShortcut(): void {
  // Note: Alt+S and Alt+P are now handled globally via chrome.commands API
  // See manifest.json "commands" and service-worker.ts onCommand listener
  // This function is kept for potential future local shortcuts
}

// ============================================
// TOGGLE LOGIC
// ============================================

async function toggleSidePanel(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'TOGGLE_SIDEPANEL' })
    console.log('PP: Toggle response:', response)
  } catch (error) {
    console.error('PP: Failed to toggle side panel:', error)
  }
}

// Update button visibility based on panel state AND preference
async function updateButtonVisibility(): Promise<void> {
  if (!buttonElement) return
  
  const prefs = await getPreferences()
  const showButton = prefs.showFloatingButton !== false // Default to true
  
  // Get current panel state
  let isPanelOpen = false
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_SIDEPANEL_STATE' })
    isPanelOpen = response?.isOpen === true
  } catch {
    // Ignore - assume panel is closed
  }
  
  // Hide if preference is false OR panel is open
  buttonElement.style.display = (showButton && !isPanelOpen) ? 'flex' : 'none'
}

// Update button visibility based on panel state
export function updatePanelState(_isOpen: boolean): void {
  // Update visibility considering both panel state and preference
  // Note: isOpen is passed for API compatibility but we check it inside updateButtonVisibility
  updateButtonVisibility()
}

// ============================================
// INITIALIZATION
// ============================================

export async function initToggleButton(): Promise<void> {
  // Don't initialize twice
  if (document.getElementById('pp-toggle-btn')) {
    return
  }
  
  // Wait for body to be available
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => initToggleButton())
    return
  }
  
  console.log('PP: Initializing toggle button')
  
  // Inject styles
  injectStyles()
  
  // Create and append button
  buttonElement = await createButton()
  document.body.appendChild(buttonElement)
  
  // Setup keyboard shortcut
  setupKeyboardShortcut()
  
  // Listen for panel state updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SIDEPANEL_STATE') {
      updatePanelState(message.isOpen)
    }
  })
  
  // Listen for storage changes (preference updates)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.pp_button_prefs) {
      // Preference changed, update button visibility
      updateButtonVisibility()
    }
  })
  
  // Get initial panel state and set visibility
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_SIDEPANEL_STATE' })
    if (response?.isOpen !== undefined) {
      updatePanelState(response.isOpen)
    } else {
      // No panel state, just check preference
      updateButtonVisibility()
    }
  } catch {
    // Ignore - panel state unknown, just check preference
    updateButtonVisibility()
  }
}

// ============================================
// CLEANUP (for SPA navigation)
// ============================================

export function destroyToggleButton(): void {
  const btn = document.getElementById('pp-toggle-btn')
  if (btn) {
    btn.remove()
  }
  
  const styles = document.getElementById('pp-toggle-styles')
  if (styles) {
    styles.remove()
  }
  
  buttonElement = null
}
