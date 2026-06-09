# Patch 08 (Full) — Tasks Page: 100% Design Coverage
**Replaces:** The previous Patch 08 partial implementation.  
**Source of truth:** `tasks-view.jsx` from handoff v4, translated to React hooks + real vault persistence.  
**Three architectural changes vs the partial patch:**
1. **Toggle = mark done** — updates `status: 'done'` in `tasks-index.json`, task stays in index and moves to Done section. Does NOT permanently resolve.
2. **Remove all = permanent resolve** — Done section "Remove all" calls `resolveTask`, removes from index, logs to `archive/tasks.md`.
3. **Comments persisted** — stored as `comments: [{id, text, ts}]` on the task entry in `tasks-index.json`.

---

## Pre-flight reads

1. `src/lib/taskResolver.js` — confirm `resolveTask(readFile, writeFile, taskId)` signature.
2. `src/components/Sidebar.jsx` — find where ARCHIVE section files are filtered. You will add `f.name !== 'tasks.md'` to hide the done log.
3. `src/App.jsx` — confirm how TasksPage is rendered and what props it receives.

---

## Step 1 — New lib function: markTaskDone

Create `src/lib/taskMarker.js`:

```js
// src/lib/taskMarker.js
// Marks a task as done in tasks-index.json WITHOUT removing it.
// The task stays in the index with status:'done' so it shows in the Done section.
// Permanent removal happens later via resolveTask (Remove all button).

const INDEX_PATH = 'context/tasks-index.json'

export async function markTaskDone(readFile, writeFile, taskId) {
  let entries = []
  try { entries = JSON.parse(await readFile(INDEX_PATH)) } catch { return }
  const updated = entries.map(e => e.id === taskId ? { ...e, status: 'done' } : e)
  await writeFile(INDEX_PATH, JSON.stringify(updated, null, 2))
}

export async function markTaskOpen(readFile, writeFile, taskId) {
  let entries = []
  try { entries = JSON.parse(await readFile(INDEX_PATH)) } catch { return }
  const updated = entries.map(e => e.id === taskId ? { ...e, status: 'open' } : e)
  await writeFile(INDEX_PATH, JSON.stringify(updated, null, 2))
}

export async function addTaskComment(readFile, writeFile, taskId, text) {
  let entries = []
  try { entries = JSON.parse(await readFile(INDEX_PATH)) } catch { return }
  const comment = { id: 'c-' + Date.now(), text, ts: new Date().toISOString() }
  const updated = entries.map(e =>
    e.id === taskId ? { ...e, comments: [...(e.comments || []), comment] } : e
  )
  await writeFile(INDEX_PATH, JSON.stringify(updated, null, 2))
}
```

---

## Step 2 — Sidebar: hide tasks.md from ARCHIVE section

Open `src/components/Sidebar.jsx`. Find where the ARCHIVE section files are mapped (the `filesFor('archive')` call or equivalent). Add a filter to exclude `tasks.md`:

```js
// In the files filter for archive section:
.filter(f =>
  !f.name.startsWith('.') &&
  !f.name.startsWith('_moved') &&
  f.name !== 'tasks.md'          // ← add this — done tasks shown in TasksPage, not sidebar
)
```

---

## Step 3 — Full TasksPage replacement

Replace `src/core/TasksPage.jsx` in full:

