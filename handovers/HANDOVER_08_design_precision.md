# Handover 08 — Design Precision Pass (Sidebar, CSS Aliases, Inbox Buttons)
**Status:** Ready for implementation  
**Source of truth:** `memory-os/project/sidebar.jsx` and `memory-os/project/note-view.jsx` from the Claude Design handoff. All measurements, colours, and behaviour in this document come directly from those files.  
**Scope:** (1) Fix CSS variable name mismatches. (2) Rewrite Sidebar to exactly match the design. (3) Rewrite InboxPage header buttons to match DictateButton and ProcessButton from the design.  
**Prerequisite:** H07 applied and building cleanly. Module toggle bug fixed.  
**Ends with:** Sidebar matches the design pixel-for-pixel. Inbox buttons match. All components can use either naming convention for CSS variables.

---

## The root problem: CSS variable name mismatch

The design uses different variable names than the codebase. This is why components look wrong even when the colours are correct — the variables resolve to `undefined`.

| Design uses | Codebase has | Resolves to |
|---|---|---|
| `var(--bg)` | `var(--bg-primary)` | `#010619` |
| `var(--text)` | `var(--text-primary)` | `#e7ecff` |
| `var(--text-dim)` | `var(--text-secondary)` | `#94a0c9` |
| `var(--text-very-dim)` | `var(--text-muted)` | `#5f6a96` |
| `var(--font-mono)` | `var(--font-sans)` | Geist |

Fix: add aliases in `index.css`. Existing components keep working, new code can use either name.

---

## Step 1 — index.css: add design aliases

Open `src/index.css`. Find the `:root` block. Add these aliases at the end of it:

```css
  /* ── Design name aliases ── */
  /* Components can use either the codebase names or the design names */
  --bg:            var(--bg-primary);
  --text:          var(--text-primary);
  --text-dim:      var(--text-secondary);
  --text-very-dim: var(--text-muted);
  --font-mono:     var(--font-sans);  /* Geist serves as mono too */
```

---

## Step 2 — Sidebar: complete rewrite

Replace `src/components/Sidebar.jsx` in full. Every value below is taken directly from the design source.

