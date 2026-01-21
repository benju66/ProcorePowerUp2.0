/**
 * StorageService - IndexedDB storage using idb-keyval
 * 
 * Provides separate stores for different data types:
 * - drawings: Drawing data per project
 * - rfis: RFI data per project
 * - commitments: Commitment/contract data per project
 * - projects: Project metadata and settings
 */

import { createStore, get, set, del, keys, clear } from 'idb-keyval'
import type { 
  Drawing, 
  RFI, 
  Commitment, 
  Specification,
  Project, 
  ProjectCache,
  DisciplineMap,
  DivisionMap,
  StatusColor,
  DrawingStatusColors,
  RecentsList,
  FavoriteFolder,
  FavoritesData
} from '@/types'

// Create separate stores for each data type
const drawingsStore = createStore('pp-drawings', 'drawings')
const rfisStore = createStore('pp-rfis', 'rfis')
const commitmentsStore = createStore('pp-commitments', 'commitments')
const specificationsStore = createStore('pp-specifications', 'specifications')
const projectsStore = createStore('pp-projects', 'projects')
const preferencesStore = createStore('pp-preferences', 'preferences')

// Key generation helpers
const drawingKey = (projectId: string) => `drawings_${projectId}`
const rfiKey = (projectId: string) => `rfis_${projectId}`
const commitmentKey = (projectId: string) => `commitments_${projectId}`
const specificationKey = (projectId: string) => `specifications_${projectId}`
const disciplineMapKey = (projectId: string) => `discipline_map_${projectId}`
const divisionMapKey = (projectId: string) => `division_map_${projectId}`
const statusColorsKey = (projectId: string) => `status_colors_${projectId}`
const recentsKey = (projectId: string) => `recents_${projectId}`
const favoritesKey = (projectId: string) => `favorites_${projectId}`

