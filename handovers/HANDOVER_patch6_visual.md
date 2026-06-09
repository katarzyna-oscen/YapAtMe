# Memory OS — Patch 6: Dashboard, Settings & Button System
*Prepared for Copilot handoff · 2026-05-26*

---

## Overview

Three visual patches in one pass. Apply in order, build after each section.

1. **Shared button system** — extract unified button components
2. **Patch 6 — Dashboard Summaries** — three-card layout, Rebuild in section header
3. **Settings redesign** — secondary nav, ActionCard layout, four panels

---

## Part 1 — Shared button system

**New file:** `src/components/ui/Buttons.jsx`

Extract and export the following button components. These replace all ad-hoc button styles across the app. After creating the file, find all buttons in the app that match these patterns and replace them.

### `PrimaryButton`
Amber/gold tint. Used for primary actions: Save, Approve, "Looks good route this", Process Note.

```jsx
export function PrimaryButton({ children, onClick, type = 'button', disabled, loading }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 16px',
        background: hov ? 'oklch(0.80 0.13 80 / 0.32)' : 'oklch(0.80 0.13 80 / 0.22)',
        color: 'oklch(0.92 0.13 80)',
        border: `1px solid ${hov ? 'oklch(0.80 0.13 80 / 0.65)' : 'oklch(0.80 0.13 80 / 0.45)'}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >{loading ? 'Loading…' : children}</button>
  )
}
```

### `SecondaryButton`
Ghost style. Used for secondary actions: Cancel, Dismiss, Test Connection, Run migration.
Accepts a `danger` prop for destructive actions (red tint).

```jsx
export function SecondaryButton({ children, onClick, danger, disabled }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 16px',
        background: danger
          ? (hov ? 'oklch(0.70 0.18 22 / 0.16)' : 'transparent')
          : (hov ? 'var(--panel-2)' : 'var(--panel)'),
        color: danger
          ? (hov ? 'oklch(0.88 0.16 22)' : 'oklch(0.78 0.16 22)')
          : (hov ? 'var(--text)' : 'var(--text-dim)'),
        border: `1px solid ${
          danger
            ? (hov ? 'oklch(0.70 0.18 22 / 0.55)' : 'oklch(0.70 0.18 22 / 0.30)')
            : (hov ? 'var(--border-strong)' : 'var(--border)')
        }`,
        borderRadius: 8,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >{children}</button>
  )
}
```

### `IconButton`
Small ghost button with icon + optional label. Used for: Rebuild context, Generate, dictation, refresh.

```jsx
export function IconButton({ children, onClick, label, title, loading }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: hov ? 'var(--panel-2)' : 'transparent',
        color: hov ? 'var(--text)' : 'var(--text-dim)',
        border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 6,
        fontSize: 11.5,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      {loading ? (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M13 8a5 5 0 1 1-1.6-3.66" /><path d="M13 2.5V5h-2.5" />
        </svg>
      ) : children}
      {label && !loading && label}
      {loading && 'Rebuilding…'}
    </button>
  )
}
```

Add `@keyframes spin { to { transform: rotate(360deg) } }` to `index.css` if not already present.

**After creating the file:** replace existing inline button styles in these files with the new components:
- `CleanupModal.jsx` — Cancel → `SecondaryButton`, "Looks good, route this" → `PrimaryButton`
- `RoutingReview.jsx` — Approve → `PrimaryButton`, Dismiss → `SecondaryButton`, Done → `PrimaryButton`, Cancel → `SecondaryButton`
- Any other modals or action buttons across the app that match these patterns

---

## Part 2 — Patch 6: Dashboard Summaries section

**File:** The component that currently renders the dashboard Summaries/WeekSummary section.

### Data loading

On dashboard mount, read `context/_context.md` and extract two sections:
```js
function extractSection(markdown, heading) {
  const rx = new RegExp(`^##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'im')
  return markdown?.match(rx)?.[1]?.trim() || null
}
const narrativeThread = extractSection(contextMd, 'Narrative thread')
const currentFocus = extractSection(contextMd, 'Current focus')
```

Also read `last_rebuild` from `context/activity-log.json` for the footer timestamp.

### Section header

```
SUMMARIES                                    [⟳ Rebuild context]
```

The Rebuild context button is `IconButton` with a refresh SVG icon:
```jsx
<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
  <path d="M13 8a5 5 0 1 1-1.6-3.66" /><path d="M13 2.5V5h-2.5" />
</svg>
```

On click: call `rebuildContext(readFile, writeFile, settings)`, show `loading` state on the button, refresh `narrativeThread` and `currentFocus` state when done.

### Three cards — equal width grid

```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 14,
  alignItems: 'stretch',
}}>
```

### Card 1 — Narrative thread (tone: 240, blue)

- Content: `narrativeThread` from `_context.md`
- Fallback: "Context not yet built — click Rebuild context to generate"
- Footer: `Context built [formatted last_rebuild timestamp]` or "Never rebuilt"
- No button of its own
- During rebuild: card shows subtle opacity reduction

### Card 2 — Current focus (tone: 150, green)

- Content: `currentFocus` from `_context.md`
- Fallback: "No focus data yet"
- Footer: same `last_rebuild` timestamp as Card 1
- No button

### Card 3 — Updates (tone: 80, amber)

- Keep existing behaviour exactly — completed tasks from previous day
- Keep its own Generate button (`IconButton` with spark/star SVG):
  ```jsx
  <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
    <path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" />
  </svg>
  ```
  Style this button with amber tint matching the Updates card tone:
  ```
  background: oklch(0.80 0.13 80 / 0.12) → hover: oklch(0.80 0.13 80 / 0.22)
  color: oklch(0.88 0.13 80)
  border: 1px solid oklch(0.80 0.13 80 / 0.36) → hover: oklch(0.80 0.13 80 / 0.55)
  ```

### SummaryCard primitive

Each card:
```jsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  padding: '16px 18px',
  background: `linear-gradient(180deg, oklch(0.72 0.13 ${tone} / 0.05), transparent 65%), var(--panel)`,
  border: '1px solid var(--border)',
  borderRadius: 10,
  minHeight: 220,
}}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
    <h3 style={{ margin: 0, fontWeight: 600, letterSpacing: '-0.005em', color: 'var(--text)', fontSize: 16 }}>{title}</h3>
    {action}  {/* optional — only Updates card has one */}
  </div>
  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    {children}
  </div>
</div>
```

Footer (pinned to bottom of each card):
```jsx
<div style={{
  marginTop: 'auto',
  paddingTop: 12,
  fontSize: 11,
  letterSpacing: '0.04em',
  color: 'var(--text-very-dim)',
  fontVariantNumeric: 'tabular-nums',
}}>
  {text}
</div>
```

**Remove:** the existing "Generate" button from the current Summary of the Week card.
**Remove:** any separate WeekSummary generation logic that makes its own LLM call on this section.

---

## Part 3 — Settings redesign

**File:** The current Settings page/component.

### Layout

Two-column layout:

```jsx
<div style={{ display: 'flex', minHeight: '100%' }}>
  <aside style={{
    flex: '0 0 220px',
    width: 220,
    borderRight: '1px solid var(--border-subtle)',
    padding: '28px 14px',
  }}>
    {/* Secondary nav */}
  </aside>
  <main style={{ flex: 1, minWidth: 0, padding: '32px 48px 64px', maxWidth: 880 }}>
    {/* Panel content */}
  </main>
</div>
```

### Secondary nav

Four sections:
- AI Setup (default)
- Vault Maintenance
- Modules
- Dashboard

Nav item style (active / inactive):
```
active:   color var(--active), background var(--panel-2), fontWeight 500
inactive: color var(--text-dim), background transparent, fontWeight 400
hover:    background var(--panel-2), color var(--text)
padding: 8px 14px, borderRadius 7, fontSize 13.5
```

### Section heading and intro

```jsx
<h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 12px', color: 'var(--text)' }}>
<p style={{ margin: '0 0 28px', fontSize: 14, lineHeight: 1.55, color: 'var(--text-dim)', maxWidth: 640 }}>
```

### ActionCard primitive

Used in Vault Maintenance for each action:
```jsx
<div style={{
  padding: '18px 20px',
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  marginBottom: 14,
}}>
  <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
  <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)' }}>{description}</p>
  <div style={{ display: 'flex', gap: 8 }}>{children}</div>
  {footnote && <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-very-dim)' }}>{footnote}</div>}
</div>
```

### Four panels — exact content

**AI Setup:**
- Intro: "Choose the model provider and credentials Memory OS uses to process inbox notes, generate summaries, and route tasks."
- Fields: Provider (select), API Key (password input), Model (text, monospace)
- Buttons: `PrimaryButton` "Save Settings" + `SecondaryButton` "Test API Connection" + success toast

**Vault Maintenance:**
- ActionCard "Reconnect vault" → `PrimaryButton` "Reconnect vault"
- ActionCard "Rebuild context" → `PrimaryButton` "Rebuild context", footnote shows last rebuild timestamp
- ActionCard "Migrate entity tasks to index" → `SecondaryButton` "Run migration"
- ActionCard "Clean entity files" → `SecondaryButton danger` "Clean entity files"

**Modules:**
- Intro: "Disable modules to hide their sections and exclude them from note routing."
- Toggle rows for: Projects, People, Ideas
- Each row: panel card with checkbox on right, click anywhere to toggle

**Dashboard:**
- Intro: "Choose which sections appear on your dashboard and in what order."
- Drag-to-reorder list (use HTML5 drag and drop, existing logic if present)
- Toggle rows: Needs Your Call (locked), Summaries (locked), Projects, People, Ideas, Tasks
- Footnote: "Drag to reorder · uncheck to hide"

### Form field styles

```
Input/Select base:
  width: 100%, padding: 10px 12px
  background: var(--panel), color: var(--text)
  border: 1px solid var(--border) → focus: var(--accent)
  borderRadius: 8, fontSize: 13.5
  
FieldLabel:
  fontSize: 12, fontWeight: 600, letterSpacing: 0.04em
  color: var(--text-dim), marginBottom: 8
```

---

## Build order

1. Create `src/components/ui/Buttons.jsx` and replace button usages → build
2. Implement Patch 6 dashboard Summaries section → build
3. Implement Settings redesign → build

**Do not change:** any routing logic, task logic, activity log, or context rebuild logic. Visual changes only in Parts 2 and 3.
