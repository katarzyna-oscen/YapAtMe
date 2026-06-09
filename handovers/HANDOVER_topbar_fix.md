# Handover — TopBar + ActivityHeatmap Fix

**File:** `src/core/dashboard-top.jsx`
**Scope:** Replace ONLY the `TopBar` and `ActivityHeatmap` component implementations.
Do NOT touch any other component in this file.

---

## What is broken

The current TopBar puts title and stats in a flat row with no date, and the heatmap
stretches full-width instead of sitting in the top-right corner.

---

## Exact replacements

### Replace the `TopBar` component

Find the existing `TopBar` function and replace it entirely with:

```jsx
function TopBar({ stats, activityData }) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).toUpperCase()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '32px 48px 28px',
      borderBottom: '1px solid var(--border-subtle)',
      gap: 24,
      flexShrink: 0,
    }}>
      {/* Left — date, title, stats */}
      <div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-very-dim)',
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}>
          {date}
        </div>
        <h1 style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
          color: 'var(--text)',
        }}>
          Command center
        </h1>
        <div style={{
          marginTop: 10,
          display: 'flex',
          gap: 18,
          fontSize: 12.5,
          color: 'var(--text-dim)',
        }}>
          <StatChip label="projects"   value={stats.projects} />
          <StatChip label="stale"      value={stats.stale}    tone={stats.stale > 0 ? 'warn' : null} />
          <StatChip label="open tasks" value={stats.actions}  />
        </div>
      </div>

      {/* Right — activity heatmap */}
      <ActivityHeatmap cells={activityData} />
    </div>
  )
}
```

### Replace `StatChip` (or add if missing)

```jsx
function StatChip({ label, value, tone }) {
  const color = tone === 'warn' ? 'var(--accent)' : 'var(--text)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ color, fontWeight: 600, fontSize: 14 }}>{value}</span>
      <span style={{ color: 'var(--text-very-dim)' }}>{label}</span>
    </span>
  )
}
```

### Replace the `ActivityHeatmap` component

Find the existing `ActivityHeatmap` function and replace it entirely with:

```jsx
function ActivityHeatmap({ cells = [] }) {
  if (!cells.length) return null

  const max    = Math.max(...cells.map(c => c.count), 1)
  const total  = cells.reduce((s, c) => s + c.count, 0)
  const today  = cells[cells.length - 1]?.count ?? 0

  // Streak = consecutive days with activity counting back from today
  let streak = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) streak++
    else break
  }

  const colorFor = (n) => {
    if (n === 0) return 'var(--panel-2)'
    const t = n / max
    return `oklch(${0.34 + t * 0.40} ${0.05 + t * 0.10} 240)`
  }

  // Split flat 84-cell array into 12 columns of 7 days
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const CELL = 8
  const GAP  = 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      {/* Label */}
      <div style={{
        fontSize: 12,
        letterSpacing: '0.04em',
        color: 'var(--text-very-dim)',
        whiteSpace: 'nowrap',
      }}>
        ACTIVITY · 12 WEEKS
      </div>

      {/* Stats column + grid */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        {/* Numeric summary */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
          fontSize: 11.5,
          color: 'var(--text-dim)',
          whiteSpace: 'nowrap',
          paddingBottom: 2,
        }}>
          <span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{total}</span> touches
          </span>
          <span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{streak}</span>d streak
          </span>
          <span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{today}</span> today
          </span>
        </div>

        {/* Heatmap grid — 12 columns × 7 rows */}
        <div style={{ display: 'flex', gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const c = week[di]
                if (!c) return <div key={di} style={{ width: CELL, height: CELL }} />
                return (
                  <div
                    key={di}
                    title={`${c.date instanceof Date
                      ? c.date.toLocaleDateString()
                      : c.date} · ${c.count} touches`}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 2,
                      background: colorFor(c.count),
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Props contract — what CommandPage must pass to TopBar

Confirm that wherever `<TopBar>` is rendered in `dashboard-top.jsx` or `CommandPage.jsx`,
it receives both props:

```jsx
<TopBar stats={stats} activityData={activityData} />
```

Where:
- `stats` = `{ projects: number, stale: number, actions: number }`
- `activityData` = `{ date: Date, count: number }[]` — 84 cells, oldest first

If `TopBar` is rendered inside a parent component in `dashboard-top.jsx` that receives
these as props, make sure the parent forwards them:

```jsx
// Example — if DashboardTop is the export:
export default function DashboardTop({ stats, activityData, ...rest }) {
  return (
    <>
      <TopBar stats={stats} activityData={activityData} />
      {/* rest of sections */}
    </>
  )
}
```

---

## Do NOT touch

- `NeedsCallSection` / `NeedsCallRow`
- `WeekSummary` / `WeeklySummaryCard` / `DailyUpdatesCard`
- `SectionHeader`, `Tag`, `AgeChip`
- Any imports or exports
- Anything in `dashboard-sections.jsx` or `CommandPage.jsx`

---

## Validation

- [ ] TopBar shows: date line (e.g. "SUNDAY, MAY 24") above "Command center" h1
- [ ] Stats sit below the h1 in a row: "5 projects · 0 stale · 18 open tasks"
- [ ] Heatmap is in the top-right corner, NOT stretched full width
- [ ] Heatmap shows 12 columns × 7 rows of small squares
- [ ] Touches / streak / today counts show to the left of the grid
- [ ] Empty days render as `var(--panel-2)`, active days in blue gradient
- [ ] `bun run build` passes
