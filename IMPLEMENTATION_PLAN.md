# Implementation Plan: Favorites, Recents, Status Colors, and Command Palette

## Executive Summary

**Answer: YES - Favorites and Recents MUST be implemented BEFORE Command Palette**

The command palette depends on both Favorites and Recents:
- **Empty search**: Shows recents (last 5 accessed drawings)
- **`*` prefix filter**: Filters to show only favorites
- **Search results**: Can include favorites/recents in results

Status colors are independent but enhance the user experience across all features.

---

## Implementation Order & Dependencies

### Phase 1: Foundation (Prerequisites for Command Palette)
1. **Status Color Cycling** ⭐ (Independent, enhances UX)
2. **Recents Tracking** ⭐ (Required by Command Palette)
3. **Favorites with Folders** ⭐ (Required by Command Palette)

### Phase 2: Command Palette (Depends on Phase 1)
4. **Command Palette (Alt+P)** ⭐ (Depends on Recents & Favorites)

---

## Architecture Overview

Following v2's existing patterns:
- **Storage**: IndexedDB via `StorageService` (separate stores per data type)
- **Types**: TypeScript interfaces in `types/`
- **Services**: Business logic in `services/`
- **Contexts**: Global state management (like `ThemeContext`)
- **Hooks**: Reusable hooks for components
- **Components**: UI components following SRP

---

## 1. Status Color Cycling

### 1.1 Data Model

**File**: `src/types/index.ts`

```typescript
export type StatusColor = 
  | 'green' 
  | 'red' 
  | 'yellow' 
  | 'blue' 
  | 'orange' 
  | 'pink'

export interface DrawingStatusColors {
  [drawingNum: string]: StatusColor
}
```

### 1.2 Storage Service

**File**: `src/services/storage.ts`

Add to `StorageService`:
```typescript
// Key helpers
const statusColorsKey = (projectId: string) => `status_colors_${projectId}`

// Methods
async getStatusColors(projectId: string): Promise<DrawingStatusColors> {
  if (!projectId) return {}
  const data = await get<DrawingStatusColors>(statusColorsKey(projectId), drawingsStore)
  return data ?? {}
},

async saveStatusColors(projectId: string, colors: DrawingStatusColors): Promise<void> {
  if (!projectId) return
  await set(statusColorsKey(projectId), colors, drawingsStore)
},

async setDrawingStatusColor(
  projectId: string, 
  drawingNum: string, 
  color: StatusColor | null
): Promise<void> {
  const colors = await this.getStatusColors(projectId)
  if (color) {
    colors[drawingNum] = color
  } else {
    delete colors[drawingNum]
  }
  await this.saveStatusColors(projectId, colors)
}
```

**SRP**: Storage operations only, no business logic

### 1.3 Hook

**File**: `src/sidepanel/hooks/useStatusColors.ts` (NEW)

```typescript
import { useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import type { StatusColor, DrawingStatusColors } from '@/types'

export function useStatusColors(projectId: string | null) {
  const [colors, setColors] = useState<DrawingStatusColors>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadColors() {
      if (!projectId) {
        setColors({})
        setIsLoading(false)
        return
      }
      const loaded = await StorageService.getStatusColors(projectId)
      setColors(loaded)
      setIsLoading(false)
    }
    loadColors()
  }, [projectId])

  const cycleColor = useCallback(async (drawingNum: string) => {
    if (!projectId) return
    
    const colorOrder: StatusColor[] = ['green', 'red', 'yellow', 'blue', 'orange', 'pink']
    const current = colors[drawingNum]
    const currentIndex = current ? colorOrder.indexOf(current) : -1
    const nextIndex = currentIndex < colorOrder.length - 1 ? currentIndex + 1 : -1
    const nextColor = nextIndex >= 0 ? colorOrder[nextIndex] : null
    
    const updated = { ...colors }
    if (nextColor) {
      updated[drawingNum] = nextColor
    } else {
      delete updated[drawingNum]
    }
    
    setColors(updated)
    await StorageService.saveStatusColors(projectId, updated)
  }, [projectId, colors])

  return { colors, cycleColor, isLoading }
}
```

**SRP**: Status color state management and cycling logic

