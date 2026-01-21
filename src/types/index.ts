// Core data types for Procore Power-Up 2.0

export interface Drawing {
  id: number
  num: string
  title: string
  // Discipline can be stored as object {id, name} like v1, or just id, or name directly
  discipline?: { id?: number; name?: string } | number
  discipline_name?: string
}

export interface RFI {
  id: number
  number: string
  subject: string
  status: string
  created_at: string
  due_date?: string
  assignee?: string
  ball_in_court?: string
}

export interface Commitment {
  id: number
  number: string
  title: string
  vendor?: string
  vendor_name?: string
  status?: string
  contract_date?: string
  type?: string
  approved_amount?: number
  pending_amount?: number
  draft_amount?: number
}

export interface Project {
  id: string
  companyId?: string
  name?: string
  drawingAreaId?: string
  lastAccessed: number
}

export interface DisciplineMap {
  [id: number]: {
    name: string
    index: number
  }
}

export interface ProjectCache {
  projectId: string
  companyId?: string
  drawingAreaId?: string
  timestamp: number
  drawings: Drawing[]
  disciplineMap: DisciplineMap
}

export interface WiretapMessage {
  type: 'PP_DATA'
  payload: unknown
  ids: {
    companyId: string | null
    projectId: string | null
    drawingAreaId: string | null
  }
  source: string
  headers: {
    total?: string | null
    perPage?: string | null
  }
}

export interface TabInfo {
  id: 'drawings' | 'rfis' | 'cost'
  label: string
  icon: import('lucide-preact').LucideIcon
}

// Message types for communication between extension components
export type MessageType = 
  | 'TOGGLE_SIDEPANEL'
  | 'DATA_UPDATE'
  | 'SCAN_REQUEST'
  | 'SCAN_COMPLETE'
  | 'GET_PROJECT_DATA'
  | 'WIRETAP_DATA'

export interface ExtensionMessage<T = unknown> {
  type: MessageType
  payload?: T
}

// ============================================
// STATUS COLORS
// ============================================

export type StatusColor = 'green' | 'red' | 'yellow' | 'blue' | 'orange' | 'pink'

export interface DrawingStatusColors {
  [drawingNum: string]: StatusColor
}

// ============================================
// RECENTS
// ============================================

export type RecentsList = string[] // Array of drawing numbers

// ============================================
// FAVORITES
// ============================================

export interface FavoriteFolder {
  id: number
  name: string
  drawings: string[] // Array of drawing numbers
}

export interface FavoritesData {
  folders: FavoriteFolder[]
}

// ============================================
// COMMAND PALETTE
// ============================================

// Discriminated union for command palette items
export type CommandPaletteItem = 
  | { type: 'drawing'; data: Drawing; discipline: string; isFavorite: boolean; isRecent: boolean }
  | { type: 'rfi'; data: RFI }

// Backward compatibility alias
export type CommandPaletteResult = CommandPaletteItem

export type CommandPaletteFilter = 'all' | 'favorites' | 'discipline' | 'recents' | 'rfis'

// Export CommandPaletteDataProvider type
export type { CommandPaletteDataProvider } from './command-palette'
