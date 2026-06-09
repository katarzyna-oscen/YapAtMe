# Handover — H09 Follow-up: Dashboard Iteration

**Issues addressed:** activity accuracy, Needs Your Call UX, two-column summary,
module gating, section visibility config in Settings.

**Files to patch:**
- `src/App.jsx`
- `src/lib/tasksIndex.js`
- `src/core/CommandPage.jsx`
- `src/core/dashboard-top.jsx`
- `src/core/dashboard-sections.jsx`
- `src/core/SettingsPage.jsx`

---

## Issue 1 + 2 — Activity heatmap data accuracy

**Problem:** Creating/processing a note doesn't update the heatmap because the
dashboard doesn't reload and `activityData` is stale.

### Fix A — App.jsx: refresh dashboard after note processing

Find `onProcessedNote` in the InboxPage render and add `refreshDashboard()`:

```jsx
onProcessedNote={async () => {
  refreshTree()
  refreshTasks()
  refreshDashboard()   // ← add this — increments dashboardRefreshKey, remounts CommandPage
}}
```

Also refresh on note creation if a `onNoteCreated` callback exists. If not, the
`refreshDashboard` call after processing is sufficient since the inbox file will
already be on disk by then.

### Fix B — CommandPage.jsx: add inbox note creation dates to activity signal

The current `buildActivityData` reads:
- tasks-index `last_updated` dates
- inbox filenames (YYYY-MM-DD.md) from listTree

This is correct but the dashboard needs to remount to see new data (Fix A handles
this). No code change needed here beyond Fix A.

---

## Issue 3 — Needs Your Call: UX redesign

**Changes:**
- Remove kind icon and "TASK" label — show plain row like Tasks section
- Add checkbox: resolves tasks (calls `onResolveTask`), dismisses stale project / lapsed person items
- Allow drag-to-reorder with persistence (new `needsCallOrder` key in settings)
- Stale project / lapsed person items get a 7-day snooze on dismiss (stored in settings)

### Fix — tasksIndex.js: mark done instead of delete

**Replace `resolveTaskEntry`:**

```js
export async function resolveTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map(e =>
    e.id === entryId
      ? { ...e, status: 'done', resolved_at: today }
      : e
  )
  await writeTasksIndex(writeFile, updated)
}
```

Tasks are now marked done with a timestamp rather than deleted. The dashboard
already filters `status !== 'done'` so resolved tasks stay invisible in task lists.
The `resolved_at` field is used by the Updates column (Issue 4).

### Fix — CommandPage.jsx: dismissal for non-task needs-call items

Add `dismissedNeedsCall` to settings shape: `{ [id]: expiryISO }`.
Add handler:

```js
const handleDismissNeedsCall = useCallback(async (itemId) => {
  const expiry = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const dismissed = { ...(settings?.dismissedNeedsCall || {}), [itemId]: expiry }
  await saveSettings({ ...settings, dismissedNeedsCall: dismissed })
}, [settings, saveSettings])
```

Update `computeNeedsCall` to accept and filter dismissed items:

```js
function computeNeedsCall(tasks, projects, people, dismissed = {}) {
  const today = new Date().toISOString().slice(0, 10)
  // filter helper — skip if dismissed and not expired
  const notDismissed = (id) => !dismissed[id] || dismissed[id] < today

  // ... existing logic, add notDismissed(id) check before pushing each item
  // For task items: check notDismissed(task.id)
  // For project items: check notDismissed(p.path)
  // For person items: check notDismissed(p.path)
}
```

Call it in `loadData`:
```js
const needsItems = computeNeedsCall(
  openTasks, projectList, peopleList,
  settings?.dismissedNeedsCall || {}
)
```

Add `needsCallOrder` persistence — same pattern as projects/tasks:

```js
// In handleOrderChange, add case:
if (section === 'needs-call') {
  const newOrder = orderedItems.map(i => i.id)
  await saveSettings({ ...settings, needsCallOrder: newOrder })
}
```

