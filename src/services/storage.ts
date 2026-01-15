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
  Project, 
  ProjectCache,
  DisciplineMap 
} from '@/types'

// Create separate stores for each data type
const drawingsStore = createStore('pp-drawings', 'drawings')
const rfisStore = createStore('pp-rfis', 'rfis')
const commitmentsStore = createStore('pp-commitments', 'commitments')
const projectsStore = createStore('pp-projects', 'projects')
const preferencesStore = createStore('pp-preferences', 'preferences')

// Key generation helpers
const drawingKey = (projectId: string) => `drawings_${projectId}`
const rfiKey = (projectId: string) => `rfis_${projectId}`
const commitmentKey = (projectId: string) => `commitments_${projectId}`
const disciplineMapKey = (projectId: string) => `discipline_map_${projectId}`

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
  },

  async clearAllData(): Promise<void> {
    await clear(drawingsStore)
    await clear(rfisStore)
    await clear(commitmentsStore)
    await clear(projectsStore)
  },

  // Export for debugging
  async exportAllData(): Promise<Record<string, unknown>> {
    const projects = await this.getAllProjects()
    const data: Record<string, unknown> = { projects }
    
    for (const project of projects) {
      data[`drawings_${project.id}`] = await this.getDrawings(project.id)
      data[`rfis_${project.id}`] = await this.getRFIs(project.id)
      data[`commitments_${project.id}`] = await this.getCommitments(project.id)
    }
    
    return data
  },
}
