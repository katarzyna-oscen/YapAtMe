import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { toSlug } from '../lib/templates'
import { parseFrontmatter, buildFileContent } from '../lib/frontmatter'
import DictateBtn from '../components/DictateBtn'
import TrashMenuButton from '../components/TrashMenuButton'
import TaskPanel from '../components/TaskPanel'
import { readTasksIndex, resolveTaskEntry } from '../lib/tasksIndex'

const STATUS_CYCLE = ['Untriaged', 'Triaged', 'Building', 'Blocked', 'Done']

const STATUS_STYLE = {
  Untriaged: { bg: 'transparent', border: 'var(--border)', color: 'var(--text-very-dim)' },
  Triaged: { bg: 'oklch(0.72 0.13 240 / 0.12)', border: 'oklch(0.72 0.13 240 / 0.35)', color: 'var(--info)' },
  Building: { bg: 'oklch(0.74 0.14 165 / 0.12)', border: 'oklch(0.74 0.14 165 / 0.35)', color: 'var(--success)' },
  Blocked: { bg: 'oklch(0.70 0.18 22 / 0.12)', border: 'oklch(0.70 0.18 22 / 0.35)', color: 'var(--danger)' },
  Done: { bg: 'var(--panel-2)', border: 'var(--border)', color: 'var(--text-very-dim)' },
}

function formatUpdatedHeader(lastUpdated, lastSavedTime) {
  if (!lastUpdated) return ''

  const date = new Date(`${lastUpdated}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return `UPDATED ${String(lastUpdated).toUpperCase()}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
  }

  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase()

  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  const age = daysAgo === 0 ? 'TODAY' : daysAgo === 1 ? '1 DAY AGO' : `${daysAgo} DAYS AGO`

  return `UPDATED ${formatted} · ${age}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
}

export default function ProjectViewer({
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
  const [name, setName] = useState('')
  const [status, setStatus] = useState('Untriaged')
  const [domain, setDomain] = useState('')
  const [owner, setOwner] = useState('')
  const [coreProblem, setCoreProblem] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const [editorBody, setEditorBody] = useState('')
  const [tasks, setTasks] = useState([])
  const [actionsCount, setActionsCount] = useState(0)
  const [delegateCount, setDelegateCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [lastSavedTime, setLastSavedTime] = useState('')

  const saveTimer = useRef(null)
  const prevTranscript = useRef('')

  const { EditorComponent, appendText } = useMarkdownEditor()
  const { isListening, isSupported, start, stop, transcript, reset } = useVoiceDictation()

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
      const fallbackName = path.split('/').pop().replace('.md', '').replace(/-/g, ' ')
      setName(fields?.name || fallbackName)
      setStatus(fields?.status || 'Untriaged')
      setDomain(fields?.domain || '')
      setOwner(fields?.owner || '')
      setCoreProblem(fields?.core_problem || '')
      setLastUpdated(fields?.last_updated || '')
      setEditorBody((body || '').trimStart())
    } catch {
      setName('')
      setStatus('Untriaged')
      setDomain('')
      setOwner('')
      setCoreProblem('')
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
      setActionsCount(mine.filter((e) => e?.section === '## Open Actions').length)
      setDelegateCount(mine.filter((e) => e?.section === '## Delegations').length)
    } catch {
      setTasks([])
      setActionsCount(0)
      setDelegateCount(0)
    }
  }

  const save = useCallback(async (body) => {
    if (!filePath) return

    setSaveStatus('saving')
    const today = new Date().toISOString().slice(0, 10)
    const fields = {
      type: 'project',
      name: name.trim() || 'Untitled',
      status,
      domain,
      owner,
      core_problem: coreProblem,
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
  }, [filePath, writeFile, name, status, domain, owner, coreProblem])

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
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save(editorBody)
    }, 800)
  }, [status, domain, owner, coreProblem])

  const handleNameBlur = async () => {
    if (!filePath || !name.trim()) return

    const folder = filePath.split('/')[0]
    const currentSlug = filePath.split('/').pop().replace('.md', '')
    const newSlug = toSlug(name.trim())
    const caseOnlyRename = newSlug.toLowerCase() === currentSlug.toLowerCase() && newSlug !== currentSlug

    if (newSlug === currentSlug || !newSlug) return

    const newPath = `${folder}/${newSlug}.md`

    try {
      if (!caseOnlyRename) {
        const exists = await fileExists(newPath)
        if (exists) {
          setName(currentSlug.replace(/-/g, ' '))
          return
        }
      }

      await save(editorBody)
      await renameFile(filePath, newPath)
      onFileRenamed?.(newPath)
    } catch (err) {
      console.error('Rename failed:', err.message)
    }
  }

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

  const cycleStatus = () => {
    const idx = STATUS_CYCLE.indexOf(status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    setStatus(next)
  }

  const handleArchive = async () => {
    if (!filePath) return
    const filename = filePath.split('/').pop()
    const content = await readFile(filePath)
    await writeFile(`archive/${filename}`, content)
    await deleteFile(filePath)
    onFileDeleted?.()
  }

  const handleDelete = async () => {
    if (!filePath) return
    await deleteFile(filePath)
    onFileDeleted?.()
  }

  const fileLabel = name || filePath?.replace('projects/', '').replace('.md', '') || 'this project'
  const s = STATUS_STYLE[status] || STATUS_STYLE.Untriaged

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
          <DictateBtn active={isListening} disabled={!isSupported} onClick={handleDictate} />
          <TrashMenuButton
            label={fileLabel}
            onConfirmAction={onConfirmAction}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Project name"
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
              marginBottom: 10,
              fontFamily: 'inherit',
            }}
          />

          <input
            type="text"
            value={coreProblem}
            onChange={(e) => setCoreProblem(e.target.value)}
            placeholder="What problem does this solve?"
            style={{
              display: 'block',
              width: '100%',
              fontSize: 15,
              fontWeight: 400,
              color: coreProblem ? 'var(--text-dim)' : 'var(--text-very-dim)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              marginBottom: 16,
              fontFamily: 'inherit',
            }}
          />

          <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={cycleStatus}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 500,
                color: s.color,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background .12s, border-color .12s',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {status}
            </button>

            <PillInput value={owner} onChange={setOwner} placeholder="Owner" />
            <PillInput value={domain} onChange={setDomain} placeholder="Domain" />

            {actionsCount > 0 && (
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
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{actionsCount}</span>
                {actionsCount === 1 ? 'action' : 'actions'}
              </span>
            )}

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
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{delegateCount}</span>
                {delegateCount === 1 ? 'delegation' : 'delegations'}
              </span>
            )}
          </div>

          <TaskPanel
            tasks={tasks}
            sections={['## Open Actions', '## Delegations', '## Decisions']}
            onResolve={handleResolveTask}
          />

          <div key={filePath} className="milkdown-wrapper">
            <EditorComponent initialValue={editorBody} onChange={handleBodyChange} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PillInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)

  if (!value && !focused) {
    return (
      <button
        onClick={() => setFocused(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 8px',
          background: 'transparent',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 5,
          fontSize: 12,
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
      autoFocus={focused && !value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        padding: '3px 8px',
        background: 'transparent',
        border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 5,
        fontSize: 12,
        color: 'var(--text-dim)',
        outline: 'none',
        fontFamily: 'inherit',
        minWidth: 60,
        transition: 'border-color .12s',
      }}
    />
  )
}
