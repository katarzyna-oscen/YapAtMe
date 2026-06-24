import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { toSlug } from '../lib/templates'
import { parseFrontmatter, buildFileContent } from '../lib/frontmatter'
import DictateBtn from '../components/DictateBtn'
import TrashMenuButton from '../components/TrashMenuButton'
import TaskPanel from '../components/TaskPanel'
import { readTasksIndex, resolveTaskEntry, updateTaskEntry, retargetTasksForFile, appendTaskEntry, appendTaskEntries, setPlanTaskStatus, removePlanTask } from '../lib/tasksIndex'
import { invalidateFileIndex } from '../lib/fileIndex'
import ConfirmDialog from '../components/ConfirmDialog'
import { resolveWikilink, emitFileNotFoundToast } from '../lib/wikilinks'
import PlanChecklist, { parsePlanSteps } from '../components/PlanChecklist'

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
  listTree,
  tasksVersion,
  wikilinkSuggestions,
  onNavigate,
  onTasksChanged,
  onFileRenamed,
  onConfirmAction,
  onFileDeleted,
  onDisplayNameChanged,
}) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState('Untriaged')
  const [domain, setDomain] = useState('')
  const [owner, setOwner] = useState('')
  const [coreProblem, setCoreProblem] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const [editorBody, setEditorBody] = useState('')
  const [sectionCurrentPlan, setSectionCurrentPlan] = useState('')
  const [tasks, setTasks] = useState([])
  const [actionsCount, setActionsCount] = useState(0)
  const [delegateCount, setDelegateCount] = useState(0)

  const sectionCurrentPlanRef = useRef('')

  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [lastSavedTime, setLastSavedTime] = useState('')
  const [renameDialog, setRenameDialog] = useState(null)

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
    if (newPart) appendText(newPart)
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

      // Extract ## Current Plan section; keep the rest for Milkdown
      // Strip task sections (Open Actions, Delegations, Decisions) and Summary
      // from the editor body — they are rendered by TaskPanel, not Milkdown.
      const STRIPPED_PROJECT = /^##\s+(Summary|Open Actions|Delegations|Decisions)\s*$/i
      function stripProjectEditorSections(text) {
        const lines = text.split('\n')
        const out = []
        let skipping = false
        for (const line of lines) {
          if (/^##\s+/.test(line)) skipping = STRIPPED_PROJECT.test(line.trim())
          if (!skipping) out.push(line)
        }
        return out.join('\n').replace(/\n{3,}/g, '\n\n').trimStart()
      }

      const planMatch = (body || '').match(/##\s+Current Plan\s*\n([\s\S]*?)(?=\n##\s|$)/i)
      const planContent = planMatch ? planMatch[1].trimEnd() : ''
      setSectionCurrentPlan(planContent)
      sectionCurrentPlanRef.current = planContent
      const bodyWithoutPlan = stripProjectEditorSections(
        (body || '')
          .replace(/##\s+Current Plan\s*\n[\s\S]*?(?=\n##\s|$)/i, '')
          .replace(/\n{3,}/g, '\n\n')
          .trimStart()
      )
      setEditorBody(bodyWithoutPlan)
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

    // Re-inject the plan section (managed separately from the Milkdown editor)
    const planContent = sectionCurrentPlanRef.current
    let fullBody = (body || '').trimEnd()
    if (planContent.trim()) {
      const planBlock = `## Current Plan\n${planContent}`
      const mentionsRe = /\n##\s+Recent Mentions/i
      if (mentionsRe.test(fullBody)) {
        const idx = fullBody.search(mentionsRe)
        fullBody = fullBody.slice(0, idx).trimEnd() + '\n\n' + planBlock + '\n\n' + fullBody.slice(idx).trimStart()
      } else {
        fullBody = fullBody + '\n\n' + planBlock
      }
    }

    const full = buildFileContent(fields, fullBody)

    try {
      await writeFile(filePath, full)
      onDisplayNameChanged?.(filePath, name.trim() || 'Untitled')
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

  const handleNameBlur = () => {
    if (!filePath || !name.trim()) return

    const folder = filePath.split('/')[0]
    const currentSlug = filePath.split('/').pop().replace('.md', '')
    const newSlug = toSlug(name.trim())

    if (!newSlug) return

    // Compare case-insensitively: toSlug capitalises first char but filenames on disk
    // may be all-lowercase (older files). A case-only difference is NOT a slug change.
    if (newSlug.toLowerCase() === currentSlug.toLowerCase()) {
      // Same slug — just persist the display-name change in frontmatter.
      clearTimeout(saveTimer.current)
      save(editorBody)
      return
    }

    // Slug changes — cancel any pending autosave and show rename confirmation
    clearTimeout(saveTimer.current)
    const newPath = `${folder}/${newSlug}.md`
    setRenameDialog({ oldPath: filePath, newPath, oldSlug: currentSlug, newSlug })
  }

  const executeRename = async () => {
    if (!renameDialog) return
    const { oldPath, newPath, oldSlug, newSlug } = renameDialog
    setRenameDialog(null)

    try {
      // Check for collision only when it's not a case-only slug change
      const isSlugCaseOnly = oldSlug.toLowerCase() === newSlug.toLowerCase()
      if (!isSlugCaseOnly) {
        try {
          const exists = await fileExists(newPath)
          if (exists) {
            setName(oldSlug.replace(/-/g, ' '))
            return
          }
        } catch {}
      }

      // Write new content to new path, then delete old path
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
      await writeFile(newPath, buildFileContent(fields, editorBody))
      // Only delete old file when it's a genuinely different path.
      // Compare case-insensitively: macOS filesystems are case-insensitive by default,
      // so "projects/my-project.md" and "projects/My-project.md" are the same file.
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
      onFileRenamed?.(newPath)
    } catch (err) {
      console.error('Rename failed:', err.message)
    }
  }

  const cancelRename = () => {
    if (!renameDialog) return
    setName(renameDialog.oldSlug.replace(/-/g, ' '))
    setRenameDialog(null)
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
    onTasksChanged?.()
    await loadStats(filePath)
  }

  const handleUpdateTask = async (id, patch) => {
    await updateTaskEntry(readFile, writeFile, id, patch)
    onTasksChanged?.()
    await loadStats(filePath)
  }

  const handlePlanChange = (newText) => {
    setSectionCurrentPlan(newText)
    sectionCurrentPlanRef.current = newText
    queueSave(editorBody)
  }

  const handlePlanToggle = async (stepTitle, nowDone) => {
    await setPlanTaskStatus(readFile, writeFile, filePath, '## Current Plan', stepTitle, nowDone)
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanDelete = async (stepTitle) => {
    await removePlanTask(readFile, writeFile, filePath, '## Current Plan', stepTitle)
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanAdd = async (stepTitle) => {
    await appendTaskEntry(readFile, writeFile, {
      file: filePath, module: 'projects', section: '## Current Plan', title: stepTitle, tags: ['action'],
    })
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanAddMultiple = async (titles) => {
    await appendTaskEntries(readFile, writeFile, titles.map((title) => ({
      file: filePath, module: 'projects', section: '## Current Plan', title, tags: ['action'],
    })))
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanRename = async (oldTitle, newTitle, isDone) => {
    await removePlanTask(readFile, writeFile, filePath, '## Current Plan', oldTitle)
    await appendTaskEntry(readFile, writeFile, {
      file: filePath, module: 'projects', section: '## Current Plan', title: newTitle,
      tags: ['action'], status: isDone ? 'done' : 'open',
    })
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
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
    await invalidateFileIndex()
    onFileDeleted?.()
  }

  const handleDelete = async () => {
    if (!filePath) return
    await deleteFile(filePath)
    await invalidateFileIndex()
    onFileDeleted?.()
  }

  const fileLabel = name || filePath?.replace('projects/', '').replace('.md', '') || 'this project'
  const s = STATUS_STYLE[status] || STATUS_STYLE.Untriaged

  const ownerPeople = (wikilinkSuggestions ?? [])
    .filter((sug) => sug?.type === 'person')
    .map((sug) => sug.name)
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
          <textarea
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={handleNameBlur}
            placeholder="Project name"
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
              marginBottom: 10,
              fontFamily: 'inherit',
              resize: 'none',
              overflow: 'hidden',
              lineHeight: 1.25,
              minHeight: '1.25em',
            }}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
          />

          <textarea
            value={coreProblem}
            onChange={(e) => {
              setCoreProblem(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            placeholder="What problem does this solve?"
            rows={1}
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
              resize: 'none',
              overflow: 'hidden',
              lineHeight: 1.5,
              minHeight: '1.5em',
            }}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
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
                textTransform: 'lowercase',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {status}
            </button>

            <OwnerPicker value={owner} onChange={setOwner} people={ownerPeople} />
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
            onUpdateTask={handleUpdateTask}
            onWikilinkClick={handleWikilinkClick}
          />

          {/* ─── CURRENT PLAN ─── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-very-dim)', marginBottom: 10 }}>
              Current Plan
            </div>
            <PlanChecklist
              sectionText={sectionCurrentPlan}
              onChange={handlePlanChange}
              onToggle={handlePlanToggle}
              onDelete={handlePlanDelete}
              onAdd={handlePlanAdd}
              onAddMultiple={handlePlanAddMultiple}
              onRename={handlePlanRename}
            />
          </div>

          <div key={filePath} className="milkdown-wrapper">
            <EditorComponent initialValue={editorBody} onChange={handleBodyChange} onWikilinkClick={handleWikilinkClick} wikilinkSuggestions={wikilinkSuggestions ?? []} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!renameDialog}
        danger={false}
        title="Rename project"
        message={renameDialog ? `Renaming "${renameDialog.oldSlug.replace(/-/g, ' ')}" to "${name}" will rename ${renameDialog.oldSlug}.md → ${renameDialog.newSlug}.md and update all vault references.` : ''}
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onConfirm={executeRename}
        onCancel={cancelRename}
      />
    </div>
  )
}

function OwnerPicker({ value, onChange, people = [] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const q = query.trim().toLowerCase()
  const matches = people.filter((p) => !q || p.toLowerCase().includes(q))
  const hasExactMatch = people.some((p) => p.toLowerCase() === q)

  const choose = (val) => {
    onChange(val)
    setQuery('')
    setOpen(false)
  }

  // Collapsed pill when nothing selected and dropdown closed
  if (!value && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
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
        + Owner
      </button>
    )
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <input
        type="text"
        value={open ? query : value}
        autoFocus={open && !value}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
        onFocus={() => { setQuery(value); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); choose(query.trim()) }
          else if (e.key === 'Escape') { setOpen(false) }
        }}
        placeholder="Owner"
        style={{
          padding: '3px 8px',
          background: 'transparent',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 5,
          fontSize: 12,
          color: 'var(--text-dim)',
          outline: 'none',
          fontFamily: 'inherit',
          minWidth: 60,
          transition: 'border-color .12s',
        }}
      />
      {open && (matches.length > 0 || (q && !hasExactMatch)) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 160,
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            zIndex: 50,
            padding: 4,
          }}
        >
          {matches.map((p) => (
            <button
              key={p}
              onMouseDown={(e) => { e.preventDefault(); choose(p) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '5px 8px',
                background: p === value ? 'var(--panel-2)' : 'transparent',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = p === value ? 'var(--panel-2)' : 'transparent' }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--info)', flexShrink: 0 }} />
              {p}
            </button>
          ))}
          {q && !hasExactMatch && (
            <button
              onMouseDown={(e) => { e.preventDefault(); choose(query.trim()) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '5px 8px',
                background: 'transparent',
                border: 'none',
                borderTop: matches.length > 0 ? '1px solid var(--border-subtle)' : 'none',
                marginTop: matches.length > 0 ? 4 : 0,
                paddingTop: matches.length > 0 ? 8 : 5,
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              + Add “{query.trim()}”
            </button>
          )}
        </div>
      )}
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