Apply order in `loadData`:
```js
setNeedsCall(applyOrder(needsItems, settings?.needsCallOrder || [], i => i.id))
```

Pass to DashboardTop:
```jsx
<DashboardTop
  ...
  needsCallOrder={settings?.needsCallOrder}
  onDismissNeedsCall={handleDismissNeedsCall}
  onNeedsCallOrderChange={(reordered) => handleOrderChange('needs-call', reordered)}
  ...
/>
```

### Fix — dashboard-top.jsx: NeedsCallSection redesign

Replace the current NeedsCallSection row with the same row pattern as TasksSection:

```jsx
// Each row — same visual as ActionRow in dashboard-sections.jsx
function NeedsCallRow({ item, onResolve, onDismiss }) {
  const [resolving, setResolving] = useState(false)

  const handleCheck = async () => {
    setResolving(true)
    if (item.kind === 'task') {
      await onResolve(item.id)
    } else {
      await onDismiss(item.id)  // snooze for project/person items
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: 'var(--panel)', borderRadius: 8, opacity: resolving ? 0.4 : 1 }}>
      {/* Drag handle */}
      <Icon name="drag" style={{ color: 'var(--text-very-dim)', cursor: 'grab' }} />
      {/* Animated urgency dot — keep from design */}
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.70 0.18 22)',
        boxShadow: '0 0 0 4px oklch(0.70 0.18 22 / 0.20)', animation: 'pulse 1.2s ease-in-out infinite',
        flexShrink: 0 }} />
      {/* Checkbox */}
      <button onClick={handleCheck} disabled={resolving} style={{
        width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--border-strong)',
        background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
      {/* Title */}
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.4 }}>
        {item.title}
      </span>
      {/* Reason */}
      <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
        {item.reason}
      </span>
      <AgeChip days={item.age} />
    </div>
  )
}
```

Use `useDraggableList` on the needsCall array (import from dashboard-sections.jsx or
duplicate the hook). Fire `onNeedsCallOrderChange` on drop.

Update NeedsCallSection props:
```
needsCall             — items[]
onResolveTask         — (id) => void   (for task kind items)
onDismissNeedsCall    — (id) => void   (for project/person kind items)
onNeedsCallOrderChange — (reordered) => void
```

---

## Issue 4 — Two-column Summary: "Summary of the Week" + "Updates"

### Layout change — dashboard-top.jsx

Replace the single WeekSummary card with a two-column row:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '0 32px 24px' }}>
  <WeeklySummaryCard ... />
  <DailyUpdatesCard  ... />
</div>
```

### WeeklySummaryCard (existing, rename from WeekSummary)

No logic change — same LLM call, same storage in `context/week-summary.json`.
Label: "SUMMARY OF THE WEEK". Prompt stays the same (past 5 work days context).

### DailyUpdatesCard (new)

Shows yesterday's resolved tasks + key points from yesterday's inbox note.
Generated on demand, stored in `context/daily-updates.json`.

**CommandPage.jsx — add `handleGenerateUpdates`:**

```js
const handleGenerateUpdates = async () => {
  if (!settings?.apiKey) return
  setUpdatesLoading(true)
  try {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

    // Resolved tasks from yesterday
    let allTasks = []
    try { allTasks = JSON.parse(await readFile('context/tasks-index.json')) } catch {}
    const resolvedYesterday = allTasks.filter(t => t.resolved_at === yesterday)

    // Yesterday's inbox note
    let inboxNote = ''
    try { inboxNote = await readFile(`inbox/${yesterday}.md`) } catch {}

    if (!resolvedYesterday.length && !inboxNote) {
      setDailyUpdates({ text: 'No activity recorded for yesterday.', generated_at: new Date().toISOString() })
      return
    }

    const taskLines = resolvedYesterday.map(t => `- ✓ ${t.title} (${t.section.replace('## ', '')})`).join('\n')

    const prompt = `Generate a brief standup update (3-5 bullet points) from yesterday's activity.

Completed tasks:
${taskLines || '(none)'}

Yesterday's notes:
${inboxNote || '(none)'}

Write concise bullet points suitable for a standup: what was done, any blockers surfaced, what's next. Use plain text bullets starting with •. No preamble.`

    const raw = await callLLM(
      [{ role: 'user', content: prompt }],
      'You generate concise standup updates from daily work logs.',
      settings
    )

    const result = { text: raw.trim(), generated_at: new Date().toISOString() }
    await writeFile('context/daily-updates.json', JSON.stringify(result, null, 2))
    setDailyUpdates(result)
  } catch (err) {
    console.error('Daily updates generation failed:', err)
  } finally {
    setUpdatesLoading(false)
  }
}
```

Add state in CommandPage:
```js
const [dailyUpdates, setDailyUpdates]     = useState(null)
const [updatesLoading, setUpdatesLoading] = useState(false)
```

Load saved updates in `loadData`:
```js
let savedUpdates = null
try { savedUpdates = JSON.parse(await readFile('context/daily-updates.json')) } catch {}
setDailyUpdates(savedUpdates)
```

Pass to DashboardTop:
```jsx
<DashboardTop
  ...
  dailyUpdates={dailyUpdates}
  updatesLoading={updatesLoading}
  onGenerateUpdates={handleGenerateUpdates}
  ...
