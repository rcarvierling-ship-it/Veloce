import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

interface FolderNode {
  path: string
  name: string
  photoCount: number
  children?: FolderNode[]
}

interface FolderItemProps {
  node: FolderNode
  depth: number
  onSelect: (path: string) => void
  selectedPath: string | null
}

function FolderItem({ node, depth, onSelect, selectedPath }: FolderItemProps): React.ReactElement {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = node.path === selectedPath

  return (
    <div className="folder-item">
      <div
        className={`folder-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node.path)}
      >
        {hasChildren && (
          <span
            className={`folder-chevron ${expanded ? 'expanded' : ''}`}
            onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            ›
          </span>
        )}
        {!hasChildren && <span className="folder-chevron-placeholder" />}
        <svg className="folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-4z"/>
        </svg>
        <span className="folder-name" title={node.path}>{node.name}</span>
        {node.photoCount > 0 && (
          <span className="folder-count">{node.photoCount}</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="folder-children">
          {node.children!.map(child => (
            <FolderItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar(): React.ReactElement {
  const { currentFolder, setCurrentFolder } = useAppStore()
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null)
  const [recentFolders, setRecentFolders] = useState<string[]>([])

  useEffect(() => {
    // Load recent folders from settings
    window.api.getSetting('recentFolders', '[]').then((val: string) => {
      try { setRecentFolders(JSON.parse(val)) } catch {}
    })
  }, [])

  useEffect(() => {
    if (currentFolder) {
      window.api.getFolderTree(currentFolder).then((tree: FolderNode) => {
        setFolderTree(tree)
      })
      // Save to recent folders
      const updated = [currentFolder, ...recentFolders.filter(f => f !== currentFolder)].slice(0, 10)
      setRecentFolders(updated)
      window.api.setSetting('recentFolders', JSON.stringify(updated))
    }
  }, [currentFolder])

  const handleOpenFolder = async () => {
    const folder = await window.api.openFolder()
    if (folder) setCurrentFolder(folder)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>Folders</span>
        <button className="sidebar-add-btn" onClick={handleOpenFolder} title="Open folder">+</button>
      </div>

      {folderTree ? (
        <div className="folder-tree">
          <FolderItem
            node={folderTree}
            depth={0}
            onSelect={setCurrentFolder}
            selectedPath={currentFolder}
          />
        </div>
      ) : (
        <div className="sidebar-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <path d="M10 4H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-4z"/>
          </svg>
          <p>Open a folder to start</p>
          <button className="btn-open-folder" onClick={handleOpenFolder}>Open Folder</button>
        </div>
      )}

      {recentFolders.length > 0 && (
        <>
          <div className="sidebar-section-header">Recent</div>
          <div className="recent-folders">
            {recentFolders.slice(0, 5).map(folder => (
              <div
                key={folder}
                className={`recent-folder-row ${folder === currentFolder ? 'selected' : ''}`}
                onClick={() => setCurrentFolder(folder)}
                title={folder}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
                  <path d="M10 4H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-4z"/>
                </svg>
                <span>{folder.split('/').pop() || folder.split('\\').pop() || folder}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