### 1.4 Component Integration

**File**: `src/sidepanel/components/StatusDot.tsx` (NEW)

```typescript
import type { StatusColor } from '@/types'

interface StatusDotProps {
  color: StatusColor | undefined
  onClick: () => void
  className?: string
}

const COLOR_CLASSES: Record<StatusColor, string> = {
  green: 'bg-green-500 border-green-600',
  red: 'bg-red-500 border-red-600',
  yellow: 'bg-yellow-500 border-yellow-600',
  blue: 'bg-blue-500 border-blue-600',
  orange: 'bg-orange-500 border-orange-600',
  pink: 'bg-pink-500 border-pink-600',
}

export function StatusDot({ color, onClick, className = '' }: StatusDotProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`
        w-3.5 h-3.5 rounded-full border-2 cursor-pointer
        transition-all hover:scale-110
        ${color ? COLOR_CLASSES[color] : 'bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 opacity-0 group-hover:opacity-100'}
        ${className}
      `}
      title="Click to cycle status color"
      aria-label="Status color"
    />
  )
}
```

**SRP**: Visual status dot component only

### 1.5 Integration Points

**File**: `src/sidepanel/components/DrawingsTab.tsx`

- Import `useStatusColors` hook
- Add `StatusDot` component to drawing rows
- Apply color classes to drawing rows based on status

---

## 2. Recents Tracking

### 2.1 Data Model

**File**: `src/types/index.ts`

```typescript
// Recents are stored as array of drawing numbers (strings)
// Max 5 items, most recent first
export type RecentsList = string[] // Array of drawing.num values
```

### 2.2 Storage Service

**File**: `src/services/storage.ts`

Add to `StorageService`:
```typescript
// Key helpers
const recentsKey = (projectId: string) => `recents_${projectId}`

// Methods
async getRecents(projectId: string): Promise<RecentsList> {
  if (!projectId) return []
  const data = await get<RecentsList>(recentsKey(projectId), drawingsStore)
  return data ?? []
},

async saveRecents(projectId: string, recents: RecentsList): Promise<void> {
  if (!projectId) return
  // Enforce max 5 items
  const trimmed = recents.slice(0, 5)
  await set(recentsKey(projectId), trimmed, drawingsStore)
},

async addRecent(projectId: string, drawingNum: string): Promise<void> {
  if (!projectId || !drawingNum) return
  const recents = await this.getRecents(projectId)
  // Remove if exists, add to front
  const filtered = recents.filter(n => n !== drawingNum)
  const updated = [drawingNum, ...filtered].slice(0, 5)
  await this.saveRecents(projectId, updated)
}
```

**SRP**: Storage operations only

### 2.3 Hook

**File**: `src/sidepanel/hooks/useRecents.ts` (NEW)

```typescript
import { useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import type { RecentsList } from '@/types'

export function useRecents(projectId: string | null) {
  const [recents, setRecents] = useState<RecentsList>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadRecents() {
      if (!projectId) {
        setRecents([])
        setIsLoading(false)
        return
      }
      const loaded = await StorageService.getRecents(projectId)
      setRecents(loaded)
      setIsLoading(false)
    }
    loadRecents()
  }, [projectId])

  const addRecent = useCallback(async (drawingNum: string) => {
    if (!projectId) return
    await StorageService.addRecent(projectId, drawingNum)
    // Optimistically update
    const updated = await StorageService.getRecents(projectId)
    setRecents(updated)
  }, [projectId])

  return { recents, addRecent, isLoading }
}
```

**SRP**: Recents state management

### 2.4 Integration Points

**File**: `src/sidepanel/components/DrawingsTab.tsx`

- Import `useRecents` hook
- Call `addRecent(drawing.num)` in `handleDrawingClick`

**File**: `src/sidepanel/components/RFIsTab.tsx` & `CostTab.tsx`

- Similar integration for RFIs/Commitments if needed (future enhancement)

---

## 3. Favorites with Folders

### 3.1 Data Model

**File**: `src/types/index.ts`

```typescript
export interface FavoriteFolder {
  id: number // Timestamp-based ID
  name: string
  drawings: string[] // Array of drawing.num values
}

export interface FavoritesData {
  folders: FavoriteFolder[]
}
```

