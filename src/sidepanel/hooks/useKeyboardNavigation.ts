/**
 * Keyboard Navigation Utilities
 * 
 * Provides keyboard navigation for sidebar sections following v1 patterns:
 * - ArrowUp/Down: Navigate between focusable elements
 * - ArrowLeft: Collapse section or move to parent header
 * - ArrowRight: Expand section or move to first child
 * - Enter/Space: Activate element (click) or toggle expand
 * - Home/End: Jump to first/last element
 */

/**
 * Get all visible, focusable elements within a container in DOM order.
 * Elements must have [data-focusable] attribute and be visible.
 * 
 * Since v2 uses conditional rendering for collapsed sections,
 * collapsed items don't exist in DOM - no need to check open state.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const all = container.querySelectorAll<HTMLElement>('[data-focusable]')
  
  return Array.from(all).filter(el => {
    // Check if element is visible (offsetParent is null for hidden elements)
    if (el.offsetParent === null) return false
    
    // Additional visibility check via computed style
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    
    return true
  })
}

/**
 * Navigate to the next/previous focusable element from current position.
 * Wraps around at the ends of the list.
 */
export function navigateToNext(
  container: HTMLElement,
  current: HTMLElement,
  direction: 'up' | 'down'
): void {
  const elements = getFocusableElements(container)
  if (elements.length === 0) return
  
  const currentIndex = elements.indexOf(current)
  
  let nextIndex: number
  if (currentIndex === -1) {
    // Current element not in list, go to first or last
    nextIndex = direction === 'down' ? 0 : elements.length - 1
  } else if (direction === 'down') {
    // Wrap to beginning if at end
    nextIndex = (currentIndex + 1) % elements.length
  } else {
    // Wrap to end if at beginning
    nextIndex = (currentIndex - 1 + elements.length) % elements.length
  }
  
  const next = elements[nextIndex]
  if (next) {
    next.focus()
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

/**
 * Focus the first focusable element in the container.
 * Used for click-to-focus behavior.
 */
export function focusFirst(container: HTMLElement): void {
  const elements = getFocusableElements(container)
  if (elements.length > 0) {
    elements[0].focus()
    elements[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

/**
 * Focus the last focusable element in the container.
 */
export function focusLast(container: HTMLElement): void {
  const elements = getFocusableElements(container)
  if (elements.length > 0) {
    elements[elements.length - 1].focus()
    elements[elements.length - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

/**
 * Find the parent section header for an element.
 * Looks for the nearest ancestor with [data-section] and finds its [data-section-header].
 */
export function findParentHeader(element: HTMLElement): HTMLElement | null {
  const parentSection = element.closest('[data-section]')
  if (!parentSection) return null
  
  const header = parentSection.querySelector<HTMLElement>('[data-section-header]')
  // Don't return self
  if (header && header !== element) {
    return header
  }
  
  // If we're the header, look for parent section's header
  const grandparentSection = parentSection.parentElement?.closest('[data-section]')
  if (grandparentSection) {
    return grandparentSection.querySelector<HTMLElement>('[data-section-header]')
  }
  
  return null
}

/**
 * Find the first focusable child element within a section.
 * Used when pressing ArrowRight on an expanded section header.
 */
export function findFirstSectionChild(header: HTMLElement): HTMLElement | null {
  const section = header.closest('[data-section]')
  if (!section) return null
  
  // Get all focusable elements in the section
  const sectionFocusable = section.querySelectorAll<HTMLElement>('[data-focusable]')
  
  // Find the first one that isn't the header itself and is visible
  for (const el of sectionFocusable) {
    if (el !== header && el.offsetParent !== null) {
      return el
    }
  }
  
  return null
}

/**
 * Create keyboard event handler props for a section header.
 * Handles ArrowUp/Down navigation, ArrowLeft/Right collapse/expand, Enter/Space toggle.
 */
export function createSectionHeaderKeyHandler(
  container: { current: HTMLElement | null },
  isExpanded: boolean,
  setExpanded: (expanded: boolean) => void
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    const target = e.currentTarget as HTMLElement
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (container.current) {
          navigateToNext(container.current, target, 'down')
        }
        break
        
      case 'ArrowUp':
        e.preventDefault()
        if (container.current) {
          navigateToNext(container.current, target, 'up')
        }
        break
        
      case 'ArrowLeft':
        e.preventDefault()
        if (isExpanded) {
          setExpanded(false)
        } else {
          // Try to move to parent header
          const parentHeader = findParentHeader(target)
          if (parentHeader) {
            parentHeader.focus()
            parentHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
        }
        break
        
      case 'ArrowRight':
        e.preventDefault()
        if (!isExpanded) {
          setExpanded(true)
        } else {
          // Already expanded, focus first child
          // Use setTimeout to allow React to render expanded content
          setTimeout(() => {
            const firstChild = findFirstSectionChild(target)
            if (firstChild) {
              firstChild.focus()
              firstChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
            }
          }, 50)
        }
        break
        
      case 'Enter':
      case ' ':
        e.preventDefault()
        setExpanded(!isExpanded)
        break
        
      case 'Home':
        e.preventDefault()
        if (container.current) {
          focusFirst(container.current)
        }
        break
        
      case 'End':
        e.preventDefault()
        if (container.current) {
          focusLast(container.current)
        }
        break
    }
  }
}

/**
 * Create keyboard event handler props for an item row (drawing, commitment, etc).
 * Handles ArrowUp/Down navigation, ArrowLeft to parent, Enter to activate.
 */
export function createItemRowKeyHandler(
  container: { current: HTMLElement | null },
  onActivate: () => void
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    const target = e.currentTarget as HTMLElement
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        onActivate()
        break
        
      case 'ArrowDown':
        e.preventDefault()
        if (container.current) {
          navigateToNext(container.current, target, 'down')
        }
        break
        
      case 'ArrowUp':
        e.preventDefault()
        if (container.current) {
          navigateToNext(container.current, target, 'up')
        }
        break
        
      case 'ArrowLeft':
        e.preventDefault()
        // Move to parent section header
        const parentHeader = findParentHeader(target)
        if (parentHeader) {
          parentHeader.focus()
          parentHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
        break
        
      case 'Home':
        e.preventDefault()
        if (container.current) {
          focusFirst(container.current)
        }
        break
        
      case 'End':
        e.preventDefault()
        if (container.current) {
          focusLast(container.current)
        }
        break
    }
  }
}
