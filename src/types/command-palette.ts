import type { Drawing, DisciplineMap, RecentsList } from './index'

/**
 * Data provider interface for Command Palette
 * Allows the palette to work in different contexts (side panel vs content script overlay)
 */
export interface CommandPaletteDataProvider {
  /**
   * Get all drawings for a project
   */
  getDrawings(projectId: string): Promise<Drawing[]>
  
  /**
   * Get discipline map for a project
   */
  getDisciplineMap(projectId: string): Promise<DisciplineMap>
  
  /**
   * Get all favorite drawing numbers as a Set
   */
  getAllFavoriteDrawings(projectId: string): Promise<Set<string>>
  
  /**
   * Get recent drawing numbers
   */
  getRecents(projectId: string): Promise<RecentsList>
}