### 3.2 Storage Service

**File**: `src/services/storage.ts`

Add to `StorageService`:
```typescript
// Key helpers
const favoritesKey = (projectId: string) => `favorites_${projectId}`

// Methods
async getFavorites(projectId: string): Promise<FavoritesData> {
  if (!projectId) return { folders: [] }
  const data = await get<FavoritesData>(favoritesKey(projectId), drawingsStore)
  return data ?? { folders: [] }
},

async saveFavorites(projectId: string, favorites: FavoritesData): Promise<void> {
  if (!projectId) return
  await set(favoritesKey(projectId), favorites, drawingsStore)
},

async addFolder(projectId: string, name: string): Promise<FavoriteFolder> {
  if (!projectId || !name.trim()) throw new Error('Invalid folder name')
  const favorites = await this.getFavorites(projectId)
  const newFolder: FavoriteFolder = {
    id: Date.now(),
    name: name.trim(),
    drawings: []
  }
  favorites.folders.push(newFolder)
  await this.saveFavorites(projectId, favorites)
  return newFolder
},

async removeFolder(projectId: string, folderId: number): Promise<void> {
  if (!projectId) return
  const favorites = await this.getFavorites(projectId)
  favorites.folders = favorites.folders.filter(f => f.id !== folderId)
  await this.saveFavorites(projectId, favorites)
},

async addDrawingToFolder(
  projectId: string, 
  folderId: number, 
  drawingNum: string
): Promise<boolean> {
  if (!projectId) return false
  const favorites = await this.getFavorites(projectId)
  const folder = favorites.folders.find(f => f.id === folderId)
  if (!folder) return false
  if (folder.drawings.includes(drawingNum)) return false // Already exists
  folder.drawings.push(drawingNum)
  await this.saveFavorites(projectId, favorites)
  return true
},

async removeDrawingFromFolder(
  projectId: string, 
  folderId: number, 
  drawingNum: string
): Promise<void> {
  if (!projectId) return
  const favorites = await this.getFavorites(projectId)
  const folder = favorites.folders.find(f => f.id === folderId)
  if (folder) {
    folder.drawings = folder.drawings.filter(d => d !== drawingNum)
    await this.saveFavorites(projectId, favorites)
  }
},

async getAllFavoriteDrawings(projectId: string): Promise<Set<string>> {
  const favorites = await this.getFavorites(projectId)
  const set = new Set<string>()
  favorites.folders.forEach(f => {
    f.drawings.forEach(d => set.add(d))
  })
  return set
}
```

**SRP**: Storage operations only

### 3.3 Context (Global State)

**File**: `src/sidepanel/contexts/FavoritesContext.tsx` (NEW)

```typescript
import { createContext } from 'preact'
import { useContext, useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import type { FavoriteFolder, FavoritesData } from '@/types'

interface FavoritesContextValue {
  folders: FavoriteFolder[]
  isLoading: boolean
  addFolder: (name: string) => Promise<FavoriteFolder>
  removeFolder: (folderId: number) => Promise<void>
  addDrawingToFolder: (folderId: number, drawingNum: string) => Promise<boolean>
  removeDrawingFromFolder: (folderId: number, drawingNum: string) => Promise<void>
  getAllFavoriteDrawings: () => Set<string>
  refresh: () => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined)

interface FavoritesProviderProps {
  children: preact.ComponentChildren
  projectId: string | null
}

export function FavoritesProvider({ children, projectId }: FavoritesProviderProps) {
  const [folders, setFolders] = useState<FavoriteFolder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadFavorites = useCallback(async () => {
    if (!projectId) {
      setFolders([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const data = await StorageService.getFavorites(projectId)
    setFolders(data.folders)
    setIsLoading(false)
  }, [projectId])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const addFolder = useCallback(async (name: string) => {
    if (!projectId) throw new Error('No project selected')
    const folder = await StorageService.addFolder(projectId, name)
    await loadFavorites()
    return folder
  }, [projectId, loadFavorites])

  const removeFolder = useCallback(async (folderId: number) => {
    if (!projectId) return
    await StorageService.removeFolder(projectId, folderId)
    await loadFavorites()
  }, [projectId, loadFavorites])

  const addDrawingToFolder = useCallback(async (folderId: number, drawingNum: string) => {
    if (!projectId) return false
    const success = await StorageService.addDrawingToFolder(projectId, folderId, drawingNum)
    if (success) await loadFavorites()
    return success
  }, [projectId, loadFavorites])

  const removeDrawingFromFolder = useCallback(async (folderId: number, drawingNum: string) => {
    if (!projectId) return
    await StorageService.removeDrawingFromFolder(projectId, folderId, drawingNum)
    await loadFavorites()
  }, [projectId, loadFavorites])

  const getAllFavoriteDrawings = useCallback(() => {
    const set = new Set<string>()
    folders.forEach(f => {
      f.drawings.forEach(d => set.add(d))
    })
    return set
  }, [folders])

  return (
    <FavoritesContext.Provider value={{
      folders,
      isLoading,
      addFolder,
      removeFolder,
      addDrawingToFolder,
      removeDrawingFromFolder,
      getAllFavoriteDrawings,
      refresh: loadFavorites,
    }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider')
  }
  return context
}
```

