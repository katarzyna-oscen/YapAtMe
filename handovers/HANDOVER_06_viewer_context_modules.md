# Handover 06 — Sidebar Fix, Unified File Viewer, Context Rebuild
**Status:** Ready for implementation  
**Scope:** (1) Fix sidebar navigation — remove Projects/People/Ideas as top-level nav items, keep them only as collapsible tree sections. (2) Generic `VaultFileViewer` so every tree file click opens in a unified Milkdown layout. (3) Wire all non-inbox sidebar file clicks to it. (4) "Rebuild Context" button in Settings.  
**Prerequisite:** Handover 05 fully applied and building cleanly.  
**Ends with:** Sidebar is clean — two nav items (Dashboard, Tasks) and a file tree below. Every file in the vault opens in the same editor layout. Context can be manually rebuilt from Settings.

---

## The sidebar navigation problem

H05 added Projects, People, and Ideas as **both** top-level nav items (alongside Dashboard and Tasks) **and** collapsible tree sections. This creates redundant navigation — clicking a module in the nav takes you to a separate list/detail page, but it's also in the tree. The correct structure is:

```
Dashboard          ← nav item
Tasks              ← nav item
─────────────────
INBOX              ← tree section (collapsible)
  2026-05-22
  2026-05-21
NOTES              ← tree section (collapsible)
  2026-05-22
PROJECTS           ← tree section (collapsible) — NOT a nav item
  content-system
  ia-framework
PEOPLE             ← tree section (collapsible) — NOT a nav item
  elaine
  sophie
IDEAS              ← tree section (collapsible) — NOT a nav item
ARCHIVE            ← tree section (collapsible)
CONTEXT            ← tree section (collapsible)
─────────────────
Settings           ← nav item
Change vault       ← nav item
```

Projects, People, Ideas are tree sections only. Clicking a file in any section opens it in `VaultFileViewer`. No separate module list pages needed.

---

## Pre-flight checks

**Check 1 — Sidebar as-built**  
Open `src/components/Sidebar.jsx`. Read the whole file. Identify:
- Where Dashboard and Tasks are rendered as nav items
- Where Projects, People, Ideas were added as nav items by H05 — these need to be removed
- How tree sections are rendered (the collapsible INBOX/NOTES pattern)
- The exact navigation function name (`onNavigate`, `setPage`, etc.)

**Check 2 — App.jsx page switch as-built**  
Open `src/App.jsx`. List every page case in the switch. Identify the `'projects'`, `'people'`, and `'ideas'` cases added by H05 — these will be removed. Confirm `activePath` and `setActivePath` exist.

**Check 3 — listTree actual shape**  
H05 found that `listTree()` returns an array tree. Open `src/hooks/useFileSystem.js` and note the exact return shape. Use this same pattern in VaultFileViewer.

**Check 4 — useMarkdownEditor onChange**  
Open `src/hooks/useMarkdownEditor.js`. Confirm whether `onChange` is supported. VaultFileViewer needs it. If not present, add it before proceeding — find the editor update event inside `useEditor` and call `onChange?.(markdown)`.

**Check 5 — SettingsPage current props**  
Open `src/core/SettingsPage.jsx`. Note what props it receives and whether `readFile`, `writeFile` are among them. Check how it is rendered in `App.jsx`.

**Check 6 — rebuildContext signature**  
Open `src/lib/rebuildContext.js`. Confirm the call signature is `rebuildContext(readFile, writeFile, settings)`.

---

## Complete file list

```
src/
  components/
    Sidebar.jsx             ← UPDATED — remove module nav items, wire tree clicks (Steps 1, 4)
  App.jsx                   ← UPDATED — remove module page cases, add viewer case (Steps 2, 3b)
  components/
    VaultFileViewer.jsx     ← NEW (Step 3)
  core/
    SettingsPage.jsx        ← UPDATED — Rebuild Context button (Step 5)
```

---

## Step 1 — Sidebar: remove module nav items

Open `src/components/Sidebar.jsx`. Find the block where H05 added Projects, People, and Ideas as nav items — they will look similar to the Dashboard and Tasks items, probably with an icon and an `onClick` that calls `onNavigate('projects')` etc.