```jsx
// src/components/Sidebar.jsx
// Matches memory-os/project/sidebar.jsx from Claude Design exactly.
// Layout: fixed header → fixed top nav → scrollable tree → fixed bottom nav
// Icons: inline SVG, no external library needed

import { useState } from 'react'
import { useSettings } from '../hooks/useSettings'

// ─── Inline SVG icon set (from design source) ────────────────────────────────

function Icon({ name, size = 14 }) {
  const s = { width: size, height: size, flex: '0 0 auto' }
  switch (name) {
    case 'grid': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    )
    case 'check': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m3 8 3.5 3.5L13 5" />
      </svg>
    )
    case 'cog': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" />
      </svg>
    )
    case 'folder': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4c.4 0 .77.16 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
      </svg>
    )
    case 'plus': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 3v10M3 8h10" />
      </svg>
    )
    case 'caret': return (
      <svg viewBox="0 0 10 10" style={s} fill="currentColor">
        <path d="M3 1 L7 5 L3 9 Z" />
      </svg>
    )
    case 'project': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <path d="M2 6h12" />
      </svg>
    )
    case 'person': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="5.5" r="2.5" />
        <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" />
      </svg>
    )
    case 'idea': return (
      <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" />
        <path d="M6 14h4" />
      </svg>
    )
    default: return null
  }
}

// ─── Collapsible tree section ─────────────────────────────────────────────────

function SidebarSection({ title, files, defaultOpen = true, addable = false, activePath, onFileClick, onAdd }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Section header — toggle only, never navigates */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--text-very-dim)',
          fontWeight: 600,
          cursor: 'pointer',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        <span style={{
          width: 10, height: 10, flex: '0 0 10px',
          transition: 'transform .15s ease',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          opacity: 0.7,
          display: 'flex', alignItems: 'center',
        }}>
          <Icon name="caret" size={10} />
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {addable && (
          <span
            onClick={e => { e.stopPropagation(); onAdd?.() }}
            style={{ opacity: 0.5, cursor: 'pointer', lineHeight: 1 }}
            title={`New ${title.toLowerCase().slice(0, -1)}`}
          >
            <Icon name="plus" size={12} />
          </span>
        )}
      </div>

      {/* File list */}
      {open && (
        files.length === 0 ? (
          <div style={{
            padding: '4px 10px 4px 28px',
            color: 'var(--text-very-dim)',
            fontStyle: 'italic',
            fontSize: 12.5,
          }}>
            empty
          </div>
        ) : files.map(file => {
          const isActive = activePath === file.path
          return (
            <div
              key={file.path}
              onClick={() => onFileClick(file.path)}
              style={{
                padding: '5px 10px 5px 28px',
                borderRadius: 6,
                cursor: 'pointer',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
                background: isActive ? 'var(--panel-2)' : 'transparent',
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'background .1s, color .1s',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--panel-2)'
                  e.currentTarget.style.color = 'var(--text)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-dim)'
                }
              }}
            >
              {file.name}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Nav item (top and bottom blocks) ────────────────────────────────────────

function NavItem({ icon, label, active, badge, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 7,
        color: active ? 'var(--text)' : 'var(--text-dim)',
        background: active ? 'var(--panel-2)' : 'transparent',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        fontSize: 13.5,
        transition: 'background .1s, color .1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--panel-2)'
          e.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = active ? 'var(--panel-2)' : 'transparent'
          e.currentTarget.style.color = active ? 'var(--text)' : 'var(--text-dim)'
        }
      }}
    >
      <Icon name={icon} size={14} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && (
        <span style={{ color: 'var(--text-very-dim)', fontSize: 11 }}>{badge}</span>
      )}
    </div>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar({
  page,
  activePath,
  folderName,
  openTaskCount,
  tree,             // { inbox, notes, projects, people, ideas, archive, context }
  onNavigate,       // (page, path?) => void
  onOpenFolder,
  settings,
}) {
  const enabledModules = settings?.enabledModules ?? { projects: true, people: true, ideas: true }

  const filesFor = (section) =>
    (tree?.[section] || [])
      .filter(f => !f.name.startsWith('.') && !f.name.startsWith('_moved'))
      .sort((a, b) => b.name.localeCompare(a.name))  // newest first
      .map(f => ({ name: f.name.replace('.md', ''), path: `${section}/${f.name}` }))

  return (
    <aside style={{
      width: 268,
      flex: '0 0 268px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      color: 'var(--text-dim)',
      fontSize: 13.5,
      userSelect: 'none',
    }}>

      {/* Header — vault identity */}
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          MEMORY OS
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-very-dim)' }}>
          {folderName || 'No vault'}
        </div>
      </div>

      {/* Top nav — Dashboard + Tasks */}
      <nav style={{ padding: '10px 8px 6px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavItem
          icon="grid"
          label="Dashboard"
          active={page === 'command'}
          badge="⟳"
          onClick={() => onNavigate('command')}
        />
        <NavItem
          icon="check"
          label="Tasks"
          active={page === 'tasks'}
          badge={openTaskCount || null}
          onClick={() => onNavigate('tasks')}
        />
      </nav>

      {/* Scrollable tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 16px' }}>
        <SidebarSection
          title="Inbox"
          files={filesFor('inbox')}
          activePath={activePath}
          onFileClick={path => onNavigate('inbox', path)}
        />
        <SidebarSection
          title="Notes"
          addable
          files={filesFor('notes')}
          activePath={activePath}
          onFileClick={path => onNavigate('viewer', path)}
        />
        {enabledModules.projects && (
          <SidebarSection
            title="Projects"
            addable
            defaultOpen={false}
            files={filesFor('projects')}
            activePath={activePath}
            onFileClick={path => onNavigate('viewer', path)}
          />
        )}
        {enabledModules.people && (
          <SidebarSection
            title="People"
            addable
            defaultOpen={false}
            files={filesFor('people')}
            activePath={activePath}
            onFileClick={path => onNavigate('viewer', path)}
          />
        )}
        {enabledModules.ideas && (
          <SidebarSection
            title="Ideas"
            addable
            defaultOpen={false}
            files={filesFor('ideas')}
            activePath={activePath}
            onFileClick={path => onNavigate('viewer', path)}
          />
        )}
        <SidebarSection
          title="Archive"
          defaultOpen={false}
          files={filesFor('archive').filter(f => f.name !== 'tasks')}
          activePath={activePath}
          onFileClick={path => onNavigate('viewer', path)}
        />
        <SidebarSection
          title="Context"
          defaultOpen={false}
          files={filesFor('context')}
          activePath={activePath}
          onFileClick={path => onNavigate('viewer', path)}
        />
      </div>

      {/* Bottom nav — Settings + Change vault (always visible, never scrolls) */}
      <div style={{ padding: '8px 8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavItem
          icon="cog"
          label="Settings"
          active={page === 'settings'}
          onClick={() => onNavigate('settings')}
        />
        <NavItem
          icon="folder"
          label="Change vault folder"
          onClick={onOpenFolder}
        />
      </div>

    </aside>
  )
}
```

