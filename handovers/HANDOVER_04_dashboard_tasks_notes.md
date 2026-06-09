# Handover 04 — Command Dashboard, Tasks, Notes
**Status:** Ready for implementation  
**Scope:** Replace the three remaining stub pages: CommandPage (dashboard), TasksPage (task resolution), NotesPage (read-only note viewer). One new lib utility. No new hooks needed.  
**Prerequisite:** Read `SESSION_HANDOVER.md` first. Confirm Handover 03 is applied — Process Note button works, RoutingReview appears, vault files are confirmed written to disk, notes move from `inbox/` to `notes/` on Done.  
**Ends with:** The full core loop is visible end-to-end. Write a note → process → review → see tasks in the dashboard → tick tasks resolved → read processed notes.

---

## Updated codebase state (after Handover 03)

### Built and working
- Full project scaffold, app shell, sidebar, vault picker, vault init
- Settings page
- Inbox page — Milkdown editor + dictation + autosave
- **Process Note** — wired end-to-end: LLM call → RoutingReview → approve/dismiss → file writes → tasks index → move note → context rebuild
- `src/lib/vaultWriter.js` — `appendToSection`, `moveFile`
- `src/lib/approvalHandler.js` — `applyChange`
- `src/lib/rebuildContext.js` — `rebuildContext`
- `src/hooks/useNoteProcessor.js` — `useNoteProcessor`
- `src/core/RoutingReview.jsx` — routing review overlay

### Still stubbed (this handover fixes three of these)
- `CommandPage.jsx` — "coming soon" ← **fix in H04**
- `TasksPage.jsx` — "coming soon" ← **fix in H04**
- `NotesPage.jsx` — "coming soon" ← **fix in H04**
- `ArchivePage.jsx` — "coming soon" ← out of scope, leave as stub
- Module pages (`modules/projects/`, `modules/people/`, `modules/ideas/`) ← H05+

---

## How the three pages fit together

```
CommandPage (default view after vault opens)
  ├── Reads: context/_context.md       → "Current Focus" narrative card
  ├── Reads: context/tasks-index.json  → open task counts + top tasks per module
  └── Nav:   clicking "View all tasks" sets page to 'tasks'

TasksPage
  ├── Reads: context/tasks-index.json  → full open task list
  ├── Groups: by module (projects / people / ideas / other)
  ├── Action: tick checkbox → resolveTask() → entry removed from index + logged to archive
  └── State: list updates in place — no page reload needed

NotesPage
  ├── Reads: listTree()['notes']       → file list from vault/notes/
  ├── Select: click a file to load it
  └── View:  readFile() → renders content in a styled read-only panel
```

---

## Step 1 — Task resolver utility

Create `src/lib/taskResolver.js`. This is the only new lib file in H04.  
It is called when the user ticks a checkbox on the Tasks page.

```js
// src/lib/taskResolver.js
// Marks a single task as resolved:
//   1. Removes it from context/tasks-index.json (write-through)
//   2. Appends a one-line record to archive/tasks_done.md

const INDEX_PATH = 'context/tasks-index.json'
const DONE_PATH  = 'archive/tasks_done.md'

/**
 * @param {Function} readFile
 * @param {Function} writeFile
 * @param {string}   taskId   — the `id` field from the IndexEntry to resolve
 */
export async function resolveTask(readFile, writeFile, taskId) {
  // 1. Read the current index
  let entries = []
  try {
    const raw = await readFile(INDEX_PATH)
    entries = JSON.parse(raw)
  } catch {
    // Index missing or unreadable — nothing to resolve
    return
  }

  const task = entries.find(e => e.id === taskId)
  if (!task) return

  // 2. Remove the resolved entry and write the updated index
  const updated = entries.filter(e => e.id !== taskId)
  await writeFile(INDEX_PATH, JSON.stringify(updated, null, 2))

  // 3. Append to the done log
  const date = new Date().toISOString().split('T')[0]
  const logLine = `- [x] ${task.title} · ${task.file} · ${task.section} · resolved ${date}\n`

  let existing = ''
  try {
    existing = await readFile(DONE_PATH)
  } catch {
    // File doesn't exist yet — create with header
    existing = '# Resolved Tasks\n\n'
  }
  await writeFile(DONE_PATH, existing + logLine)
}
```

---

## Step 2 — CommandPage (dashboard)

Replace `src/core/CommandPage.jsx` in full. Do not keep any of the stub content.

The page has two columns:
- **Left**: Current context card (from `_context.md`) + unknown entities notice (if any)  
- **Right**: Open tasks grouped by module, with a "View all" link per group

