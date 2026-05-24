import { useEffect, useState } from 'react'

export default function ArchivePage({ readFile, listTree }) {
  const [tab, setTab] = useState('tasks')
  const [tasksDone, setTasksDone] = useState('')
  const [noteFiles, setNoteFiles] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [noteContent, setNoteContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadArchive()
  }, [])

  const loadArchive = async () => {
    setLoading(true)

    try {
      setTasksDone(await readFile('archive/tasks.md'))
    } catch {
      setTasksDone('')
    }

    try {
      const tree = await listTree()
      let files = []

      if (Array.isArray(tree)) {
        const archiveDir = tree.find((entry) => entry.kind === 'directory' && entry.name === 'archive')
        files = (archiveDir?.children || [])
          .filter((file) => file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.') && file.name !== 'tasks.md')
          .map((file) => ({ name: file.name.replace('.md', ''), path: file.path || `archive/${file.name}` }))
          .sort((a, b) => b.name.localeCompare(a.name))
      } else {
        files = (tree.archive || [])
          .filter((file) => file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.') && file.name !== 'tasks.md')
          .map((file) => ({ name: file.name.replace('.md', ''), path: file.path || `archive/${file.name}` }))
          .sort((a, b) => b.name.localeCompare(a.name))
      }

      setNoteFiles(files)
    } catch {
      setNoteFiles([])
    }

    setLoading(false)
  }

  const loadNote = async (file) => {
    setSelectedNote(file)
    try {
      setNoteContent(await readFile(file.path))
    } catch {
      setNoteContent('_Could not load this file._')
    }
  }

  const doneTasks = tasksDone.split('\n').filter((line) => line.startsWith('- [x]')).reverse()

  if (loading) {
    return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">Loading…</div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Archive</h1>
        <div className="flex gap-1 border-b border-[var(--border)]">
          {[
            { key: 'tasks', label: `Resolved Tasks (${doneTasks.length})` },
            { key: 'notes', label: `Notes (${noteFiles.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm transition-colors ${tab === key ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)] -mb-px' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tasks' && (
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {doneTasks.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No resolved tasks yet.</p>
          ) : (
            <div className="space-y-1">
              {doneTasks.map((line, index) => {
                const parts = line.replace('- [x] ', '').split(' · ')
                const title = parts[0] || line
                const file = parts[1] || ''
                const resolved = parts[parts.length - 1]?.replace('resolved ', '') || ''

                return (
                  <div key={index} className="flex items-start gap-3 px-3 py-2.5 rounded-md bg-[var(--panel)] border border-[var(--border)]">
                    <span className="text-[var(--success)] mt-0.5 shrink-0">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]">{title}</p>
                      {file && (
                        <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5 truncate">
                          {file}{resolved && ` · ${resolved}`}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 shrink-0 border-r border-[var(--border)] overflow-y-auto py-4">
            {noteFiles.length === 0 ? (
              <p className="px-4 text-sm text-[var(--text-muted)]">No archived notes.</p>
            ) : (
              noteFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => loadNote(file)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedNote?.path === file.path ? 'bg-[var(--panel-pop)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  {file.name}
                </button>
              ))
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-8">
            {selectedNote ? (
              <>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">{selectedNote.name}</h2>
                <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">{noteContent}</pre>
              </>
            ) : (
              <p className="text-[var(--text-muted)] text-sm">Select a note to view it.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
