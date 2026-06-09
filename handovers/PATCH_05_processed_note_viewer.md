# Patch 05 — Notes Folder: Editable Viewer + Design-Correct Layout
**Root cause:** `VaultFileViewer` is a generic component — it has no title field, no DictateButton, no TrashMenuButton, and its layout is centred. Notes in `notes/` need the `ProcessedNoteView` layout from the design: same header structure as InboxPage but without the Process button, editable title + body, left-aligned canvas.  
**Fix:** Create `ProcessedNoteViewer.jsx` specifically for `notes/` files. Route `notes/` paths to it from App.jsx. Everything else keeps using VaultFileViewer.

---

## Pre-flight reads

1. `src/core/InboxPage.jsx` — find the `TrashMenuButton` and `TrashMenuItem` helper functions (added in Patch 03). You will copy or import them into `ProcessedNoteViewer`.
2. `src/hooks/useVoiceDictation.js` — note the exact destructured interface: `{ isListening, isSupported, start, stop }`.
3. `src/hooks/useMarkdownEditor.js` — confirm `onChange` is supported. If it is not yet wired, add it now before proceeding (see note at end of Step 1).
4. `src/App.jsx` — find where `page === 'viewer'` renders `VaultFileViewer`. You will add a condition that routes `notes/` paths to `ProcessedNoteViewer` instead.

---

## Step 1 — ProcessedNoteViewer.jsx (new)

Create `src/core/ProcessedNoteViewer.jsx` in full.

```jsx
// src/core/ProcessedNoteViewer.jsx
// Viewer/editor for files in the notes/ folder.
// Matches ProcessedNoteView from the design: same header as InboxPage
// (date left, DictateButton + TrashMenuButton right) but without ProcessButton.
// Left-aligned canvas: padding "32px 48px 48px", maxWidth 760.
// Editable title (input, 30px) + editable body (Milkdown, 800ms autosave).

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor'
import { useVoiceDictation } from '../hooks/useVoiceDictation'

export default function ProcessedNoteViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  onConfirmAction,
}) {
  const [title,      setTitle]      = useState('')
  const [editorBody, setEditorBody] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [lastSavedTime, setLastSavedTime] = useState('')
  const saveTimer = useRef(null)

  const { EditorComponent } = useMarkdownEditor({
    initialContent: editorBody,
    onChange: handleBodyChange,
  })

  const { isListening, isSupported, start, stop } = useVoiceDictation()

  // Load file when path changes
  useEffect(() => {
    if (filePath) loadFile(filePath)
  }, [filePath])

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    setLastSavedTime('')
    try {
      const raw = await readFile(path)
      if (raw.trimStart().startsWith('# ')) {
        const lines = raw.split('\n')
        setTitle(lines[0].replace(/^#+ /, '').trim())
        setEditorBody(lines.slice(1).join('\n').trimStart())
      } else {
        setTitle('')
        setEditorBody(raw)
      }
    } catch {
      setTitle('')
      setEditorBody('')
    }
    setLoading(false)
  }

  function handleBodyChange(newBody) {
    setEditorBody(newBody)
    setSaveStatus('idle')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(newBody), 800)
  }

  const save = useCallback(async (body) => {
    if (!filePath) return
    setSaveStatus('saving')
    const full = title.trim() ? `# ${title.trim()}\n\n${body}` : body
    try {
      await writeFile(filePath, full)
      const t = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
      setLastSavedTime(t)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch { setSaveStatus('error') }
  }, [filePath, writeFile, title])

  // Save when title changes (after a short debounce)
  useEffect(() => {
    if (!filePath || loading) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(editorBody), 800)
  }, [title])

  // Parse display date from filename (expects YYYY-MM-DD.md)
  const headerDate = (() => {
    if (!filePath) return ''
    const raw = filePath.replace('notes/', '').replace('.md', '')
    const d = new Date(raw)
    if (isNaN(d)) return raw.toUpperCase()
    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    }).toUpperCase()
    const daysAgo = Math.floor((Date.now() - d) / 86_400_000)
    const age = daysAgo === 0 ? 'TODAY'
      : daysAgo === 1 ? '1 DAY AGO'
      : `${daysAgo} DAYS AGO`
    return `${formatted} · ${age}`
  })()

  const noteLabel = title || filePath?.replace('notes/', '').replace('.md', '') || 'this note'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
      Loading…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header — date left, buttons right */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 16, flexShrink: 0,
      }}>
        <div style={{
          fontSize: 13, color: 'var(--text-very-dim)',
          letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
        }}>
          {headerDate}
          {lastSavedTime && (
            <span style={{ marginLeft: 8, opacity: 0.6 }}>· saved {lastSavedTime}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Dictate button */}
          <DictateBtn active={isListening} disabled={!isSupported} onClick={isListening ? stop : start} />

          {/* Trash menu button — Archive / Delete */}
          <TrashMenuButton
            label={noteLabel}
            onConfirmAction={onConfirmAction}
            onArchive={async () => {
              const filename = filePath.split('/').pop()
              const content  = await readFile(filePath)
              await writeFile(`archive/${filename}`, content)
              await deleteFile(filePath)
            }}
            onDelete={async () => {
              await deleteFile(filePath)
            }}
          />

        </div>
      </header>

      {/* Canvas — left-aligned, maxWidth 760, same as InboxPage */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>

          {/* Editable title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled"
            style={{
              display: 'block', width: '100%',
              fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em',
              color: 'var(--text)', background: 'transparent',
              border: 'none', outline: 'none',
              padding: 0, marginBottom: 20, fontFamily: 'inherit',
            }}
          />

          {/* Editable body — remounts when filePath changes */}
          <div key={filePath}>
            <EditorComponent />
          </div>

        </div>
      </div>

    </div>
  )
}