```jsx
// src/core/CommandPage.jsx
// The home dashboard. Loads context + task index on mount.
// Refreshes when the user navigates here (key prop in App.jsx handles this if needed).

import { useState, useEffect } from 'react'

export default function CommandPage({ readFile, writeFile, setPage }) {
  const [context,    setContext]    = useState('')
  const [tasks,      setTasks]      = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    // Load _context.md — non-fatal if missing
    let ctx = ''
    try { ctx = await readFile('context/_context.md') } catch {}
    setContext(ctx)

    // Load tasks index — non-fatal if missing or empty
    let taskList = []
    try {
      const raw = await readFile('context/tasks-index.json')
      taskList = JSON.parse(raw).filter(t => t.status !== 'done')
    } catch {}
    setTasks(taskList)

    setLoading(false)
  }

  // Group tasks by module
  const grouped = tasks.reduce((acc, t) => {
    const key = t.module || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const totalOpen = tasks.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Command</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {totalOpen} open {totalOpen === 1 ? 'task' : 'tasks'}
        </p>
      </div>

      <div className="flex flex-1 gap-6 px-8 pb-8 overflow-hidden">

        {/* Left column — context */}
        <div className="w-72 shrink-0 space-y-4">
          <ContextCard context={context} />
        </div>

        {/* Right column — tasks grouped by module */}
        <div className="flex-1 space-y-6 overflow-y-auto">
          {Object.keys(grouped).length === 0 ? (
            <EmptyTasks />
          ) : (
            Object.entries(grouped).map(([module, items]) => (
              <TaskGroup
                key={module}
                module={module}
                tasks={items.slice(0, 5)}   // show top 5 per group
                total={items.length}
                onViewAll={() => setPage('tasks')}
              />
            ))
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ContextCard({ context }) {
  if (!context.trim()) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Current Focus
        </h2>
        <p className="text-sm text-[var(--text-muted)] italic">
          No context yet — process a note to build your working memory.
        </p>
      </div>
    )
  }

  // Extract the Current Focus section if it exists, otherwise show the whole file
  const focusMatch = context.match(/## Current Focus\n([\s\S]*?)(?=\n## |\s*$)/)
  const focusText = focusMatch ? focusMatch[1].trim() : context.trim()

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Current Focus
      </h2>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
        {focusText}
      </p>
    </div>
  )
}

function TaskGroup({ module, tasks, total, onViewAll }) {
  const label = module.charAt(0).toUpperCase() + module.slice(1)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h2>
        {total > 5 && (
          <button
            onClick={onViewAll}
            className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            View all {total} →
          </button>
        )}
      </div>
      <div className="space-y-1">
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} compact />
        ))}
      </div>
    </div>
  )
}

function TaskRow({ task }) {
  return (
    <div className="flex items-start gap-3 rounded-md px-3 py-2 bg-[var(--bg-sidebar)] border border-[var(--border)]">
      <span className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">{task.title}</p>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {task.file} · {task.section}
        </p>
      </div>
    </div>
  )
}

function EmptyTasks() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-[var(--text-muted)] text-sm">No open tasks.</p>
      <p className="text-[var(--text-muted)] text-xs mt-1">
        Process a note to start routing actions and decisions.
      </p>
    </div>
  )
}
```

**Note on `setPage`:** `CommandPage` receives `setPage` as a prop from `App.jsx` so "View all" can navigate to the Tasks page. You need to pass it when rendering CommandPage in `App.jsx`:

```jsx
// In App.jsx, wherever you render CommandPage:
<CommandPage readFile={readFile} writeFile={writeFile} setPage={setPage} />
```

If `setPage` doesn't exist yet in App.jsx, add `const [page, setPage] = useState('command')` (or whatever your current navigation state is called) and pass it through.

---

## Step 3 — TasksPage

Replace `src/core/TasksPage.jsx` in full.

The page loads all tasks from `tasks-index.json`, groups them by module, and lets the user tick each one resolved. Resolving a task updates the UI immediately (optimistic) and writes to disk in the background.

