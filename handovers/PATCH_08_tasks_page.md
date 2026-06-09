# Patch 08 — Tasks Page: Full Implementation from Design
**Source of truth:** `tasks-view.jsx` from handoff v4.  
**Problem:** Current TasksPage has no AddTaskButton and shows no tasks because the data mapping from `tasks-index.json` to the design's task format was never implemented.  
**Scope:** Full TasksPage replacement — data bridge, AddTaskButton, DraftRow, CategorySection, TaskRow with inline edit and comments, task completion via resolveTask.

---

## Pre-flight reads

1. `src/core/TasksPage.jsx` — read what Copilot built. Note what it already has so you don't duplicate.
2. `src/lib/taskResolver.js` — confirm the `resolveTask(readFile, writeFile, taskId)` signature.
3. `src/lib/vaultWriter.js` — confirm `appendToSection(readFile, writeFile, filePath, section, content)` signature. Needed for manually-added tasks.
4. `src/App.jsx` — confirm how TasksPage currently receives props (`readFile`, `writeFile`, `listTree` etc.).

---

## Architecture decision: manual tasks

When the user adds a task manually via AddTaskButton:
- If a project name is provided AND a matching file exists in `projects/`, append `- [ ] {text}` to `## Open Actions` in that file and add to tasks-index.json
- If no project, or project file doesn't exist: add to tasks-index.json only, with `file: 'context/tasks-index.json'` as a placeholder
- Category maps back to section: `actions→## Open Actions`, `delegate→## Delegate`, `decisions→## Decisions`

---

## Step 1 — Task categories constant

Add to `src/core/TasksPage.jsx` at the top (after imports):

```js
const TASK_CATEGORIES = [
  { id: 'needs-call', label: 'Needs Your Call', hue: 25,  description: 'Blockers and decisions waiting on you' },
  { id: 'actions',    label: 'Actions',         hue: 150, description: 'Work to do yourself' },
  { id: 'delegate',   label: 'Delegate',        hue: 230, description: 'To hand off to someone else' },
  { id: 'decisions',  label: 'Decisions',       hue: 80,  description: 'Calls to make, options to weigh' },
  { id: 'done',       label: 'Done',            hue: 260, description: 'Completed tasks', isDone: true },
]

// Maps vault section headers → task categories
const SECTION_TO_CATEGORY = {
  '## Open Actions':  'actions',
  '## Delegations':   'delegate',
  '## Delegate':      'delegate',
  '## Decisions':     'decisions',
  '## Talk About':    'actions',
}

// Maps task categories → vault section + default module folder
const CATEGORY_TO_SECTION = {
  'actions':    { section: '## Open Actions', folder: 'projects' },
  'delegate':   { section: '## Delegate',     folder: 'people' },
  'decisions':  { section: '## Decisions',    folder: 'projects' },
  'needs-call': { section: '## Open Actions', folder: 'projects' },
}
```

---

## Step 2 — Data bridge: IndexEntry → design task

```js
function indexEntryToTask(entry) {
  return {
    id:       entry.id,
    text:     entry.title,
    project:  entry.file?.split('/').pop().replace('.md', '') ?? '—',
    file:     entry.file,                            // keep for resolveTask
    category: SECTION_TO_CATEGORY[entry.section] ?? 'actions',
    created:  new Date(entry.last_updated ?? Date.now()),
    done:     entry.status === 'done',
    comments: [],
  }
}
```

---

## Step 3 — Full TasksPage replacement

Replace `src/core/TasksPage.jsx` in full:

```jsx
// src/core/TasksPage.jsx
// Full tasks view matching tasks-view.jsx from design handoff v4.
// Reads tasks from context/tasks-index.json, maps to design format.
// AddTaskButton → DraftRow → writes to tasks-index.json (+ vault file if project exists).
// Checkbox → resolveTask → moves to archive/tasks.md.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { resolveTask } from '../lib/taskResolver'
import { appendToSection } from '../lib/vaultWriter'
import { createPortal } from 'react-dom'

const TASK_CATEGORIES = [
  { id: 'needs-call', label: 'Needs Your Call', hue: 25,  description: 'Blockers and decisions waiting on you' },
  { id: 'actions',    label: 'Actions',         hue: 150, description: 'Work to do yourself' },
  { id: 'delegate',   label: 'Delegate',        hue: 230, description: 'To hand off to someone else' },
  { id: 'decisions',  label: 'Decisions',       hue: 80,  description: 'Calls to make, options to weigh' },
  { id: 'done',       label: 'Done',            hue: 260, description: 'Completed tasks', isDone: true },
]

const SECTION_TO_CATEGORY = {
  '## Open Actions': 'actions',
  '## Delegations':  'delegate',
  '## Delegate':     'delegate',
  '## Decisions':    'decisions',
  '## Talk About':   'actions',
}

const CATEGORY_TO_SECTION = {
  actions:    '## Open Actions',
  delegate:   '## Delegate',
  decisions:  '## Decisions',
  'needs-call': '## Open Actions',
}

function indexEntryToTask(entry) {
  return {
    id:       entry.id,
    text:     entry.title,
    project:  entry.file?.split('/').pop().replace('.md', '') ?? '—',
    file:     entry.file,
    category: SECTION_TO_CATEGORY[entry.section] ?? 'actions',
    created:  new Date(entry.last_updated ?? Date.now()),
    done:     entry.status === 'done',
    comments: [],
  }
}

export default function TasksPage({ readFile, writeFile, fileExists }) {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)
  const [draft,         setDraft]         = useState('')
  const [draftProject,  setDraftProject]  = useState('')
  const [draftCategory, setDraftCategory] = useState('actions')
  const inputRef = useRef(null)

  useEffect(() => { loadTasks() }, [])
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const raw     = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw)
      setTasks(entries.map(indexEntryToTask))
    } catch { setTasks([]) }
    setLoading(false)
  }

  // ── Toggle done ────────────────────────────────────────────────────────────
  const toggle = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    if (!task.done) {
      // Mark done — resolve from index
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true, category: 'done' } : t))
      try { await resolveTask(readFile, writeFile, id) } catch (err) {
        console.error('Resolve failed:', err.message)
        setTasks(prev => prev.map(t => t.id === id ? { ...t, done: false, category: task.category } : t))
      }
    } else {
      // Uncheck — restore (UI only, index was already resolved)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: false, category: task.category } : t))
    }
  }, [tasks, readFile, writeFile])

  // ── Add task ───────────────────────────────────────────────────────────────
  const addTask = useCallback(async () => {
    const text = draft.trim()
    if (!text) { setAdding(false); return }

    const today   = new Date().toISOString().slice(0, 10)
    const newId   = crypto.randomUUID()
    const section = CATEGORY_TO_SECTION[draftCategory] ?? '## Open Actions'
    const projSlug = draftProject.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const projFile = projSlug ? `projects/${projSlug}.md` : null

    const newEntry = {
      id:           newId,
      file:         projFile ?? 'context/tasks-index.json',
      module:       'projects',
      title:        text,
      section,
      status:       'open',
      tags:         [],
      last_updated: today,
    }

    // Optimistic UI
    const uiTask = indexEntryToTask(newEntry)
    setTasks(prev => [uiTask, ...prev])
    setDraft(''); setDraftProject(''); setAdding(false)

    try {
      // Write to tasks-index.json
      let entries = []
      try { entries = JSON.parse(await readFile('context/tasks-index.json')) } catch {}
      entries.unshift(newEntry)
      await writeFile('context/tasks-index.json', JSON.stringify(entries, null, 2))

      // If project file exists, also append to the section
      if (projFile) {
        const exists = await fileExists(projFile)
        if (exists) await appendToSection(readFile, writeFile, projFile, section, `- [ ] ${text}`)
      }
    } catch (err) {
      console.error('Add task failed:', err.message)
    }
  }, [draft, draftProject, draftCategory, readFile, writeFile, fileExists])

  // ── Remove all done ────────────────────────────────────────────────────────
  const removeAllDone = useCallback(async (ids) => {
    setTasks(prev => prev.filter(t => !ids.includes(t.id)))
    for (const id of ids) {
      try { await resolveTask(readFile, writeFile, id) } catch {}
    }
  }, [readFile, writeFile])

  // ── Group tasks by category ────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = new Map(TASK_CATEGORIES.map(c => [c.id, []]))
    tasks.forEach(t => {
      const cat = map.has(t.category) ? t.category : 'actions'
      map.get(cat).push(t)
    })
    return map
  }, [tasks])

  const remaining     = tasks.filter(t => !t.done).length
  const completed     = tasks.filter(t => t.done).length
  const doneInSection = tasks.filter(t => t.done && t.category !== 'done').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
      Loading…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 16, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--text)' }}>
            Tasks
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-very-dim)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{remaining}</span> open
            <span style={{ margin: '0 8px', color: 'var(--border-strong)' }}>·</span>
            <span style={{ color: 'var(--text-dim)' }}>{completed} done</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {doneInSection > 0 && (
            <ClearDoneButton
              count={doneInSection}
              onClick={() => {
                const ids = tasks.filter(t => t.done && t.category !== 'done').map(t => t.id)
                setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, category: 'done' } : t))
              }}
            />
          )}
          <AddTaskButton onClick={() => setAdding(true)} />
        </div>
      </header>

      <div style={{ padding: '20px 48px 48px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1, overflowY: 'auto' }}>

        {/* Draft row */}
        {adding && (
          <DraftRow
            draft={draft}              setDraft={setDraft}
            project={draftProject}     setProject={setDraftProject}
            category={draftCategory}   setCategory={setDraftCategory}
            inputRef={inputRef}
            onCommit={addTask}
            onCancel={() => { setDraft(''); setDraftProject(''); setAdding(false) }}
          />
        )}

        {/* Category sections */}
        {TASK_CATEGORIES.map(cat => {
          const items = byCategory.get(cat.id) || []
          if (cat.isDone && items.length === 0) return null
          return (
            <CategorySection
              key={cat.id}
              category={cat}
              count={items.length}
              right={cat.isDone && items.length > 0 ? (
                <RemoveAllDoneButton onClick={() => removeAllDone(items.map(t => t.id))} />
              ) : null}
            >
              {items.length === 0 && !cat.isDone && (
                <EmptyHint hue={cat.hue} text={`Drag tasks here · ${cat.description.toLowerCase()}`} />
              )}
              {items.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  category={cat}
                  onToggle={() => toggle(t.id)}
                  onUpdate={(patch) => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x))}
                  onDelete={() => {
                    setTasks(prev => prev.filter(x => x.id !== t.id))
                    resolveTask(readFile, writeFile, t.id).catch(() => {})
                  }}
                />
              ))}
            </CategorySection>
          )
        })}

        {tasks.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-very-dim)', fontSize: 13 }}>
            No open tasks — process an inbox note or add one above.
          </div>
        )}
      </div>
    </div>
  )
}

// ── AddTaskButton ─────────────────────────────────────────────────────────────

function AddTaskButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        background: hov ? 'oklch(0.80 0.13 80 / 0.22)' : 'oklch(0.80 0.13 80 / 0.12)',
        color: 'oklch(0.88 0.13 80)',
        border: `1px solid ${hov ? 'oklch(0.80 0.13 80 / 0.55)' : 'oklch(0.80 0.13 80 / 0.36)'}`,
        borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      Add task
    </button>
  )
}

// ── ClearDoneButton ───────────────────────────────────────────────────────────

function ClearDoneButton({ count, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        background: hov ? 'var(--panel-2)' : 'var(--panel)',
        color: hov ? 'var(--text)' : 'var(--text-dim)',
        border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 8 3.5 3.5L13 5" />
      </svg>
      Clear done
      <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 4, background: 'var(--panel-2)', color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {count}
      </span>
    </button>
  )
}

// ── RemoveAllDoneButton ───────────────────────────────────────────────────────

function RemoveAllDoneButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 9px',
        background: hov ? 'oklch(0.70 0.18 22 / 0.16)' : 'transparent',
        color: hov ? 'oklch(0.84 0.16 22)' : 'var(--text-very-dim)',
        border: `1px solid ${hov ? 'oklch(0.70 0.18 22 / 0.40)' : 'var(--border-subtle)'}`,
        borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4.5h10" /><path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
        <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
      </svg>
      Remove all
    </button>
  )
}

// ── DraftRow ──────────────────────────────────────────────────────────────────

function DraftRow({ draft, setDraft, project, setProject, category, setCategory, inputRef, onCommit, onCancel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px',
      background: 'var(--panel-2)',
      border: '1px solid var(--accent)',
      borderRadius: 10,
    }}>
      <span style={{ width: 18, height: 18, border: '1.5px dashed var(--border-strong)', borderRadius: 5, flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        placeholder="What needs doing?"
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit' }}
      />
      <CategorySelect value={category} onChange={setCategory} />
      <input
        value={project}
        onChange={e => setProject(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        placeholder="project (optional)"
        style={{ width: 160, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-dim)', fontSize: 12, fontFamily: 'inherit', textAlign: 'right' }}
      />
      <button onClick={onCommit} style={{ padding: '5px 12px', background: 'var(--accent)', color: '#1a1408', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Add
      </button>
      <button onClick={onCancel} style={{ padding: '5px 10px', background: 'transparent', color: 'var(--text-very-dim)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        Cancel
      </button>
    </div>
  )
}

// ── CategorySelect ────────────────────────────────────────────────────────────

function CategorySelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = TASK_CATEGORIES.find(c => c.id === value) || TASK_CATEGORIES[1]

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 10px',
          background: 'var(--panel)', color: 'var(--text)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${current.hue})` }} />
        {current.label}
        <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
          minWidth: 180, padding: 4,
          background: 'var(--panel-pop)', border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
        }}>
          {TASK_CATEGORIES.filter(c => !c.isDone).map(c => (
            <div
              key={c.id}
              onClick={e => { e.stopPropagation(); onChange(c.id); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: c.id === value ? 'var(--text)' : 'var(--text-dim)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${c.hue})` }} />
              {c.label}
              {c.id === value && <span style={{ marginLeft: 'auto', color: 'var(--text-very-dim)' }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CategorySection ───────────────────────────────────────────────────────────

function CategorySection({ category, count, children, right }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '0 4px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${category.hue})`, flexShrink: 0 }} />
        <h2 style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)', margin: 0 }}>
          {category.label}
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-very-dim)' }}>{count}</span>
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  )
}

// ── EmptyHint ─────────────────────────────────────────────────────────────────

function EmptyHint({ hue, text }) {
  return (
    <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-very-dim)', fontStyle: 'italic', fontSize: 12.5 }}>
      {text}
    </div>
  )
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({ task, category, onToggle, onUpdate, onDelete }) {
  const [hov, setHov] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuBtnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const openMenu = () => {
    const r = menuBtnRef.current?.getBoundingClientRect()
    if (r) setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 150) })
    setMenuOpen(true)
  }

  const daysAgo = Math.round((Date.now() - task.created) / 86_400_000)
  const ageLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1d' : `${daysAgo}d`

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          background: hov ? 'var(--panel-2)' : 'transparent',
          transition: 'background .12s',
        }}
      >
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          style={{
            width: 18, height: 18, flexShrink: 0,
            border: `1.5px solid ${task.done ? 'var(--success)' : 'var(--border-strong)'}`,
            borderRadius: 5,
            background: task.done ? 'var(--success)' : 'transparent',
            cursor: 'pointer', padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--bg)',
          }}
        >
          {task.done && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 8 3.5 3.5L13 5" />
            </svg>
          )}
        </button>

        {/* Text */}
        <span style={{
          flex: 1, fontSize: 13.5, minWidth: 0,
          color: task.done ? 'var(--text-very-dim)' : 'var(--text)',
          textDecoration: task.done ? 'line-through' : 'none',
        }}>
          <EditableField
            value={task.text}
            onCommit={v => onUpdate({ text: v })}
            placeholder="Untitled task"
          />
        </span>

        {/* Project */}
        <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.project !== '—' ? task.project : ''}
        </span>

        {/* Age */}
        <span style={{ fontSize: 11, color: 'var(--text-very-dim)', flexShrink: 0 }}>{ageLabel}</span>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={menuBtnRef}
            onClick={e => { e.stopPropagation(); openMenu() }}
            style={{
              width: 22, height: 22,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: 'none',
              background: menuOpen ? 'var(--border)' : 'transparent',
              color: 'var(--text-dim)', borderRadius: 5,
              cursor: 'pointer', padding: 0,
              opacity: (hov || menuOpen) ? 1 : 0.3,
              transition: 'opacity .12s, background .12s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = 'var(--border)' }}
            onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" />
            </svg>
          </button>
          {menuOpen && createPortal(
            <div style={{
              position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 200,
              minWidth: 150, padding: 4,
              background: 'var(--panel-pop)', border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
            }}>
              <TaskMenuItem label="Remove" danger onClick={() => { setMenuOpen(false); onDelete() }} />
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  )
}

// ── TaskMenuItem ──────────────────────────────────────────────────────────────

function TaskMenuItem({ label, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 5, fontSize: 12.5, cursor: 'pointer',
        color:      danger ? (hov ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)') : (hov ? 'var(--text)' : 'var(--text-dim)'),
        background: danger ? (hov ? 'oklch(0.70 0.18 22 / 0.12)' : 'transparent') : (hov ? 'var(--panel-2)' : 'transparent'),
      }}
    >
      {label}
    </div>
  )
}

