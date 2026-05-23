import React, { useCallback, useRef, useEffect, useState } from 'react'
import { useAppStore, Photo } from '../store/useAppStore'
import { PhotoThumbnail } from './PhotoThumbnail'

export function ContactSheet(): React.ReactElement {
  const { filteredPhotos, selectedIds, activePhoto, thumbnailSize, selectPhoto, setView, isScanning } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(900)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })

  // Scroll active photo into view
  useEffect(() => {
    if (activePhoto && containerRef.current) {
      const idx = filteredPhotos.findIndex(p => p.id === activePhoto.id)
      if (idx >= 0) {
        const el = containerRef.current.querySelector(`[data-idx="${idx}"]`) as HTMLElement
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [activePhoto?.id])

  // Track container width with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    ro.observe(container)
    setContainerWidth(container.clientWidth || 900)
    return () => ro.disconnect()
  }, [])

  // Virtual scroll - compute visible range based on scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, clientHeight } = container
      const cols = Math.max(1, Math.floor(container.clientWidth / (thumbnailSize + 8)))
      const rowHeight = thumbnailSize + 46
      const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2)
      const endRow = Math.ceil((scrollTop + clientHeight) / rowHeight) + 2
      setVisibleRange({
        start: startRow * cols,
        end: Math.min(filteredPhotos.length, (endRow + 1) * cols)
      })
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => container.removeEventListener('scroll', handleScroll)
  }, [filteredPhotos.length, thumbnailSize])

  const handleClick = useCallback((photo: Photo, e: React.MouseEvent) => {
    selectPhoto(photo.id, e.metaKey || e.ctrlKey, e.shiftKey)
  }, [selectPhoto])

  const handleDoubleClick = useCallback((photo: Photo) => {
    selectPhoto(photo.id)
    setView('loupe')
  }, [selectPhoto, setView])

  const handleContextMenu = useCallback((photo: Photo, e: React.MouseEvent) => {
    e.preventDefault()
    if (!selectedIds.has(photo.id)) selectPhoto(photo.id)
    // Could implement context menu here
  }, [selectedIds, selectPhoto])

  if (isScanning) {
    return (
      <div className="contact-sheet-empty">
        <div className="spinner" />
        <p>Scanning folder...</p>
      </div>
    )
  }

  if (filteredPhotos.length === 0) {
    return (
      <div className="contact-sheet-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <p>No photos found</p>
        <span>Open a folder or adjust filters</span>
      </div>
    )
  }

  const cols = Math.max(1, Math.floor(containerWidth / (thumbnailSize + 8)))
  const totalRows = Math.ceil(filteredPhotos.length / cols)
  const rowHeight = thumbnailSize + 46

  return (
    <div
      ref={containerRef}
      className="contact-sheet"
      style={{ '--thumb-size': `${thumbnailSize}px` } as any}
    >
      <div
        className="contact-sheet-grid"
        style={{ height: `${totalRows * rowHeight}px`, position: 'relative' }}
      >
        {filteredPhotos.map((photo, idx) => {
          const row = Math.floor(idx / cols)
          const col = idx % cols
          const isVisible = idx >= visibleRange.start && idx <= visibleRange.end

          return (
            <div
              key={photo.id}
              data-idx={idx}
              className="thumbnail-cell"
              style={{
                position: 'absolute',
                left: col * (thumbnailSize + 8),
                top: row * rowHeight,
                width: thumbnailSize,
                height: rowHeight - 4
              }}
            >
              {isVisible && (
                <PhotoThumbnail
                  photo={photo}
                  size={thumbnailSize}
                  isSelected={selectedIds.has(photo.id)}
                  isActive={activePhoto?.id === photo.id}
                  onClick={e => handleClick(photo, e)}
                  onDoubleClick={() => handleDoubleClick(photo)}
                  onContextMenu={e => handleContextMenu(photo, e)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
