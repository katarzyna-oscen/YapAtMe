import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { toSlug } from '../lib/templates'
import { parseFrontmatter, buildFileContent } from '../lib/frontmatter'
import TrashMenuButton from '../components/TrashMenuButton'
import TaskPanel from '../components/TaskPanel'
import { SecondaryButton } from '../components/ui/Buttons'
import { readTasksIndex, resolveTaskEntry, updateTaskEntry, disconnectTasksForFile, archiveTasksForFile, deleteTasksForFile, retargetTasksForFile } from '../lib/tasksIndex'
import { invalidateFileIndex } from '../lib/fileIndex'
import { resolveWikilink, emitFileNotFoundToast } from '../lib/wikilinks'
import ConfirmDialog from '../components/ConfirmDialog'
import EntityPicker from '../components/EntityPicker'

function PersonTaskActionModal({ open, mode, label, onCancel, onSelect }) {
  if (!open) return null

  const isArchive = mode === 'archive'
  const title = isArchive
    ? `Archive "${label}" and handle related tasks`
    : `Delete "${label}" and handle related tasks`

  const subtitle = isArchive
    ? 'Choose what should happen to tasks linked to this person.'
    : 'Choose how tasks linked to this person should be handled before deletion.'

  const options = isArchive
    ? [
        { key: 'keep', label: 'Keep linked tasks', detail: 'Tasks stay linked to the archived person file and remain visible.' },
        { key: 'disconnect', label: 'Disconnect tasks from person', detail: 'Remove person link from tasks and keep them visible.' },
        { key: 'archive_tasks', label: 'Archive all related tasks', detail: 'Hide related tasks from active views but keep them in index.' },
      ]
    : [
        { key: 'disconnect', label: 'Disconnect tasks from person', detail: 'Remove person link from tasks and keep them visible.' },
        { key: 'archive_tasks', label: 'Archive all related tasks', detail: 'Hide related tasks from active views but keep them in index.' },
        { key: 'delete_tasks', label: 'Delete all related tasks', detail: 'Permanently remove related tasks from the index.' },
      ]

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 560,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)',
          padding: 22,
          color: 'var(--text)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
        <p style={{ margin: '8px 0 16px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-dim)' }}>{subtitle}</p>

        <div style={{ display: 'grid', gap: 10 }}>
          {options.map((option) => (
            <button
              key={option.key}
              onClick={() => onSelect(option.key)}
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                background: 'var(--panel-2)',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '11px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{option.label}</div>
              <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-dim)' }}>{option.detail}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        </div>
      </div>
    </div>
  )
}

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

// Strips sections rendered as custom UI from the Milkdown editor body.
// Only ## Recent Mentions and ## Notes remain in the editor.
const STRIPPED = /^##\s+(Summary|Related Projects|Talk About|Delegate|My Actions)\s*$/i
const STRIPPED_OWNER = /^##\s+(Summary|Related Projects|Talk About|Delegate|My Actions|Recent Mentions)\s*$/i

