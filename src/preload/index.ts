import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Folder operations
  scanFolder: (folderPath: string) => ipcRenderer.invoke('folder:scan', folderPath),
  getFolderTree: (rootPath: string) => ipcRenderer.invoke('folder:getFolderTree', rootPath),

  // Thumbnail
  generateThumbnail: (photoPath: string, size?: number) =>
    ipcRenderer.invoke('thumbnail:generate', photoPath, size),
  generateThumbnailBatch: (paths: string[], size?: number) =>
    ipcRenderer.invoke('thumbnail:generateBatch', paths, size),
  onThumbnailProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('thumbnail:progress', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('thumbnail:progress')
  },

  // Photo metadata
  getPhotoMetadata: (photoPath: string) => ipcRenderer.invoke('photo:getMetadata', photoPath),
  updateRating: (photoId: string, rating: number) =>
    ipcRenderer.invoke('photo:updateRating', photoId, rating),
  updateFlag: (photoId: string, flag: string) =>
    ipcRenderer.invoke('photo:updateFlag', photoId, flag),
  updateColor: (photoId: string, color: string | null) =>
    ipcRenderer.invoke('photo:updateColor', photoId, color),
  updateIptc: (photoId: string, iptc: any) =>
    ipcRenderer.invoke('photo:updateIptc', photoId, iptc),

  // AI
  getAIStatus: () => ipcRenderer.invoke('ai:getStatus'),
  analyzePhoto: (photoPath: string) => ipcRenderer.invoke('ai:analyzePhoto', photoPath),
  analyzeBatch: (photoPaths: string[]) => ipcRenderer.invoke('ai:analyzeBatch', photoPaths),
  onAIProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('ai:progress', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('ai:progress')
  },

  // Settings
  getSetting: (key: string, defaultValue?: string) =>
    ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key: string, value: string) =>
    ipcRenderer.invoke('settings:set', key, value),

  // App
  openInFinder: (filePath: string) => ipcRenderer.invoke('app:openInFinder', filePath),

  // Menu events
  onMenuEvent: (callback: (event: string, data?: any) => void) => {
    const events = [
      'open-folder', 'set-view', 'zoom-thumbnails', 'toggle-panel',
      'photo-action', 'ai-action', 'select-all', 'show-in-finder',
      'open-preferences'
    ]
    events.forEach(evt => {
      ipcRenderer.on(evt, (_, data) => callback(evt, data))
    })
    return () => events.forEach(evt => ipcRenderer.removeAllListeners(evt))
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