```jsx
// src/core/TasksPage.jsx
// Full task list — grouped by module, with checkbox resolution.
// Resolving removes the task from tasks-index.json and logs it to archive/tasks_done.md.

import { useState, useEffect } from 'react'
import { resolveTask } from '../lib/taskResolver'

export default function TasksPage({ readFile, writeFile }) {
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [resolving, setResolving] = useState(new Set()) // ids currently being written

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const raw = await readFile('context/tasks-index.json')
      const all = JSON.parse(raw)
      // Show only open tasks — resolved tasks should not be in the index,
      // but filter defensively in case of a stale write
      setTasks(all.filter(t => t.status !== 'done'))
    } catch {
      setTasks([])
    }
    setLoading(false)
  }

  const handleResolve = async (taskId) => {
    // Optimistic update — remove from UI immediately
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setResolving(prev => new Set(prev).add(taskId))

    try {
      await resolveTask(readFile, writeFile, taskId)
    } catch (err) {
      // If write failed, restore the task
      console.error('Failed to resolve task:', err.message)
      await loadTasks() // reload from disk to get back to real state
    } finally {
      setResolving(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  // Group tasks by module
  const grouped = tasks.reduce((acc, t) => {
    const key = t.module || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const moduleOrder = ['projects', 'people', 'ideas', 'other']
  const sortedGroups = moduleOrder
    .filter(m => grouped[m])
    .concat(Object.keys(grouped).filter(m => !moduleOrder.includes(m)))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Tasks</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {tasks.length} open {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
      </div>

      {/* Task groups */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[var(--text-muted)] text-sm">All caught up.</p>
            <p className="text-[var(--text-muted)] text-xs mt-1">
              No open tasks — process a note to generate some.
            </p>
          </div>
        ) : (
          sortedGroups.map(module => (
            <TaskGroup
              key={module}
              module={module}
              tasks={grouped[module]}
              resolving={resolving}
              onResolve={handleResolve}
            />
          ))
        )}
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskGroup({ module, tasks, resolving, onResolve }) {
  const label = module.charAt(0).toUpperCase() + module.slice(1)

  return (
    <div>
      <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        {label} · {tasks.length}
      </h2>
      <div className="space-y-1">
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            isResolving={resolving.has(task.id)}
            onResolve={onResolve}
          />
        ))}
      </div>
    </div>
  )
}

function TaskRow({ task, isResolving, onResolve }) {
  return (
    <div className={`flex items-start gap-3 rounded-md px-3 py-2.5
      border border-[var(--border)] bg-[var(--bg-sidebar)]
      transition-opacity ${isResolving ? 'opacity-40' : 'opacity-100'}`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onResolve(task.id)}
        disabled={isResolving}
        aria-label="Mark resolved"
        className="mt-0.5 w-4 h-4 shrink-0 rounded border border-[var(--border)]
          hover:border-[var(--accent)] hover:bg-[var(--accent)]/10
          transition-colors flex items-center justify-center"
      >
        {isResolving && (
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)]">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-[var(--text-muted)] font-mono truncate">
            {task.file}
          </span>
          <span className="text-xs text-[var(--text-muted)]">·</span>
          <span className="text-xs text-[var(--text-muted)] truncate">
            {task.section}
          </span>
          {task.last_updated && (
            <>
              <span className="text-xs text-[var(--text-muted)]">·</span>
              <span className="text-xs text-[var(--text-muted)]">{task.last_updated}</span>
            </>
          )}
        </div>
      </div>

      {/* Marker badge */}
      {task.tags?.length > 0 && (
        <div className="flex gap-1 shrink-0 flex-wrap">
          {task.tags.slice(0, 2).map(tag => (
            <span key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-active)] text-[var(--text-muted)]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Step 4 — NotesPage

Replace `src/core/NotesPage.jsx` in full.

Two-column layout: file list on the left, note content on the right. Notes are read-only — no editor, no dictation. Content is rendered as styled raw markdown (plain text). This is intentional for v1; a rendered markdown view is H05 scope.

```jsx
// src/core/NotesPage.jsx
// Read-only view of processed notes from vault/notes/.
// Click a note in the list to load and display its content.

import { useState, useEffect } from 'react'

