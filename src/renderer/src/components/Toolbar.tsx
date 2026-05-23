import React, { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

export function Toolbar(): React.ReactElement {
  const {
    viewMode, setView, thumbnailSize, setThumbnailSize,
    showMetadataPanel, showAIPanel, togglePanel,
    photos, filteredPhotos, selectedIds, isScanning, isAnalyzing,
    analyzeProgress, ollamaStatus, setOllamaStatus, setCurrentFolder,
    currentFolder
  } = useAppStore()

  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    // Check Ollama status on mount
    window.api.getAIStatus().then((status: any) => {
      setOllamaStatus({
        connected: status.connected,
        model: status.models?.[0]?.name || '',
        models: status.models || []
      })
    })

    // Listen for AI progress
    const cleanup = window.api.onAIProgress((data: any) => {
      if (data.total) {
        useAppStore.setState({ analyzeProgress: { current: data.progress, total: data.total } })
        if (data.score) {
          // Find the photo by path and update AI score
          const state = useAppStore.getState()
          const photo = state.photos.find(p => p.path === data.photoPath)
          if (photo) state.updatePhotoAI(photo.id, data.score)
        }
        if (data.progress >= data.total) setAnalyzing(false)
      }
    })
    return cleanup
  }, [])

  const handleOpenFolder = async () => {
    const folder = await window.api.openFolder()
    if (folder) useAppStore.getState().setCurrentFolder(folder)
  }

  const handleAnalyzeAll = async () => {
    if (!ollamaStatus.connected) {
      alert('Ollama is not connected. Please install Ollama and start it at localhost:11434')
      return
    }
    const paths = filteredPhotos.map(p => p.path)
    if (paths.length === 0) return
    setAnalyzing(true)
    useAppStore.setState({ analyzeProgress: { current: 0, total: paths.length } })
    await window.api.analyzeBatch(paths)
  }

  const selectedCount = selectedIds.size
  const totalCount = filteredPhotos.length
  const allCount = photos.length

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn toolbar-btn-primary" onClick={handleOpenFolder} title="Open Folder (Cmd+O)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Open Folder
        </button>

        <div className="toolbar-separator" />

        <div className="view-switcher">
          <button
            className={`toolbar-btn ${viewMode === 'contact-sheet' ? 'active' : ''}`}
            onClick={() => setView('contact-sheet')}
            title="Contact Sheet (Cmd+1)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Grid
          </button>
          <button
            className={`toolbar-btn ${viewMode === 'loupe' ? 'active' : ''}`}
            onClick={() => setView('loupe')}
            title="Loupe View (Cmd+2)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
            Loupe
          </button>
        </div>

        {viewMode === 'contact-sheet' && (
          <>
            <div className="toolbar-separator" />
            <div className="thumbnail-size-control">
              <button className="toolbar-btn icon-btn" onClick={() => setThumbnailSize(-1)} title="Smaller">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <input
                type="range"
                min="100"
                max="400"
                value={thumbnailSize}
                onChange={e => useAppStore.setState({ thumbnailSize: parseInt(e.target.value) })}
                className="size-slider"
                title={`Thumbnail size: ${thumbnailSize}px`}
              />
              <button className="toolbar-btn icon-btn" onClick={() => setThumbnailSize(1)} title="Larger">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="toolbar-center">
        {currentFolder && (
          <span className="folder-path" title={currentFolder}>
            {currentFolder.split('/').pop() || currentFolder.split('\\').pop() || currentFolder}
          </span>
        )}
        <span className="photo-count">
          {isScanning ? 'Scanning...' :
           selectedCount > 0 ? `${selectedCount} of ${totalCount} selected` :
           totalCount !== allCount ? `${totalCount} of ${allCount} photos` :
           `${allCount} photo${allCount !== 1 ? 's' : ''}`}
        </span>
        {(analyzing || isAnalyzing) && analyzeProgress.total > 0 && (
          <span className="analyze-progress">
            AI: {analyzeProgress.current}/{analyzeProgress.total}
          </span>
        )}
      </div>

      <div className="toolbar-right">
        <div className="ai-status" title={ollamaStatus.connected ? `Ollama connected - ${ollamaStatus.model}` : 'Ollama not connected'}>
          <div className={`ai-indicator ${ollamaStatus.connected ? 'connected' : 'disconnected'}`} />
          <span>{ollamaStatus.connected ? 'AI Ready' : 'AI Offline'}</span>
        </div>

        <button
          className="toolbar-btn toolbar-btn-ai"
          onClick={handleAnalyzeAll}
          disabled={analyzing || photos.length === 0}
          title="Analyze all photos with AI"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          {analyzing ? `Analyzing ${analyzeProgress.current}/${analyzeProgress.total}...` : 'Analyze Photos'}
        </button>

        <div className="toolbar-separator" />

        <button
          className={`toolbar-btn icon-btn ${showMetadataPanel ? 'active' : ''}`}
          onClick={() => togglePanel('metadata')}
          title="Toggle Metadata Panel (Cmd+M)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </button>

        <button
          className={`toolbar-btn icon-btn ${showAIPanel ? 'active' : ''}`}
          onClick={() => togglePanel('ai')}
          title="Toggle AI Panel (Cmd+I)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
