import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { toSlug } from '../lib/templates'
import { parseFrontmatter, buildFileContent } from '../lib/frontmatter'
import TrashMenuButton from '../components/TrashMenuButton'
import TaskPanel from '../components/TaskPanel'
import { readTasksIndex, resolveTaskEntry } from '../lib/tasksIndex'

function formatUpdatedHeader(lastUpdated, lastSavedTime) {
  if (!lastUpdated) return ''
  const date = new Date(`${lastUpdated}T00:00:00`)
  if (Number.isNaN(date.getTime())) return `UPDATED ${String(lastUpdated).toUpperCase()}`

  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase()
  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  const age = daysAgo === 0 ? 'TODAY' : daysAgo === 1 ? '1 DAY AGO' : `${daysAgo} DAYS AGO`
  return `UPDATED ${formatted} · ${age}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
}

function DictateBtn({ active, disabled, onClick }) {
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: active
          ? (hover ? 'oklch(0.70 0.18 22 / 0.24)' : 'oklch(0.70 0.18 22 / 0.16)')
          : (hover ? 'var(--panel-2)' : 'var(--panel)'),
        color: active ? 'oklch(0.84 0.16 22)' : 'var(--text)',
        border: `1px solid ${active
          ? (hover ? 'oklch(0.70 0.18 22 / 0.55)' : 'oklch(0.70 0.18 22 / 0.40)')
          : (hover ? 'var(--border-strong)' : 'var(--border)')}`,
        borderRadius: 8,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          background: active ? 'oklch(0.75 0.20 22)' : 'var(--text-very-dim)',
          boxShadow: active ? '0 0 0 4px oklch(0.70 0.18 22 / 0.20)' : 'none',
          animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
      {active ? 'Recording…' : 'Dictate'}
    </button>
  )
}

export default function PersonViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  fileExists,
  tasksVersion,
  onFileRenamed,
  onConfirmAction,
  onFileDeleted,
}) {
  const [fullName, setFullName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [role, setRole] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [editorBody, setEditorBody] = useState('')
  const [tasks, setTasks] = useState([])

  const [delegateCount, setDelegateCount] = useState(0)
  const [talkAboutCount, setTalkAboutCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [lastSavedTime, setLastSavedTime] = useState('')

  const saveTimer = useRef(null)

  const { EditorComponent, appendText } = useMarkdownEditor()
  const { isListening, isSupported, start, stop, transcript, reset } = useVoiceDictation()
  const prevTranscript = useRef('')

  useEffect(() => {
    if (!filePath) return
    loadFile(filePath)
  }, [filePath])

  useEffect(() => {
    if (!filePath) return
    loadStats(filePath)
  }, [filePath, tasksVersion])

  useEffect(() => {
    if (!transcript) return
    const newPart = transcript.slice(prevTranscript.current.length)
    if (newPart) appendText(`${newPart} `)
    prevTranscript.current = transcript
  }, [transcript, appendText])

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    setLastSavedTime('')

    try {
      const raw = await readFile(path)
      const { fields, body } = parseFrontmatter(raw)
      setFullName(fields?.full_name || '')
      setRelationship(fields?.relationship || '')
      setRole(fields?.role || '')
      setLastUpdated(fields?.last_updated || '')
      setEditorBody((body || '').trimStart())
    } catch {
      setFullName('')
      setRelationship('')
      setRole('')
      setLastUpdated('')
      setEditorBody('')
    }

    setLoading(false)
  }

  const loadStats = async (path) => {
    try {
      const entries = await readTasksIndex(readFile)
      const mine = Array.isArray(entries)
        ? entries.filter((e) => e?.file === path && e?.status !== 'done')
        : []
      setTasks(mine)
      setDelegateCount(mine.filter((e) => e?.section === '## Delegate').length)
      setTalkAboutCount(mine.filter((e) => e?.section === '## Talk About').length)
    } catch {
      setTasks([])
      setDelegateCount(0)
      setTalkAboutCount(0)
    }
  }

  const save = useCallback(async (body) => {
    if (!filePath) return

    setSaveStatus('saving')
    const today = new Date().toISOString().slice(0, 10)
    const fields = {
      type: 'person',
      full_name: fullName.trim() || 'Untitled',
      relationship,
      role,
      last_updated: today,
    }
    const full = buildFileContent(fields, body)

    try {
      await writeFile(filePath, full)
      const t = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      setLastSavedTime(t)
      setLastUpdated(today)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }, [filePath, writeFile, fullName, relationship, role])

  const queueSave = (body) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save(body)
    }, 800)
  }

  const handleBodyChange = (newBody) => {
    setEditorBody(newBody)
    setSaveStatus('idle')
    queueSave(newBody)
  }

  useEffect(() => {
    if (!filePath || loading) return
    setSaveStatus('idle')
    queueSave(editorBody)
  }, [fullName, relationship, role])

  const handleDictate = () => {
    if (isListening) {
      stop()
      return
    }
    reset()
    prevTranscript.current = ''
    start()
  }

  const handleResolveTask = async (id) => {
    await resolveTaskEntry(readFile, writeFile, id)
    await loadStats(filePath)
  }

  const handleNameBlur = async () => {
    if (!filePath || !fullName.trim()) return

    const folder = filePath.split('/')[0]
    const currentSlug = filePath.split('/').pop().replace('.md', '')
    const newSlug = toSlug(fullName.trim())
    const caseOnlyRename = newSlug.toLowerCase() === currentSlug.toLowerCase() && newSlug !== currentSlug

    if (newSlug === currentSlug || !newSlug) return

    const newPath = `${folder}/${newSlug}.md`

    if (!caseOnlyRename) {
      try {
        const exists = await fileExists(newPath)
        if (exists) {
          setFullName(currentSlug.replace(/-/g, ' '))
          return
        }
      } catch {}
    }

    try {
      await save(editorBody)
      await renameFile(filePath, newPath)
      onFileRenamed?.(newPath)
    } catch (err) {
      console.error('Rename failed:', err.message)
    }
  }

  const handleArchive = async () => {
    const filename = filePath.split('/').pop()
    const content = await readFile(filePath)
    await writeFile(`archive/${filename}`, content)
    await deleteFile(filePath)
    onFileDeleted?.()
  }

  const handleDelete = async () => {
    await deleteFile(filePath)
    onFileDeleted?.()
  }

  const fileLabel = fullName || filePath?.replace('people/', '').replace('.md', '') || 'this person'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 48px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-very-dim)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {formatUpdatedHeader(lastUpdated, lastSavedTime)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DictateBtn
            active={isListening}
            disabled={!isSupported}
            onClick={handleDictate}
          />
          <TrashMenuButton
            label={fileLabel}
            onConfirmAction={onConfirmAction}
            onArchive={handleArchive}
            onDelete={handleDelete}
            getArchiveConfirm={(label) => ({
              title: `Archive "${label}"?`,
              message: 'This note will be moved to archive/.',
              confirmLabel: 'Archive',
              danger: false,
            })}
            getDeleteConfirm={(label) => ({
              title: `Delete "${label}"?`,
              message: 'This file will be permanently removed. This cannot be undone.',
              confirmLabel: 'Delete',
              danger: true,
            })}
          />
        </div>
      </header>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>
          {/* Name — large editable title */}
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Full name"
            style={{
              display: 'block',
              width: '100%',
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              marginBottom: 12,
              fontFamily: 'inherit',
            }}
          />

          {/* Metadata row — role + relationship + last mentioned + open counts */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <PillInput
              value={role}
              onChange={setRole}
              placeholder="Role"
            />
            <PillInput
              value={relationship}
              onChange={setRelationship}
              placeholder="Relationship"
            />

            {delegateCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  fontSize: 12,
                  color: 'var(--text-very-dim)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{delegateCount}</span>
                {delegateCount === 1 ? 'delegate' : 'delegates'}
              </span>
            )}

            {talkAboutCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  fontSize: 12,
                  color: 'var(--text-very-dim)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{talkAboutCount}</span>
                to talk about
              </span>
            )}
          </div>

          <TaskPanel
            tasks={tasks}
            sections={['## Delegate', '## Talk About']}
            onResolve={handleResolveTask}
          />

          {/* Milkdown body — remounts when filePath changes */}
          <div key={filePath} className="milkdown-wrapper">
            <EditorComponent initialValue={editorBody} onChange={handleBodyChange} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PillInput ────────────────────────────────────────────────────────────────
// Looks like a tag chip, behaves like an input.

function PillInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  const show = value || focused

  if (!show) {
    return (
      <button
        onClick={() => setFocused(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          background: 'var(--panel-2)',
          border: '1px dashed var(--border)',
          borderRadius: 6,
          fontSize: 12.5,
          color: 'var(--text-very-dim)',
          cursor: 'text',
          fontFamily: 'inherit',
        }}
      >
        + {placeholder}
      </button>
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      autoFocus={focused && !value}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        background: 'var(--panel-2)',
        border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 6,
        fontSize: 12.5,
        color: 'var(--text-dim)',
        outline: 'none',
        fontFamily: 'inherit',
        minWidth: 60,
        transition: 'border-color .12s',
      }}
    />
  )
}