export const StorageService = {
  // ============================================
  // DRAWINGS
  // ============================================
  
  async getDrawings(projectId: string): Promise<Drawing[]> {
    if (!projectId) return []
    const data = await get<Drawing[]>(drawingKey(projectId), drawingsStore)
    return data ?? []
  },

  async saveDrawings(projectId: string, drawings: Drawing[]): Promise<void> {
    if (!projectId) return
    await set(drawingKey(projectId), drawings, drawingsStore)
  },

  async mergeDrawings(projectId: string, newDrawings: Drawing[]): Promise<Drawing[]> {
    if (!projectId) return []
    const existing = await this.getDrawings(projectId)
    const existingIds = new Set(existing.map(d => d.id))
    const toAdd = newDrawings.filter(d => !existingIds.has(d.id))
    const merged = [...existing, ...toAdd]
    await this.saveDrawings(projectId, merged)
    return merged
  },

  async getDisciplineMap(projectId: string): Promise<DisciplineMap> {
    if (!projectId) return {}
    const data = await get<DisciplineMap>(disciplineMapKey(projectId), drawingsStore)
    return data ?? {}
  },

  async saveDisciplineMap(projectId: string, map: DisciplineMap): Promise<void> {
    if (!projectId) return
    await set(disciplineMapKey(projectId), map, drawingsStore)
  },

  async getProjectCache(projectId: string): Promise<ProjectCache | null> {
    if (!projectId) return null
    const drawings = await this.getDrawings(projectId)
    const disciplineMap = await this.getDisciplineMap(projectId)
    const project = await this.getProject(projectId)
    
    if (drawings.length === 0) return null
    
    return {
      projectId,
      companyId: project?.companyId,
      drawingAreaId: project?.drawingAreaId,
      timestamp: project?.lastAccessed ?? Date.now(),
      drawings,
      disciplineMap,
    }
  },

  // ============================================
  // RFIs
  // ============================================
  
  async getRFIs(projectId: string): Promise<RFI[]> {
    if (!projectId) return []
    const data = await get<RFI[]>(rfiKey(projectId), rfisStore)
    return data ?? []
  },

  async saveRFIs(projectId: string, rfis: RFI[]): Promise<void> {
    if (!projectId) return
    await set(rfiKey(projectId), rfis, rfisStore)
  },

  async mergeRFIs(projectId: string, newRFIs: RFI[]): Promise<RFI[]> {
    if (!projectId) return []
    const existing = await this.getRFIs(projectId)
    const existingIds = new Set(existing.map(r => r.id))
    const toAdd = newRFIs.filter(r => !existingIds.has(r.id))
    const merged = [...existing, ...toAdd]
    await this.saveRFIs(projectId, merged)
    return merged
  },

  // ============================================
  // COMMITMENTS
  // ============================================
  
  async getCommitments(projectId: string): Promise<Commitment[]> {
    if (!projectId) return []
    const data = await get<Commitment[]>(commitmentKey(projectId), commitmentsStore)
    return data ?? []
  },

  async saveCommitments(projectId: string, commitments: Commitment[]): Promise<void> {
    if (!projectId) return
    await set(commitmentKey(projectId), commitments, commitmentsStore)
  },

  async mergeCommitments(projectId: string, newCommitments: Commitment[]): Promise<Commitment[]> {
    if (!projectId) return []
    const existing = await this.getCommitments(projectId)
    const existingIds = new Set(existing.map(c => c.id))
    const toAdd = newCommitments.filter(c => !existingIds.has(c.id))
    const merged = [...existing, ...toAdd]
    await this.saveCommitments(projectId, merged)
    return merged
  },

  // ============================================
  // SPECIFICATIONS
  // ============================================
  
  async getSpecifications(projectId: string): Promise<Specification[]> {
    if (!projectId) return []
    const data = await get<Specification[]>(specificationKey(projectId), specificationsStore)
    return data ?? []
  },

  async saveSpecifications(projectId: string, specifications: Specification[]): Promise<void> {
    if (!projectId) return
    await set(specificationKey(projectId), specifications, specificationsStore)
  },

  async mergeSpecifications(projectId: string, newSpecifications: Specification[]): Promise<Specification[]> {
    if (!projectId) return []
    const existing = await this.getSpecifications(projectId)
    const existingIds = new Set(existing.map(s => s.id))
    const toAdd = newSpecifications.filter(s => !existingIds.has(s.id))
    const merged = [...existing, ...toAdd]
    await this.saveSpecifications(projectId, merged)
    return merged
  },

  async getDivisionMap(projectId: string): Promise<DivisionMap> {
    if (!projectId) return {}
    const data = await get<DivisionMap>(divisionMapKey(projectId), specificationsStore)
    return data ?? {}
  },

  async saveDivisionMap(projectId: string, map: DivisionMap): Promise<void> {
    if (!projectId) return
    await set(divisionMapKey(projectId), map, specificationsStore)
  },

  // ============================================
  // PROJECTS
  // ============================================
  
  async getProject(projectId: string): Promise<Project | null> {
    if (!projectId) return null
    const data = await get<Project>(projectId, projectsStore)
    return data ?? null
  },

  async saveProject(project: Project): Promise<void> {
    if (!project.id) return
    await set(project.id, project, projectsStore)
  },

  async getAllProjects(): Promise<Project[]> {
    const allKeys = await keys<string>(projectsStore)
    const projects: Project[] = []
    for (const key of allKeys) {
      const project = await get<Project>(key, projectsStore)
      if (project) projects.push(project)
    }
    return projects.sort((a, b) => b.lastAccessed - a.lastAccessed)
  },

  async updateProjectAccess(projectId: string, updates: Partial<Project>): Promise<void> {
    const existing = await this.getProject(projectId) ?? { id: projectId, lastAccessed: Date.now() }
    await this.saveProject({
      ...existing,
      ...updates,
      lastAccessed: Date.now(),
    })
  },

  // ============================================
  // PREFERENCES
  // ============================================
  
  async getPreferences<T>(key: string, defaultValue: T): Promise<T> {
    const data = await get<T>(key, preferencesStore)
    return data ?? defaultValue
  },

  async savePreference<T>(key: string, value: T): Promise<void> {
    await set(key, value, preferencesStore)
  },

  // ============================================
  // UTILITIES
  // ============================================
  
  async clearProjectData(projectId: string): Promise<void> {
    if (!projectId) return
    await del(drawingKey(projectId), drawingsStore)
    await del(disciplineMapKey(projectId), drawingsStore)
    await del(rfiKey(projectId), rfisStore)
    await del(commitmentKey(projectId), commitmentsStore)
    await del(specificationKey(projectId), specificationsStore)
    await del(divisionMapKey(projectId), specificationsStore)
  },

  async deleteProject(projectId: string): Promise<void> {
    if (!projectId) return
    
    // Delete all project data from various stores
    await del(drawingKey(projectId), drawingsStore)
    await del(disciplineMapKey(projectId), drawingsStore)
    await del(rfiKey(projectId), rfisStore)
    await del(commitmentKey(projectId), commitmentsStore)
    await del(specificationKey(projectId), specificationsStore)
    await del(divisionMapKey(projectId), specificationsStore)
    
    // Delete project preferences
    await del(statusColorsKey(projectId), preferencesStore)
    await del(recentsKey(projectId), preferencesStore)
    await del(favoritesKey(projectId), preferencesStore)
    
    // Delete the project entry itself
    await del(projectId, projectsStore)
  },

  async clearAllData(): Promise<void> {
    await clear(drawingsStore)
    await clear(rfisStore)
    await clear(commitmentsStore)
    await clear(specificationsStore)
    await clear(projectsStore)
  },

  // ============================================
  // STATUS COLORS
  // ============================================
  
  async getStatusColors(projectId: string): Promise<DrawingStatusColors> {
    if (!projectId) return {}
    const data = await get<DrawingStatusColors>(statusColorsKey(projectId), preferencesStore)
    return data ?? {}
  },

  async saveStatusColors(projectId: string, colors: DrawingStatusColors): Promise<void> {
    if (!projectId) return
    await set(statusColorsKey(projectId), colors, preferencesStore)
  },

  async setDrawingStatusColor(projectId: string, drawingNum: string, color: StatusColor | null): Promise<void> {
    if (!projectId) return
    const colors = await this.getStatusColors(projectId)
    if (color) {
      colors[drawingNum] = color
    } else {
      delete colors[drawingNum]
    }
    await this.saveStatusColors(projectId, colors)
  },

  // ============================================
  // RECENTS
  // ============================================
  
  async getRecents(projectId: string): Promise<RecentsList> {
    if (!projectId) return []
    const data = await get<RecentsList>(recentsKey(projectId), preferencesStore)
    return data ?? []
  },

  async saveRecents(projectId: string, recents: RecentsList): Promise<void> {
    if (!projectId) return
    await set(recentsKey(projectId), recents, preferencesStore)
  },

  async addRecent(projectId: string, drawingNum: string): Promise<void> {
    if (!projectId || !drawingNum) return
    const recents = await this.getRecents(projectId)
    // Remove if already exists (deduplication)
    const filtered = recents.filter(num => num !== drawingNum)
    // Add to front
    const updated = [drawingNum, ...filtered]
    // Limit to 5 items (like v1)
    const limited = updated.slice(0, 5)
    await this.saveRecents(projectId, limited)
  },

  // ============================================
  // FAVORITES
  // ============================================
  
  async getFavorites(projectId: string): Promise<FavoritesData> {
    if (!projectId) return { folders: [] }
    const data = await get<FavoritesData>(favoritesKey(projectId), preferencesStore)
    if (!data) return { folders: [] }
    
    // Ensure all folder drawings are sorted to match default list order
    data.folders.forEach(folder => {
      folder.drawings.sort((a, b) => 
        (a || '').localeCompare(b || '', undefined, { numeric: true })
      )
    })
    
    return data
  },

  async saveFavorites(projectId: string, favorites: FavoritesData): Promise<void> {
    if (!projectId) return
    await set(favoritesKey(projectId), favorites, preferencesStore)
  },

  async addFolder(projectId: string, name: string): Promise<FavoriteFolder> {
    if (!projectId) throw new Error('No project selected')
    const favorites = await this.getFavorites(projectId)
    const newFolder: FavoriteFolder = {
      id: Date.now(), // Simple timestamp-based ID (like v1)
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

  async addDrawingToFolder(projectId: string, folderId: number, drawingNum: string): Promise<boolean> {
    if (!projectId) return false
    const favorites = await this.getFavorites(projectId)
    const folder = favorites.folders.find(f => f.id === folderId)
    if (!folder) return false
    
    // Check if already in folder
    if (folder.drawings.includes(drawingNum)) return false
    
    folder.drawings.push(drawingNum)
    // Sort drawings to match the default list order (numeric sorting)
    folder.drawings.sort((a, b) => 
      (a || '').localeCompare(b || '', undefined, { numeric: true })
    )
    await this.saveFavorites(projectId, favorites)
    return true
  },

  async removeDrawingFromFolder(projectId: string, folderId: number, drawingNum: string): Promise<void> {
    if (!projectId) return
    const favorites = await this.getFavorites(projectId)
    const folder = favorites.folders.find(f => f.id === folderId)
    if (!folder) return
    
    folder.drawings = folder.drawings.filter(num => num !== drawingNum)
    await this.saveFavorites(projectId, favorites)
  },

  async getAllFavoriteDrawings(projectId: string): Promise<Set<string>> {
    if (!projectId) return new Set()
    const favorites = await this.getFavorites(projectId)
    const set = new Set<string>()
    favorites.folders.forEach(f => {
      f.drawings.forEach(d => set.add(d))
    })
    return set
  },

  // Export for debugging
  async exportAllData(): Promise<Record<string, unknown>> {
    const projects = await this.getAllProjects()
    const data: Record<string, unknown> = { projects }
    
    for (const project of projects) {
      data[`drawings_${project.id}`] = await this.getDrawings(project.id)
      data[`rfis_${project.id}`] = await this.getRFIs(project.id)
      data[`commitments_${project.id}`] = await this.getCommitments(project.id)
      data[`specifications_${project.id}`] = await this.getSpecifications(project.id)
    }
    
    return data
  },
}
