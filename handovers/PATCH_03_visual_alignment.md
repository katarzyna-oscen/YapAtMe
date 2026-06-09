# Patch 03 — Visual Alignment (Design Handoff v2)
**Source of truth:** `sidebar.jsx`, `note-view.jsx`, `confirm-dialog.jsx` from the Claude Design handoff.  
**Scope:** ConfirmDialog component, sidebar visual fixes (sync icon, 3-dots SVG, + button, badge), InboxPage and VaultFileViewer action button alignment, CSS animation fixes.  
**All values in this document are taken verbatim from the design source.**

---

## Pre-flight reads

1. `src/components/Sidebar.jsx` — find: the Dashboard badge (`⟳`), the `rowMenuBtn` button JSX, the `sectionAdd` span, the Tasks badge
2. `src/core/InboxPage.jsx` — find: the current `···` or trash action button in the header
3. `src/components/VaultFileViewer.jsx` — find: the `···` button in the header
4. `src/App.jsx` — find: where ConfirmDialog is currently rendered (if at all), and how archive/delete actions are confirmed today
5. `src/index.css` — find: the `@keyframes pulse-dot` and `@keyframes sparkleSpin` blocks

---

## Complete file list

```
src/
  components/
    ConfirmDialog.jsx     ← NEW
    Sidebar.jsx           ← UPDATED (sync icon, 3-dots SVG, + button, badge, MenuItem sizing)
  core/
    InboxPage.jsx         ← UPDATED (TrashMenuButton replaces current action button)
  components/
    VaultFileViewer.jsx   ← UPDATED (TrashMenuButton replaces ··· button)
  App.jsx                 ← UPDATED (centralized confirmDialog state + showConfirm)
  index.css               ← UPDATED (modal animations, pulse keyframe name fix)
```

---

## Step 1 — index.css: add modal animations + fix pulse name

Open `src/index.css`. Find the `@keyframes pulse-dot` block. The design uses the name `pulse` (not `pulse-dot`). Add `pulse` as an alias so both names work:

```css
/* Design uses 'pulse' — add alongside existing pulse-dot */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(0.85); }
}
```

Add modal animation keyframes (used by ConfirmDialog):

```css
@keyframes modalFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes modalPopIn {
  from { opacity: 0; transform: scale(0.96) translateY(4px); }
  to   { opacity: 1; transform: scale(1)    translateY(0); }
}
```

---

## Step 2 — ConfirmDialog.jsx (new component)

Create `src/components/ConfirmDialog.jsx`. This is translated directly from the design source with React import adjustments for the app's module system:

```jsx
// src/components/ConfirmDialog.jsx
// Centered modal for destructive actions.
// Renders into document.body via ReactDOM.createPortal.
// Keyboard: Escape cancels, Enter confirms.

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel  = 'Cancel',
  danger       = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
      if (e.key === 'Enter')  onConfirm?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  const hue = danger ? 22 : 230

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        animation: 'modalFadeIn .12s ease-out',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)',
          padding: 24,
          color: 'var(--text)',
          animation: 'modalPopIn .15s ease-out',
        }}
      >
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: `oklch(0.70 0.18 ${hue} / 0.16)`,
            color: `oklch(0.84 0.16 ${hue})`,
          }}>
            <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 3.5v5" />
              <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
              <path d="M7.13 1.7 1.4 12a1 1 0 0 0 .87 1.5h11.46a1 1 0 0 0 .87-1.5L8.87 1.7a1 1 0 0 0-1.74 0Z" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {title}
          </h2>
        </div>

        {/* Message */}
        <p style={{ margin: '0 0 22px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-dim)' }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 14px', background: 'transparent',
              color: 'var(--text-dim)', border: '1px solid var(--border)',
              borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{
              padding: '8px 14px',
              background: danger ? `oklch(0.62 0.20 ${hue})` : `oklch(0.62 0.16 ${hue})`,
              color: '#fff', border: '1px solid transparent',
              borderRadius: 7, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = `oklch(0.66 0.20 ${hue})`}
            onMouseLeave={(e) => e.currentTarget.style.background = danger ? `oklch(0.62 0.20 ${hue})` : `oklch(0.62 0.16 ${hue})`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

---

## Step 3 — App.jsx: centralize confirm dialog

Open `src/App.jsx`. Add a single confirm dialog state that any component can trigger:

### 3a — Add import

```js
import ConfirmDialog from './components/ConfirmDialog'
```

### 3b — Add state

```js
const [confirmDialog, setConfirmDialog] = useState({
  open: false, title: '', message: '', confirmLabel: 'Delete', danger: true, onConfirm: null,
})

const showConfirm = ({ title, message, confirmLabel = 'Delete', danger = true, onConfirm }) => {
  setConfirmDialog({ open: true, title, message, confirmLabel, danger, onConfirm })
}

