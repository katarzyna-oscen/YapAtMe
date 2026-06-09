# Handover — H09: Dashboard Redesign (with persisted reorder)

**Files to create/replace:**
- `src/core/CommandPage.jsx` — replace entirely (data orchestrator)
- `src/core/dashboard-top.jsx` — new file (TopBar, NeedsYourCall, WeekSummary)
- `src/core/dashboard-sections.jsx` — new file (Projects, Tasks, People, Ideas)

**Files to patch:**
- `src/App.jsx` — pass `listTree`, `settings`, `saveSettings` into CommandPage

**Reference files (design — match visual output, do NOT copy structure):**
- `memory-os/project/dashboard-top.jsx`
- `memory-os/project/dashboard-sections.jsx`
- `memory-os/project/data.jsx`

---

## Step 0 — App.jsx: add three props to CommandPage

```jsx
{activePage === 'command' && (
  <CommandPage
    key={dashboardRefreshKey}
    readFile={readFile}
    writeFile={writeFile}
    listTree={listTree}
    settings={settings}
    saveSettings={saveSettings}
    setPage={(page) => navigate(page)}
  />
)}
```

---

## Step 1 — Order persistence contract

Drag-to-reorder persists for **projects, people, ideas, and tasks** via IndexedDB
(the existing settings store). Two keys are written alongside AI/provider settings:

```js
// Shape stored inside settings object
settings.dashboardOrder = {
  projects: ['projects/memory-os.md', 'projects/design-tokens.md', ...],
  people:   ['people/Elaine.md', 'people/Sophie.md', ...],
  ideas:    ['ideas/Ai-memory-os.md', ...],
}
settings.tasksOrder = ['uuid1', 'uuid2', 'uuid3', ...]
```

**Sort helper** — use this everywhere ordered lists are rendered:

```js
// Sort items array to match stored id order.
// Items not yet in stored order append at the end (handles new additions).
function applyOrder(items, storedIds, getKey) {
  if (!storedIds?.length) return items
  const orderMap = new Map(storedIds.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const ai = orderMap.has(getKey(a)) ? orderMap.get(getKey(a)) : Infinity
    const bi = orderMap.has(getKey(b)) ? orderMap.get(getKey(b)) : Infinity
    return ai - bi
  })
}
```

---

## Step 2 — CommandPage.jsx (full replacement)