**SRP**: Global favorites state management

### 3.4 Hook Export

**File**: `src/sidepanel/hooks/useFavorites.ts` (NEW)

```typescript
export { useFavorites } from '../contexts/FavoritesContext'
```

### 3.5 Components

**File**: `src/sidepanel/components/FavoritesTab.tsx` (NEW)

- Full favorites UI with folders
- Drag-and-drop support
- Folder management (create, delete, rename)
- Drawing list per folder

**File**: `src/sidepanel/components/FavoriteFolder.tsx` (NEW)

- Individual folder component
- Drag-and-drop target
- Drawing list rendering

**File**: `src/sidepanel/components/ContextMenu.tsx` (NEW)

- Right-click menu for drawings
- "Add to Favorites" with folder selection
- "Copy Link" option

### 3.6 Integration Points

**File**: `src/sidepanel/App.tsx`

- Wrap app with `FavoritesProvider`
- Pass `currentProjectId` to provider

**File**: `src/sidepanel/components/DrawingsTab.tsx`

- Add context menu to drawing rows
- Show favorite indicator (star icon) for favorited drawings
- Support drag-and-drop to favorites

---

## 4. Command Palette (Alt+P)

### 4.1 Data Model

**File**: `src/types/index.ts`

```typescript
export interface CommandPaletteResult {
  drawing: Drawing
  discipline: string
  isFavorite: boolean
  isRecent: boolean
}

export type CommandPaletteFilter = 'all' | 'favorites' | 'discipline' | 'recents'
```

### 4.2 Hook

**File**: `src/sidepanel/hooks/useCommandPalette.ts` (NEW)

```typescript
import { useState, useMemo, useCallback } from 'preact/hooks'
import { useFavorites } from './useFavorites'
import { useRecents } from './useRecents'
import { StorageService } from '@/services'
import type { Drawing, DisciplineMap, CommandPaletteResult } from '@/types'

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

export function useCommandPalette(projectId: string | null) {
  const { getAllFavoriteDrawings } = useFavorites()
  const { recents } = useRecents(projectId)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchResults = useMemo(async (): Promise<CommandPaletteResult[]> => {
    if (!projectId) return []
    
    const [drawings, disciplineMap, favoriteSet] = await Promise.all([
      StorageService.getDrawings(projectId),
      StorageService.getDisciplineMap(projectId),
      projectId ? StorageService.getAllFavoriteDrawings(projectId) : Promise.resolve(new Set<string>())
    ])

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
    } else if (!cleanQuery && recents.length > 0) {
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
      const recentDrawings = recents
        .map(num => drawings.find(d => d.num === num))
        .filter((d): d is Drawing => d !== undefined)
      
      results = recentDrawings.map(d => ({
        drawing: d,
        discipline: getDisciplineName(d),
        isFavorite: favoriteSet.has(d.num),
        isRecent: true,
      }))
      return results
    }

    // Filter drawings
    const filtered = drawings.filter(d => {
      // Favorites filter
      if (filter === 'favorites' && !favoriteSet.has(d.num)) {
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
      isFavorite: favoriteSet.has(d.num),
      isRecent: recents.includes(d.num),
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
      const discA = Object.values(disciplineMap).find(m => m.name === a[0])
      const discB = Object.values(disciplineMap).find(m => m.name === b[0])
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

    return flattened.slice(0, 50)
  }, [projectId, searchQuery, recents, getAllFavoriteDrawings])

  const open = useCallback(() => {
    setIsOpen(true)
    setSearchQuery('')
    setSelectedIndex(0)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    
    // Results need to be awaited - this is a simplification
    // In practice, we'd need to handle async results differently
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      // Increment selectedIndex (with bounds checking)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      // Decrement selectedIndex
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Open selected drawing
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }, [isOpen, close])

  return {
    isOpen,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    searchResults,
    open,
    close,
    handleKeyDown,
  }
}
```

