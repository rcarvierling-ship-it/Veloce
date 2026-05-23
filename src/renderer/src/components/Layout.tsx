import React, { useEffect, useRef } from 'react'
import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'
import { ContactSheet } from './ContactSheet'
import { Loupe } from './Loupe'
import { MetadataPanel } from './MetadataPanel'
import { AIPanel } from './AIPanel'
import { FilterBar } from './FilterBar'
import { useAppStore } from '../store/useAppStore'

export function Layout(): React.ReactElement {
  const {
    viewMode, showMetadataPanel, showAIPanel,
    navigatePhoto, applyPhotoAction, selectAll, clearSelection,
    setView, updatePhotoThumbnail
  } = useAppStore()

  useEffect(() => {
    // Listen for thumbnail progress updates
    const cleanup = window.api.onThumbnailProgress((data: any) => {
      if (data.thumbnailPath) {
        updatePhotoThumbnail(data.photoPath, data.thumbnailPath)
      }
    })
    return cleanup
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          if (viewMode === 'loupe' || !e.shiftKey) navigatePhoto('next')
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          if (viewMode === 'loupe' || !e.shiftKey) navigatePhoto('prev')
          break
        case ' ':
          e.preventDefault()
          if (viewMode === 'contact-sheet') {
            setView('loupe')
          } else {
            navigatePhoto('next')
          }
          break
        case 'Escape':
          if (viewMode === 'loupe') setView('contact-sheet')
          else clearSelection()
          break
        case 'Enter':
          if (viewMode === 'contact-sheet') setView('loupe')
          break
        case 'p':
        case 'P':
          applyPhotoAction('pick')
          break
        case 'x':
        case 'X':
          applyPhotoAction('reject')
          break
        case 'u':
        case 'U':
          applyPhotoAction('unflag')
          break
        case '0': applyPhotoAction('rate-0'); break
        case '1': applyPhotoAction('rate-1'); break
        case '2': applyPhotoAction('rate-2'); break
        case '3': applyPhotoAction('rate-3'); break
        case '4': applyPhotoAction('rate-4'); break
        case '5': applyPhotoAction('rate-5'); break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode])

  const rightPanelVisible = showMetadataPanel || showAIPanel

  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        <Sidebar />
        <div className="app-main">
          <FilterBar />
          <div className="app-content">
            {viewMode === 'contact-sheet' ? <ContactSheet /> : <Loupe />}
          </div>
        </div>
        {rightPanelVisible && (
          <div className="right-panel">
            {showMetadataPanel && <MetadataPanel />}
            {showAIPanel && <AIPanel />}
          </div>
        )}
      </div>
    </div>
  )
}
