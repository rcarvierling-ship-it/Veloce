import React, { useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

const COLOR_MAP: Record<string, string> = {
  red: '#e53e3e',
  green: '#38a169',
  blue: '#3182ce',
  yellow: '#d69e2e',
  purple: '#805ad5'
}

export function Filmstrip(): React.ReactElement {
  const { filteredPhotos, activePhoto, selectPhoto, setActivePhoto } = useAppStore()
  const activeRef = useRef<HTMLDivElement>(null)
  const THUMB_SIZE = 80

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activePhoto?.id])

  return (
    <div className="filmstrip">
      <div className="filmstrip-inner">
        {filteredPhotos.map(photo => {
          const isActive = photo.id === activePhoto?.id
          const imageSrc = photo.thumbnail_path
            ? `file://${photo.thumbnail_path}`
            : `file://${photo.path}`

          return (
            <div
              key={photo.id}
              ref={isActive ? activeRef : null}
              className={`filmstrip-item ${isActive ? 'active' : ''} ${photo.flag !== 'unflagged' ? `flag-${photo.flag}` : ''}`}
              onClick={() => {
                selectPhoto(photo.id)
                setActivePhoto(photo)
              }}
              style={photo.color_tag ? { boxShadow: `0 0 0 2px ${COLOR_MAP[photo.color_tag]}` } : undefined}
            >
              <img
                src={imageSrc}
                alt={photo.filename}
                className="filmstrip-thumb"
                style={{ width: THUMB_SIZE, height: THUMB_SIZE, objectFit: 'cover' }}
                draggable={false}
              />
              {photo.flag === 'picked' && <div className="filmstrip-badge picked">P</div>}
              {photo.flag === 'rejected' && <div className="filmstrip-badge rejected">X</div>}
              {photo.rating > 0 && (
                <div className="filmstrip-rating">{'★'.repeat(photo.rating)}</div>
              )}
              {photo.ai && (
                <div className={`filmstrip-ai ai-${photo.ai.recommendation}`}>
                  {photo.ai.overall}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
