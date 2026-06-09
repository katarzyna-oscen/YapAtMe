# Handover — Patch B: Entity Viewers Read Tasks from Index
**Files to patch:**
- `src/core/ProjectViewer.jsx`
- `src/core/PersonViewer.jsx`
- **New file:** `src/components/TaskPanel.jsx`

**No changes needed to:** `src/lib/tasksIndex.js`, `src/lib/migrateEntityTasks.js`

---

## Context

Both viewers already read `tasks-index.json` in `loadStats()` to show count badges.
Patch B extends this: instead of only counting, load the full task entries and render
them in a structured panel between the metadata row and the markdown editor.

The markdown body editor is untouched — after Patch A migration it contains only
narrative sections (Summary, Current Plan, Recent Mentions, Notes) plus placeholder
text where task checkboxes used to be. The task panel is the only place tasks are
rendered and interacted with.

---

## Step 1 — Create `src/components/TaskPanel.jsx`

This is a shared component used by both viewers.

```jsx
import { useState } from 'react'

// Section display labels
const SECTION_LABELS = {
  '## Open Actions': 'Open Actions',
  '## Delegations':  'Delegations',
  '## Decisions':    'Decisions',
  '## Delegate':     'Delegate',
  '## Talk About':   'Talk About',
}

function TaskRow({ task, onResolve }) {
  const [resolving, setResolving] = useState(false)

  const handleCheck = async () => {
    if (resolving) return
    setResolving(true)
    await onResolve(task.id)
    // Component will unmount as parent re-renders; no need to reset
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '6px 0',
        opacity: resolving ? 0.4 : 1,
        transition: 'opacity .15s',
      }}
    >
      <button
        onClick={handleCheck}
        disabled={resolving}
        style={{
          flexShrink: 0,
          marginTop: 2,
          width: 16,
          height: 16,
          borderRadius: 4,
          border: '1.5px solid var(--border-strong)',
          background: 'transparent',
          cursor: resolving ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'border-color .12s, background .12s',
        }}
        onMouseEnter={e => {
          if (!resolving) {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.background = 'oklch(var(--accent-l) var(--accent-c) var(--accent-h) / 0.12)'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        {resolving && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 2.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.45, flex: 1 }}>
        {task.title}
      </span>
    </div>
  )
}

/**
 * TaskPanel
 *
 * Props:
 *   tasks      — IndexEntry[] filtered to this file, status === 'open'
 *   sections   — string[]  ordered list of section headers to show
 *                e.g. ['## Open Actions', '## Delegations', '## Decisions']
 *   onResolve  — async (id: string) => void
 */
export default function TaskPanel({ tasks, sections, onResolve }) {
  // Only render sections that have tasks
  const populated = sections.filter(
    section => tasks.some(t => t.section === section)
  )

  if (populated.length === 0) return null

  return (
    <div style={{ marginBottom: 28 }}>
      {populated.map((section, i) => {
        const sectionTasks = tasks.filter(t => t.section === section)
        return (
          <div key={section} style={{ marginBottom: i < populated.length - 1 ? 20 : 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--text-very-dim)',
                marginBottom: 6,
              }}
            >
              {SECTION_LABELS[section] ?? section.replace('## ', '')}
            </div>
            <div
              style={{
                borderLeft: '2px solid var(--border)',
                paddingLeft: 12,
              }}
            >
              {sectionTasks.map(task => (
                <TaskRow key={task.id} task={task} onResolve={onResolve} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Step 2 — Patch `ProjectViewer.jsx`

### 2a — Add import at the top

```js
import TaskPanel from '../components/TaskPanel'
import { readTasksIndex, resolveTaskEntry } from '../lib/tasksIndex'
```

### 2b — Add tasks state alongside existing state declarations

```js
const [tasks, setTasks] = useState([])
```

### 2c — Replace the existing `loadStats` function

The current version reads the index and sets only count state.
Replace it so it also stores the full entries:

```js
const loadStats = async (path) => {
  try {
    const entries = await readTasksIndex(readFile)
    const mine = Array.isArray(entries)
      ? entries.filter(e => e?.file === path && e?.status !== 'done')
      : []

    setTasks(mine)
    setActionsCount(mine.filter(e => e?.section === '## Open Actions').length)
    setDelegateCount(mine.filter(e => e?.section === '## Delegations').length)
  } catch {
    setTasks([])
    setActionsCount(0)
    setDelegateCount(0)
  }
}
```

### 2d — Add resolve handler after `handleDictate`

```js
const handleResolveTask = async (id) => {
  await resolveTaskEntry(readFile, writeFile, id)
  // Refresh counts + task list
  await loadStats(filePath)
}
```

### 2e — Mount TaskPanel in the canvas, between metadata row and editor

Find the metadata row closing `</div>` (the one wrapping the status button, PillInputs,
and count badges) and insert TaskPanel immediately after it, before the `milkdown-wrapper` div:

```jsx
{/* Task panel — renders open tasks from tasks-index.json */}
<TaskPanel
  tasks={tasks}
  sections={['## Open Actions', '## Delegations', '## Decisions']}
  onResolve={handleResolveTask}
