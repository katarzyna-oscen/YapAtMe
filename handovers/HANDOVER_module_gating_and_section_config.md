# Handover — Module Gating + Dashboard Section Config

Two self-contained patches. Apply them in order.

---

## Patch 1 — Module gating in `dashboard-sections.jsx`

**Scope:** Change only the `DashboardSections` export at the bottom of the file.
Do NOT touch ProjectsSection, TasksSection, PeopleSection, IdeasSection, or any other component.

### Replace the `DashboardSections` export (lines 392–401)

```jsx
export default function DashboardSections({
  projects,
  tasks,
  people,
  ideas,
  onResolveTask,
  onOrderChange,
  onNavigate,
  enabledModules,
  sectionConfig,
}) {
  const DEFAULT_ORDER = ['projects', 'tasks', 'people', 'ideas']

  // Stored order or default
  const order = sectionConfig?.order?.length ? sectionConfig.order : DEFAULT_ORDER

  // A section is visible if:
  //   1. sectionConfig.visibility doesn't explicitly hide it, AND
  //   2. its parent module isn't disabled
  const isVisible = (id) => {
    if (sectionConfig?.visibility?.[id] === false) return false
    if (id === 'projects' && enabledModules?.projects === false) return false
    if (id === 'people'   && enabledModules?.people   === false) return false
    if (id === 'ideas'    && enabledModules?.ideas    === false) return false
    return true
  }

  const sections = {
    projects: () => (
      <ProjectsSection
        projects={projects}
        onOrderChange={onOrderChange}
        onNavigate={onNavigate}
      />
    ),
    tasks: () => (
      <TasksSection
        tasks={tasks}
        onResolveTask={onResolveTask}
        onOrderChange={onOrderChange}
      />
    ),
    people: () => (
      <PeopleSection
        people={people}
        onOrderChange={onOrderChange}
        onNavigate={onNavigate}
      />
    ),
    ideas: () => (
      <IdeasSection
        ideas={ideas}
        onOrderChange={onOrderChange}
        onNavigate={onNavigate}
      />
    ),
  }

  return (
    <>
      {order.map(id => {
        if (!isVisible(id) || !sections[id]) return null
        return <React.Fragment key={id}>{sections[id]()}</React.Fragment>
      })}
    </>
  )
}
```

Add `import React from 'react'` at the top if not already present (needed for `React.Fragment`).

### Pass the new props from `CommandPage.jsx`

Find where `<DashboardSections>` is rendered and add two props:

```jsx
<DashboardSections
  projects={projects}
  tasks={tasks}
  people={people}
  ideas={ideas}
  onResolveTask={handleResolveTask}
  onOrderChange={handleOrderChange}
  onNavigate={setPage}
  enabledModules={settings?.enabledModules || { projects: true, people: true, ideas: true }}
  sectionConfig={settings?.dashboardSections || {}}
/>
```

### Validation

- [ ] Disable Projects module in Settings → Projects section disappears from dashboard
- [ ] Re-enable Projects → Projects section reappears
- [ ] Same for People and Ideas
- [ ] Tasks section always visible regardless of module state
- [ ] Section order unchanged when `sectionConfig` is empty
- [ ] `bun run build` passes

---

## Patch 2 — Dashboard section config in `SettingsPage.jsx`

**Scope:** Add a new "Dashboard" settings section. Three precise changes:
1. Add `dashboardSections` to form state
2. Add `DashboardSectionConfig` component (above the `export default`)
3. Insert the Dashboard section into the JSX between Modules and Vault maintenance

Do NOT touch anything else in the file.

### Change 1 — Add to form state

Find the `useState` that initialises `form` (around line 201) and add `dashboardSections`:

```js
const [form, setForm] = useState({
  apiKey:           settings.apiKey   || '',
  model:            settings.model    || 'meta-llama/llama-3.3-70b-instruct',
  provider:         settings.provider || 'openrouter',
  enabledModules:   settings.enabledModules   || DEFAULT_ENABLED_MODULES,
  dashboardSections: settings.dashboardSections || {},   // ← add this line
})
```

Also update the `useEffect` that syncs settings → form (add the same field):
```js
useEffect(() => {
  setForm({
    apiKey:           settings.apiKey || '',
    model:            settings.model || 'meta-llama/llama-3.3-70b-instruct',
    provider:         settings.provider || 'openrouter',
    enabledModules:   settings.enabledModules || DEFAULT_ENABLED_MODULES,
    dashboardSections: settings.dashboardSections || {},  // ← add this line
  })
}, [settings])
```

