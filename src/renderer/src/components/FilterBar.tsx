import React from 'react'
import { useAppStore } from '../store/useAppStore'

const COLOR_TAGS = [
  { value: 'red', label: 'Red', color: '#e53e3e' },
  { value: 'green', label: 'Green', color: '#38a169' },
  { value: 'blue', label: 'Blue', color: '#3182ce' },
  { value: 'yellow', label: 'Yellow', color: '#d69e2e' },
  { value: 'purple', label: 'Purple', color: '#805ad5' }
]

export function FilterBar(): React.ReactElement {
  const { filters, setFilters, clearFilters, setSortBy, setSortOrder, sortBy, sortOrder, photos, filteredPhotos } = useAppStore()

  const hasActiveFilter = filters.ratingMin !== null || filters.flag !== null || filters.colorTag !== null || filters.aiRec !== null

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <span className="filter-label">Flag:</span>
        <button
          className={`filter-btn ${filters.flag === 'picked' ? 'active picked' : ''}`}
          onClick={() => setFilters({ flag: filters.flag === 'picked' ? null : 'picked' })}
          title="Show picked only"
        >
          <span className="flag-icon picked">P</span>
          Picked
        </button>
        <button
          className={`filter-btn ${filters.flag === 'rejected' ? 'active rejected' : ''}`}
          onClick={() => setFilters({ flag: filters.flag === 'rejected' ? null : 'rejected' })}
          title="Show rejected only"
        >
          <span className="flag-icon rejected">X</span>
          Rejected
        </button>
        <button
          className={`filter-btn ${filters.flag === 'unflagged' ? 'active' : ''}`}
          onClick={() => setFilters({ flag: filters.flag === 'unflagged' ? null : 'unflagged' })}
          title="Show unflagged only"
        >
          Unflagged
        </button>
      </div>

      <div className="filter-separator" />

      <div className="filter-group">
        <span className="filter-label">Stars:</span>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            className={`filter-btn star-btn ${filters.ratingMin === star ? 'active' : ''}`}
            onClick={() => setFilters({ ratingMin: filters.ratingMin === star ? null : star })}
            title={`Show ${star}+ stars`}
          >
            {'★'.repeat(star)}
          </button>
        ))}
      </div>

      <div className="filter-separator" />

      <div className="filter-group">
        <span className="filter-label">Color:</span>
        {COLOR_TAGS.map(ct => (
          <button
            key={ct.value}
            className={`filter-btn color-btn ${filters.colorTag === ct.value ? 'active' : ''}`}
            onClick={() => setFilters({ colorTag: filters.colorTag === ct.value ? null : ct.value })}
            title={ct.label}
            style={{ '--color': ct.color } as any}
          >
            <span className="color-dot" style={{ background: ct.color }} />
          </button>
        ))}
      </div>

      <div className="filter-separator" />

      <div className="filter-group">
        <span className="filter-label">AI:</span>
        {(['pick', 'maybe', 'reject'] as const).map(rec => (
          <button
            key={rec}
            className={`filter-btn ai-rec-btn ${filters.aiRec === rec ? 'active' : ''} ai-${rec}`}
            onClick={() => setFilters({ aiRec: filters.aiRec === rec ? null : rec })}
            title={`AI recommended: ${rec}`}
          >
            {rec === 'pick' ? '✓ Pick' : rec === 'maybe' ? '? Maybe' : '✗ Reject'}
          </button>
        ))}
      </div>

      {hasActiveFilter && (
        <>
          <div className="filter-separator" />
          <button className="filter-btn clear-btn" onClick={clearFilters}>
            Clear Filters ({filteredPhotos.length}/{photos.length})
          </button>
        </>
      )}

      <div className="filter-spacer" />

      <div className="sort-group">
        <span className="filter-label">Sort:</span>
        <select
          className="sort-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
        >
          <option value="filename">Filename</option>
          <option value="date">Date</option>
          <option value="rating">Rating</option>
          <option value="ai-score">AI Score</option>
        </select>
        <button
          className="sort-order-btn"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  )
}