```jsx
import { useState, useEffect, useCallback } from 'react'
import { parseFrontmatter } from '../lib/frontmatter'
import { readTasksIndex } from '../lib/tasksIndex'
import { callLLM } from '../lib/llm'
import DashboardTop from './dashboard-top'
import DashboardSections from './dashboard-sections'

const WEEK_SUMMARY_PATH = 'context/week-summary.json'
const STALE_PROJECT_DAYS = 21
const LAPSED_PERSON_DAYS = 28
const CADENCE_WINDOW_DAYS = 30

function daysAgo(dateStr) {
  if (!dateStr) return 999
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d)) return 999
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function normalizeFiles(tree, folder) {
  if (Array.isArray(tree)) {
    const dir = tree.find(e => e?.kind === 'directory' && e.name === folder)
    return (dir?.children || []).filter(e => e?.kind === 'file' && e.name.endsWith('.md') && !e.name.startsWith('_'))
  }
  return (tree?.[folder] || []).filter(e => e.name?.endsWith('.md') && !e.name.startsWith('_'))
}

async function readFrontmatters(readFile, files, folder) {
  return Promise.all(
    files.map(async (file) => {
      const path = file.path || `${folder}/${file.name}`
      try {
        const raw = await readFile(path)
        const { fields } = parseFrontmatter(raw)
        return { path, fields }
      } catch {
        return { path, fields: {} }
      }
    })
  )
}

function applyOrder(items, storedIds, getKey) {
  if (!storedIds?.length) return items
  const orderMap = new Map(storedIds.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const ai = orderMap.has(getKey(a)) ? orderMap.get(getKey(a)) : Infinity
    const bi = orderMap.has(getKey(b)) ? orderMap.get(getKey(b)) : Infinity
    return ai - bi
  })
}

function computeCadence(personPath, tasks, lastUpdated) {
  const cutoff = Date.now() - CADENCE_WINDOW_DAYS * 86_400_000
  const recentMentions = tasks.filter(t =>
    t.file === personPath &&
    new Date(`${t.last_updated}T00:00:00`).getTime() > cutoff
  ).length
  const age = daysAgo(lastUpdated)
  if (recentMentions >= 3 || age <= 7)  return 5
  if (recentMentions >= 2 || age <= 14) return 4
  if (recentMentions >= 1 || age <= 21) return 3
  if (age <= 30)                         return 2
  return 1
}

function buildActivityData(tasks, inboxFiles) {
  const counts = {}
  for (const task of tasks) {
    if (task.last_updated) counts[task.last_updated] = (counts[task.last_updated] || 0) + 1
  }
  for (const file of inboxFiles) {
    const date = file.name.replace('.md', '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      counts[date] = (counts[date] || 0) + 2
    }
  }
  const cells = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: d, count: counts[key] || 0 })
  }
  return cells
}

function computeNeedsCall(tasks, projects, people) {
  const items = []
  for (const task of tasks) {
    const isUrgent = task.tags?.some(t => t === 'urgent' || t === 'important')
    if (isUrgent) items.push({
      id: task.id, kind: 'task', title: task.title, file: task.file,
      reason: `${task.tags.find(t => t === 'urgent' || t === 'important')} — ${task.section.replace('## ', '')}`,
      age: daysAgo(task.last_updated),
    })
  }
  for (const p of projects) {
    if (p.status === 'Done') continue
    const age = daysAgo(p.last_updated)
    if (age >= STALE_PROJECT_DAYS) items.push({
      id: p.path, kind: 'project', title: p.name, file: p.path,
      reason: `${age}d since last update — revisit or drop`, age,
    })
  }
  for (const p of people) {
    const age = daysAgo(p.last_updated)
    if (age >= LAPSED_PERSON_DAYS) items.push({
      id: p.path, kind: 'person', title: p.full_name, file: p.path,
      reason: `no contact in ${age} days`, age,
    })
  }
  return items.sort((a, b) => b.age - a.age)
}

export default function CommandPage({ readFile, writeFile, listTree, settings, saveSettings, setPage }) {
  const [loading, setLoading]             = useState(true)
  const [projects, setProjects]           = useState([])
  const [people, setPeople]               = useState([])
  const [ideas, setIdeas]                 = useState([])
  const [tasks, setTasks]                 = useState([])
  const [activityData, setActivity]       = useState([])
  const [needsCall, setNeedsCall]         = useState([])
  const [weekSummary, setWeekSummary]     = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tree, allTasks] = await Promise.all([listTree(), readTasksIndex(readFile)])
      const openTasks = allTasks.filter(t => t.status !== 'done')

      const projectFiles = normalizeFiles(tree, 'projects')
      const peopleFiles  = normalizeFiles(tree, 'people')
      const ideaFiles    = normalizeFiles(tree, 'ideas')
      const inboxFiles   = normalizeFiles(tree, 'inbox')

      const [rawProjects, rawPeople, rawIdeas] = await Promise.all([
        readFrontmatters(readFile, projectFiles, 'projects'),
        readFrontmatters(readFile, peopleFiles,  'people'),
        readFrontmatters(readFile, ideaFiles,    'ideas'),
      ])

      const projectList = rawProjects.map(({ path, fields }) => ({
        path,
        name:         fields.name || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        status:       fields.status || 'Untriaged',
        core_problem: fields.core_problem || '',
        domain:       fields.domain || '',
        last_updated: fields.last_updated || '',
        openActions:  openTasks.filter(t => t.file === path && t.section === '## Open Actions').length,
      }))

      const peopleList = rawPeople.map(({ path, fields }) => ({
        path,
        full_name:    fields.full_name || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        role:         fields.role || '',
        last_updated: fields.last_updated || '',
        cadence:      computeCadence(path, allTasks, fields.last_updated),
      }))

      const ideaList = rawIdeas.map(({ path, fields }) => ({
        path,
        name:         fields.name || fields.title || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        status:       fields.status || 'Spark',
        last_updated: fields.last_updated || fields.origin || '',
      }))

      // Apply stored order to all four lists
      const order = settings?.dashboardOrder || {}
      const tasksOrder = settings?.tasksOrder || []

      setProjects(applyOrder(projectList, order.projects, p => p.path))
      setPeople(applyOrder(peopleList,    order.people,   p => p.path))
      setIdeas(applyOrder(ideaList,       order.ideas,    i => i.path))
      setTasks(applyOrder(openTasks,      tasksOrder,     t => t.id))

      setActivity(buildActivityData(allTasks, inboxFiles))
      setNeedsCall(computeNeedsCall(openTasks, projectList, peopleList))

      let savedSummary = null
      try { savedSummary = JSON.parse(await readFile(WEEK_SUMMARY_PATH)) } catch {}
      setWeekSummary(savedSummary)
    } catch (err) {
      console.error('Dashboard load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [readFile, listTree, settings?.dashboardOrder, settings?.tasksOrder])

  useEffect(() => { loadData() }, [loadData])

  // Called by DashboardSections when user finishes a drag.
  // section: 'projects' | 'people' | 'ideas' | 'tasks'
  // orderedItems: the reordered array after drop
  const handleOrderChange = useCallback(async (section, orderedItems) => {
    if (section === 'tasks') {
      const newOrder = orderedItems.map(t => t.id)
      await saveSettings({ ...settings, tasksOrder: newOrder })
    } else {
      const newOrder = orderedItems.map(i => i.path)
      const next = { ...(settings?.dashboardOrder || {}), [section]: newOrder }
      await saveSettings({ ...settings, dashboardOrder: next })
    }
  }, [settings, saveSettings])

  const handleGenerateSummary = async () => {
    if (!settings?.apiKey) return
    setSummaryLoading(true)
    try {
      let ctx = ''
      try { ctx = await readFile('context/_context.md') } catch {}
      const projectSummary = projects
        .filter(p => p.status !== 'Done')
        .map(p => `- ${p.name} [${p.status}] — ${p.core_problem || 'no summary'} (updated ${p.last_updated || 'unknown'})`)
        .join('\n')
      const prompt = `You are summarising a personal knowledge vault for a weekly digest.\n\nCurrent working memory:\n${ctx}\n\nActive projects:\n${projectSummary}\n\nOpen tasks: ${tasks.length} total\n\nWrite a 3–4 sentence plain prose summary of the week: what's moving, what's stale, what needs attention. Be specific — use project and person names. No bullet points. No preamble.`
      const raw = await callLLM(
        [{ role: 'user', content: prompt }],
        'You generate concise weekly digests from knowledge vault context.',
        settings
      )
      const result = { text: raw.trim(), generated_at: new Date().toISOString() }
      await writeFile(WEEK_SUMMARY_PATH, JSON.stringify(result, null, 2))
      setWeekSummary(result)
    } catch (err) {
      console.error('Week summary generation failed:', err)
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleResolveTask = async (taskId) => {
    const { resolveTaskEntry } = await import('../lib/tasksIndex')
    await resolveTaskEntry(readFile, writeFile, taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const stats = {
    projects: projects.length,
    stale:    projects.filter(p => p.status !== 'Done' && daysAgo(p.last_updated) >= STALE_PROJECT_DAYS).length,
    actions:  tasks.length,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <DashboardTop
        stats={stats}
        activityData={activityData}
        needsCall={needsCall}
        weekSummary={weekSummary}
        summaryLoading={summaryLoading}
        hasApiKey={!!settings?.apiKey}
        onGenerateSummary={handleGenerateSummary}
        onNavigate={setPage}
      />
      <DashboardSections
        projects={projects}
        tasks={tasks}
        people={people}
        ideas={ideas}
        onResolveTask={handleResolveTask}
        onOrderChange={handleOrderChange}
        onNavigate={setPage}
      />
    </div>
  )
}
```