### Change 2 — Add `DashboardSectionConfig` component

Insert this component just above `export default function SettingsPage`:

```jsx
const DASHBOARD_SECTION_DEFS = [
  { id: 'projects', label: 'Projects' },
  { id: 'tasks',    label: 'Tasks'    },
  { id: 'people',   label: 'People'   },
  { id: 'ideas',    label: 'Ideas'    },
]

function DashboardSectionConfig({ value, onChange }) {
  const storedOrder = value?.order || []
  const defaultOrder = DASHBOARD_SECTION_DEFS.map(d => d.id)
  // Merge stored order with any missing defaults appended at end
  const fullOrder = [
    ...storedOrder.filter(id => defaultOrder.includes(id)),
    ...defaultOrder.filter(id => !storedOrder.includes(id)),
  ]

  const [order, setOrder] = useState(fullOrder)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  const isVisible = (id) => value?.visibility?.[id] !== false

  const toggleVisible = (id) => {
    const next = {
      ...value,
      visibility: { ...(value?.visibility || {}), [id]: !isVisible(id) },
      order,
    }
    onChange(next)
  }

  const dragHandlers = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnter: (e) => { e.preventDefault(); if (id !== dragId) setOverId(id) },
    onDragOver:  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) return
      const next = [...order]
      const from = next.indexOf(dragId)
      const to   = next.indexOf(id)
      if (from < 0 || to < 0) return
      next.splice(from, 1)
      next.splice(to, 0, dragId)
      setOrder(next)
      onChange({ ...value, order: next })
      setDragId(null); setOverId(null)
    },
    onDragEnd: () => { setDragId(null); setOverId(null) },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {order.map(id => {
        const def     = DASHBOARD_SECTION_DEFS.find(d => d.id === id)
        const visible = isVisible(id)
        const over    = overId === id
        const dragging = dragId === id
        if (!def) return null
        return (
          <div
            key={id}
            {...dragHandlers(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: over ? 'var(--panel-pop)' : 'var(--bg-input)',
              border: `1px solid ${over ? 'var(--border-strong)' : 'var(--border)'}`,
              borderRadius: 8,
              opacity: dragging ? 0.4 : 1,
              cursor: 'grab',
              transition: 'border-color .12s, background .12s',
            }}
          >
            {/* Drag handle */}
            <svg viewBox="0 0 14 14" width="14" height="14" fill="var(--text-very-dim)"
              style={{ flexShrink: 0, cursor: 'grab' }}>
              <circle cx="4.5" cy="4"  r="1.1" /><circle cx="4.5" cy="7"  r="1.1" /><circle cx="4.5" cy="10" r="1.1" />
              <circle cx="9.5" cy="4"  r="1.1" /><circle cx="9.5" cy="7"  r="1.1" /><circle cx="9.5" cy="10" r="1.1" />
            </svg>
            {/* Label */}
            <span style={{ flex: 1, fontSize: 13, color: visible ? 'var(--text-secondary)' : 'var(--text-very-dim)' }}>
              {def.label}
            </span>
            {/* Visibility toggle */}
            <input
              type="checkbox"
              checked={visible}
              onChange={() => toggleVisible(id)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </div>
        )
      })}
      <p style={{ fontSize: 11.5, color: 'var(--text-very-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>
        Drag to reorder · uncheck to hide
      </p>
    </div>
  )
}
```

### Change 3 — Insert Dashboard section into the JSX

Find the closing `</section>` of the Modules section (the one containing the module
checkboxes for Projects/People/Ideas, ending around line 545). Insert the Dashboard
section immediately after it, before the Vault maintenance `<section>`:

```jsx
      {/* ── Dashboard ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Dashboard
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Choose which sections appear on your dashboard and in what order.
          Needs Your Call and Summary are always shown.
        </p>
        <DashboardSectionConfig
          value={form.dashboardSections}
          onChange={(next) => {
            const nextForm = { ...form, dashboardSections: next }
            setForm(nextForm)
            saveSettings(nextForm)   // auto-save immediately, same as module toggles
          }}
        />
      </section>
```

### Validation

- [ ] Settings shows a "Dashboard" section below Modules
- [ ] 4 rows: Projects, Tasks, People, Ideas — each with drag handle + label + checkbox
- [ ] Unchecking a row hides that section on the dashboard immediately
- [ ] Re-checking restores it
- [ ] Dragging rows reorders them; dashboard section order updates on next load
- [ ] Disabling Projects module AND unchecking Projects in Dashboard → section hidden (both gates work independently)
- [ ] `bun run build` passes
