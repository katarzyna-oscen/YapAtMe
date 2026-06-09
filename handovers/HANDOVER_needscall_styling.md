# Handover — NeedsYourCall: Match TasksPage Styling

**File:** `src/core/dashboard-top.jsx`
**Scope:** Replace only `NeedsCallSection` and its sub-components.
Do NOT touch TopBar, ActivityHeatmap, WeekSummary, SectionHeader, AgeChip, Tag, or any imports/exports.

---

## What to replace

Find and replace the entire `NeedsCallSection` component (and any helper components
it uses internally, e.g. `NeedsCallRow`, `NeedsCallRowItem`). Replace with the
components below.

---

## Replacement components

### AgeChip (local copy matching TasksPage exactly)

Add this alongside the existing `AgeChip` in dashboard-top.jsx, or replace it if
the existing one accepts `days` instead of `date`. The NeedsCall rows pass a
pre-computed `age` (number of days), so convert it to a Date for the chip:

```jsx
// Matches TasksPage AgeChip exactly — accepts a Date object
function TaskAgeChip({ date }) {
  const when = date instanceof Date ? date : new Date(date)
  const days = Math.max(0, Math.floor((Date.now() - when.getTime()) / 86_400_000))
  let hue = 150, label = 'fresh'
  if (days >= 45)      { hue = 8;  label = 'rotting' }
  else if (days >= 21) { hue = 22; label = 'stale'   }
  else if (days >= 7)  { hue = 80; label = 'aging'   }
  return (
    <span
      title={`${days}d old`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 999,
        background: `oklch(0.82 0.13 ${hue} / 0.12)`,
        color: `oklch(0.84 0.13 ${hue})`,
        border: `1px solid oklch(0.82 0.13 ${hue} / 0.28)`,
        fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </span>
  )
}
```

### TypeDot — colored by module/kind

```jsx
function NeedsCallTypeDot({ kind, file }) {
  // For task items, derive color from file path. For project/person, use kind directly.
  let color = 'var(--text-very-dim)'
  const folder = file?.split('/')[0]
  if (kind === 'project' || folder === 'projects') color = 'var(--success)'
  else if (kind === 'person' || folder === 'people')  color = 'var(--info)'
  else if (kind === 'idea'   || folder === 'ideas')   color = 'var(--accent)'
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
}
```

### NeedsCallItemRow — matches TaskRow layout exactly

```jsx
function NeedsCallItemRow({ item, isLast, onResolve, onDismiss, dragHandlers, isDragging, isOver }) {
  const [hov, setHov] = useState(false)
  const [resolving, setResolving] = useState(false)

  const handleCheck = async (e) => {
    e.stopPropagation()
    if (resolving) return
    setResolving(true)
    try {
      if (item.kind === 'task') {
        await onResolve(item.id)
      } else {
        await onDismiss(item.id)
      }
    } finally {
      setResolving(false)
    }
  }

  // Source label shown right of title — file basename for tasks, empty for project/person (title IS the entity)
  const sourceLabel = item.kind === 'task'
    ? item.file?.split('/').pop().replace('.md', '') ?? ''
    : ''

  const dateForChip = new Date(Date.now() - item.age * 86_400_000)

  return (
    <div
      {...(dragHandlers || {})}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderTop: isLast === false ? '1px solid var(--border-subtle)' : 'none',
        background: isOver
          ? 'oklch(0.78 0.14 25 / 0.10)'
          : hov ? 'var(--panel-2)' : 'transparent',
        opacity: isDragging ? 0.4 : resolving ? 0.5 : 1,
        cursor: dragHandlers ? 'grab' : 'default',
        transition: 'background .12s, opacity .15s',
      }}
    >
      {/* Drag handle — matches TaskRow exactly */}
      <span style={{
        color: 'var(--text-very-dim)',
        display: 'inline-flex',
        opacity: hov ? 1 : 0.3,
        transition: 'opacity .12s',
        flexShrink: 0,
      }}>
        <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
          <circle cx="4.5" cy="4"  r="1.1" /><circle cx="4.5" cy="7"  r="1.1" /><circle cx="4.5" cy="10" r="1.1" />
          <circle cx="9.5" cy="4"  r="1.1" /><circle cx="9.5" cy="7"  r="1.1" /><circle cx="9.5" cy="10" r="1.1" />
        </svg>
      </span>

      {/* Checkbox — matches TaskRow exactly */}
      <button
        onClick={handleCheck}
        style={{
          width: 18, height: 18, flexShrink: 0,
          border: `1.5px solid ${resolving ? 'var(--success)' : 'var(--border-strong)'}`,
          borderRadius: 5,
          background: resolving ? 'var(--success)' : 'transparent',
          cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--bg)',
        }}
      >
        {resolving && (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
        )}
      </button>

      {/* Type dot */}
      <NeedsCallTypeDot kind={item.kind} file={item.file} />

      {/* Title */}
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.4, minWidth: 0 }}>
        {item.title}
      </span>

      {/* Source label */}
      {sourceLabel && (
        <span style={{ fontSize: 12, color: 'var(--text-very-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {sourceLabel}
        </span>
      )}

      {/* Reason */}
      <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {item.reason}
      </span>

      {/* Age chip */}
      <TaskAgeChip date={dateForChip} />
    </div>
  )
}
```

