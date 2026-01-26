import { createContext } from 'preact'
import { useContext, useState, useEffect, useCallback } from 'preact/hooks'
import { StorageService } from '@/services'
import type { FavoriteFolder } from '@/types'

interface FavoritesContextValue {
  folders: FavoriteFolder[]
  isLoading: boolean
  addFolder: (name: string) => Promise<FavoriteFolder>
  removeFolder: (folderId: number) => Promise<void>
  reorderFolders: (newOrderIds: number[]) => Promise<void>
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

  const reorderFolders = useCallback(async (newOrderIds: number[]) => {
    if (!projectId) return
    // Reorder folders based on the new order of IDs
    const reordered = newOrderIds
      .map(id => folders.find(f => f.id === id))
      .filter((f): f is FavoriteFolder => f !== undefined)
    // Optimistic update
    setFolders(reordered)
    // Persist to storage
    await StorageService.saveFavorites(projectId, { folders: reordered })
  }, [projectId, folders])

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
      reorderFolders,
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