**Remove** those nav items entirely. The three sections should only exist as collapsible tree entries, not as clickable navigation rows in the top block.

Before removing, confirm the tree sections for Projects, People, and Ideas are still present lower in the sidebar (the collapsible sections that list individual files). Those stay — only the nav items go.

After removal, the top nav block should contain only:
- Dashboard
- Tasks

Everything else is in the tree below.

---

## Step 2 — App.jsx: remove module page cases

Open `src/App.jsx`. Find and remove the three page cases added by H05:

```jsx
// REMOVE these entirely:
{page === 'projects' && <ProjectsPage ... />}
{page === 'people'   && <PeoplePage   ... />}
{page === 'ideas'    && <IdeasPage    ... />}
```

Also remove the imports for `ProjectsPage`, `PeoplePage`, `IdeasPage` at the top of the file if they are no longer used anywhere.

> The module files themselves (`src/modules/projects/index.jsx` etc.) can stay on disk — they are not doing any harm. Just remove the page cases and imports from App.jsx so navigating to `'projects'` no longer renders anything. Files in those folders are accessed directly through the tree → VaultFileViewer.

---

## Step 3 — VaultFileViewer (new)

Create `src/components/VaultFileViewer.jsx` in full.

Single unified layout for every file opened from the sidebar tree. Header shows `folder/filename` breadcrumb and live save status. Body is Milkdown with 800ms autosave.

```jsx
// src/components/VaultFileViewer.jsx
// Unified file viewer/editor for any vault file opened from the sidebar tree.
// Header: folder/filename breadcrumb + save status.
// Body: Milkdown editor, max-w-2xl centred, 800ms autosave.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor'

export default function VaultFileViewer({ filePath, readFile, writeFile }) {
  const [content,    setContent]    = useState('')
  const [loading,    setLoading]    = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle')
  const saveTimer = useRef(null)

  const { EditorComponent } = useMarkdownEditor({
    initialContent: content,
    onChange: handleChange,
  })

  useEffect(() => {
    if (filePath) loadFile(filePath)
  }, [filePath])

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    try { setContent(await readFile(path)) }
    catch { setContent('') }
    setLoading(false)
  }

  function handleChange(newContent) {
    setContent(newContent)
    setSaveStatus('idle')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(newContent), 800)
  }

  const save = useCallback(async (text) => {
    if (!filePath) return
    setSaveStatus('saving')
    try {
      await writeFile(filePath, text)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch { setSaveStatus('error') }
  }, [filePath, writeFile])

  const parts       = filePath ? filePath.split('/') : []
  const folder      = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
  const displayName = parts[parts.length - 1]?.replace('.md', '') ?? ''

  if (!filePath) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
      Select a file from the sidebar.
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
      Loading…
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {folder && (
            <span className="text-xs text-[var(--text-muted)] font-mono shrink-0">
              {folder}/
            </span>
          )}
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {displayName}
          </span>
        </div>
        <span className={`text-xs shrink-0 transition-opacity
          ${saveStatus === 'idle'   ? 'opacity-0'                : 'opacity-100'}
          ${saveStatus === 'saving' ? 'text-[var(--text-muted)]' : ''}
          ${saveStatus === 'saved'  ? 'text-[var(--success)]'    : ''}
          ${saveStatus === 'error'  ? 'text-[var(--danger)]'     : ''}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved'  && 'Saved'}
          {saveStatus === 'error'  && 'Save failed'}
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-6">
          <EditorComponent />
        </div>
      </div>

    </div>
  )
}
```

### 3b — Add viewer page to App.jsx

Add import:
```js
import VaultFileViewer from './components/VaultFileViewer'
```

Add to page switch:
```jsx
{page === 'viewer' && (
  <VaultFileViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
  />
)}
```

---

## Step 4 — Sidebar: wire all tree file clicks to viewer

Open `src/components/Sidebar.jsx`. For every tree section except INBOX, update file item click handlers to navigate to `'viewer'` with the vault-relative path.

### Pattern for every non-inbox file item:

```js
onClick={() => onNavigate('viewer', `${sectionFolder}/${f.name}`)}
```

Apply to these sections:

| Section | Path pattern |
|---|---|
| NOTES | `notes/${f.name}` |
| PROJECTS | `projects/${f.name}` |
| PEOPLE | `people/${f.name}` |
| IDEAS | `ideas/${f.name}` |
| ARCHIVE | `archive/${f.name}` |
| CONTEXT | `context/${f.name}` |

INBOX file items stay on their existing handler — do not change them.

Section headers (the collapsible toggle rows like "NOTES", "PROJECTS") should only toggle open/closed — they must not navigate. If any section header currently calls `onNavigate`, remove that call and leave only the collapse toggle.

---

## Step 5 — Settings: Rebuild Context button

Open `src/core/SettingsPage.jsx`.

### 5a — Add imports

```js
import { rebuildContext } from '../lib/rebuildContext'
```

### 5b — Add state

```js
const [rebuilding,    setRebuilding]    = useState(false)
const [rebuildStatus, setRebuildStatus] = useState(null) // null | 'ok' | 'error'
```

### 5c — Add handler

```js
const handleRebuildContext = async () => {
  setRebuilding(true)
  setRebuildStatus(null)
  try {
    await rebuildContext(readFile, writeFile, settings)
    setRebuildStatus('ok')
  } catch {
    setRebuildStatus('error')
  } finally {
    setRebuilding(false)
    setTimeout(() => setRebuildStatus(null), 3000)
  }
}
```

### 5d — Add JSX section

Add after the existing API key / model fields:

```jsx
<div className="border-t border-[var(--border)] pt-6 mt-6">
  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
    Working Memory
  </h2>
  <p className="text-xs text-[var(--text-muted)] mb-4">
    Rebuilds <span className="font-mono">context/_context.md</span> from the
    current vault state. Run this if context looks stale or after making
    manual edits to vault files.
  </p>
  <div className="flex items-center gap-3">
    <button
      onClick={handleRebuildContext}
      disabled={rebuilding || !settings?.apiKey}
      className="px-4 py-2 bg-[var(--panel-2)] border border-[var(--border)] rounded-lg
        text-sm text-[var(--text-secondary)] hover:border-[var(--border-strong)]
        hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
    >
      {rebuilding ? 'Rebuilding…' : 'Rebuild Context'}
    </button>
    {rebuildStatus === 'ok'    && <span className="text-xs text-[var(--success)]">Context updated</span>}
    {rebuildStatus === 'error' && <span className="text-xs text-[var(--danger)]">Failed — check API key</span>}
  </div>
