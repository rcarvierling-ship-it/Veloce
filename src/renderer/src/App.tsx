import React, { useEffect } from 'react'
import { Layout } from './components/Layout'
import { useAppStore } from './store/useAppStore'

declare global {
  interface Window {
    api: any
    electron: any
  }
}

export default function App(): React.ReactElement {
  const { setView, setThumbnailSize, togglePanel, applyPhotoAction, setCurrentFolder } = useAppStore()

  useEffect(() => {
    const cleanup = window.api.onMenuEvent((event: string, data: any) => {
      switch (event) {
        case 'open-folder':
          setCurrentFolder(data)
          break
        case 'set-view':
          setView(data)
          break
        case 'zoom-thumbnails':
          setThumbnailSize(data)
          break
        case 'toggle-panel':
          togglePanel(data)
          break
        case 'photo-action':
          applyPhotoAction(data)
          break
      }
    })
    return cleanup
  }, [])

  return <Layout />
}