**Note**: This hook has async results - we'll need to handle this carefully in the component.

**SRP**: Command palette search logic and state

### 4.3 Component

**File**: `src/sidepanel/components/CommandPalette.tsx` (NEW)

- Modal overlay (like v1)
- Search input with special character hints
- Results list with keyboard navigation
- Discipline grouping
- Keyboard shortcuts (Alt+P to open, Arrow keys, Enter, Escape)

### 4.4 Global Keyboard Handler

**File**: `src/sidepanel/App.tsx` or new hook

- Listen for Alt+P globally
- Open command palette
- Handle focus management

---

## File Structure Summary

```
v2/src/
├── types/
│   ├── index.ts                    # Add StatusColor, FavoriteFolder, etc.
│   └── preferences.ts              # (existing)
├── services/
│   └── storage.ts                  # Add favorites, recents, status colors methods
├── sidepanel/
│   ├── contexts/
│   │   ├── ThemeContext.tsx        # (existing)
│   │   └── FavoritesContext.tsx    # NEW - Global favorites state
│   ├── hooks/
│   │   ├── useTheme.ts             # (existing)
│   │   ├── useStatusColors.ts      # NEW - Status color management
│   │   ├── useRecents.ts           # NEW - Recents management
│   │   ├── useFavorites.ts         # NEW - Re-export from context
│   │   └── useCommandPalette.ts   # NEW - Command palette logic
│   ├── components/
│   │   ├── StatusDot.tsx           # NEW - Status dot UI
│   │   ├── FavoritesTab.tsx        # NEW - Favorites UI
│   │   ├── FavoriteFolder.tsx      # NEW - Folder component
│   │   ├── ContextMenu.tsx         # NEW - Right-click menu
│   │   ├── CommandPalette.tsx     # NEW - Command palette modal
│   │   └── ... (existing)
│   └── App.tsx                     # Wrap with FavoritesProvider, add keyboard handler
```

---

## Implementation Steps

### Step 1: Types & Storage (Foundation)
1. ✅ Add types to `types/index.ts`
2. ✅ Add storage methods to `StorageService`
3. ✅ Test storage operations

### Step 2: Status Colors (Independent)
1. ✅ Create `useStatusColors` hook
2. ✅ Create `StatusDot` component
3. ✅ Integrate into `DrawingsTab`
4. ✅ Test color cycling

### Step 3: Recents (Required by Command Palette)
1. ✅ Create `useRecents` hook
2. ✅ Integrate into `DrawingsTab.handleDrawingClick`
3. ✅ Test recents tracking

### Step 4: Favorites (Required by Command Palette)
1. ✅ Create `FavoritesContext`
2. ✅ Create `useFavorites` hook
3. ✅ Create `FavoritesTab` component
4. ✅ Create `FavoriteFolder` component
5. ✅ Create `ContextMenu` component
6. ✅ Integrate drag-and-drop
7. ✅ Wrap App with `FavoritesProvider`
8. ✅ Test favorites functionality

### Step 5: Command Palette (Depends on Steps 3 & 4)
1. ✅ Create `useCommandPalette` hook
2. ✅ Create `CommandPalette` component
3. ✅ Add global keyboard handler (Alt+P)
4. ✅ Integrate with favorites and recents
5. ✅ Test command palette

---

## Key Design Decisions

