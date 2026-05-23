import { create } from 'zustand'

export interface Photo {
  id: string
  path: string
  filename: string
  thumbnail_path: string | null
  width: number
  height: number
  file_size: number
  date_created: string
  date_modified: string
  rating: number
  flag: 'picked' | 'rejected' | 'unflagged'
  color_tag: string | null
  folder_path: string
  exif?: any
  iptc?: any
  ai?: AIScore | null
}

export interface AIScore {
  overall: number
  sharpness: number
  exposure: number
  composition: number
  subject: number
  faces: number
  eyes_open: number | null
  recommendation: 'pick' | 'maybe' | 'reject'
  reasoning: string
  tags: string
  analysis_time: number
  analyzed_at: string
}

export interface FilterState {
  ratingMin: number | null
  flag: 'picked' | 'rejected' | 'unflagged' | null
  colorTag: string | null
  aiRec: 'pick' | 'maybe' | 'reject' | null
}

interface AppState {
  currentFolder: string | null
  photos: Photo[]
  filteredPhotos: Photo[]
  selectedIds: Set<string>
  activePhoto: Photo | null
  viewMode: 'contact-sheet' | 'loupe'
  thumbnailSize: number
  showMetadataPanel: boolean
  showAIPanel: boolean
  sortBy: 'filename' | 'date' | 'rating' | 'ai-score'
  sortOrder: 'asc' | 'desc'
  filters: FilterState
  isScanning: boolean
  isAnalyzing: boolean
  analyzeProgress: { current: number; total: number }
  ollamaStatus: { connected: boolean; model: string; models: any[] }

  setCurrentFolder: (folder: string) => Promise<void>
  setPhotos: (photos: Photo[]) => void
  setActivePhoto: (photo: Photo | null) => void
  selectPhoto: (id: string, multi?: boolean, range?: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  navigatePhoto: (direction: 'next' | 'prev') => void
  setView: (mode: 'contact-sheet' | 'loupe') => void
  setThumbnailSize: (delta: number) => void
  togglePanel: (panel: 'metadata' | 'ai') => void
  applyPhotoAction: (action: string) => void
  updatePhotoRating: (id: string, rating: number) => Promise<void>
  updatePhotoFlag: (id: string, flag: 'picked' | 'rejected' | 'unflagged') => Promise<void>
  updatePhotoColor: (id: string, color: string | null) => Promise<void>
  updatePhotoAI: (id: string, ai: AIScore) => void
  updatePhotoThumbnail: (path: string, thumbnailPath: string) => void
  setSortBy: (sortBy: AppState['sortBy']) => void
  setSortOrder: (order: 'asc' | 'desc') => void
  setFilters: (filters: Partial<FilterState>) => void
  clearFilters: () => void
  setOllamaStatus: (status: any) => void
  setAnalyzeProgress: (progress: { current: number; total: number }) => void
}

const DEFAULT_FILTERS: FilterState = {
  ratingMin: null,
  flag: null,
  colorTag: null,
  aiRec: null
}

function applyFiltersAndSort(photos: Photo[], filters: FilterState, sortBy: string, sortOrder: string): Photo[] {
  let result = photos.filter(p => {
    if (filters.ratingMin !== null && p.rating < filters.ratingMin) return false
    if (filters.flag !== null && p.flag !== filters.flag) return false
    if (filters.colorTag !== null && p.color_tag !== filters.colorTag) return false
    if (filters.aiRec !== null && p.ai?.recommendation !== filters.aiRec) return false
    return true
  })

  result.sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case 'filename':
        cmp = a.filename.localeCompare(b.filename)
        break
      case 'date':
        cmp = new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        break
      case 'rating':
        cmp = a.rating - b.rating
        break
      case 'ai-score':
        cmp = (a.ai?.overall || 0) - (b.ai?.overall || 0)
        break
    }
    return sortOrder === 'desc' ? -cmp : cmp
  })

  return result
}

