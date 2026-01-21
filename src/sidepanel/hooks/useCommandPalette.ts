import { useState, useEffect, useCallback, useRef } from 'preact/hooks'
import { StorageService } from '@/services'
import type { Drawing, CommandPaletteResult, DisciplineMap, RecentsList } from '@/types'
import type { CommandPaletteDataProvider } from '@/types/command-palette'

// Fuzzy match helper (from v1)
function fuzzyMatch(text: string, pattern: string): boolean {
  if (!pattern) return true
  if (!text) return false
  const textLower = text.toLowerCase()
  const patternLower = pattern.toLowerCase()
  let patternIdx = 0
  for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIdx]) {
      patternIdx++
    }
  }
  return patternIdx === patternLower.length
}

/**
 * Default data provider that uses StorageService directly
 * Used by the side panel implementation
 */
class DefaultDataProvider implements CommandPaletteDataProvider {
  async getDrawings(projectId: string): Promise<Drawing[]> {
    return StorageService.getDrawings(projectId)
  }

  async getDisciplineMap(projectId: string): Promise<DisciplineMap> {
    return StorageService.getDisciplineMap(projectId)
  }

  async getAllFavoriteDrawings(projectId: string): Promise<Set<string>> {
    return StorageService.getAllFavoriteDrawings(projectId)
  }

  async getRecents(projectId: string): Promise<RecentsList> {
    return StorageService.getRecents(projectId)
  }
}

const defaultDataProvider = new DefaultDataProvider()