// ─── DictateBtn ──────────────────────────────────────────────────────────────
// Matches DictateButton from design v3 with hover states.

function DictateBtn({ active, disabled, onClick }) {
  const [hov, setHov] = useState(false)
  const bgActive    = 'oklch(0.70 0.18 22 / 0.16)'
  const bgActiveHov = 'oklch(0.70 0.18 22 / 0.24)'
  const bgIdle      = 'var(--panel)'
  const bgIdleHov   = 'var(--panel-2)'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        background: active ? (hov ? bgActiveHov : bgActive) : (hov ? bgIdleHov : bgIdle),
        color: active ? 'oklch(0.84 0.16 22)' : 'var(--text)',
        border: `1px solid ${
          active
            ? (hov ? 'oklch(0.70 0.18 22 / 0.55)' : 'oklch(0.70 0.18 22 / 0.40)')
            : (hov ? 'var(--border-strong)'        : 'var(--border)')
        }`,
        borderRadius: 8, fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: active ? 'oklch(0.75 0.20 22)' : 'var(--text-very-dim)',
        boxShadow: active ? '0 0 0 4px oklch(0.70 0.18 22 / 0.20)' : 'none',
        animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      {active ? 'Recording…' : 'Dictate'}
    </button>
  )
}

// ─── TrashMenuButton ──────────────────────────────────────────────────────────
// Shared with InboxPage — if you extracted to TrashMenuButton.jsx in Patch 03,
// import it instead of redefining here.

function TrashMenuButton({ label, onConfirmAction, onArchive, onDelete }) {
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
      title: `Archive "${label}"?`,
      message: 'This note will be moved to archive/.',
      confirmLabel: 'Archive', danger: false,
      onConfirm: onArchive,
    })
  }

  const handleDelete = () => {
    setOpen(false)
    onConfirmAction({
      title: `Delete "${label}"?`,
      message: 'This file will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete', danger: true,
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
          color:      open ? 'var(--text)'   : 'var(--text-dim)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          transition: 'background .12s, color .12s, border-color .12s',
        }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)' } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = 'var(--panel)';   e.currentTarget.style.color = 'var(--text-dim)' } }}
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
          background: 'var(--panel-pop)', border: '1px solid var(--border)',
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
        color:      danger ? (hov ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)') : (hov ? 'var(--text)' : 'var(--text-dim)'),
        background: danger ? (hov ? 'oklch(0.70 0.18 22 / 0.12)' : 'transparent') : (hov ? 'var(--panel-2)' : 'transparent'),
      }}
    >
      {label}
    </div>
  )
}
```

> **TrashMenuButton duplication note:** If you extracted `TrashMenuButton` to `src/components/TrashMenuButton.jsx` in Patch 03, import it here instead:
> ```js
> import TrashMenuButton from '../components/TrashMenuButton'
> ```
> And remove the local definitions at the bottom of this file.

> **useMarkdownEditor onChange:** If `onChange` is not yet supported in the hook, open `src/hooks/useMarkdownEditor.js` and wire it now. Inside the `useEditor` config, fire `onChange?.(markdown)` on the editor's update event. This is required for both ProcessedNoteViewer and InboxPage to autosave correctly.

---

## Step 2 — App.jsx: route notes/ to ProcessedNoteViewer

Open `src/App.jsx`.

### 2a — Add import

```js
import ProcessedNoteViewer from './core/ProcessedNoteViewer'
```

### 2b — Update the viewer page case

Find the `page === 'viewer'` block. Add a branch for notes/ paths:

```jsx
{page === 'viewer' && activePath?.startsWith('notes/') && (
  <ProcessedNoteViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
    deleteFile={deleteFile}
    onConfirmAction={showConfirm}
  />
)}

{page === 'viewer' && activePath && !activePath.startsWith('notes/') && (
  <VaultFileViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
    deleteFile={deleteFile}
    onFileDeleted={() => {
      setActivePath(null)
      listTree().then(setTree).catch(() => {})
    }}
    onConfirmAction={showConfirm}
  />
)}
```

---

## Step 3 — InboxPage.jsx: confirm canvas layout matches design

Open `src/core/InboxPage.jsx`. Verify the content area wrapper uses these exact inline styles (from Patch 04 — confirm it was applied):

```jsx
<div style={{ flex: 1, overflowY: 'auto' }}>
  <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>
    {/* title input */}
    {/* editor */}
  </div>