/>
```

**DailyUpdatesCard** — same visual as WeeklySummaryCard:
- Header: "UPDATES" left, "generated [date]" right
- Body: generated text (bullet points, preserve `•` line breaks)
- Button: "Generate" / "Regenerate"
- Disabled without API key

---

## Issue 5 — Module gating on dashboard sections

Pass `enabledModules` from CommandPage into DashboardSections.
Each module-owned section is hidden when its module is disabled.

**CommandPage.jsx** — pass to DashboardSections:
```jsx
<DashboardSections
  ...
  enabledModules={settings?.enabledModules || { projects: true, people: true, ideas: true }}
  ...
/>
```

**dashboard-sections.jsx** — add guards:
```jsx
// In the section render area:
{enabledModules.projects !== false && (
  <ProjectsSection ... />
)}
{enabledModules.people !== false && (
  <PeopleSection ... />
)}
{enabledModules.ideas !== false && (
  <IdeasSection ... />
)}
// Tasks section is always shown (index is module-agnostic)
```

---

## Issue 6 — Dashboard section visibility + order in Settings

### New settings shape

```js
const DEFAULT_DASHBOARD_SECTIONS = [
  { id: 'needs-call', label: 'Needs Your Call' },
  { id: 'summary',    label: 'Summary & Updates' },
  { id: 'projects',   label: 'Projects' },
  { id: 'tasks',      label: 'Tasks' },
  { id: 'people',     label: 'People' },
  { id: 'ideas',      label: 'Ideas' },
]
```

Stored in settings as `dashboardSections: { [id]: { visible: boolean, order: number } }`.

**SettingsPage.jsx — add "Dashboard" section:**

Below the Modules section, add a new section:

```jsx
<section className="space-y-4">
  <h2 className="text-xs font-semibold uppercase tracking-wider"
    style={{ color: 'var(--text-muted)' }}>
    Dashboard
  </h2>
  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
    Choose which sections appear on your dashboard and in what order.
    Drag to reorder.
  </p>

  <DashboardSectionConfig
    value={form.dashboardSections || {}}
    onChange={(next) => setForm(f => ({ ...f, dashboardSections: next }))}
  />