export function useCommandPalette(
  projectId: string | null,
  dataProvider?: CommandPaletteDataProvider,
  options?: { 
    defaultOpen?: boolean
    onClose?: () => void 
  }
) {
  // Use provided data provider or default to StorageService
  const provider = dataProvider || defaultDataProvider
  
  const [isOpen, setIsOpen] = useState(options?.defaultOpen ?? false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CommandPaletteResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const searchCancelledRef = useRef(false)
  
  // State for recents and favorites (loaded from provider)
  // These are kept in state for potential future use, but currently
  // the search function fetches fresh data each time for accuracy
  const [, setRecents] = useState<RecentsList>([])
  const [, setFavoriteSet] = useState<Set<string>>(new Set())
  
  // Load recents and favorites when project changes
  useEffect(() => {
    if (!projectId) {
      setRecents([])
      setFavoriteSet(new Set())
      return
    }
    
    let cancelled = false
    
    async function loadData() {
      // TypeScript guard: projectId is checked above, but we need to ensure it's not null
      const pid = projectId
      if (!pid) return
      
      try {
        const [loadedRecents, loadedFavorites] = await Promise.all([
          provider.getRecents(pid),
          provider.getAllFavoriteDrawings(pid),
        ])
        
        if (!cancelled) {
          setRecents(loadedRecents)
          setFavoriteSet(loadedFavorites)
        }
      } catch (error) {
        console.error('Failed to load command palette data:', error)
        if (!cancelled) {
          setRecents([])
          setFavoriteSet(new Set())
        }
      }
    }
    
    loadData()
    
    return () => {
      cancelled = true
    }
  }, [projectId, provider])

  // Perform search when query changes
  useEffect(() => {
    if (!isOpen || !projectId) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    
    searchCancelledRef.current = false
    
    async function performSearch() {
      setIsSearching(true)
      
      try {
        const [drawings, disciplineMap, favorites] = await Promise.all([
          provider.getDrawings(projectId!),
          provider.getDisciplineMap(projectId!),
          provider.getAllFavoriteDrawings(projectId!),
        ])
        
        // Update favorite set state
        setFavoriteSet(favorites)
        
        // Reload recents to ensure they're up to date
        const currentRecents = await provider.getRecents(projectId!)
        setRecents(currentRecents)
        
        if (searchCancelledRef.current) return
        
        let cleanQuery = searchQuery.toLowerCase().trim()
        let filter: 'all' | 'favorites' | 'discipline' | 'recents' = 'all'
        let disciplineFilter = ''

        // Parse special prefixes
        if (cleanQuery.startsWith('*')) {
          filter = 'favorites'
          cleanQuery = cleanQuery.substring(1).trim()
        } else if (cleanQuery.startsWith('@')) {
          filter = 'discipline'
          cleanQuery = cleanQuery.substring(1).trim()
          disciplineFilter = cleanQuery
        } else if (!cleanQuery && currentRecents.length > 0) {
          filter = 'recents'
        }

        // Get discipline name helper
        const getDisciplineName = (d: Drawing): string => {
          if (d.discipline && typeof d.discipline === 'object' && d.discipline.id) {
            return disciplineMap[d.discipline.id]?.name || d.discipline.name || 'General'
          }
          return d.discipline_name || 'General'
        }

        let results: CommandPaletteResult[] = []

        // Handle recents (empty search)
        if (filter === 'recents') {
          const recentDrawings = currentRecents
            .map(num => drawings.find(d => d.num === num))
            .filter((d): d is Drawing => d !== undefined)

          results = recentDrawings.map(d => ({
            drawing: d,
            discipline: getDisciplineName(d),
            isFavorite: favorites.has(d.num),
            isRecent: true,
          }))
        } else {
          // Filter drawings
          const filtered = drawings.filter(d => {
            // Favorites filter
            if (filter === 'favorites' && !favorites.has(d.num)) {
              return false
            }

            // Discipline filter
            if (filter === 'discipline') {
              const discName = getDisciplineName(d)
              return fuzzyMatch(discName, disciplineFilter)
            }

            // Standard search
            if (cleanQuery) {
              const discName = getDisciplineName(d)
              return (
                fuzzyMatch(d.num || '', cleanQuery) ||
                fuzzyMatch(d.title || '', cleanQuery) ||
                fuzzyMatch(discName, cleanQuery)
              )
            }

            return true
          })

          // Convert to results
          results = filtered.map(d => ({
            drawing: d,
            discipline: getDisciplineName(d),
            isFavorite: favorites.has(d.num),
            isRecent: currentRecents.includes(d.num),
          }))

          // Group by discipline and sort
          const grouped = new Map<string, CommandPaletteResult[]>()
          results.forEach(r => {
            if (!grouped.has(r.discipline)) {
              grouped.set(r.discipline, [])
            }
            grouped.get(r.discipline)!.push(r)
          })

          // Sort disciplines by map index, then alphabetically
          const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
            // Guard against undefined/null disciplineMap to prevent Object.values crash
            const discA = disciplineMap ? Object.values(disciplineMap).find(m => m.name === a[0]) : undefined
            const discB = disciplineMap ? Object.values(disciplineMap).find(m => m.name === b[0]) : undefined
            const indexA = discA?.index ?? 9999
            const indexB = discB?.index ?? 9999
            if (indexA !== indexB) return indexA - indexB
            return a[0].localeCompare(b[0])
          })

          // Flatten back to array, limit to 50
          const flattened: CommandPaletteResult[] = []
          for (const [_, items] of sortedGroups) {
            const sorted = items.sort((a, b) =>
              (a.drawing.num || '').localeCompare(b.drawing.num || '', undefined, { numeric: true })
            )
            flattened.push(...sorted)
            if (flattened.length >= 50) break
          }

          results = flattened.slice(0, 50)
        }
        
        if (!searchCancelledRef.current) {
          setSearchResults(results)
          setSelectedIndex(0)
          setIsSearching(false)
        }
      } catch (error) {
        console.error('Command palette search error:', error)
        if (!searchCancelledRef.current) {
          setSearchResults([])
          setIsSearching(false)
        }
      }
    }
    
    performSearch()
    
    return () => {
      searchCancelledRef.current = true
    }
  }, [isOpen, projectId, searchQuery, provider])

  const open = useCallback(() => {
    setIsOpen(true)
    setSearchQuery('')
    setSelectedIndex(0)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
    setSearchResults([])
    options?.onClose?.()
  }, [options?.onClose])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }, [isOpen, searchResults.length, close])

  return {
    isOpen,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    searchResults,
    isSearching,
    open,
    close,
    handleKeyDown,
  }
}