### Wire the new Sidebar props in App.jsx

The new Sidebar takes more props than the old one. Open `src/App.jsx` and update the Sidebar render:

```jsx
<Sidebar
  page={page}
  activePath={activePath}
  folderName={folderName}
  openTaskCount={openTaskCount}  // derive from tasks-index.json or pass null
  tree={tree}                    // from useFileSystem — see note below
  onNavigate={handleNavigate}
  onOpenFolder={openFolder}
  settings={settings}
/>
```

**`tree` prop:** the new Sidebar calls `filesFor(section)` using a `tree` object. Check how the current Sidebar accesses file lists — it may call `listTree()` internally. If so, move that call to `App.jsx` and pass the result as `tree`. Add a `useEffect` that calls `listTree()` on vault ready and stores the result in state:

```js
const [tree, setTree] = useState({})

useEffect(() => {
  if (vaultReady) {
    listTree().then(setTree).catch(() => {})
  }
}, [vaultReady])
```

**`openTaskCount`:** read from `tasks-index.json` if you want the Tasks badge to show a count. Pass `null` to hide it.

---

## Step 3 — InboxPage: rewrite Dictate and Process buttons

Open `src/core/InboxPage.jsx`. Replace the two button components with exact design matches.

### 3a — Add sparkle spin keyframe to index.css

Open `src/index.css`. Add to the animations block:

```css
@keyframes sparkleSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

### 3b — DictateButton

Find the current Dictate button in InboxPage. Replace it with:

```jsx
<button
  onClick={isListening ? stop : start}
  disabled={!isSupported}
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    background: isListening ? 'oklch(0.70 0.18 22 / 0.16)' : 'var(--panel)',
    color: isListening ? 'oklch(0.84 0.16 22)' : 'var(--text)',
    border: `1px solid ${isListening ? 'oklch(0.70 0.18 22 / 0.40)' : 'var(--border)'}`,
    borderRadius: 8,
    fontSize: 13,
    cursor: isSupported ? 'pointer' : 'not-allowed',
    opacity: isSupported ? 1 : 0.4,
    fontFamily: 'inherit',
    transition: 'background .15s',
  }}
>
  <span style={{
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: isListening ? 'oklch(0.75 0.20 22)' : 'var(--text-very-dim)',
    boxShadow: isListening ? '0 0 0 4px oklch(0.70 0.18 22 / 0.20)' : 'none',
    animation: isListening ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
  }} />
  {isListening ? 'Recording…' : 'Dictate'}
