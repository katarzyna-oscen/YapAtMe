import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { deleteArchivedTasks } from '../lib/tasksIndex'

function humanizeFilePath(file) {
  if (!file || file === 'context/tasks-index.json') return null
  const stem = String(file).split('/').pop().replace(/\.md$/i, '')
  return stem.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizeTitle(raw) {
  let text = String(raw || '').trim()
  if (!text) return ''
  text = text.replace(/^#\s*\d{2}-\d{2}-\d{4}\s+/i, '')
  text = text.replace(/\\\[\[/g, '[[').replace(/\\\]\]/g, ']]')
  text = text.replace(/\[\[\[+\s*([^\]]+?)\s*\]+\]\]/g, '[[$1]]')
  text = text.replace(/\[{4,}\s*([^\]]+?)\s*\]{4,}/g, '[[$1]]')
  return text.replace(/\s+/g, ' ').trim()
}

function DeleteAllDialog({ count, onConfirm, onCancel }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel-pop)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '24px 28px', maxWidth: 400, width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          Permanently delete {count} archived task{count !== 1 ? 's' : ''}?
        </h3>
        <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          This cannot be undone. Tasks will be removed from tasks-index.json entirely.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px', background: 'var(--panel-2)', color: 'var(--text-dim)',
              border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              background: 'oklch(0.70 0.18 22 / 0.20)',
              color: 'oklch(0.84 0.16 22)',
              border: '1px solid oklch(0.70 0.18 22 / 0.50)',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Delete {count} task{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function ArchiveViewer({ readFile, writeFile, tasksVersion }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const loadArchive = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await readFile('context/tasks-index.json')
      const all = JSON.parse(raw)
      const archived = (Array.isArray(all) ? all : [])
        .filter((e) => e?.status === 'archived' || e?.status === 'done')
        .sort((a, b) => {
          const da = String(a?.archived_at || a?.resolved_at || a?.last_updated || '')
          const db = String(b?.archived_at || b?.resolved_at || b?.last_updated || '')
          return db.localeCompare(da)
        })
      setEntries(archived)
    } catch {
      setEntries([])
    }
    setLoading(false)
  }, [readFile])

  useEffect(() => { loadArchive() }, [loadArchive, tasksVersion])

  const handleDeleteAll = useCallback(async () => {
    const count = await deleteArchivedTasks(readFile, writeFile)
    console.log(`[ArchiveViewer] deleteArchivedTasks: removed ${count} tasks`)
    setEntries([])
    setConfirmDelete(false)
  }, [readFile, writeFile])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0, gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--text)' }}>
            Archive
          </h1>
          {!loading && (
            <span style={{ fontSize: 13, color: 'var(--text-very-dim)' }}>
              {entries.length} task{entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--text-very-dim)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'background .15s, color .15s, border-color .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'oklch(0.70 0.18 22 / 0.14)'
              e.currentTarget.style.color = 'oklch(0.84 0.16 22)'
              e.currentTarget.style.borderColor = 'oklch(0.70 0.18 22 / 0.40)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-very-dim)'
              e.currentTarget.style.borderColor = 'var(--border-subtle)'
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5h10" />
              <path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
              <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
            </svg>
            Delete all
          </button>
        )}
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 48px 48px' }}>
        {loading && (
          <div style={{ color: 'var(--text-very-dim)', fontSize: 13 }}>Loading…</div>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-very-dim)', fontSize: 13 }}>
            No archived tasks yet. Completed tasks moved here from the Tasks screen.
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {entries.map((entry) => {
              const dateStr = String(entry?.archived_at || entry?.resolved_at || entry?.last_updated || '').slice(0, 10)
              const entity = humanizeFilePath(entry?.file)
              const folder = String(entry?.file || '').split('/')[0]
              const moduleLabel = folder === 'people' ? 'Person' : folder === 'projects' ? 'Project' : folder === 'ideas' ? 'Idea' : null

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--text-very-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m3 8 3.5 3.5L13 5" />
                  </svg>

                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4, textDecoration: 'line-through', textDecorationColor: 'var(--border-strong)' }}>
                    {normalizeTitle(String(entry?.title || ''))}
                  </span>

                  {moduleLabel && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 500,
                      padding: '2px 7px', borderRadius: 999,
                      background: 'var(--panel-2)', color: 'var(--text-very-dim)',
                      border: '1px solid var(--border-subtle)',
                      whiteSpace: 'nowrap',
                    }}>
                      {moduleLabel}
                    </span>
                  )}

                  {entity && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>
                      {entity}
                    </span>
                  )}

                  {dateStr && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>
                      {dateStr}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmDelete && (
        <DeleteAllDialog
          count={entries.length}
          onConfirm={handleDeleteAll}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