const hideConfirm = () => setConfirmDialog(s => ({ ...s, open: false, onConfirm: null }))
```

### 3c — Render ConfirmDialog at the top level

At the very bottom of the App JSX return, before the closing tag:

```jsx
<ConfirmDialog
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  confirmLabel={confirmDialog.confirmLabel}
  danger={confirmDialog.danger}
  onConfirm={() => { confirmDialog.onConfirm?.(); hideConfirm() }}
  onCancel={hideConfirm}
/>
```

### 3d — Pass showConfirm to child components

```jsx
<Sidebar
  ...existing props...
  onConfirmAction={showConfirm}
/>

{page === 'viewer' && (
  <VaultFileViewer
    ...existing props...
    onConfirmAction={showConfirm}
  />
)}

{page === 'inbox' && (
  <InboxPage
    ...existing props...
    onConfirmAction={showConfirm}
  />
)}
```

---

## Step 4 — Sidebar.jsx: visual updates

Open `src/components/Sidebar.jsx`. Make the following targeted changes.

### 4a — Dashboard sync icon

Find the Dashboard nav item. Replace the `badge="⟳"` text span with the proper sync SVG icon. The new icon component (already defined in the Icon function from H08) should be:

```jsx
{/* Dashboard nav item badge — sync icon */}
<span
  title="Sync vault"
  onClick={onBadgeClick ? (e) => { e.stopPropagation(); onBadgeClick() } : undefined}
  style={{
    marginLeft: 'auto',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 4,
    color: 'var(--text-dim)',
    cursor: onBadgeClick ? 'pointer' : 'default',
  }}
  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)' }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
>
  <Icon name="sync" size={14} />
</span>
```

Confirm the `Icon` function includes the `"sync"` case. If not, add it:

```jsx
case 'sync':
  return (
    <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8a5 5 0 1 1-1.6-3.66" />
      <path d="M13 2.5V5h-2.5" />
    </svg>
  )
```

### 4b — Tasks count badge

Find the Tasks nav item badge. Update to match the design's `navItemBadge` style:

```jsx
{openTaskCount != null && openTaskCount > 0 && (
  <span style={{
    marginLeft: 'auto',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px',
    borderRadius: 4,
    background: 'var(--panel-2)',
    color: 'var(--text-dim)',
    fontSize: 11, fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  }}>
    {openTaskCount}
  </span>
)}
```

### 4c — Section + button

Find the `sectionAdd` span (the + button on section headers). Replace with the design spec — a proper bordered button:

```jsx
{addable && (
  <span
    onClick={e => { e.stopPropagation(); onAdd?.() }}
    style={{
      marginLeft: 'auto',
      width: 18, height: 18,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid var(--border)',
      borderRadius: 4,
      color: 'var(--text-dim)',
      cursor: 'pointer',
      transition: 'background .12s, color .12s, border-color .12s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--panel-2)'
      e.currentTarget.style.color = 'var(--text)'
      e.currentTarget.style.borderColor = 'var(--border-strong)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent'
      e.currentTarget.style.color = 'var(--text-dim)'
      e.currentTarget.style.borderColor = 'var(--border)'
    }}
  >
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 2.5v7M2.5 6h7" />
    </svg>
  </span>
)}
```

### 4d — 3-dots row menu button: replace text with SVG circles

Find the `rowMenuBtn` button. Replace any text `···` with the three-circle SVG:

```jsx
<button
  ref={btnRef}
  onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
  aria-label="More actions"
  style={{
    width: 20, height: 20,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: 'none',
    background: menuOpen ? 'var(--border)' : 'transparent',
    color: 'var(--text)',
    borderRadius: 4, cursor: 'pointer', padding: 0,
    opacity: (hover || menuOpen) ? 1 : 0,
    transition: 'opacity .12s, background .12s',
    flexShrink: 0,
  }}
  onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = 'var(--border)' }}
  onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
>
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <circle cx="3.5"  cy="8" r="1.3" />
    <circle cx="8"    cy="8" r="1.3" />
    <circle cx="12.5" cy="8" r="1.3" />
  </svg>
</button>
```

### 4e — Dropdown menu shadow + MenuItem sizing

Find the dropdown menu container. Update shadow and border to match design:

```js
// Dropdown container:
{
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0, zIndex: 50,
  minWidth: 150, padding: 4,
  background: 'var(--panel-pop)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
}
```

Find the `MenuItem` component (or equivalent). Update padding and font size:

```jsx
// MenuItem: padding 6px 10px, fontSize 12.5
style={{ padding: '6px 10px', fontSize: 12.5, ... }}
```

### 4f — Wire onConfirmAction in Sidebar archive/delete

Find where archive and delete are currently confirmed in the sidebar (the confirmation card or inline confirm state). Replace with a call to the new centralized dialog.

Add `onConfirmAction` to the Sidebar props. When delete is chosen:

```js
// In the delete handler inside SidebarFileRow or wherever onItemAction is handled:
onConfirmAction({
  title: `Delete "${item.label}"?`,
  message: 'This file will be permanently removed from your vault. This cannot be undone.',
  confirmLabel: 'Delete',
  danger: true,
  onConfirm: () => handleDeleteFile(item.path),
})

