import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }): React.ReactElement {
  return (
    <div className="score-bar-row">
      <span className="score-label">{label}</span>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="score-value">{value}</span>
    </div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#48bb78'
  if (score >= 50) return '#ed8936'
  return '#fc8181'
}

function RecommendationBadge({ rec }: { rec: 'pick' | 'maybe' | 'reject' }): React.ReactElement {
  const config = {
    pick: { label: '✓ PICK', class: 'rec-pick' },
    maybe: { label: '? MAYBE', class: 'rec-maybe' },
    reject: { label: '✗ REJECT', class: 'rec-reject' }
  }
  return <div className={`rec-badge ${config[rec].class}`}>{config[rec].label}</div>
}

export function AIPanel(): React.ReactElement {
  const {
    activePhoto, filteredPhotos, selectedIds, updatePhotoFlag,
    ollamaStatus, setOllamaStatus, updatePhotoAI
  } = useAppStore()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [ollamaModel, setOllamaModel] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [showSettings, setShowSettings] = useState(false)

  const ai = activePhoto?.ai

  const handleAnalyzeCurrent = async () => {
    if (!activePhoto) return
    setIsAnalyzing(true)
    try {
      const score = await window.api.analyzePhoto(activePhoto.path)
      updatePhotoAI(activePhoto.id, score)
    } catch (err: any) {
      alert(`Analysis failed: ${err.message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApplyRecommendation = () => {
    if (!activePhoto?.ai) return
    const rec = activePhoto.ai.recommendation
    if (rec === 'pick') updatePhotoFlag(activePhoto.id, 'picked')
    else if (rec === 'reject') updatePhotoFlag(activePhoto.id, 'rejected')
    else updatePhotoFlag(activePhoto.id, 'unflagged')
  }

  const handleAutoApplyAll = async () => {
    if (!confirm('Apply AI recommendations to all analyzed photos as flags?')) return
    for (const photo of filteredPhotos) {
      if (photo.ai) {
        const rec = photo.ai.recommendation
        if (rec === 'pick') await window.api.updateFlag(photo.id, 'picked')
        else if (rec === 'reject') await window.api.updateFlag(photo.id, 'rejected')
      }
    }
    // Reload
    window.location.reload()
  }

  const handleCheckOllama = async () => {
    const status = await window.api.getAIStatus()
    setOllamaStatus({
      connected: status.connected,
      model: ollamaModel || status.models?.[0]?.name || '',
      models: status.models || []
    })
    if (ollamaModel) {
      await window.api.setSetting('ollamaModel', ollamaModel)
    }
    await window.api.setSetting('ollamaUrl', ollamaUrl)
    setShowSettings(false)
  }

  return (
    <div className="ai-panel">
      <div className="panel-header">
        <span>AI Analysis</span>
        <div className={`ai-dot ${ollamaStatus.connected ? 'connected' : 'disconnected'}`} />
        <button className="panel-header-btn" onClick={() => setShowSettings(!showSettings)} title="AI Settings">⚙</button>
      </div>

      {showSettings && (
        <div className="ai-settings">
          <div className="ai-settings-row">
            <label>Ollama URL</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={e => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
          <div className="ai-settings-row">
            <label>Vision Model</label>
            {ollamaStatus.models.length > 0 ? (
              <select value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}>
                <option value="">Select model...</option>
                {ollamaStatus.models.map((m: any) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={ollamaModel}
                onChange={e => setOllamaModel(e.target.value)}
                placeholder="e.g. llava, moondream"
              />
            )}
          </div>
          <button className="ai-settings-save" onClick={handleCheckOllama}>
            Connect & Save
          </button>
          {!ollamaStatus.connected && (
            <div className="ollama-help">
              <p>Install Ollama: <code>brew install ollama</code></p>
              <p>Pull a vision model: <code>ollama pull llava</code></p>
              <p>Or for faster results: <code>ollama pull moondream</code></p>
            </div>
          )}
        </div>
      )}

      {!activePhoto ? (
        <div className="panel-empty">
          <p>Select a photo to analyze</p>
        </div>
      ) : (
        <div className="ai-content">
          {ai ? (
            <>
              <RecommendationBadge rec={ai.recommendation} />

              <div className="overall-score">
                <div
                  className="overall-circle"
                  style={{ '--score-color': getScoreColor(ai.overall) } as any}
                >
                  <span className="overall-number">{ai.overall}</span>
                  <span className="overall-label">/ 100</span>
                </div>
              </div>

              <div className="score-bars">
                <ScoreBar label="Sharpness" value={ai.sharpness} color={getScoreColor(ai.sharpness)} />
                <ScoreBar label="Exposure" value={ai.exposure} color={getScoreColor(ai.exposure)} />
                <ScoreBar label="Composition" value={ai.composition} color={getScoreColor(ai.composition)} />
                <ScoreBar label="Subject" value={ai.subject} color={getScoreColor(ai.subject)} />
              </div>

              {ai.faces > 0 && (
                <div className="ai-faces">
                  <span>👤 {ai.faces} face{ai.faces !== 1 ? 's' : ''}</span>
                  {ai.eyes_open !== null && (
                    <span className={ai.eyes_open ? 'eyes-open' : 'eyes-closed'}>
                      {ai.eyes_open ? '👁 Eyes open' : '😌 Eyes closed'}
                    </span>
                  )}
                </div>
              )}

              {ai.reasoning && (
                <div className="ai-reasoning">
                  <p>{ai.reasoning}</p>
                </div>
              )}

              {ai.tags && (() => {
                try {
                  const tags = typeof ai.tags === 'string' ? JSON.parse(ai.tags) : ai.tags
                  return tags.length > 0 ? (
                    <div className="ai-tags">
                      {tags.map((tag: string) => (
                        <span key={tag} className="ai-tag">{tag}</span>
                      ))}
                    </div>
                  ) : null
                } catch { return null }
              })()}

              {ai.analysis_time && (
                <div className="ai-meta">
                  Analyzed in {(ai.analysis_time / 1000).toFixed(1)}s
                </div>
              )}

              <div className="ai-actions">
                <button className="ai-action-btn apply-btn" onClick={handleApplyRecommendation}>
                  Apply: {ai.recommendation === 'pick' ? '✓ Pick' : ai.recommendation === 'reject' ? '✗ Reject' : '? Maybe'}
                </button>
                <button
                  className="ai-action-btn reanalyze-btn"
                  onClick={handleAnalyzeCurrent}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
                </button>
              </div>
            </>
          ) : (
            <div className="ai-unanalyzed">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/>
              </svg>
              <p>Not yet analyzed</p>
              <button
                className="ai-analyze-btn"
                onClick={handleAnalyzeCurrent}
                disabled={isAnalyzing || !ollamaStatus.connected}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Photo'}
              </button>
              {!ollamaStatus.connected && (
                <p className="ai-offline-msg">Configure Ollama to enable AI</p>
              )}
            </div>
          )}

          {filteredPhotos.some(p => p.ai) && (
            <button className="auto-apply-btn" onClick={handleAutoApplyAll}>
              Auto-Apply All AI Recommendations
            </button>
          )}
        </div>
      )}
    </div>
  )
}