---

## Step 3 — dashboard-top.jsx

Match the design exactly. Replace all `MEM_*` globals with props.

**Props:**
```
stats            — { projects, stale, actions }
activityData     — { date: Date, count: number }[]  84 cells oldest-first
needsCall        — { id, kind, title, file, reason, age }[]
weekSummary      — { text, generated_at } | null
summaryLoading   — boolean
hasApiKey        — boolean
onGenerateSummary — () => void
onNavigate       — (page, file?) => void
```

**AgeChip** — accepts pre-computed `days` number (not a Date):
```jsx
const AgeChip = ({ days }) => {
  let hue, label
  if (days < 7)       { hue = 150; label = 'fresh' }
  else if (days < 21) { hue = 80;  label = 'aging' }
  else                { hue = 22;  label = 'stale'  }
  // rest of design styling unchanged
}
```

**ActivityHeatmap** — receives `activityData` as `cells` prop.
Compute `max`, `streak`, `total`, `colorFor` locally from `cells`. Keep design visuals exactly.

**WeekSummary:**
- Right header slot: `weekSummary?.generated_at` formatted as short date + time, or "not yet generated"
- Generated text block: shown when `weekSummary` is set
- Button label: "Generate digest" (no summary) / "Regenerate" (has summary)
- Disabled + tooltip "Add API key in Settings" when `!hasApiKey`
- Spinner icon when `summaryLoading`

