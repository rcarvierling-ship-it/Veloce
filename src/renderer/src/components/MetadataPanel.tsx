import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

const COLOR_OPTIONS = [
  { value: null, label: 'None', color: 'transparent' },
  { value: 'red', label: 'Red', color: '#e53e3e' },
  { value: 'green', label: 'Green', color: '#38a169' },
  { value: 'blue', label: 'Blue', color: '#3182ce' },
  { value: 'yellow', label: 'Yellow', color: '#d69e2e' },
  { value: 'purple', label: 'Purple', color: '#805ad5' }
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

export function MetadataPanel(): React.ReactElement {
  const { activePhoto, updatePhotoColor, updatePhotoFlag, updatePhotoRating } = useAppStore()
  const [iptcEdits, setIptcEdits] = useState<any>({})
  const [activeTab, setActiveTab] = useState<'exif' | 'iptc' | 'file'>('exif')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (activePhoto?.iptc) {
      setIptcEdits(activePhoto.iptc)
    } else {
      setIptcEdits({})
    }
  }, [activePhoto?.id])

  const handleSaveIptc = async () => {
    if (!activePhoto) return
    setIsSaving(true)
    try {
      await window.api.updateIptc(activePhoto.id, iptcEdits)
    } finally {
      setIsSaving(false)
    }
  }

  const exif = activePhoto?.exif || {}

  if (!activePhoto) {
    return (
      <div className="metadata-panel">
        <div className="panel-header">Metadata</div>
        <div className="panel-empty">
          <p>Select a photo to view metadata</p>
        </div>
      </div>
    )
  }

  return (
    <div className="metadata-panel">
      <div className="panel-header">
        <span>Metadata</span>
        <button
          className="panel-header-btn"
          onClick={() => window.api.openInFinder(activePhoto.path)}
          title="Show in Finder/Explorer"
        >⊙</button>
      </div>

      {/* Flag & Color Controls */}
      <div className="metadata-quick-controls">
        <div className="flag-controls">
          <span className="control-label">Flag:</span>
          <button
            className={`flag-btn pick ${activePhoto.flag === 'picked' ? 'active' : ''}`}
            onClick={() => updatePhotoFlag(activePhoto.id, activePhoto.flag === 'picked' ? 'unflagged' : 'picked')}
            title="Pick (P)"
          >Pick</button>
          <button
            className={`flag-btn reject ${activePhoto.flag === 'rejected' ? 'active' : ''}`}
            onClick={() => updatePhotoFlag(activePhoto.id, activePhoto.flag === 'rejected' ? 'unflagged' : 'rejected')}
            title="Reject (X)"
          >Reject</button>
        </div>

        <div className="color-controls">
          <span className="control-label">Color:</span>
          <div className="color-swatches">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.value || 'none'}
                className={`color-swatch ${activePhoto.color_tag === opt.value ? 'active' : ''}`}
                style={{ background: opt.color, border: opt.value === null ? '1px solid #555' : 'none' }}
                onClick={() => updatePhotoColor(activePhoto.id, opt.value)}
                title={opt.label}
              />
            ))}
          </div>
        </div>

        <div className="rating-controls">
          <span className="control-label">Rating:</span>
          <div className="star-row">
            {[0, 1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                className={`star-btn ${star === 0 ? 'clear-star' : ''} ${activePhoto.rating === star && star !== 0 ? 'active' : ''}`}
                onClick={() => updatePhotoRating(activePhoto.id, star)}
                title={star === 0 ? 'Clear rating' : `${star} star${star !== 1 ? 's' : ''}`}
              >
                {star === 0 ? '✕' : '★'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="metadata-tabs">
        {(['exif', 'iptc', 'file'] as const).map(tab => (
          <button
            key={tab}
            className={`metadata-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="metadata-content">
        {activeTab === 'exif' && (
          <div className="metadata-grid">
            {exif.make && <><span className="meta-label">Camera</span><span className="meta-value">{[exif.make, exif.model].filter(Boolean).join(' ')}</span></>}
            {exif.lens && <><span className="meta-label">Lens</span><span className="meta-value">{exif.lens}</span></>}
            {exif.iso && <><span className="meta-label">ISO</span><span className="meta-value">{exif.iso}</span></>}
            {exif.aperture && <><span className="meta-label">Aperture</span><span className="meta-value">f/{Number(exif.aperture).toFixed(1)}</span></>}
            {exif.shutter_speed && <><span className="meta-label">Shutter</span><span className="meta-value">{exif.shutter_speed}</span></>}
            {exif.focal_length && <><span className="meta-label">Focal Length</span><span className="meta-value">{Math.round(exif.focal_length)}mm</span></>}
            {exif.exposure_bias !== undefined && exif.exposure_bias !== null && (
              <><span className="meta-label">Exp Bias</span><span className="meta-value">{Number(exif.exposure_bias) > 0 ? '+' : ''}{Number(exif.exposure_bias).toFixed(1)} EV</span></>
            )}
            {exif.white_balance && <><span className="meta-label">White Bal</span><span className="meta-value">{exif.white_balance}</span></>}
            {exif.flash && <><span className="meta-label">Flash</span><span className="meta-value">{exif.flash}</span></>}
            {activePhoto.width > 0 && <><span className="meta-label">Dimensions</span><span className="meta-value">{activePhoto.width} × {activePhoto.height}</span></>}
            {exif.gps_lat && exif.gps_lon && (
              <><span className="meta-label">GPS</span><span className="meta-value">{Number(exif.gps_lat).toFixed(5)}, {Number(exif.gps_lon).toFixed(5)}</span></>
            )}
          </div>
        )}

        {activeTab === 'iptc' && (
          <div className="iptc-editor">
            <div className="iptc-field">
              <label>Caption</label>
              <textarea
                value={iptcEdits.caption || ''}
                onChange={e => setIptcEdits({ ...iptcEdits, caption: e.target.value })}
                rows={3}
                placeholder="Caption / description"
              />
            </div>
            <div className="iptc-field">
              <label>Headline</label>
              <input
                type="text"
                value={iptcEdits.headline || ''}
                onChange={e => setIptcEdits({ ...iptcEdits, headline: e.target.value })}
                placeholder="Headline"
              />
            </div>
            <div className="iptc-field">
              <label>Keywords</label>
              <input
                type="text"
                value={Array.isArray(iptcEdits.keywords) ? iptcEdits.keywords.join(', ') : iptcEdits.keywords || ''}
                onChange={e => setIptcEdits({ ...iptcEdits, keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean) })}
                placeholder="keyword1, keyword2, ..."
              />
            </div>
            <div className="iptc-field">
              <label>Creator</label>
              <input
                type="text"
                value={iptcEdits.creator || ''}
                onChange={e => setIptcEdits({ ...iptcEdits, creator: e.target.value })}
                placeholder="Photographer name"
              />
            </div>
            <div className="iptc-field">
              <label>Copyright</label>
              <input
                type="text"
                value={iptcEdits.copyright || ''}
                onChange={e => setIptcEdits({ ...iptcEdits, copyright: e.target.value })}
                placeholder="© 2024 Name"
              />
            </div>
            <div className="iptc-field">
              <label>Credit</label>
              <input
                type="text"
                value={iptcEdits.credit || ''}
                onChange={e => setIptcEdits({ ...iptcEdits, credit: e.target.value })}
                placeholder="Credit line"
              />
            </div>
            <div className="iptc-row">
              <div className="iptc-field">
                <label>City</label>
                <input type="text" value={iptcEdits.city || ''} onChange={e => setIptcEdits({ ...iptcEdits, city: e.target.value })} placeholder="City" />
              </div>
              <div className="iptc-field">
                <label>State</label>
                <input type="text" value={iptcEdits.state || ''} onChange={e => setIptcEdits({ ...iptcEdits, state: e.target.value })} placeholder="State" />
              </div>
            </div>
            <div className="iptc-row">
              <div className="iptc-field">
                <label>Country</label>
                <input type="text" value={iptcEdits.country || ''} onChange={e => setIptcEdits({ ...iptcEdits, country: e.target.value })} placeholder="Country" />
              </div>
              <div className="iptc-field">
                <label>Code</label>
                <input type="text" value={iptcEdits.country_code || ''} onChange={e => setIptcEdits({ ...iptcEdits, country_code: e.target.value })} placeholder="US" maxLength={3} />
              </div>
            </div>
            <button className="save-iptc-btn" onClick={handleSaveIptc} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Metadata'}
            </button>
          </div>
        )}

        {activeTab === 'file' && (
          <div className="metadata-grid">
            <span className="meta-label">Filename</span>
            <span className="meta-value">{activePhoto.filename}</span>
            <span className="meta-label">Size</span>
            <span className="meta-value">{formatBytes(activePhoto.file_size)}</span>
            <span className="meta-label">Created</span>
            <span className="meta-value">{formatDate(activePhoto.date_created)}</span>
            <span className="meta-label">Modified</span>
            <span className="meta-value">{formatDate(activePhoto.date_modified)}</span>
            <span className="meta-label">Dimensions</span>
            <span className="meta-value">{activePhoto.width > 0 ? `${activePhoto.width} × ${activePhoto.height}` : '—'}</span>
            <span className="meta-label">Path</span>
            <span className="meta-value meta-path" title={activePhoto.path}>{activePhoto.path}</span>
          </div>
        )}
      </div>
    </div>
  )
}