export const useAppStore = create<AppState>((set, get) => ({
  currentFolder: null,
  photos: [],
  filteredPhotos: [],
  selectedIds: new Set(),
  activePhoto: null,
  viewMode: 'contact-sheet',
  thumbnailSize: 200,
  showMetadataPanel: true,
  showAIPanel: true,
  sortBy: 'filename',
  sortOrder: 'asc',
  filters: DEFAULT_FILTERS,
  isScanning: false,
  isAnalyzing: false,
  analyzeProgress: { current: 0, total: 0 },
  ollamaStatus: { connected: false, model: '', models: [] },

  setCurrentFolder: async (folder: string) => {
    set({ currentFolder: folder, isScanning: true, photos: [], filteredPhotos: [], selectedIds: new Set(), activePhoto: null })
    try {
      const photos = await window.api.scanFolder(folder)
      const { filters, sortBy, sortOrder } = get()
      const filtered = applyFiltersAndSort(photos, filters, sortBy, sortOrder)
      set({ photos, filteredPhotos: filtered, isScanning: false })

      // Start generating thumbnails in background
      const paths = photos.map((p: Photo) => p.path)
      window.api.generateThumbnailBatch(paths, 320)
    } catch (err) {
      set({ isScanning: false })
    }
  },

  setPhotos: (photos: Photo[]) => {
    const { filters, sortBy, sortOrder } = get()
    set({ photos, filteredPhotos: applyFiltersAndSort(photos, filters, sortBy, sortOrder) })
  },

  setActivePhoto: (photo: Photo | null) => {
    set({ activePhoto: photo })
    if (photo) {
      // Load metadata lazily
      window.api.getPhotoMetadata(photo.path).then((meta: any) => {
        set(state => ({
          photos: state.photos.map(p => p.id === photo.id ? { ...p, ...meta } : p),
          filteredPhotos: state.filteredPhotos.map(p => p.id === photo.id ? { ...p, ...meta } : p),
          activePhoto: state.activePhoto?.id === photo.id ? { ...state.activePhoto, ...meta } : state.activePhoto
        }))
      })
    }
  },

  selectPhoto: (id: string, multi = false, range = false) => {
    set(state => {
      let newSelected: Set<string>
      if (multi) {
        newSelected = new Set(state.selectedIds)
        if (newSelected.has(id)) {
          newSelected.delete(id)
        } else {
          newSelected.add(id)
        }
      } else if (range && state.activePhoto) {
        const photos = state.filteredPhotos
        const lastIdx = photos.findIndex(p => p.id === state.activePhoto!.id)
        const newIdx = photos.findIndex(p => p.id === id)
        const start = Math.min(lastIdx, newIdx)
        const end = Math.max(lastIdx, newIdx)
        newSelected = new Set(photos.slice(start, end + 1).map(p => p.id))
      } else {
        newSelected = new Set([id])
      }
      const photo = state.filteredPhotos.find(p => p.id === id) || null
      return { selectedIds: newSelected, activePhoto: photo }
    })
  },

  selectAll: () => {
    set(state => ({
      selectedIds: new Set(state.filteredPhotos.map(p => p.id))
    }))
  },

  clearSelection: () => set({ selectedIds: new Set(), activePhoto: null }),

  navigatePhoto: (direction: 'next' | 'prev') => {
    const { filteredPhotos, activePhoto } = get()
    if (!activePhoto || filteredPhotos.length === 0) return
    const currentIdx = filteredPhotos.findIndex(p => p.id === activePhoto.id)
    let nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1
    nextIdx = Math.max(0, Math.min(filteredPhotos.length - 1, nextIdx))
    const nextPhoto = filteredPhotos[nextIdx]
    set({ activePhoto: nextPhoto, selectedIds: new Set([nextPhoto.id]) })
    get().setActivePhoto(nextPhoto)
  },

  setView: (mode: 'contact-sheet' | 'loupe') => set({ viewMode: mode }),

  setThumbnailSize: (delta: number) => {
    set(state => ({
      thumbnailSize: Math.max(100, Math.min(400, state.thumbnailSize + delta * 30))
    }))
  },

  togglePanel: (panel: 'metadata' | 'ai') => {
    if (panel === 'metadata') set(state => ({ showMetadataPanel: !state.showMetadataPanel }))
    else set(state => ({ showAIPanel: !state.showAIPanel }))
  },

  applyPhotoAction: (action: string) => {
    const { selectedIds, filteredPhotos } = get()
    const targets = filteredPhotos.filter(p => selectedIds.has(p.id))

    for (const photo of targets) {
      if (action === 'pick') get().updatePhotoFlag(photo.id, 'picked')
      else if (action === 'reject') get().updatePhotoFlag(photo.id, 'rejected')
      else if (action === 'unflag') get().updatePhotoFlag(photo.id, 'unflagged')
      else if (action.startsWith('rate-')) {
        const rating = parseInt(action.split('-')[1])
        get().updatePhotoRating(photo.id, rating)
      }
    }
  },

  updatePhotoRating: async (id: string, rating: number) => {
    await window.api.updateRating(id, rating)
    set(state => ({
      photos: state.photos.map(p => p.id === id ? { ...p, rating } : p),
      filteredPhotos: state.filteredPhotos.map(p => p.id === id ? { ...p, rating } : p),
      activePhoto: state.activePhoto?.id === id ? { ...state.activePhoto, rating } : state.activePhoto
    }))
  },

  updatePhotoFlag: async (id: string, flag: 'picked' | 'rejected' | 'unflagged') => {
    await window.api.updateFlag(id, flag)
    set(state => ({
      photos: state.photos.map(p => p.id === id ? { ...p, flag } : p),
      filteredPhotos: state.filteredPhotos.map(p => p.id === id ? { ...p, flag } : p),
      activePhoto: state.activePhoto?.id === id ? { ...state.activePhoto, flag } : state.activePhoto
    }))
  },

  updatePhotoColor: async (id: string, color: string | null) => {
    await window.api.updateColor(id, color)
    set(state => ({
      photos: state.photos.map(p => p.id === id ? { ...p, color_tag: color } : p),
      filteredPhotos: state.filteredPhotos.map(p => p.id === id ? { ...p, color_tag: color } : p),
      activePhoto: state.activePhoto?.id === id ? { ...state.activePhoto, color_tag: color } : state.activePhoto
    }))
  },

  updatePhotoAI: (id: string, ai: AIScore) => {
    set(state => ({
      photos: state.photos.map(p => p.id === id ? { ...p, ai } : p),
      filteredPhotos: state.filteredPhotos.map(p => p.id === id ? { ...p, ai } : p),
      activePhoto: state.activePhoto?.id === id ? { ...state.activePhoto, ai } : state.activePhoto
    }))
  },

  updatePhotoThumbnail: (path: string, thumbnailPath: string) => {
    set(state => ({
      photos: state.photos.map(p => p.path === path ? { ...p, thumbnail_path: thumbnailPath } : p),
      filteredPhotos: state.filteredPhotos.map(p => p.path === path ? { ...p, thumbnail_path: thumbnailPath } : p)
    }))
  },

  setSortBy: (sortBy) => {
    const { photos, filters, sortOrder } = get()
    set({ sortBy, filteredPhotos: applyFiltersAndSort(photos, filters, sortBy, sortOrder) })
  },

  setSortOrder: (order) => {
    const { photos, filters, sortBy } = get()
    set({ sortOrder: order, filteredPhotos: applyFiltersAndSort(photos, filters, sortBy, order) })
  },

  setFilters: (newFilters: Partial<FilterState>) => {
    const { photos, sortBy, sortOrder } = get()
    const filters = { ...get().filters, ...newFilters }
    set({ filters, filteredPhotos: applyFiltersAndSort(photos, filters, sortBy, sortOrder) })
  },

  clearFilters: () => {
    const { photos, sortBy, sortOrder } = get()
    set({ filters: DEFAULT_FILTERS, filteredPhotos: applyFiltersAndSort(photos, DEFAULT_FILTERS, sortBy, sortOrder) })
  },

  setOllamaStatus: (status: any) => set({ ollamaStatus: status }),
  setAnalyzeProgress: (progress) => set({ analyzeProgress: progress })
}))