```jsx
// src/core/TasksPage.jsx
// 100% design coverage from tasks-view.jsx (handoff v4).
// Toggle = markTaskDone (task stays in Done section).
// Remove all = resolveTask (permanent, logs to archive/tasks.md).
// Comments stored in tasks-index.json.
// Drag-and-drop reordering within and between categories.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { resolveTask } from '../lib/taskResolver'
import { markTaskDone, markTaskOpen, addTaskComment } from '../lib/taskMarker'
import { appendToSection } from '../lib/vaultWriter'

// ── Constants ─────────────────────────────────────────────────────────────────

const TASK_CATEGORIES = [
  { id: 'needs-call', label: 'Needs Your Call', hue: 25,  description: 'blockers and decisions waiting on you' },
  { id: 'actions',    label: 'Actions',         hue: 150, description: 'work to do yourself' },
  { id: 'delegate',   label: 'Delegate',        hue: 230, description: 'to hand off to someone else' },
  { id: 'decisions',  label: 'Decisions',       hue: 80,  description: 'calls to make, options to weigh' },
  { id: 'done',       label: 'Done',            hue: 260, description: 'completed tasks', isDone: true },
]

const SECTION_TO_CATEGORY = {
  '## Open Actions': 'actions',
  '## Delegations':  'delegate',
  '## Delegate':     'delegate',
  '## Decisions':    'decisions',
  '## Talk About':   'actions',
}

const CATEGORY_TO_SECTION = {
  'actions':    '## Open Actions',
  'delegate':   '## Delegate',
  'decisions':  '## Decisions',
  'needs-call': '## Open Actions',
}

function indexEntryToTask(e) {
  return {
    id:       e.id,
    text:     e.title,
    project:  e.file?.split('/').pop().replace('.md', '') ?? '—',
    file:     e.file,
    category: e.status === 'done' ? 'done' : (SECTION_TO_CATEGORY[e.section] ?? 'actions'),
    created:  new Date(e.last_updated ?? Date.now()),
    done:     e.status === 'done',
    comments: (e.comments || []).map(c => ({ ...c, ts: new Date(c.ts) })),
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TasksPage({ readFile, writeFile, fileExists }) {
  const [tasks,         setTasks]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [adding,        setAdding]        = useState(false)
  const [draft,         setDraft]         = useState('')
  const [draftProject,  setDraftProject]  = useState('')
  const [draftCategory, setDraftCategory] = useState('actions')

  const [expandedComments, setExpandedComments] = useState(() => new Set())
  const [dragId,       setDragId]       = useState(null)
  const [overId,       setOverId]       = useState(null)
  const [overEmptyCat, setOverEmptyCat] = useState(null)

  const inputRef = useRef(null)

  useEffect(() => { loadTasks() }, [])
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const raw     = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw)
      const loaded  = entries.map(indexEntryToTask)
      setTasks(loaded)
      // Auto-expand tasks that have comments
      setExpandedComments(new Set(loaded.filter(t => t.comments.length > 0).map(t => t.id)))
    } catch { setTasks([]) }
    setLoading(false)
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  const setCommentsExpanded = useCallback((id, open) =>
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (open) next.add(id); else next.delete(id)
      return next
    }), [])

  const tasksWithComments = useMemo(() => tasks.filter(t => t.comments.length > 0), [tasks])
  const anyExpanded = tasksWithComments.some(t => expandedComments.has(t.id))

  const handleAddComment = useCallback(async (taskId, text) => {
    const comment = { id: 'c-' + Date.now(), text, ts: new Date() }
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t
    ))
    setCommentsExpanded(taskId, true)
    try { await addTaskComment(readFile, writeFile, taskId, text) } catch {}
  }, [readFile, writeFile, setCommentsExpanded])

  // ── Toggle done ────────────────────────────────────────────────────────────

  const toggle = useCallback(async (id) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const nowDone = !task.done
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, done: nowDone, category: nowDone ? 'done' : (SECTION_TO_CATEGORY[t.section ?? ''] ?? 'actions') } : t
    ))
    try {
      if (nowDone) await markTaskDone(readFile, writeFile, id)
      else         await markTaskOpen(readFile, writeFile, id)
    } catch (err) {
      console.error('Toggle failed:', err.message)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: task.done, category: task.category } : t))
    }
  }, [tasks, readFile, writeFile])

  // ── Add task ───────────────────────────────────────────────────────────────

  const addTask = useCallback(async () => {
    const text = draft.trim()
    if (!text) { setAdding(false); return }

    const today    = new Date().toISOString().slice(0, 10)
    const newId    = crypto.randomUUID()
    const section  = CATEGORY_TO_SECTION[draftCategory] ?? '## Open Actions'
    const projSlug = draftProject.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const projFile = projSlug ? `projects/${projSlug}.md` : null

    const newEntry = {
      id: newId, file: projFile ?? 'context/tasks-index.json',
      module: 'projects', title: text, section,
      status: 'open', tags: [], last_updated: today, comments: [],
    }

    setTasks(prev => [indexEntryToTask(newEntry), ...prev])
    setDraft(''); setDraftProject(''); setAdding(false)

    try {
      let entries = []
      try { entries = JSON.parse(await readFile('context/tasks-index.json')) } catch {}
      entries.unshift(newEntry)
      await writeFile('context/tasks-index.json', JSON.stringify(entries, null, 2))
      if (projFile && fileExists) {
        const exists = await fileExists(projFile)
        if (exists) await appendToSection(readFile, writeFile, projFile, section, `- [ ] ${text}`)
      }
    } catch (err) { console.error('Add task failed:', err.message) }
  }, [draft, draftProject, draftCategory, readFile, writeFile, fileExists])

  // ── Remove all done ────────────────────────────────────────────────────────

  const removeAllDone = useCallback(async (ids) => {
    setTasks(prev => prev.filter(t => !ids.includes(t.id)))
    for (const id of ids) {
      try { await resolveTask(readFile, writeFile, id) } catch {}
    }
  }, [readFile, writeFile])

  // ── Drag and drop ──────────────────────────────────────────────────────────

  const moveTask = useCallback((fromId, toCategory, toBeforeId) => {
    setTasks(arr => {
      const fromIdx = arr.findIndex(t => t.id === fromId)
      if (fromIdx < 0) return arr
      const moved   = { ...arr[fromIdx], category: toCategory }
      const without = arr.filter(t => t.id !== fromId)
      if (toBeforeId == null) {
        let insertAt = without.length
        for (let i = without.length - 1; i >= 0; i--) {
          if (without[i].category === toCategory) { insertAt = i + 1; break }
        }
        without.splice(insertAt, 0, moved)
      } else {
        const toIdx = without.findIndex(t => t.id === toBeforeId)
        without.splice(toIdx < 0 ? without.length : toIdx, 0, moved)
      }
      return without
    })
  }, [])

  const dragHandlersFor = useCallback((id, catId) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', id) } catch {}
    },
    onDragEnter: (e) => {
      e.preventDefault()
      if (id !== dragId) { setOverId(id); setOverEmptyCat(null) }
    },
    onDragOver:  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) { setDragId(null); setOverId(null); return }
      moveTask(dragId, catId, id)
      setDragId(null); setOverId(null); setOverEmptyCat(null)
    },
    onDragEnd: () => { setDragId(null); setOverId(null); setOverEmptyCat(null) },
  }), [dragId, moveTask])

  // ── Group by category ──────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
          {tasksWithComments.length > 0 && (
            <ToggleCommentsButton
              anyOpen={anyExpanded}
              count={tasksWithComments.length}
              onClick={anyExpanded
                ? () => setExpandedComments(new Set())
                : () => setExpandedComments(new Set(tasksWithComments.map(t => t.id)))
              }
            />
          )}
          {doneInSection > 0 && (
            <ClearDoneButton
              count={doneInSection}
              onClick={() => setTasks(prev => {
                const ids = prev.filter(t => t.done && t.category !== 'done').map(t => t.id)
                return prev.map(t => ids.includes(t.id) ? { ...t, category: 'done' } : t)
              })}
            />
          )}
          <AddTaskButton onClick={() => setAdding(true)} />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 48px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>

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

        {TASK_CATEGORIES.map(cat => {
          const items        = byCategory.get(cat.id) || []
          const showDropZone = overEmptyCat === cat.id && items.every(t => t.id !== dragId)
          if (cat.isDone && items.length === 0) return null

          return (
            <CategorySection
              key={cat.id}
              category={cat}
              count={items.length}
              right={cat.isDone && items.length > 0
                ? <RemoveAllDoneButton onClick={() => removeAllDone(items.map(t => t.id))} />
                : null
              }
              onDragEnter={e => { e.preventDefault(); setOverEmptyCat(cat.id); setOverId(null) }}
              onDragOver={e  => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={e => {
                e.preventDefault()
                if (!dragId) return
                moveTask(dragId, cat.id, null)
                setDragId(null); setOverId(null); setOverEmptyCat(null)
              }}
            >
              {items.length === 0 && !showDropZone && !cat.isDone && (
                <EmptyHint hue={cat.hue} text={`Drag tasks here · ${cat.description}`} />
              )}
              {showDropZone && <DropPlaceholder hue={cat.hue} />}
              {items.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  category={cat}
                  onToggle={() => toggle(t.id)}
                  onUpdate={patch => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x))}
                  onAddComment={text => handleAddComment(t.id, text)}
                  commentsOpen={expandedComments.has(t.id)}
                  onSetCommentsOpen={open => setCommentsExpanded(t.id, open)}
                  onDelete={() => {
                    setTasks(prev => prev.filter(x => x.id !== t.id))
                    resolveTask(readFile, writeFile, t.id).catch(() => {})
                  }}
                  isDragging={dragId === t.id}
                  isOver={overId === t.id}
                  dragHandlers={dragHandlersFor(t.id, cat.id)}
                />
              ))}
            </CategorySection>
          )
        })}

        {tasks.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-very-dim)', fontSize: 13 }}>
            No tasks yet — process an inbox note or click Add task above.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Header buttons ────────────────────────────────────────────────────────────

function AddTaskButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: hov ? 'oklch(0.80 0.13 80 / 0.22)' : 'oklch(0.80 0.13 80 / 0.12)', color: 'oklch(0.88 0.13 80)', border: `1px solid ${hov ? 'oklch(0.80 0.13 80 / 0.55)' : 'oklch(0.80 0.13 80 / 0.36)'}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s, border-color .15s' }}>
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
      Add task
    </button>
  )
}