</section>
```

**DashboardSectionConfig component** (inline in SettingsPage or separate file):

```jsx
function DashboardSectionConfig({ value, onChange }) {
  const DEFAULT_ORDER = ['needs-call', 'summary', 'projects', 'tasks', 'people', 'ideas']
  const LABELS = {
    'needs-call': 'Needs Your Call',
    'summary':    'Summary & Updates',
    'projects':   'Projects',
    'tasks':      'Tasks',
    'people':     'People',
    'ideas':      'Ideas',
  }

  // Maintain order array in local state, init from stored order or default
  const [order, setOrder] = useState(() => {
    const stored = value?.order || []
    const missing = DEFAULT_ORDER.filter(id => !stored.includes(id))
    return [...stored, ...missing]
  })

  const isVisible = (id) => value?.visibility?.[id] !== false

  const toggleVisible = (id) => {
    onChange({
      ...value,
      visibility: { ...(value?.visibility || {}), [id]: !isVisible(id) },
      order,
    })
  }

  const handleDrop = (draggedId, targetId) => {
    const next = [...order]
    const from = next.indexOf(draggedId)
    const to   = next.indexOf(targetId)
    if (from < 0 || to < 0) return
    next.splice(from, 1)
    next.splice(to, 0, draggedId)
    setOrder(next)
    onChange({ ...value, order: next })
  }

  return (
    <div className="space-y-1">
      {order.map((id) => (
        <DashboardSectionRow
          key={id}
          id={id}
          label={LABELS[id]}
          visible={isVisible(id)}
          onToggle={() => toggleVisible(id)}
          onDrop={handleDrop}
        />
      ))}
    </div>
  )
}
```

Each row: drag handle, label, toggle checkbox. Use HTML5 drag events (same pattern
as `useDraggableList` in dashboard-sections.jsx).

**CommandPage.jsx — data-driven section render:**

Read section config and render in stored order:

```js
const sectionConfig = settings?.dashboardSections || {}
const sectionOrder  = sectionConfig?.order || ['needs-call', 'summary', 'projects', 'tasks', 'people', 'ideas']
const sectionVisible = (id) => sectionConfig?.visibility?.[id] !== false
```

In the return, replace the hardcoded section sequence with a map:

```jsx
// In CommandPage return, replace DashboardSections with data-driven render:
<div>
  {sectionOrder.map(sectionId => {
    if (!sectionVisible(sectionId)) return null
    switch (sectionId) {
      case 'needs-call': return <NeedsCallSection key="needs-call" ... />  // from DashboardTop
      case 'summary':    return <SummaryRow key="summary" ... />           // from DashboardTop
      case 'projects':   return enabledModules.projects !== false ? <ProjectsSection key="projects" ... /> : null
      case 'tasks':      return <TasksSection key="tasks" ... />
      case 'people':     return enabledModules.people !== false ? <PeopleSection key="people" ... /> : null
      case 'ideas':      return enabledModules.ideas !== false ? <IdeasSection key="ideas" ... /> : null
      default:           return null
    }
  })}
</div>
```

This requires NeedsCallSection, SummaryRow, ProjectsSection etc. to be exported
from their respective files and imported in CommandPage. Refactor exports accordingly:
- `dashboard-top.jsx`: export `NeedsCallSection`, `SummaryRow`, `TopBar`
- `dashboard-sections.jsx`: export `ProjectsSection`, `TasksSection`, `PeopleSection`, `IdeasSection`

CommandPage imports all six and renders them in config order.

---

## Save on section visibility change

In SettingsPage, `handleSave` already saves the whole `form`. The `DashboardSectionConfig`
calls `onChange` which updates `form.dashboardSections`. The existing Save button
persists this along with all other settings. No separate save needed.

---

## Validation checklist

- [ ] Processing a note increments activity heatmap on the same day
- [ ] Needs Your Call rows have checkboxes; checking a task row resolves it; checking a project/person row snoozes 7 days
- [ ] Needs Your Call has no type icon or "TASK" label
- [ ] Needs Your Call is drag-to-reorder with persistence
- [ ] Summary and Updates appear side by side in two equal columns
- [ ] "Generate" on Updates shows yesterday's resolved tasks + highlights from yesterday's inbox note
- [ ] Disabling Projects module hides Projects section on dashboard (and vice versa)
- [ ] Settings → Dashboard section shows all 6 sections with visibility toggles and drag reorder
- [ ] Toggling a section off hides it from dashboard immediately after save
- [ ] Reordering sections in Settings changes render order on dashboard
- [ ] `bun run build` passes