</div>
```

If it still uses Tailwind classes like `max-w-2xl mx-auto`, replace with the inline styles above. The `mx-auto` is what causes centring — removing it left-aligns the content. The `maxWidth: 760` then acts as a cap on wide screens without centring.

---

## Step 4 — Apply v3 hover states to InboxPage + Sidebar

These are the only other files changed between design v2 and v3.

### 4a — InboxPage.jsx: DictateButton hover

Open `src/core/InboxPage.jsx`. Find the DictateButton inline JSX in the header. It currently has no hover state. Apply the same `DictateBtn` pattern from Step 1 — either copy the component locally or extract `DictateBtn` to `src/components/DictateBtn.jsx` and import it in both files.

The three value changes from v3:
- **Background on hover (idle):** `var(--panel)` → `var(--panel-2)`
- **Background on hover (active/recording):** `oklch(0.70 0.18 22 / 0.16)` → `oklch(0.70 0.18 22 / 0.24)`
- **Border on hover (idle):** `var(--border)` → `var(--border-strong)`
- **Border on hover (active):** `oklch(0.70 0.18 22 / 0.40)` → `oklch(0.70 0.18 22 / 0.55)`
- **Transition:** add `border-color .15s` alongside `background .15s`

### 4b — InboxPage.jsx: ProcessButton hover

Find the ProcessButton. Apply hover state from v3:

```jsx
// Add to ProcessButton:
const [hov, setHov] = useState(false)
const baseBg = 'oklch(0.80 0.13 80 / 0.12)'
const hovBg  = 'oklch(0.80 0.13 80 / 0.22)'

// Updated style props:
onMouseEnter={() => setHov(true)}
onMouseLeave={() => setHov(false)}
// ...
background: processing ? 'oklch(0.80 0.13 80 / 0.18)' : (hov ? hovBg : baseBg),
color: 'oklch(0.88 0.13 80)',                    // was 0.85, now 0.88 (slightly brighter)
border: `1px solid ${hov ? 'oklch(0.80 0.13 80 / 0.55)' : 'oklch(0.80 0.13 80 / 0.36)'}`,
transition: 'background .15s, border-color .15s', // was background only
```

### 4c — Sidebar.jsx: Dashboard nav item missing hover

Open `src/components/Sidebar.jsx`. Find the Dashboard nav item. In v2 the Tasks item had hover handlers but the Dashboard item did not. Add the missing handlers:

```jsx
// On the Dashboard navItem div:
onMouseEnter={(e) => {
  if (!isDashboard) {
    e.currentTarget.style.background = 'var(--panel-2)'
    e.currentTarget.style.color = 'var(--text)'
  }
}}
onMouseLeave={(e) => {
  if (!isDashboard) {
    e.currentTarget.style.background = 'transparent'
    e.currentTarget.style.color = 'var(--text-dim)'
  }
}}
```

The `!isDashboard` guard ensures the hover style doesn't override the active background when Dashboard is the current page.

---

## Build check

1. `bun run build` — passes
2. **New note in Notes folder** — click + on NOTES section → new file created → ProcessedNoteViewer opens → title input is editable, body editor is editable, typing triggers autosave ("saved HH:MM" appears in header)
3. **Existing note** — click a note in the sidebar NOTES section → ProcessedNoteViewer opens → correct header (date + age, not filename breadcrumb), DictateButton and TrashMenuButton visible
4. **No Process button** — notes view has Dictate + Trash only. Process button only appears in InboxPage.
5. **Title treatment** — 30px bold input, same as inbox, placeholder "Untitled"
6. **Left alignment** — content starts at 48px from left edge, max 760px wide, does not stretch to right edge, does not centre on wide screens
7. **Inbox alignment** — same check: still left-aligned (confirm Patch 04 held)
8. **Archive from notes** — trash icon → Archive → ConfirmDialog → confirm → file moves to archive/, note disappears from NOTES section
9. **Delete from notes** — trash icon → Delete → ConfirmDialog (red) → confirm → file deleted
10. **Context/archive/project files** — still open in VaultFileViewer (generic), not ProcessedNoteViewer
11. **Dictate in notes** — clicking Dictate turns button red + pulse, text changes to "Recording…"
12. **Dictate hover (idle)** — hover over Dictate (not recording) → background shifts to `var(--panel-2)`, border to `var(--border-strong)`, smooth transition
13. **Dictate hover (recording)** — while recording, hover → background deepens from `0.16` to `0.24` opacity, border from `0.40` to `0.55`
14. **Process note hover** — hover → amber background brightens from `0.12` to `0.22` opacity, border from `0.36` to `0.55`, text slightly brighter (`0.88` vs `0.85`)
15. **Dashboard hover** — hover over Dashboard nav item when not on Dashboard → background becomes `var(--panel-2)`, text becomes `var(--text)`. No hover when already active.