</button>
```

### 3c — ProcessButton with sparkle

Find the current Process Note button. Replace it with:

```jsx
{isInboxFile && (
  <button
    onClick={handleProcess}
    disabled={status === 'loading'}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      background: status === 'loading'
        ? 'oklch(0.80 0.13 80 / 0.18)'
        : 'oklch(0.80 0.13 80 / 0.12)',
      color: 'oklch(0.85 0.13 80)',
      border: '1px solid oklch(0.80 0.13 80 / 0.36)',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      cursor: status === 'loading' ? 'wait' : 'pointer',
      fontFamily: 'inherit',
      transition: 'background .15s',
    }}
  >
    {/* Sparkle icon — spins while processing */}
    <svg
      viewBox="0 0 16 16"
      width="13" height="13"
      fill="currentColor"
      style={{ animation: status === 'loading' ? 'sparkleSpin 1.2s linear infinite' : 'none' }}
    >
      <path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" />
    </svg>
    {status === 'loading' ? 'Processing…' : 'Process note'}
  </button>
)}
```

---

## Step 4 — InboxPage: match the design note canvas

The design specifies exact measurements for the note canvas. Open `src/core/InboxPage.jsx`. Find the content area and update to match:

```jsx
{/* Note canvas */}
<div style={{ flex: 1, padding: '32px 48px 48px', maxWidth: 760 }}>

  {/* Title input */}
  <input
    type="text"
    value={title}
    onChange={e => setTitle(e.target.value)}
    placeholder="Untitled — type a subject or leave blank"
    style={{
      display: 'block',
      width: '100%',
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: 'var(--text)',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      padding: 0,
      marginBottom: 20,
      fontFamily: 'inherit',
    }}
  />

  {/* Milkdown editor — remove the max-w-2xl wrapper; canvas constrains width */}
  <EditorComponent />

</div>
```

Also update the header to match the design's exact measurements:

```jsx
<header style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '24px 48px 20px',
  borderBottom: '1px solid var(--border-subtle)',
  gap: 16,
}}>
  <div style={{
    fontSize: 13,
    color: 'var(--text-very-dim)',
    letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
  }}>
    {headerDate}
  </div>
  <div style={{ display: 'flex', gap: 8 }}>
    {/* DictateButton JSX from Step 3b */}
    {/* ProcessButton JSX from Step 3c */}
  </div>
</header>
```

---

## Smoke test

1. `bun run build` — passes
2. **Sidebar fixed bottom** — scroll the file tree down → Settings and Change vault folder stay pinned at the bottom, never scroll away
3. **Sidebar icons** — Dashboard shows grid icon, Tasks shows checkmark, Settings shows cog, Change vault shows folder
4. **Sidebar hover** — hover any nav item or file row → background becomes `var(--panel-2)`, text becomes `var(--text)`
5. **Sidebar active** — current page highlighted with `var(--panel-2)` background and full-weight text
6. **Section collapse** — click PROJECTS header → files hide. Click again → files show. Header never navigates.
7. **Module sections** — disable People in Settings → PEOPLE section disappears from tree
8. **Inbox header** — date + day on left (13px, very dim), Dictate and Process note on right
9. **Dictate button** — click → background turns red-tinted, dot pulses with ring, text changes to "Recording…"
10. **Process note button** — click → sparkle icon spins, text changes to "Processing…"
11. **Title input** — 30px, weight 600, no border, placeholder in muted colour
12. **Canvas padding** — content is 48px from the left edge, max 760px wide

---

## Handover 09 preview (do not build yet)

Dashboard redesign to match the design exactly:
- `TopBar` with date, h1, stat chips, and activity heatmap (12-week grid)
- `NeedsCallRow` — items flagged as needing attention
- `ProjectsSection` — draggable project cards with status pills and age chips
- `ActionsSection` — draggable task rows with checkbox resolution
- `PeopleSection` and `IdeasSection`

This is a full CommandPage replacement with the rich layout from the design.