function stripEditorOnlySections(body, isOwner = false) {
  const pattern = isOwner ? STRIPPED_OWNER : STRIPPED
  const lines = body.split('\n')
  const result = []
  let skipping = false
  for (const line of lines) {
    if (/^##\s+/.test(line)) skipping = pattern.test(line.trim())
    if (!skipping) result.push(line)
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trimStart()
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
  listTree,
  tasksVersion,
  settings,
  wikilinkSuggestions,
  onNavigate,
  onTasksChanged,
  onFileRenamed,
  onConfirmAction,
  onFileDeleted,
  onDisplayNameChanged,
}) {
  const [fullName, setFullName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [role, setRole] = useState('')
  const [relatedProjects, setRelatedProjects] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [editorBody, setEditorBody] = useState('')
  const [tasks, setTasks] = useState([])

  const [delegateCount, setDelegateCount] = useState(0)
  const [talkAboutCount, setTalkAboutCount] = useState(0)
  const [myActionsCount, setMyActionsCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [lastSavedTime, setLastSavedTime] = useState('')
  const [taskActionModal, setTaskActionModal] = useState({ open: false, mode: null })
  const [renameDialog, setRenameDialog] = useState(null)

  const saveTimer = useRef(null)
  // True while a rename is in flight — suppresses debounced autosaves that
  // would otherwise resurrect the old file or race the rename write.
  const renamingRef = useRef(false)
  // The path currently loaded into the editor. A debounced autosave scheduled
  // before a rename closes over the old path; this ref lets save() detect and
  // skip those stale writes so a renamed file is never re-created.
  const activePathRef = useRef(null)

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
    if (newPart) appendText(newPart)
    prevTranscript.current = transcript
  }, [transcript, appendText])

  const loadFile = async (path) => {
    activePathRef.current = path
    renamingRef.current = false
    setLoading(true)
    setSaveStatus('idle')
    setLastSavedTime('')

    try {
      const raw = await readFile(path)
      const { fields, body } = parseFrontmatter(raw)
      setFullName(fields?.full_name || '')
      setRelationship(fields?.relationship || '')
      setRole(fields?.role || '')

      // Prefer frontmatter; fall back to parsing ## Related Projects from body
      const rawRel = fields?.related_projects
      let relText = ''
      if (rawRel && (Array.isArray(rawRel) ? rawRel.length > 0 : rawRel.trim())) {
        relText = Array.isArray(rawRel)
          ? rawRel.filter(Boolean).map((s) => `[[${String(s).replace(/^\[+|\]+$/g, '').trim()}]]`).join('\n')
          : rawRel
      } else {
        // Extract [[links]] from ## Related Projects section in body
        const relMatch = (body || '').match(/##\s+Related Projects\s*\n([\s\S]*?)(?=\n##\s|$)/i)
        if (relMatch) {
          relText = relMatch[1]
            .split('\n')
            .map((l) => l.trim().replace(/^-\s*/, ''))
            .filter((l) => l.startsWith('[['))
            .join('\n')
        }
      }
      setRelatedProjects(relText)

      setLastUpdated(fields?.last_updated || '')
      // Strip task/meta sections from body; also strip Recent Mentions for vault owner
      const isOwner = filePath === settings?.writerFile
      const trimmedBody = stripEditorOnlySections((body || '').trimStart(), isOwner)
      setEditorBody(trimmedBody)
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
      setMyActionsCount(mine.filter((e) => e?.section === '## My Actions').length)
    } catch {
      setTasks([])
      setDelegateCount(0)
      setTalkAboutCount(0)
      setMyActionsCount(0)
    }
  }

  const save = useCallback(async (body) => {
    if (!filePath) return
    // Skip stale/racing writes: a rename is in progress, or this save closed
    // over a path that is no longer the active file (e.g. after a rename).
    if (renamingRef.current) return
    if (activePathRef.current && filePath !== activePathRef.current) return

    setSaveStatus('saving')
    const today = new Date().toISOString().slice(0, 10)
    // Store related projects as a clean array of bare names so YAML round-trips
    // correctly. Storing the raw "[[name]]" string makes the frontmatter parser
    // misread the leading "[" as an array and corrupt the value on reload.
    const relatedArr = (relatedProjects.match(/\[\[([^\]]+)\]\]/g) || [])
      .map((m) => m.slice(2, -2).trim())
      .filter(Boolean)
    const fields = {
      type: 'person',
      full_name: fullName.trim() || 'Untitled',
      relationship,
      role,
      related_projects: relatedArr.length ? relatedArr : null,
      last_updated: today,
    }
    const full = buildFileContent(fields, body)

    try {
      await writeFile(filePath, full)
      onDisplayNameChanged?.(filePath, fullName.trim() || 'Untitled')
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
  }, [filePath, writeFile, fullName, relationship, role, relatedProjects])

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
  }, [fullName, relationship, role, relatedProjects])

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
    onTasksChanged?.()
    await loadStats(filePath)
  }

  const handleUpdateTask = async (id, patch) => {
    await updateTaskEntry(readFile, writeFile, id, patch)
    onTasksChanged?.()
    await loadStats(filePath)
  }

  const handleWikilinkClick = async (name) => {
    const target = await resolveWikilink(name, listTree)
    if (!target) {
      emitFileNotFoundToast()
      return
    }
    const page = target.startsWith('inbox/') ? 'inbox' : 'viewer'
    onNavigate?.(page, target)
  }

  const handleNameBlur = () => {
    if (!filePath || !fullName.trim()) return

    const folder = filePath.split('/')[0]
    const currentSlug = filePath.split('/').pop().replace('.md', '')
    const newSlug = toSlug(fullName.trim())

    if (newSlug === currentSlug || !newSlug) return

    // Slug changes — cancel any pending autosave
    clearTimeout(saveTimer.current)
    const newPath = `${folder}/${newSlug}.md`
    const info = { oldPath: filePath, newPath, oldSlug: currentSlug, newSlug }

    // Freshly-created, never-named files (untitled-*) have no inbound
    // references yet, so rename silently — no confirmation dialog needed.
    if (/^untitled/i.test(currentSlug)) {
      runRename(info)
      return
    }
    setRenameDialog(info)
  }

  const executeRename = async () => {
    if (!renameDialog) return
    const info = renameDialog
    setRenameDialog(null)
    await runRename(info)
  }

  const runRename = async ({ oldPath, newPath, oldSlug, newSlug }) => {
    // Suppress debounced autosaves while we move the file so a stale write
    // can't resurrect the old path or clobber the destination mid-rename.
    renamingRef.current = true
    clearTimeout(saveTimer.current)

    const today = new Date().toISOString().slice(0, 10)
    const fields = {
      type: 'person',
      full_name: fullName.trim() || 'Untitled',
      relationship,
      role,
      last_updated: today,
    }
    const content = buildFileContent(fields, editorBody)

    try {
      // Collision: the target name is already taken by a different file.
      // Keep the user's typed name (never revert to the "Untitled" slug);
      // just save in place under the current path and let them pick another.
      const isSlugCaseOnly = oldSlug.toLowerCase() === newSlug.toLowerCase()
      if (!isSlugCaseOnly) {
        let exists = false
        try { exists = await fileExists(newPath) } catch {}
        if (exists) {
          renamingRef.current = false
          await writeFile(oldPath, content)
          onDisplayNameChanged?.(oldPath, fullName.trim() || 'Untitled')
          window.dispatchEvent(new CustomEvent('memostack:toast', {
            detail: { message: `A person named “${fullName.trim()}” already exists` },
          }))
          return
        }
      }

      // Write new content to new path, then delete old path
      await writeFile(newPath, content)
      if (oldPath.toLowerCase() !== newPath.toLowerCase()) {
        await deleteFile(oldPath)
      }

      // Update tasks-index and context/index files
      await retargetTasksForFile(readFile, writeFile, oldPath, newPath)
      for (const ctxPath of [
        'context/_context.md',
        'context/_context_log.md',
        'context/projects-index.md',
        'context/people-index.md',
        'context/ideas-index.md',
      ]) {
        try {
          const txt = await readFile(ctxPath)
          if (txt.includes(oldPath)) {
            await writeFile(ctxPath, txt.split(oldPath).join(newPath))
          }
        } catch {}
      }

      await invalidateFileIndex()
      onDisplayNameChanged?.(newPath, fullName.trim() || 'Untitled')
      activePathRef.current = newPath
      onFileRenamed?.(newPath)
    } catch (err) {
      renamingRef.current = false
      console.error('Rename failed:', err.message)
    }
  }

  const cancelRename = () => {
    if (!renameDialog) return
    setFullName(renameDialog.oldSlug.replace(/-/g, ' '))
    setRenameDialog(null)
  }

  const applyArchiveWithTaskAction = async (taskAction) => {
    if (!filePath) return
    const filename = filePath.split('/').pop()
    const targetPath = `archive/${filename}`
    const content = await readFile(filePath)

    if (taskAction === 'keep') {
      await retargetTasksForFile(readFile, writeFile, filePath, targetPath)
    } else if (taskAction === 'disconnect') {
      await disconnectTasksForFile(readFile, writeFile, filePath, [fullName, filename.replace('.md', '')])
    } else if (taskAction === 'archive_tasks') {
      await archiveTasksForFile(readFile, writeFile, filePath)
    }

    await writeFile(targetPath, content)
    await deleteFile(filePath)
    await invalidateFileIndex()
    onFileDeleted?.()
  }

  const applyDeleteWithTaskAction = async (taskAction) => {
    if (!filePath) return

    if (taskAction === 'disconnect') {
      const filename = filePath.split('/').pop() || ''
      await disconnectTasksForFile(readFile, writeFile, filePath, [fullName, filename.replace('.md', '')])
    } else if (taskAction === 'archive_tasks') {
      await archiveTasksForFile(readFile, writeFile, filePath)
    } else if (taskAction === 'delete_tasks') {
      await deleteTasksForFile(readFile, writeFile, filePath)
    }

    await deleteFile(filePath)
    await invalidateFileIndex()
    onFileDeleted?.()
  }

  const handleArchive = async () => {
    setTaskActionModal({ open: true, mode: 'archive' })
  }

  const handleDelete = async () => {
    setTaskActionModal({ open: true, mode: 'delete' })
  }

  const handleTaskActionSelect = async (action) => {
    const mode = taskActionModal.mode
    setTaskActionModal({ open: false, mode: null })
    try {
      if (mode === 'archive') {
        await applyArchiveWithTaskAction(action)
      } else if (mode === 'delete') {
        await applyDeleteWithTaskAction(action)
      }
    } catch (err) {
      console.error('Person file action failed:', err?.message || err)
    }
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
          {filePath !== settings?.writerFile ? (
          <TrashMenuButton
            label={fileLabel}
            onConfirmAction={onConfirmAction}
            onArchive={handleArchive}
            onDelete={handleDelete}
            confirmArchive={false}
            confirmDelete={false}
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
          ) : null}
        </div>
      </header>

      <PersonTaskActionModal
        open={taskActionModal.open}
        mode={taskActionModal.mode}
        label={fileLabel}
        onCancel={() => setTaskActionModal({ open: false, mode: null })}
        onSelect={handleTaskActionSelect}
      />

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>
          {/* Name — large editable title */}
          <textarea
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={handleNameBlur}
            placeholder="Full name"
            rows={1}
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
              resize: 'none',
              overflow: 'hidden',
              lineHeight: 1.25,
              minHeight: '1.25em',
            }}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
          />

          {/* Metadata row — role + relationship + last mentioned + open counts */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <PillInput
              value={role}
              onChange={setRole}
              placeholder="Role"
            />
            {filePath === settings?.writerFile ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  background: 'oklch(0.85 0.16 95 / 0.12)',
                  border: '1px solid oklch(0.85 0.16 95 / 0.4)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: 'oklch(0.85 0.16 95)',
                  whiteSpace: 'nowrap',
                }}
              >
                VAULT OWNER
              </span>
            ) : (
              <PillInput
                value={relationship}
                onChange={setRelationship}
                placeholder="Relationship"
              />
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

            {myActionsCount > 0 && (
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
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{myActionsCount}</span>
                my actions
              </span>
            )}
          </div>

          {/* Related Projects widget — top of canvas, before task sections */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-very-dim)', textTransform: 'uppercase', marginBottom: 10 }}>
              Related Projects
            </div>
            <EntityPicker
              entities={(relatedProjects.match(/\[\[([^\]]+)\]\]/g) || []).map((m) => m.slice(2, -2))}
              onChange={(arr) => setRelatedProjects(arr.map((n) => `[[${n}]]`).join('\n'))}
              suggestions={wikilinkSuggestions}
              filterType="project"
              onNavigate={(name) => handleWikilinkClick(name)}
              placeholder="Add related project"
            />
          </div>

          <TaskPanel
            tasks={tasks}
            sections={['## Talk About', '## Delegate', '## My Actions']}
            onResolve={handleResolveTask}
            onUpdateTask={handleUpdateTask}
            onWikilinkClick={handleWikilinkClick}
          />

          {/* Milkdown body — Recent Mentions + Notes only */}
          <div key={filePath} className="milkdown-wrapper">
            <EditorComponent initialValue={editorBody} onChange={handleBodyChange} onWikilinkClick={handleWikilinkClick} wikilinkSuggestions={wikilinkSuggestions ?? []} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!renameDialog}
        danger={false}
        title="Rename person"
        message={renameDialog ? `Renaming "${renameDialog.oldSlug.replace(/-/g, ' ')}" to "${fullName}" will rename ${renameDialog.oldSlug}.md → ${renameDialog.newSlug}.md and update all vault references.` : ''}
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onConfirm={executeRename}
        onCancel={cancelRename}
      />
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