// For archive:
onConfirmAction({
  title: `Archive "${item.label}"?`,
  message: `This file will be moved to archive/.`,
  confirmLabel: 'Archive',
  danger: false,
  onConfirm: () => handleArchiveFile(item.path),
})
```

---

## Step 5 — InboxPage.jsx: replace action button with TrashMenuButton

Open `src/core/InboxPage.jsx`. Find the current archive/delete button in the header (may be `···`, a trash button, or an "Archive" text button).

Replace it with the `TrashMenuButton` component from the design — an icon-only button (34×34) that opens an Archive/Delete dropdown. Instead of handling the confirmation inline, it calls `onConfirmAction`.

```jsx
// TrashMenuButton — add inside InboxPage.jsx (or import from a shared file)
function TrashMenuButton({ onConfirmAction, onArchive, onDelete, label }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleArchive = () => {
    setOpen(false)
    onConfirmAction({
      title: `Archive this note?`,
      message: `"${label}" will be moved to archive/.`,
      confirmLabel: 'Archive',
      danger: false,
      onConfirm: onArchive,
    })
  }

  const handleDelete = () => {
    setOpen(false)
    onConfirmAction({
      title: `Delete this note?`,
      message: 'This file will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: onDelete,
    })
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Archive or delete"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34,
          background: open ? 'var(--panel-2)' : 'var(--panel)',
          color: open ? 'var(--text)' : 'var(--text-dim)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          transition: 'background .12s, color .12s, border-color .12s',
        }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)' } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = 'var(--panel)'; e.currentTarget.style.color = 'var(--text-dim)' } }}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5h10" />
          <path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
          <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
          <path d="M7 7v4M9 7v4" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          minWidth: 160, padding: 4,
          background: 'var(--panel-pop)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
        }}>
          <TrashMenuItem label="Archive" onClick={handleArchive} />
          <TrashMenuItem label="Delete"  onClick={handleDelete} danger />
        </div>
      )}
    </div>
  )
}

function TrashMenuItem({ label, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 5, fontSize: 13, cursor: 'pointer',
        color: danger
          ? (hov ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)')
          : (hov ? 'var(--text)' : 'var(--text-dim)'),
        background: hov
          ? (danger ? 'oklch(0.70 0.18 22 / 0.12)' : 'var(--panel-2)')
          : 'transparent',
      }}
    >
      {label}
    </div>
  )
}
```

Replace the current action button in the InboxPage header JSX with:

```jsx
<TrashMenuButton
  label={noteDateStr || 'this note'}
  onConfirmAction={onConfirmAction}
  onArchive={handleArchiveNote}
  onDelete={handleDeleteNote}
/>
```

---

## Step 6 — VaultFileViewer.jsx: same TrashMenuButton pattern

Open `src/components/VaultFileViewer.jsx`. Replace the current `···` button and its inline menu with the same `TrashMenuButton` + `TrashMenuItem` pattern from Step 5.

Either copy the two helper components directly into the file, or extract them to `src/components/TrashMenuButton.jsx` and import in both InboxPage and VaultFileViewer.

> **Recommended:** extract to `src/components/TrashMenuButton.jsx` — it's used in both InboxPage and VaultFileViewer, possibly in the future ProcessedNoteView too. Avoids duplication.

Wire to `onConfirmAction` prop (passed from App.jsx in Step 3d).

---

## Build check

1. `bun run build` — passes
2. **ConfirmDialog — keyboard:** open any confirm → Escape cancels, Enter confirms, no page refresh
3. **ConfirmDialog — visual:** centered overlay with blur, warning triangle icon, title 16px, message 13.5px, bordered cancel button, filled danger/action button
4. **Dashboard sync:** 14px SVG sync icon, 20×20 hover area, correct colour on hover
5. **Tasks badge:** minWidth 18, height 18, `var(--panel-2)` background, shows count
6. **Section + button:** 18×18 bordered box with SVG plus, border changes on hover
7. **Row 3-dots:** SVG three circles, hidden (opacity 0) until row hover, opacity 1 when hovered or menu open
8. **Row menu dropdown:** `var(--panel-pop)` background, correct shadow, borderRadius 8, items 12.5px / 6px 10px padding
9. **InboxPage trash button:** 34×34 icon button with trash SVG, opens Archive/Delete dropdown, both items route through ConfirmDialog
10. **VaultFileViewer trash button:** same pattern as InboxPage
11. **Confirm archive:** danger=false → icon and button use blue hue (230), not red
12. **Confirm delete:** danger=true → icon and button use red hue (22)