export default function NotesPage({ readFile, listTree }) {
  const [noteFiles,  setNoteFiles]  = useState([])   // { name, path }[]
  const [selected,   setSelected]   = useState(null)  // { name, path }
  const [content,    setContent]    = useState('')
  const [loading,    setLoading]    = useState(true)
  const [loadingNote, setLoadingNote] = useState(false)

  useEffect(() => {
    loadNotesList()
  }, [])

  const loadNotesList = async () => {
    setLoading(true)
    try {
      const tree = await listTree()
      const files = (tree['notes'] || [])
        .filter(f => f.name.endsWith('.md') && !f.name.startsWith('_moved'))
        .map(f => ({ name: f.name.replace('.md', ''), path: `notes/${f.name}` }))
        // Most recently named first (inbox notes are named by date DD-MM-YYYY)
        .sort((a, b) => b.name.localeCompare(a.name))
      setNoteFiles(files)

      // Auto-select first note if list is non-empty
      if (files.length > 0) {
        await loadNote(files[0])
      }
    } catch {
      setNoteFiles([])
    }
    setLoading(false)
  }

  const loadNote = async (file) => {
    setSelected(file)
    setLoadingNote(true)
    try {
      const text = await readFile(file.path)
      setContent(text)
    } catch {
      setContent('_Could not load this note._')
    }
    setLoadingNote(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Loading…
      </div>
    )
  }

  if (noteFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-[var(--text-muted)] text-sm">No notes yet.</p>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Processed notes appear here after you approve changes in the Inbox.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* File list — left panel */}
      <div className="w-56 shrink-0 border-r border-[var(--border)] overflow-y-auto py-4">
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-4 mb-2">
          Notes · {noteFiles.length}
        </p>
        {noteFiles.map(file => (
          <button
            key={file.path}
            onClick={() => loadNote(file)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors
              ${selected?.path === file.path
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* Note content — right panel */}
      <div className="flex-1 overflow-y-auto">
        {loadingNote ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
            Loading…
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-8 py-8">
            {/* Note title */}
            <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
              {selected?.name}
            </h1>
            {/* Raw markdown content — styled as monospace for v1 */}
            <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
              {content}
            </pre>
          </div>
        )}
      </div>

    </div>
  )
}
```

---

## Step 5 — Wire props in App.jsx

Check `App.jsx` and confirm the three pages are rendered with the right props. Find the section that switches on `page` (or whatever your navigation state variable is called) and update accordingly:

```jsx
// In App.jsx — wherever your page switch lives:

{page === 'command' && (
  <CommandPage
    readFile={readFile}
    writeFile={writeFile}
    setPage={setPage}
  />
)}

{page === 'tasks' && (
  <TasksPage
    readFile={readFile}
    writeFile={writeFile}
  />
)}

{page === 'notes' && (
  <NotesPage
    readFile={readFile}
    listTree={listTree}
  />
)}
```

If `setPage` is not the name of your navigation setter, use whatever it's called in your App.jsx. The pattern is: `CommandPage` needs to be able to push the user to the tasks view when they click "View all."

---

## Step 6 — Sidebar navigation (verify, not rewrite)

Open `src/components/Sidebar.jsx`. Find the nav items for Command, Tasks, and Notes. Check that clicking each one sets the page to `'command'`, `'tasks'`, and `'notes'` respectively — these must match exactly what App.jsx checks in the page switch above.

If the sidebar uses string literals that don't match, update them now. Do not rewrite the sidebar component — just update the string values on the three affected items.

---

## Smoke test

Run through this in order. Do not skip steps — each one validates a dependency of the next.

1. `npm run dev` — zero console errors on load
2. Open vault — Command page loads, shows "No open tasks" (if you haven't processed a note yet)
3. Go to Inbox — write 3–4 sentences, Process Note, approve at least one action-type change, click Done
4. Navigate to **Command** — the approved task appears under its module group; context card shows content from `_context.md`
5. Navigate to **Tasks** — full task list is visible, grouped by module
6. Tick a task — it disappears from the list immediately
7. Check `context/tasks-index.json` on disk — resolved task is gone
8. Check `archive/tasks_done.md` on disk — resolved task appears as a `- [x]` line
9. Navigate to **Notes** — processed note appears in the left panel
10. Click the note — content loads in the right panel, raw markdown is readable
11. Reload the page — navigate back to Notes — same note still appears (vault reads are live from disk)

---

## Known issues to avoid

| Risk | Mitigation |
|---|---|
| `tasks-index.json` missing on first launch | Both `loadTasks` calls are wrapped in try/catch — falls back to empty array |
| `notes/` folder empty or missing | `listTree()` returns empty or no `notes` key — handled with `(tree['notes'] \|\| [])` |
| Optimistic resolve then disk write fails | `handleResolve` in TasksPage catches the error and calls `loadTasks()` to restore from disk |
| Navigation mismatch between Sidebar strings and App.jsx switch | Step 6 — verify string literals match exactly |
| `_moved_` tombstone files showing in Notes list | Already filtered with `!f.name.startsWith('_moved')` in NotesPage |
| Context card shows full file if no `## Current Focus` section | Regex falls back to showing the full `_context.md` — fine for v1 |

---

## Complete file list for this handover

```
src/
  lib/
    taskResolver.js       ← NEW — resolveTask (remove from index, log to done)
  core/
    CommandPage.jsx       ← REPLACED — dashboard with context card + task groups
    TasksPage.jsx         ← REPLACED — full task list with checkbox resolution
    NotesPage.jsx         ← REPLACED — two-column read-only note viewer
  App.jsx                 ← CHECK ONLY — verify props passed to three pages
  components/
    Sidebar.jsx           ← CHECK ONLY — verify nav strings match page switch
```

---

## Handover 05 preview (do not build yet)

- Entity creation flow — wire the "Create person/project/idea" stub in `RoutingReview.jsx` (currently calls `alert()`). Should open a form, write a templated `.md` file from `templates.js`, and add it to the allowedFiles list for future LLM calls.
- AllowedFiles population — scan the vault on Process to build the real `allowedFiles[]` list passed to `useNoteProcessor`. Currently hardcoded to `[]`.
- Module list and detail pages — `projects/`, `people/`, `ideas/` index pages that list files and link to a detail view (read `frontmatter.js` to surface metadata).
- ArchivePage — shows `archive/tasks_done.md` and `archive/notes/` contents.
