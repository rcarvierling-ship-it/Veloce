import React, { useState, useCallback } from 'react'
import { Photo, useAppStore } from '../store/useAppStore'

const COLOR_MAP: Record<string, string> = {
  red: '#e53e3e',
  green: '#38a169',
  blue: '#3182ce',
  yellow: '#d69e2e',
  purple: '#805ad5'
}

interface Props {
  photo: Photo
  size: number
  isSelected: boolean
  isActive: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function StarRating({ rating, photoId }: { rating: number; photoId: string }): React.ReactElement {
  const { updatePhotoRating } = useAppStore()
  const [hovered, setHovered] = useState(0)

  return (
    <div className="thumb-stars" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={`thumb-star ${(hovered || rating) >= star ? 'filled' : ''}`}
          onMouseEnter={() => setHovered(star)}
          onClick={e => {
            e.stopPropagation()
            updatePhotoRating(photoId, rating === star ? 0 : star)
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

function FlagBadge({ flag, photoId }: { flag: string; photoId: string }): React.ReactElement | null {
  const { updatePhotoFlag } = useAppStore()
  if (flag === 'unflagged') return null
  return (
    <div
      className={`thumb-flag ${flag}`}
      onClick={e => {
        e.stopPropagation()
        updatePhotoFlag(photoId, 'unflagged')
      }}
      title={`${flag} - click to unflag`}
    >
      {flag === 'picked' ? 'P' : 'X'}
    </div>
  )
}

function AIBadge({ recommendation, score }: { recommendation: string; score: number }): React.ReactElement {
  return (
    <div className={`thumb-ai-badge ai-${recommendation}`} title={`AI Score: ${score}/100`}>
      {score}
    </div>
  )
}

export function PhotoThumbnail({
  photo, size, isSelected, isActive, onClick, onDoubleClick, onContextMenu
}: Props): React.ReactElement {
  const { updatePhotoFlag, updatePhotoColor } = useAppStore()
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const imageSrc = photo.thumbnail_path
    ? `file://${photo.thumbnail_path}`
    : photo.path
      ? `file://${photo.path}`
      : null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'p': case 'P': updatePhotoFlag(photo.id, 'picked'); break
      case 'x': case 'X': updatePhotoFlag(photo.id, 'rejected'); break
      case 'u': case 'U': updatePhotoFlag(photo.id, 'unflagged'); break
    }
  }

  const colorBorder = photo.color_tag ? COLOR_MAP[photo.color_tag] : undefined

  return (
    <div
      className={`photo-thumbnail ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''} ${photo.flag !== 'unflagged' ? `flag-${photo.flag}` : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={isActive ? 0 : -1}
      role="option"
      aria-selected={isSelected}
      style={colorBorder ? { boxShadow: `0 0 0 3px ${colorBorder}` } : undefined}
    >
      <div className="thumb-image-container" style={{ width: size, height: size - 40 }}>
        {imageSrc && !imageError ? (
          <>
            {!imageLoaded && <div className="thumb-placeholder" />}
            <img
              src={imageSrc}
              alt={photo.filename}
              className={`thumb-image ${imageLoaded ? 'loaded' : ''}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              draggable={false}
            />
          </>
        ) : (
          <div className="thumb-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}

        {/* Overlays */}
        <FlagBadge flag={photo.flag} photoId={photo.id} />
        {photo.ai && (
          <AIBadge recommendation={photo.ai.recommendation} score={photo.ai.overall} />
        )}
        {photo.color_tag && (
          <div className="thumb-color-dot" style={{ background: COLOR_MAP[photo.color_tag] }} />
        )}

        {/* Quick action bar on hover */}
        <div className="thumb-quick-actions">
          <button
            className="quick-btn pick-btn"
            onClick={e => { e.stopPropagation(); updatePhotoFlag(photo.id, photo.flag === 'picked' ? 'unflagged' : 'picked') }}
            title="Pick (P)"
          >P</button>
          <button
            className="quick-btn reject-btn"
            onClick={e => { e.stopPropagation(); updatePhotoFlag(photo.id, photo.flag === 'rejected' ? 'unflagged' : 'rejected') }}
            title="Reject (X)"
          >X</button>
        </div>
      </div>

      <div className="thumb-info">
        <StarRating rating={photo.rating} photoId={photo.id} />
        <span className="thumb-filename" title={photo.filename}>
          {photo.filename}
        </span>
      </div>
    </div>
  )
}