**Export from this file:** `Icon`, `SectionHeader`, `AgeChip`, `Tag` — imported by dashboard-sections.jsx.

---

## Step 4 — dashboard-sections.jsx

Match the design exactly. Replace all `MEM_*` globals with props.

**Props:**
```
projects      — shaped project objects (ordered)
tasks         — IndexEntry[] open (ordered)
people        — shaped people objects (ordered)
ideas         — shaped idea objects (ordered)
onResolveTask — (id: string) => void
onOrderChange — (section: string, orderedItems: any[]) => void
onNavigate    — (page: string, file?: string) => void
```

### Updated `useDraggableList` hook

Add `onOrderChange` callback parameter. Fire it after a successful drop:

```js
function useDraggableList(initial, onOrderChange) {
  const [items, setItems] = React.useState(initial)
  // ... all existing state

  // Keep items in sync when initial changes (e.g. after dashboard reload)
  React.useEffect(() => { setItems(initial) }, [initial])

  const handlers = (id) => ({
    // ... all existing handlers unchanged except onDrop:
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) return
      setItems((arr) => {
        const from = arr.findIndex(x => x.id === dragId)
        const to   = arr.findIndex(x => x.id === id)
        if (from < 0 || to < 0) return arr
        const next = arr.slice()
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        onOrderChange?.(next)   // ← fire callback with reordered array
        return next
      })
      setDragId(null); setOverId(null)
    },
    // ... onDragEnd unchanged
  })

  return { items, setItems, dragId, overId, handlers }
}
```

Note: `initial` for each section is the already-ordered array passed from CommandPage.
The `useEffect` sync ensures the list reflects vault reloads.

### ProjectsSection

```jsx
function ProjectsSection({ projects, onOrderChange, onNavigate }) {
  const { items, dragId, overId, handlers } = useDraggableList(
    projects,
    (reordered) => onOrderChange('projects', reordered)
  )
  // ... render grid of ProjectCards
}
```

**ProjectCard** fields:
- `project.name` → title (2-line clamp)
- `project.core_problem` → summary paragraph (2-line clamp)
- `project.status` → StatusPill (display-only — clicking navigates to viewer)
- `project.openActions` → "N actions" label
- `project.domain` → Tag chips; if domain is a comma-separated string, split it: `domain.split(',').map(s => s.trim()).filter(Boolean)`
- `project.last_updated` → `<AgeChip days={daysAgo(project.last_updated)} />`
- Click anywhere on card → `onNavigate('viewer', project.path)`
- StatusPill click → same navigation (not inline edit)