</div>
```

### 5e — Pass readFile + writeFile to SettingsPage if missing

If SettingsPage doesn't currently receive `readFile` and `writeFile` as props, update its render call in App.jsx:

```jsx
{page === 'settings' && (
  <SettingsPage readFile={readFile} writeFile={writeFile} />
)}
```

---

## Smoke test

1. `bun run build` — passes
2. **Sidebar top nav** — only Dashboard and Tasks appear as nav items. No Projects, People, Ideas nav items.
3. **Tree sections** — PROJECTS, PEOPLE, IDEAS exist as collapsible tree sections. Clicking the section header expands/collapses. Does not navigate anywhere.
4. **Project file click** — click a file under PROJECTS → full-width Milkdown editor, header shows `projects/ia-framework`, editable, autosaves
5. **People file click** — same unified layout, `people/elaine`
6. **Context file click** — click `_context` under CONTEXT → `context/_context`, editable
7. **Notes file click** — click a note → same layout, `notes/2026-05-22`
8. **All headers consistent** — every viewer shows `folder/filename` breadcrumb
9. **Rebuild Context** — Settings → "Rebuild Context" → "Rebuilding…" → "Context updated" → check `context/_context.md` on disk
10. **No broken routes** — navigating to Dashboard, Tasks, Settings all still work correctly after the App.jsx cleanup

---

## Handover 07 preview (do not build yet)

- **Lazy imports** — split Milkdown and viewer surfaces into async chunks, add Suspense boundaries and loading skeletons. Priority now that this is a real app.
- **Vault file index** — persist `allowedFiles` to IndexedDB, avoid `listTree()` scan on every Process click
- **Search** — text search across all vault files, accessible from the sidebar
- **New entity shortcut** — `+` button on PROJECTS/PEOPLE/IDEAS section headers creates a new entity file from template and opens it in the viewer