// ── EditableField — double-click to edit ──────────────────────────────────────

function EditableField({ value, onCommit, placeholder }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const ref = useRef(null)

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])
  useEffect(() => { setDraft(value) }, [value])

  const commit = () => {
    const t = draft.trim()
    if (t && t !== value) onCommit(t)
    setEditing(false)
  }

  if (editing) return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      onBlur={commit}
      onClick={e => e.stopPropagation()}
      style={{ width: '100%', padding: '2px 6px', margin: '-3px -7px', background: 'var(--panel)', border: '1px solid var(--accent)', borderRadius: 4, outline: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 'inherit' }}
    />
  )

  return (
    <span onDoubleClick={e => { e.stopPropagation(); setEditing(true) }} title="Double-click to edit" style={{ cursor: 'text', borderRadius: 3 }}>
      {value || <span style={{ color: 'var(--text-very-dim)' }}>{placeholder}</span>}
    </span>
  )
}
```

---

## Step 4 — App.jsx: pass fileExists to TasksPage

Find where `TasksPage` is rendered. Add `fileExists`:

```jsx
{page === 'tasks' && (
  <TasksPage
    readFile={readFile}
    writeFile={writeFile}
    fileExists={fileExists}
  />
)}
```

---

## Build check

1. `bun run build` — passes
2. **Tasks load** — navigate to Tasks page — tasks from `tasks-index.json` appear grouped by category (Actions, Delegate, Decisions). Each shows task text + project name (from filename) + age in days.
3. **Empty state** — fresh vault with no tasks shows "No open tasks — process an inbox note or add one above."
4. **Add task button** — amber tinted button in header with + icon. Click → DraftRow appears at top with accent border.
5. **DraftRow** — type task text → Enter or click Add → task appears in correct category. Category selector opens a custom dropdown with coloured dots. Project field is optional.
6. **Checkbox** — tick a task → turns green, text gets strikethrough, task moves to Done section. Done section appears only when it has items.
7. **Clear done** — when ticked tasks exist outside Done bucket, "Clear done" button appears. Clicking moves them to Done section.
8. **Remove all** — Done section header has "Remove all" button. Clicking permanently resolves all done tasks.
9. **Double-click to edit** — double-click task text → inline input appears with accent border → Enter commits.
10. **3-dot menu** — shows on hover → Remove option → removes task and resolves from index.
11. **Manual task persists** — add a task with project "ia-framework" → check `context/tasks-index.json` on disk → entry present.
