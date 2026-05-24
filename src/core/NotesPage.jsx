import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'

export default function NotesPage({ readFile, writeFile, listTree, activePath }) {
  const [filePath, setFilePath] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer = useRef(null)

  useEffect(() => {
    if (activePath) loadFile(activePath)
    else loadFirstNote()
  }, [activePath])

  const loadFirstNote = async () => {
    setLoading(true)
    try {
      const tree = await listTree()

      let files = []
      if (Array.isArray(tree)) {
        const notesDir = tree.find((entry) => entry.kind === 'directory' && entry.name === 'notes')
        files = (notesDir?.children || [])
          .filter((file) => file.kind === 'file' && file.name.endsWith('.md') && !file.name.startsWith('_moved'))
          .map((file) => file.path || `notes/${file.name}`)
          .sort((a, b) => b.localeCompare(a))
      } else {
        files = (tree.notes || [])
          .filter((file) => file.name.endsWith('.md') && !file.name.startsWith('_moved'))
          .map((file) => file.path || `notes/${file.name}`)
          .sort((a, b) => b.localeCompare(a))
      }

      if (files.length > 0) await loadFile(files[0])
      else {
        setFilePath(null)
        setContent('')
        setLoading(false)
      }
    } catch {
      setFilePath(null)
      setContent('')
      setLoading(false)
    }
  }

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    try {
      const raw = await readFile(path)
      setFilePath(path)
      setContent(raw)
    } catch (err) {
      console.error('Failed to load note:', err.message)
      setFilePath(path)
      setContent('')
    }
    setLoading(false)
  }

  const save = useCallback(async (text, path) => {
    if (!path) return
    setSaveStatus('saving')
    try {
      await writeFile(path, text)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }, [writeFile])

  const handleChange = (newContent) => {
    setContent(newContent)
    setSaveStatus('idle')

    clearTimeout(saveTimer.current)
    const path = filePath
    saveTimer.current = setTimeout(() => {
      save(newContent, path)
    }, 800)
  }

  const { EditorComponent } = useMarkdownEditor()

  const displayName = filePath
    ? filePath.replace('notes/', '').replace('.md', '')
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Loading…
      </div>
    )
  }

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-[var(--text-muted)] text-sm">No notes yet.</p>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Processed notes appear here. Select one from the sidebar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-8 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-medium text-[var(--text-primary)] truncate">{displayName}</h1>
          <span className="text-xs text-[var(--text-muted)] shrink-0">notes/</span>
        </div>

        <span className={`text-xs shrink-0 transition-opacity ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${saveStatus === 'saving' ? 'text-[var(--text-muted)]' : ''} ${saveStatus === 'saved' ? 'text-[var(--success)]' : ''} ${saveStatus === 'error' ? 'text-[var(--danger)]' : ''}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-6 milkdown-wrapper">
          <EditorComponent key={filePath} initialValue={content} onChange={handleChange} />
        </div>
      </div>
    </div>
  )
}