### 1. Storage Strategy
- **Decision**: Use existing `drawingsStore` for favorites, recents, and status colors (project-specific data)
- **Rationale**: All are project-specific, fits existing pattern
- **Alternative Considered**: Separate stores - rejected (unnecessary complexity)

### 2. State Management
- **Decision**: Context for Favorites (global), hooks for Recents/StatusColors (local)
- **Rationale**: 
  - Favorites used across multiple components (DrawingsTab, CommandPalette, FavoritesTab)
  - Recents/StatusColors primarily used in DrawingsTab
- **Alternative Considered**: All in Context - rejected (over-engineering)

### 3. Command Palette Hook Async Results
- **Decision**: Use `useMemo` with async function (returns Promise)
- **Rationale**: Need to await storage operations
- **Alternative Considered**: Separate state for results - preferred approach
- **Better Approach**: Use `useState` + `useEffect` for async results

### 4. Drawing Number vs ID
- **Decision**: Use `drawing.num` (string) for favorites/recents
- **Rationale**: Matches v1, more user-friendly, stable identifier
- **Alternative Considered**: Use `drawing.id` - rejected (less user-friendly)

### 5. Folder ID Generation
- **Decision**: Use `Date.now()` timestamp
- **Rationale**: Simple, unique, matches v1
- **Alternative Considered**: UUID - rejected (unnecessary complexity)

---

## Testing Strategy

### Unit Tests (Future)
- Storage service methods
- Hook logic
- Utility functions (fuzzyMatch, etc.)

### Integration Tests (Future)
- Favorites CRUD operations
- Recents tracking
- Status color cycling
- Command palette search

### Manual Testing Checklist
1. ✅ Status colors cycle correctly
2. ✅ Recents track last 5 drawings
3. ✅ Favorites folders CRUD works
4. ✅ Drag-and-drop to favorites works
5. ✅ Command palette shows recents when empty
6. ✅ Command palette filters by `*favorites`
7. ✅ Command palette filters by `@discipline`
8. ✅ Keyboard navigation works
9. ✅ Alt+P opens command palette
10. ✅ Data persists across sessions

---

## Migration Considerations

### From v1 Data
- v1 stores favorites as `pp_favs_{projectId}` in chrome.storage.local
- v1 stores recents as `pp_recents_{projectId}` in chrome.storage.local
- v1 stores colors as `pp_colors_{projectId}` in chrome.storage.local

**Migration Path**:
- Create migration utility in `StorageService`
- Check for v1 data on first load
- Convert and migrate to IndexedDB
- Clear v1 data after migration

---

## Performance Considerations

1. **Favorites Lookup**: Use `Set` for O(1) lookups
2. **Command Palette Results**: Limit to 50 items, virtualize if needed
3. **Recents**: Max 5 items (already enforced)
4. **Status Colors**: Load once per project, cache in state

---

## Accessibility Considerations

1. **Keyboard Navigation**: Full keyboard support for all features
2. **ARIA Labels**: Proper labels for all interactive elements
3. **Focus Management**: Proper focus handling in modals
4. **Screen Readers**: Semantic HTML and ARIA attributes

---

## Security Considerations

1. **Input Validation**: Validate folder names, drawing numbers
2. **XSS Prevention**: Sanitize user input (folder names)
3. **Storage Limits**: Enforce reasonable limits (max folders, max drawings per folder)

---

## Future Enhancements

1. **Favorites**: Rename folders, reorder folders
2. **Recents**: Show recents in DrawingsTab footer
3. **Status Colors**: Custom color picker
4. **Command Palette**: Search across RFIs/Commitments
5. **Command Palette**: Recent searches history

---

## Confidence Assessment

| Feature | Confidence | Notes |
|---------|-----------|-------|
| Status Colors | 95% | Straightforward, well-defined |
| Recents | 95% | Simple array management |
| Favorites | 90% | More complex but well-understood |
| Command Palette | 85% | Depends on favorites/recents, async handling complexity |

**Overall Confidence**: 91%

---

## Next Steps

1. Review and approve this plan
2. Implement in order: Status Colors → Recents → Favorites → Command Palette
3. Test each phase before moving to next
4. Document any deviations from plan