### NeedsCallSection — matches CategorySection wrapper exactly

```jsx
function NeedsCallSection({ needsCall, onResolveTask, onDismissNeedsCall, onNeedsCallOrderChange }) {
  const [items, setItems] = useState(needsCall)
  const [dragId, setDragId]   = useState(null)
  const [overId, setOverId]   = useState(null)

  // Keep in sync when parent data refreshes
  useEffect(() => { setItems(needsCall) }, [needsCall])

  if (!items || items.length === 0) return null

  const dragHandlersFor = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', id) } catch {}
    },
    onDragEnter: (e) => { e.preventDefault(); if (id !== dragId) setOverId(id) },
    onDragOver:  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) { setDragId(null); setOverId(null); return }
      setItems((arr) => {
        const from = arr.findIndex(x => x.id === dragId)
        const to   = arr.findIndex(x => x.id === id)
        if (from < 0 || to < 0) return arr
        const next = arr.slice()
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        onNeedsCallOrderChange?.(next)
        return next
      })
      setDragId(null); setOverId(null)
    },
    onDragEnd: () => { setDragId(null); setOverId(null) },
  })

  return (
    <section style={{ padding: '28px 48px 8px' }}>
      {/* Section header — matches CategorySection header from TasksPage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '0 4px' }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'oklch(0.78 0.16 25)', flex: '0 0 6px',
        }} />
        <h2 style={{
          fontSize: 11, letterSpacing: '0.16em', fontWeight: 600,
          textTransform: 'uppercase', color: 'var(--text-dim)', margin: 0,
        }}>
          Needs Your Call
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-very-dim)' }}>{items.length}</span>
      </div>

      {/* Item list — matches CategorySection body from TasksPage */}
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        {items.map((item, i) => (
          <NeedsCallItemRow
            key={item.id}
            item={item}
            isLast={i === 0}   // first row has no top border; rest have border-top
            onResolve={onResolveTask}
            onDismiss={onDismissNeedsCall}
            dragHandlers={dragHandlersFor(item.id)}
            isDragging={dragId === item.id}
            isOver={overId === item.id}
          />
        ))}
      </div>
    </section>
  )
}
```

---

## Props wiring — confirm parent passes these to NeedsCallSection

In the component that renders `NeedsCallSection` (DashboardTop or CommandPage):

```jsx
<NeedsCallSection
  needsCall={needsCall}
  onResolveTask={onResolveTask}
  onDismissNeedsCall={onDismissNeedsCall}
  onNeedsCallOrderChange={onNeedsCallOrderChange}
/>
```

If `onDismissNeedsCall` and `onNeedsCallOrderChange` aren't yet wired from CommandPage,
stub them for now:
```jsx
onDismissNeedsCall={(id) => console.log('dismiss', id)}
onNeedsCallOrderChange={(items) => console.log('reorder', items)}
```

---

## Do NOT touch

- `TopBar`
- `ActivityHeatmap`
- `StatChip`
- `WeekSummary` / `WeeklySummaryCard` / `DailyUpdatesCard`
- `SectionHeader`, `AgeChip` (the existing dashboard one), `Tag`
- Any imports or exports at the top/bottom of the file
- Anything in `dashboard-sections.jsx` or `CommandPage.jsx`

---

## Validation

- [ ] NeedsYourCall section header: small colored dot (hue 25) + "NEEDS YOUR CALL" uppercase + count
- [ ] Each row: drag handle dots → checkbox → TypeDot → title → source label → reason → AgeChip
- [ ] Drag handle fades in on hover, stays subtle otherwise
- [ ] TypeDot color: green for project-sourced tasks, blue for people, amber for ideas
- [ ] Checkbox fills green with checkmark when clicked
- [ ] Row background changes to `var(--panel-2)` on hover
- [ ] Section wrapper: `var(--panel)` background, border, borderRadius 10
- [ ] Drag to reorder works within the section
- [ ] Visually identical to a TasksPage CategorySection
- [ ] `bun run build` passes
