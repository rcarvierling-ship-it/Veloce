import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Filmstrip } from './Filmstrip'

export function Loupe(): React.ReactElement {
  const { activePhoto, navigatePhoto, setView, updatePhotoFlag, updatePhotoRating } = useAppStore()
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Reset zoom/pan on photo change
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setImageLoaded(false)
    setImageError(false)
  }, [activePhoto?.id])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY / 500
    setZoom(z => Math.max(0.25, Math.min(10, z + z * delta)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }, [zoom, pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  const handleDoubleClick = useCallback(() => {
    if (zoom > 1) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    } else {
      setZoom(3)
    }
  }, [zoom])

  const handleZoomIn = () => setZoom(z => Math.min(10, z * 1.5))
  const handleZoomOut = () => {
    setZoom(z => {
      const newZ = Math.max(0.25, z / 1.5)
      if (newZ <= 1) setPan({ x: 0, y: 0 })
      return newZ
    })
  }
  const handleZoomFit = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const handleZoom100 = () => setZoom(1)

  if (!activePhoto) {
    return (
      <div className="loupe-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>Select a photo to view in Loupe</p>
        <button className="btn-secondary" onClick={() => setView('contact-sheet')}>
          Back to Contact Sheet
        </button>
      </div>
    )
  }

  const imageSrc = `file://${activePhoto.path}`

  return (
    <div className="loupe-container">
      <div className="loupe-toolbar">
        <button className="loupe-back-btn" onClick={() => setView('contact-sheet')} title="Back to Contact Sheet (Escape)">
          ← Grid
        </button>

        <div className="loupe-filename">
          <span className="loupe-name">{activePhoto.filename}</span>
          {activePhoto.exif?.model && (
            <span className="loupe-camera">{activePhoto.exif.model}</span>
          )}
        </div>

        <div className="loupe-flag-controls">
          <button
            className={`loupe-flag-btn pick ${activePhoto.flag === 'picked' ? 'active' : ''}`}
            onClick={() => updatePhotoFlag(activePhoto.id, activePhoto.flag === 'picked' ? 'unflagged' : 'picked')}
            title="Pick (P)"
          >P</button>
          <button
            className={`loupe-flag-btn reject ${activePhoto.flag === 'rejected' ? 'active' : ''}`}
            onClick={() => updatePhotoFlag(activePhoto.id, activePhoto.flag === 'rejected' ? 'unflagged' : 'rejected')}
            title="Reject (X)"
          >X</button>
        </div>

        <div className="loupe-stars">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              className={`loupe-star ${activePhoto.rating >= star ? 'filled' : ''}`}
              onClick={() => updatePhotoRating(activePhoto.id, activePhoto.rating === star ? 0 : star)}
            >★</button>
          ))}
        </div>

        <div className="loupe-zoom-controls">
          <button className="loupe-zoom-btn" onClick={handleZoomOut} title="Zoom Out">−</button>
          <span className="loupe-zoom-level" onClick={handleZoomFit}>{Math.round(zoom * 100)}%</span>
          <button className="loupe-zoom-btn" onClick={handleZoomIn} title="Zoom In">+</button>
          <button className="loupe-zoom-btn" onClick={handleZoom100} title="Fit to Screen">Fit</button>
          <button className="loupe-zoom-btn" onClick={() => setZoom(1)} title="100%">1:1</button>
        </div>

        <div className="loupe-nav">
          <button className="loupe-nav-btn" onClick={() => navigatePhoto('prev')} title="Previous (←)">‹</button>
          <button className="loupe-nav-btn" onClick={() => navigatePhoto('next')} title="Next (→)">›</button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`loupe-image-area ${isPanning ? 'panning' : zoom > 1 ? 'zoomable' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {!imageLoaded && !imageError && (
          <div className="loupe-loading">
            <div className="spinner" />
          </div>
        )}
        {imageError ? (
          <div className="loupe-error">
            <p>Could not load image</p>
            <span>{activePhoto.path}</span>
          </div>
        ) : (
          <img
            ref={imageRef}
            src={imageSrc}
            alt={activePhoto.filename}
            className={`loupe-image ${imageLoaded ? 'loaded' : ''}`}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in'
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            onDoubleClick={handleDoubleClick}
            draggable={false}
          />
        )}
      </div>

      <Filmstrip />
    </div>
  )
}