/>

<div key={filePath} className="milkdown-wrapper">
  <EditorComponent initialValue={editorBody} onChange={handleBodyChange} />
</div>
```

---

## Step 3 — Patch `PersonViewer.jsx`

### 3a — Add import at the top

```js
import TaskPanel from '../components/TaskPanel'
import { readTasksIndex, resolveTaskEntry } from '../lib/tasksIndex'
```

### 3b — Add tasks state

```js
const [tasks, setTasks] = useState([])
```

### 3c — Replace the existing `loadStats` function

```js
const loadStats = async (path) => {
  try {
    const entries = await readTasksIndex(readFile)
    const mine = Array.isArray(entries)
      ? entries.filter(e => e?.file === path && e?.status !== 'done')
      : []

    setTasks(mine)
    setDelegateCount(mine.filter(e => e?.section === '## Delegate').length)
    setTalkAboutCount(mine.filter(e => e?.section === '## Talk About').length)
  } catch {
    setTasks([])
    setDelegateCount(0)
    setTalkAboutCount(0)
  }
}
```

Note: PersonViewer's `loadStats` currently reads the file directly via `readFile('context/tasks-index.json')`
and parses manually. Replace the entire function body with the version above which uses `readTasksIndex`.

### 3d — Add resolve handler after `handleDictate`

```js
const handleResolveTask = async (id) => {
  await resolveTaskEntry(readFile, writeFile, id)
  await loadStats(filePath)
}
```

### 3e — Mount TaskPanel between metadata row and editor

```jsx
{/* Task panel — renders open tasks from tasks-index.json */}
<TaskPanel
  tasks={tasks}
  sections={['## Delegate', '## Talk About']}
  onResolve={handleResolveTask}
/>

<div key={filePath} className="milkdown-wrapper">
  <EditorComponent initialValue={editorBody} onChange={handleBodyChange} />
</div>
```

---

## Behaviour summary

| Action | Result |
|---|---|
| File opens | `loadStats` reads index, populates `tasks` + count badges |
| TaskPanel renders | Groups open tasks by section, skips empty sections |
| User checks a task | `resolveTaskEntry` removes it from index, `loadStats` refreshes |
| Count badge in metadata row | Stays in sync — driven by same `tasks` state |
| No tasks for this file | TaskPanel renders nothing (`null`) |
| Task sections in markdown body | Show placeholder text (post-migration); editor ignores them |

---

## Validation checklist

- [ ] `src/components/TaskPanel.jsx` created
- [ ] Open a project file with tasks in index — TaskPanel renders above editor
- [ ] Sections with no tasks are hidden; sections with tasks show their label + list
- [ ] Checking a task removes it from the list immediately (optimistic via re-render)
- [ ] Count badge in metadata row decrements when task is resolved
- [ ] Open a project file with no tasks — TaskPanel renders nothing, no gap in layout
- [ ] PersonViewer: Delegate and Talk About sections render correctly
- [ ] PersonViewer: `loadStats` no longer calls `readFile('context/tasks-index.json')` directly
- [ ] `bun run build` passes
