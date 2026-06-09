import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { invalidateFileIndex } from '../lib/fileIndex'
import TrashMenuButton from './TrashMenuButton'

export default function VaultFileViewer({ filePath, readFile, writeFile, deleteFile, onWikilinkClick, onArchiveFile, onDeleteFile, onFileDeleted, onConfirmAction }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer = useRef(null)
  const { EditorComponent } = useMarkdownEditor()

  useEffect(() => {
    if (filePath) loadFile(filePath)
  }, [filePath])

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    try {
      setContent(await readFile(path))
    } catch {
      setContent('')
    }
    setLoading(false)
  }

  function handleChange(newContent) {
    setContent(newContent)
    setSaveStatus('idle')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(newContent), 800)
  }

  const save = useCallback(async (text) => {
    if (!filePath) return
    setSaveStatus('saving')
    try {
      await writeFile(filePath, text)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }, [filePath, writeFile])

  const handleArchive = async () => {
    if (!filePath) return
    try {
      await onArchiveFile?.(filePath)
      onFileDeleted?.()
    } catch (err) {
      console.error('Archive failed:', err.message)
    }
  }

  const handleDelete = async () => {
    if (!filePath) return
    try {
      await onDeleteFile?.(filePath)
      onFileDeleted?.()
    } catch (err) {
      console.error('Delete failed:', err.message)
    }
  }

  const parts = filePath ? filePath.split('/') : []
  const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
  const displayName = parts[parts.length - 1]?.replace('.md', '') ?? ''

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Select a file from the sidebar.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-8 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {folder && (
            <span className="text-xs text-[var(--text-muted)] font-mono shrink-0">
              {folder}/
            </span>
          )}
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {displayName}
          </span>
        </div>
        {filePath && !filePath.startsWith('context/') && (
          <TrashMenuButton
            label={displayName || 'this note'}
            onConfirmAction={onConfirmAction}
            onArchive={handleArchive}
            onDelete={handleDelete}
            showArchive={!filePath.startsWith('archive/') && !filePath.startsWith('context/')}
          />
        )}
        <span className={`text-xs shrink-0 transition-opacity ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${saveStatus === 'saving' ? 'text-[var(--text-muted)]' : ''} ${saveStatus === 'saved' ? 'text-[var(--success)]' : ''} ${saveStatus === 'error' ? 'text-[var(--danger)]' : ''}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }} className="milkdown-wrapper">
          <EditorComponent key={filePath} initialValue={content} onChange={handleChange} onWikilinkClick={onWikilinkClick} />
        </div>
      </div>
    </div>
  )
}