function ClearDoneButton({ count, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title="Move all done tasks into the Done section"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: hov ? 'var(--panel-2)' : 'var(--panel)', color: hov ? 'var(--text)' : 'var(--text-dim)', border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s, border-color .15s, color .15s' }}>
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3.5 3.5L13 5"/></svg>
      Clear done
      <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 4, background: 'var(--panel-2)', color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
    </button>
  )
}

function RemoveAllDoneButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', background: hov ? 'oklch(0.70 0.18 22 / 0.16)' : 'transparent', color: hov ? 'oklch(0.84 0.16 22)' : 'var(--text-very-dim)', border: `1px solid ${hov ? 'oklch(0.70 0.18 22 / 0.40)' : 'var(--border-subtle)'}`, borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s, border-color .15s, color .15s' }}>
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5h10"/><path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5"/><path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5"/></svg>
      Remove all
    </button>
  )
}

function ToggleCommentsButton({ anyOpen, count, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={anyOpen ? 'Collapse all comments' : 'Expand all comments'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: hov ? 'var(--panel-2)' : 'var(--panel)', color: hov ? 'var(--text)' : 'var(--text-dim)', border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s, border-color .15s, color .15s' }}>
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H6L3 13v-2.5h-.5z"/>
        {anyOpen ? <path d="M5.5 7h5"/> : <><path d="M8 5v4"/><path d="M5.5 7h5"/></>}
      </svg>
      {anyOpen ? 'Collapse comments' : 'Expand comments'}
      <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 4, background: 'var(--panel-2)', color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
    </button>
  )
}

// ── Draft row ─────────────────────────────────────────────────────────────────

function DraftRow({ draft, setDraft, project, setProject, category, setCategory, inputRef, onCommit, onCancel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--panel-2)', border: '1px solid var(--accent)', borderRadius: 10 }}>
      <span style={{ width: 18, height: 18, border: '1.5px dashed var(--border-strong)', borderRadius: 5, flexShrink: 0 }} />
      <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        placeholder="What needs doing?"
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit' }} />
      <CategorySelect value={category} onChange={setCategory} />
      <input value={project} onChange={e => setProject(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        placeholder="project (optional)"
        style={{ width: 160, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-dim)', fontSize: 12, fontFamily: 'inherit', textAlign: 'right' }} />
      <button onClick={onCommit} style={{ padding: '5px 12px', background: 'var(--accent)', color: '#1a1408', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
      <button onClick={onCancel} style={{ padding: '5px 10px', background: 'transparent', color: 'var(--text-very-dim)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
    </div>
  )
}

// ── Category select ───────────────────────────────────────────────────────────

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
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'var(--panel)', color: 'var(--text)', border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .12s' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${current.hue})` }} />
        {current.label}
        <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M1 3 L5 7 L9 3 Z"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, minWidth: 180, padding: 4, background: 'var(--panel-pop)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)' }}>
          {TASK_CATEGORIES.filter(c => !c.isDone).map(c => (
            <div key={c.id} onClick={e => { e.stopPropagation(); onChange(c.id); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: c.id === value ? 'var(--text)' : 'var(--text-dim)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({ category, count, children, right, onDragEnter, onDragOver, onDrop }) {
  return (
    <section onDragEnter={onDragEnter} onDragOver={onDragOver} onDrop={onDrop}>
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

function EmptyHint({ hue, text }) {
  return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-very-dim)', fontStyle: 'italic', fontSize: 12.5 }}>{text}</div>
}

function DropPlaceholder({ hue }) {
  return (
    <div style={{ margin: 10, padding: 14, border: `1.5px dashed oklch(0.78 0.16 ${hue} / 0.6)`, background: `oklch(0.78 0.16 ${hue} / 0.07)`, borderRadius: 8, textAlign: 'center', fontSize: 12, color: `oklch(0.84 0.14 ${hue})` }}>
      Drop here
    </div>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, category, onToggle, onUpdate, onAddComment, commentsOpen, onSetCommentsOpen, onDelete, isDragging, isOver, dragHandlers }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos,  setMenuPos]  = useState({ top: 0, left: 0 })
  const [hov,      setHov]      = useState(false)
  const [draft,    setDraft]    = useState('')
  const menuBtnRef    = useRef(null)
  const menuRef       = useRef(null)
  const commentInputRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close        = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    const closeOnScroll = () => setMenuOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', closeOnScroll)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', closeOnScroll)
    }
  }, [menuOpen])

  const openMenu = () => {
    const r = menuBtnRef.current?.getBoundingClientRect()
    if (r) setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 150) })
    setMenuOpen(true)
  }

  const openComments = () => {
    onSetCommentsOpen(true)
    setMenuOpen(false)
    setTimeout(() => commentInputRef.current?.focus(), 50)
  }

  const submitComment = () => {
    const text = draft.trim()
    if (!text) return
    onAddComment(text)
    setDraft('')
  }

  const daysAgo = Math.round((Date.now() - task.created) / 86_400_000)
  const ageLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1d' : `${daysAgo}d`

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
      {/* Main row */}
      <div
        {...dragHandlers}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: isOver ? `oklch(0.78 0.14 ${category.hue} / 0.10)` : (hov ? 'var(--panel-2)' : 'transparent'),
          opacity: isDragging ? 0.4 : 1,
          borderTop: isOver ? `2px solid oklch(0.78 0.16 ${category.hue})` : '2px solid transparent',
          cursor: 'grab', transition: 'background .12s',
        }}
      >
        {/* Drag handle */}
        <span style={{ color: 'var(--text-very-dim)', display: 'inline-flex', opacity: hov ? 1 : 0.3, transition: 'opacity .12s', flexShrink: 0 }}>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
            <circle cx="4.5" cy="4" r="1.1"/><circle cx="4.5" cy="7" r="1.1"/><circle cx="4.5" cy="10" r="1.1"/>
            <circle cx="9.5" cy="4" r="1.1"/><circle cx="9.5" cy="7" r="1.1"/><circle cx="9.5" cy="10" r="1.1"/>
          </svg>
        </span>

        {/* Checkbox */}
        <button onClick={e => { e.stopPropagation(); onToggle() }}
          style={{ width: 18, height: 18, flexShrink: 0, border: `1.5px solid ${task.done ? 'var(--success)' : 'var(--border-strong)'}`, borderRadius: 5, background: task.done ? 'var(--success)' : 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)' }}>
          {task.done && <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3.5 3.5L13 5"/></svg>}
        </button>

        {/* Text */}
        <span style={{ flex: 1, fontSize: 13.5, minWidth: 0, color: task.done ? 'var(--text-very-dim)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>
          <EditableField value={task.text} onCommit={v => onUpdate({ text: v })} placeholder="Untitled task" inputStyle={{ fontSize: 13.5, width: '100%' }} />
        </span>

        {/* Comment count pill */}
        {task.comments.length > 0 && (
          <button onClick={e => { e.stopPropagation(); onSetCommentsOpen(!commentsOpen) }}
            title={`${task.comments.length} comment${task.comments.length === 1 ? '' : 's'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: commentsOpen ? 'var(--panel-2)' : 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 999, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H6L3 13v-2.5h-.5z"/></svg>
            {task.comments.length}
          </button>
        )}

        {/* Project name */}
        <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <EditableField value={task.project === '—' ? '' : task.project} onCommit={v => onUpdate({ project: v || '—' })} placeholder="—" width={140} textStyle={{ display: 'inline-block' }} inputStyle={{ fontSize: 11.5, textAlign: 'right' }} />
        </span>

        {/* Age */}
        <span style={{ fontSize: 11, color: 'var(--text-very-dim)', flexShrink: 0 }}>{ageLabel}</span>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button ref={menuBtnRef} onClick={e => { e.stopPropagation(); openMenu() }}
            style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: menuOpen ? 'var(--border)' : 'transparent', color: 'var(--text-dim)', borderRadius: 5, cursor: 'pointer', padding: 0, opacity: (hov || menuOpen) ? 1 : 0.3, transition: 'opacity .12s, background .12s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.background = 'var(--border)' }}
            onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/>
            </svg>
          </button>
          {menuOpen && createPortal(
            <div style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 200, minWidth: 150, padding: 4, background: 'var(--panel-pop)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)' }}>
              <TaskMenuItem label="Comment" onClick={openComments} />
              <TaskMenuItem label="Remove" danger onClick={() => { setMenuOpen(false); onDelete() }} />
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Comment thread */}
      {commentsOpen && (
        <div style={{ padding: '4px 16px 14px 48px', background: 'var(--bg-sidebar)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 4px' }}>
            <span style={{ fontSize: 10.5, letterSpacing: '0.14em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-very-dim)' }}>
              Comments{task.comments.length > 0 && ` · ${task.comments.length}`}
            </span>
            <button onClick={() => onSetCommentsOpen(false)}
              style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-very-dim)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, fontFamily: 'inherit', transition: 'background .12s, color .12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-very-dim)' }}>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>
            </button>
          </div>
          {task.comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', background: 'var(--panel-2)', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>You</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{c.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-very-dim)', marginTop: 2 }}>
                  {(c.ts instanceof Date ? c.ts : new Date(c.ts)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: task.comments.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
            <input ref={commentInputRef} value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitComment(); if (e.key === 'Escape') { setDraft(''); onSetCommentsOpen(false) } }}
              placeholder="Write a comment…"
              style={{ flex: 1, padding: '7px 10px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={() => { setDraft(''); onSetCommentsOpen(false) }}
              style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-very-dim)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text-dim)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-very-dim)' }}>
              Cancel
            </button>
            <button onClick={submitComment} disabled={!draft.trim()}
              style={{ padding: '6px 12px', background: draft.trim() ? 'var(--accent)' : 'var(--panel-2)', color: draft.trim() ? '#1a1408' : 'var(--text-very-dim)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: draft.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskMenuItem({ label, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, fontSize: 12.5, cursor: 'pointer', color: danger ? (hov ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)') : (hov ? 'var(--text)' : 'var(--text-dim)'), background: danger ? (hov ? 'oklch(0.70 0.18 22 / 0.12)' : 'transparent') : (hov ? 'var(--panel-2)' : 'transparent') }}>
      {label}
    </div>
  )
}

// ── EditableField — double-click to edit ──────────────────────────────────────

function EditableField({ value, onCommit, placeholder, textStyle, inputStyle, width }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const ref = useRef(null)

  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])
  useEffect(() => { setDraft(value) }, [value])

  const commit = () => {
    const t = draft.trim()
    if (t && t !== value) onCommit(t)
    setEditing(false)
  }

  if (editing) return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      onBlur={commit}
      onClick={e => e.stopPropagation()}
      onDragStart={e => e.preventDefault()}
      style={{ width: width || 'auto', padding: '2px 6px', margin: '-3px -7px', background: 'var(--panel)', border: '1px solid var(--accent)', borderRadius: 4, outline: 'none', color: 'var(--text)', fontFamily: 'inherit', ...(inputStyle || {}) }} />
  )

  return (
    <span onDoubleClick={e => { e.stopPropagation(); setEditing(true) }} title="Double-click to edit"
      style={{ cursor: 'text', borderRadius: 3, ...(textStyle || {}) }}>
      {value || <span style={{ color: 'var(--text-very-dim)' }}>{placeholder}</span>}
    </span>
  )
}
```

---

## Step 4 — App.jsx: pass fileExists to TasksPage

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

## Step 5 — EntitySelector: smart project/person/idea picker

This replaces the free-text project input in DraftRow with a searchable entity selector. Respects enabled modules from settings.

### 5a — Add listTree + settings props to TasksPage

Update the component signature and App.jsx wiring:

```jsx
// TasksPage — add to props:
export default function TasksPage({ readFile, writeFile, fileExists, listTree, settings }) {
```

In `src/App.jsx`, pass the new props:
```jsx
{page === 'tasks' && (
  <TasksPage
    readFile={readFile}
    writeFile={writeFile}
    fileExists={fileExists}
    listTree={listTree}
    settings={settings}
  />
)}
```

Also pass `listTree` and `settings` through to DraftRow:
```jsx
// In the DraftRow JSX inside TasksPage:
<DraftRow
  ...existing props...
  listTree={listTree}
  enabledModules={settings?.enabledModules}
/>
```

### 5b — Update DraftRow: replace text input with EntitySelector

Find the `<input placeholder="project (optional)"...>` in `DraftRow`. Replace it entirely with `EntitySelector`, and change `draftProject` state from a string to a file path or null:

In TasksPage state declarations, change:
```js
const [draftProject, setDraftProject] = useState('')
// → becomes:
const [draftEntityPath, setDraftEntityPath] = useState(null) // e.g. "projects/ia-framework.md"
```

In `addTask`, update to use the entity path directly:
```js
// REPLACE:
const projSlug = draftProject.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
const projFile = projSlug ? `projects/${projSlug}.md` : null

// WITH:
const projFile = draftEntityPath ?? null
```

In `addTask` cleanup after commit:
```js
setDraftEntityPath(null)  // was: setDraftProject('')
```

In DraftRow, replace the text input:
```jsx
// REMOVE:
<input value={project} ... placeholder="project (optional)" ... />

// ADD:
<EntitySelector
  value={entityPath}
  onChange={setEntityPath}
  listTree={listTree}
  enabledModules={enabledModules}
/>
```

Update DraftRow props accordingly:
```jsx
function DraftRow({ draft, setDraft, entityPath, setEntityPath, category, setCategory,
                    inputRef, onCommit, onCancel, listTree, enabledModules }) {
```

### 5c — Add EntitySelector + TypeDot components

Add these after the `CategorySelect` component in `TasksPage.jsx`:

```jsx
// ── EntitySelector ────────────────────────────────────────────────────────────

function EntitySelector({ value, onChange, listTree, enabledModules }) {
  const [open,     setOpen]     = useState(false)
  const [search,   setSearch]   = useState('')
  const [entities, setEntities] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    if (!open || !listTree) return
    const load = async () => {
      try {
        const tree    = await listTree()
        const enabled = enabledModules ?? { projects: true, people: true, ideas: true }
        const result  = []
        const folders = [
          { key: 'projects' },
          { key: 'people'   },
          { key: 'ideas'    },
        ]
        for (const { key } of folders) {
          if (enabled[key] === false) continue
          const files = tree[key] || []
          for (const f of files) {
            if (!f.name.endsWith('.md') || f.name.startsWith('_') || f.name.startsWith('.')) continue
            result.push({ name: f.name.replace('.md', ''), path: `${key}/${f.name}`, type: key })
          }
        }
        setEntities(result)
      } catch {}
    }
    load()
  }, [open, listTree, enabledModules])

  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const filtered  = entities.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
  const grouped   = ['projects', 'people', 'ideas']
    .map(type => ({ type, label: type.charAt(0).toUpperCase() + type.slice(1), items: filtered.filter(e => e.type === type) }))
    .filter(g => g.items.length > 0)

  const current     = value ? entities.find(e => e.path === value) : null
  const displayName = current?.name ?? (value ? value.split('/').pop().replace('.md', '') : null)
  const anyModules  = Object.values(enabledModules ?? {}).some(Boolean)

  if (!anyModules) return null  // all modules off — hide the field

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); setSearch('') }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'transparent', border: 'none', outline: 'none',
          color: displayName ? 'var(--text-dim)' : 'var(--text-very-dim)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          padding: '2px 4px', borderRadius: 4,
          transition: 'color .12s',
        }}
      >
        {current && <TypeDot type={current.type} />}
        {displayName || 'link entity…'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
          width: 220, padding: 4,
          background: 'var(--panel-pop)', border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
        }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
            placeholder="Search…"
            style={{
              width: '100%', padding: '7px 10px', background: 'var(--panel)',
              border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box', marginBottom: 4,
            }}
          />
          {value && (
            <div
              onClick={() => { onChange(null); setOpen(false) }}
              style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-very-dim)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ✕  Clear link
            </div>
          )}
          {grouped.length === 0 && (
            <div style={{ padding: 10, textAlign: 'center', color: 'var(--text-very-dim)', fontSize: 12 }}>
              {entities.length === 0 ? 'No entities yet' : 'No match'}
            </div>
          )}
          {grouped.map(g => (
            <div key={g.type}>
              <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-very-dim)' }}>
                {g.label}
              </div>
              {g.items.map(item => (
                <div
                  key={item.path}
                  onClick={() => { onChange(item.path); setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: item.path === value ? 'var(--text)' : 'var(--text-dim)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
                  onMouseLeave={e => { if (item.path !== value) e.currentTarget.style.background = 'transparent' }}
                >
                  <TypeDot type={item.type} />
                  {item.name}
                  {item.path === value && <span style={{ marginLeft: 'auto', color: 'var(--text-very-dim)' }}>✓</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TypeDot — coloured dot indicating entity type ─────────────────────────────

function TypeDot({ type }) {
  const color = type === 'projects' ? 'var(--success)'
              : type === 'people'   ? 'var(--info)'
              : type === 'ideas'    ? 'var(--accent)'
              : 'var(--text-very-dim)'
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
}
```

### 5d — Update TaskRow project display with TypeDot

In the TaskRow, find the project name span. Add a TypeDot before the name, derived from the `file` path:

```jsx
{/* Project name with type dot */}
{task.file && task.file !== 'context/tasks-index.json' && (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-very-dim)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
    <TypeDot type={task.file.split('/')[0]} />
    {task.project}
  </span>
)}
```

Replace the existing project `<span>` with this version.

---

## Build check

1. `bun run build` — passes
2. **Tasks load from index** — existing tasks appear grouped by category with correct dots
3. **Toggle** — tick → green checkbox, strikethrough, stays in Done section. Untick → moves back
4. **Clear done** — sweeps ticked tasks to Done section
5. **Remove all** — permanently resolves from index
6. **ToggleCommentsButton** — appears only when tasks have comments
7. **Add task → entity selector** — DraftRow shows "link entity…" button. Click → dropdown grouped by Projects / People / Ideas (only enabled modules). Type to filter. Select → colored TypeDot + name appears. Click ✕ Clear to unlink.
8. **All modules off** — entity selector hidden entirely from DraftRow
9. **TypeDot on task rows** — green dot for project tasks, blue for person tasks, amber for ideas
10. **Drag and drop** — drag handle → reorder within section → drop on section header changes category
11. **Double-click to edit** — task text and project name both inline-editable
12. **Comments** — 3-dot → Comment → thread opens → Post persists to index
13. **ToggleComments** — expand/collapse all threads at once
14. **tasks.md hidden** — not visible in sidebar ARCHIVE section
15. **Needs Your Call** — renders, accepts drops, empty hint visible