**Status colour map:**
```js
const STATUS_META = {
  'Untriaged':      { hue: 260 },
  'Triaged':        { hue: 80  },
  'In Progress':    { hue: 150 },
  'Building':       { hue: 150 },
  'Blocked':        { hue: 22  },
  'In Review':      { hue: 230 },
  'To Be Deployed': { hue: 230 },
  'Done':           { hue: 260 },
}
```

### TasksSection

```jsx
function TasksSection({ tasks, onResolveTask, onOrderChange }) {
  const { items, dragId, overId, handlers } = useDraggableList(
    tasks,
    (reordered) => onOrderChange('tasks', reordered)
  )
  // tasks use task.id as the drag id — ensure handlers(task.id) is called
}
```

**Task category** (derived at render time):
```js
function taskCategory(task) {
  if (task.tags?.some(t => t === 'urgent' || t === 'important')) return 'needs-call'
  if (task.section === '## Open Actions')                         return 'actions'
  if (task.section === '## Delegations' || task.section === '## Delegate') return 'delegate'
  if (task.section === '## Decisions')                            return 'decisions'
  return 'actions'
}

const CATEGORY_HUE = { 'needs-call': 22, actions: 150, delegate: 230, decisions: 80 }
```

**ActionRow fields:**
- Drag handle icon
- Checkbox → `onResolveTask(task.id)` on click; show check icon when resolving
- `task.title` → main text
- Right: short file label (`task.file.split('/').pop().replace('.md','').replace(/-/g,' ')`)
- `<AgeChip days={daysAgo(task.last_updated)} />`
- Category colour dot left of checkbox (use `CATEGORY_HUE[taskCategory(task)]`)

**Header right slot:** "N open" count of remaining items.

Show ALL open tasks — no cap.

### PeopleSection

```jsx
function PeopleSection({ people, onOrderChange, onNavigate }) {
  const { items, dragId, overId, handlers } = useDraggableList(
    people,
    (reordered) => onOrderChange('people', reordered)
  )
  // ... grid of PersonCards
}
```

**PersonCard:** `person.full_name`, `person.role`, `<CadenceMeter cadence={person.cadence} />`.
Click → `onNavigate('viewer', person.path)`.

**CadenceMeter** — keep design exactly. Hue: cadence ≥ 4 → 150 (green), cadence 3 → 80 (amber), cadence ≤ 2 → 22 (red).

### IdeasSection

```jsx
function IdeasSection({ ideas, onOrderChange, onNavigate }) {
  const [items, setItems] = React.useState(ideas)
  React.useEffect(() => setItems(ideas), [ideas])
  // Ideas use a simple list (no drag in design) — add drag for consistency:
  const { items: orderedItems, dragId, overId, handlers } = useDraggableList(
    ideas,
    (reordered) => onOrderChange('ideas', reordered)
  )
  // ... list rows
}
```

Ideas row: idea icon, `idea.name`, `<AgeChip days={daysAgo(idea.last_updated)} />`, StatusPill (display-only).
Click → `onNavigate('viewer', idea.path)`.

---

## Section render order

1. TopBar
2. NeedsYourCall — hidden entirely when `needsCall.length === 0`
3. WeekSummary
4. Projects
5. Tasks
6. People
7. Ideas

---

## Validation checklist

- [ ] App.jsx passes `listTree`, `settings`, `saveSettings` to CommandPage
- [ ] Dashboard loads without errors on empty vault
- [ ] Stats in TopBar reflect real counts
- [ ] Activity heatmap renders 12 weeks; today is rightmost
- [ ] NeedsYourCall hidden when empty; shows stale projects / lapsed people / urgent tasks
- [ ] WeekSummary: Generate button works, disabled without API key, shows timestamp after generation
- [ ] Projects grid renders; drag to reorder persists on next reload
- [ ] Clicking project card navigates to viewer
- [ ] Tasks list renders all open tasks; category colour dots show correctly
- [ ] Checking a task removes it from the list
- [ ] Dragging tasks to reorder persists on next reload
- [ ] People grid renders with cadence meter; drag to reorder persists
- [ ] Ideas list renders; drag to reorder persists
- [ ] `bun run build` passes
