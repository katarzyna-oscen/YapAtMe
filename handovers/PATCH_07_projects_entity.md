# Patch 07 — Projects Entity + File Rename
**Scope:** File rename via name input (people + projects), projects template, ProjectViewer with status chip, App.jsx wiring.  
**Depends on:** Patch 06b/06c applied. `PersonViewer.jsx` exists and working.

---

## Pre-flight reads

1. `src/hooks/useFileSystem.js` — find the return value. Confirm `deleteFile` is already there from H07. Note the root handle variable name — needed for `renameFile`.
2. `src/lib/templates.js` — confirm the current `case 'projects':` block so you know what you're replacing.
3. `src/core/PersonViewer.jsx` — find the `fullName` input JSX and the `save` function. You'll add rename logic here.
4. `src/App.jsx` — find where `PersonViewer` and `VaultFileViewer` are rendered. Note how `activePath` and `setActivePath` are managed.

---

## Step 1 — useFileSystem: add renameFile

Open `src/hooks/useFileSystem.js`. Add alongside `deleteFile`:

```js
const renameFile = async (oldPath, newPath) => {
  // Read, write to new path, delete old path
  const content = await readFile(oldPath)
  await writeFile(newPath, content)
  await deleteFile(oldPath)
}
```

Add to the return object:
```js
return {
  vaultReady, folderName, openFolder,
  readFile, writeFile, listTree, fileExists,
  deleteFile,
  renameFile,  // ← add
}
```

---

## Step 2 — templates.js: update projects case

Open `src/lib/templates.js`. Replace `case 'projects':` in full:

```js
case 'projects':
  return {
    slug,
    content:
`---
type: project
name: ${name}
status: Untriaged
domain: 
owner: 
core_problem: 
last_updated: ${today}
---

## Summary


## Current Plan


## Open Actions


## Delegations


## Decisions


## Recent Mentions


## Notes
`,
  }
```

---

## Step 3 — PersonViewer: add rename-on-blur

Open `src/core/PersonViewer.jsx`. Three small additions.

### 3a — Add renameFile + onFileRenamed to props

```jsx
export default function PersonViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  renameFile,        // ← add
  onFileRenamed,     // ← add  (newPath: string) => void
  onConfirmAction,
}) {
```

### 3b — Import toSlug

```js
import { toSlug } from '../lib/templates'
```

### 3c — Add handleNameBlur

Add this function inside the component, alongside `save`:

```js
const handleNameBlur = async () => {
  if (!filePath || !fullName.trim()) return

  const folder      = filePath.split('/')[0]               // e.g. "people"
  const currentSlug = filePath.split('/').pop().replace('.md', '')
  const newSlug     = toSlug(fullName.trim())

  // No rename needed
  if (newSlug === currentSlug || !newSlug) return

  const newPath = `${folder}/${newSlug}.md`

  // Guard: don't overwrite an existing file
  try {
    const exists = await fileExists(newPath)
    if (exists) {
      // Revert the name input to the current filename
      setFullName(currentSlug.replace(/-/g, ' '))
      return
    }
  } catch {}

  try {
    // Save current content to new path, delete old
    await save(editorBody)          // ensure latest content is written first
    await renameFile(filePath, newPath)
    onFileRenamed?.(newPath)        // App.jsx updates activePath + refreshes tree
  } catch (err) {
    console.error('Rename failed:', err.message)
  }
}
```

### 3d — Add onBlur to the name input

Find the `<input>` for `fullName`. Add `onBlur`:

```jsx
<input
  type="text"
  value={fullName}
  onChange={e => setFullName(e.target.value)}
  onBlur={handleNameBlur}        // ← add
  placeholder="Full name"
  style={{ ... }}
/>
```

---

## Step 4 — ProjectViewer.jsx (new)

Create `src/core/ProjectViewer.jsx` in full:

```jsx
// src/core/ProjectViewer.jsx
// Dedicated viewer/editor for files in projects/.
// Header: last_updated date + DictateButton + TrashMenuButton
// Pill row: StatusChip (clickable, cycles statuses) + owner + domain pills
// Subtitle: core_problem (editable, muted)
// Stats: open actions + open delegations from tasks-index.json
// Body: Milkdown editor, section headers small-caps via global CSS
// Rename on name blur via renameFile prop

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { toSlug } from '../lib/templates'
import { parseFrontmatter, buildFileContent } from '../lib/frontmatter'
import DictateBtn      from '../components/DictateBtn'
import TrashMenuButton from '../components/TrashMenuButton'

// ── Status configuration ─────────────────────────────────────────────────────

const STATUS_CYCLE = ['Untriaged', 'Triaged', 'Building', 'Blocked', 'Done']

const STATUS_STYLE = {
  Untriaged: { bg: 'transparent',                    border: 'var(--border)',                    color: 'var(--text-very-dim)' },
  Triaged:   { bg: 'oklch(0.72 0.13 240 / 0.12)',    border: 'oklch(0.72 0.13 240 / 0.35)',      color: 'var(--info)' },
  Building:  { bg: 'oklch(0.74 0.14 165 / 0.12)',    border: 'oklch(0.74 0.14 165 / 0.35)',      color: 'var(--success)' },
  Blocked:   { bg: 'oklch(0.70 0.18 22 / 0.12)',     border: 'oklch(0.70 0.18 22 / 0.35)',       color: 'var(--danger)' },
  Done:      { bg: 'var(--panel-2)',                  border: 'var(--border)',                    color: 'var(--text-very-dim)' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProjectViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  fileExists,
  onFileRenamed,
  onConfirmAction,
}) {
  const [name,        setName]        = useState('')
  const [status,      setStatus]      = useState('Untriaged')
  const [domain,      setDomain]      = useState('')
  const [owner,       setOwner]       = useState('')
  const [coreProblem, setCoreProblem] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const [editorBody,    setEditorBody]    = useState('')
  const [actionsCount,  setActionsCount]  = useState(0)
  const [delegateCount, setDelegateCount] = useState(0)

  const [loading,       setLoading]       = useState(true)
  const [saveStatus,    setSaveStatus]    = useState('idle')
  const [lastSavedTime, setLastSavedTime] = useState('')
  const saveTimer = useRef(null)

  const { EditorComponent } = useMarkdownEditor({
    initialContent: editorBody,
    onChange: handleBodyChange,
  })
  const { isListening, isSupported, start, stop } = useVoiceDictation()

  useEffect(() => {
    if (filePath) { loadFile(filePath); loadStats(filePath) }
  }, [filePath])

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    setLastSavedTime('')
    try {
      const raw = await readFile(path)
      const { fields, body } = parseFrontmatter(raw)
      setName(        fields.name         || '')
      setStatus(      fields.status       || 'Untriaged')
      setDomain(      fields.domain       || '')
      setOwner(       fields.owner        || '')
      setCoreProblem( fields.core_problem || '')
      setLastUpdated( fields.last_updated || '')
      setEditorBody((body || '').trimStart())
    } catch {
      setName(''); setEditorBody('')
    }
    setLoading(false)
  }

  const loadStats = async (path) => {
    try {
      const raw     = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw).filter(e => e.file === path && e.status !== 'done')
      setActionsCount( entries.filter(e => e.section === '## Open Actions').length)
      setDelegateCount(entries.filter(e => e.section === '## Delegations').length)
    } catch {
      setActionsCount(0); setDelegateCount(0)
    }
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
    const today  = new Date().toISOString().slice(0, 10)
    const fields = {
      type: 'project', name: name.trim() || 'Untitled',
      status, domain, owner,
      core_problem: coreProblem,
      last_updated: today,
    }
    const full = buildFileContent(fields, body)
    try {
      await writeFile(filePath, full)
      const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      setLastSavedTime(t)
      setLastUpdated(today)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch { setSaveStatus('error') }
  }, [filePath, writeFile, name, status, domain, owner, coreProblem])

  // Trigger save when metadata fields change
  useEffect(() => {
    if (!filePath || loading) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(editorBody), 800)
  }, [status, domain, owner, coreProblem])

  // Rename on name blur
  const handleNameBlur = async () => {
    if (!filePath || !name.trim()) return
    const folder      = filePath.split('/')[0]
    const currentSlug = filePath.split('/').pop().replace('.md', '')
    const newSlug     = toSlug(name.trim())
    if (newSlug === currentSlug || !newSlug) return

    const newPath = `${folder}/${newSlug}.md`
    try {
      const exists = await fileExists(newPath)
      if (exists) { setName(currentSlug.replace(/-/g, ' ')); return }
      await save(editorBody)
      await renameFile(filePath, newPath)
      onFileRenamed?.(newPath)
    } catch (err) { console.error('Rename failed:', err.message) }
  }

  // Cycle status on chip click
  const cycleStatus = () => {
    const idx  = STATUS_CYCLE.indexOf(status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    setStatus(next)
  }

  // Header date from last_updated
  const headerDate = (() => {
    if (!lastUpdated) return ''
    const d = new Date(lastUpdated)
    if (isNaN(d)) return lastUpdated.toUpperCase()
    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    }).toUpperCase()
    const daysAgo = Math.floor((Date.now() - d) / 86_400_000)
    const age = daysAgo === 0 ? 'TODAY' : daysAgo === 1 ? '1 DAY AGO' : `${daysAgo} DAYS AGO`
    return `UPDATED ${formatted} · ${age}`
  })()

  const fileLabel = name || filePath?.replace('projects/', '').replace('.md', '') || 'this project'
  const s = STATUS_STYLE[status] || STATUS_STYLE.Untriaged

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
      Loading…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 16, flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-very-dim)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {headerDate}
          {lastSavedTime && <span style={{ marginLeft: 8, opacity: 0.6 }}>· saved {lastSavedTime}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DictateBtn active={isListening} disabled={!isSupported} onClick={isListening ? stop : start} />
          <TrashMenuButton
            label={fileLabel}
            onConfirmAction={onConfirmAction}
            onArchive={async () => {
              const filename = filePath.split('/').pop()
              const content  = await readFile(filePath)
              await writeFile(`archive/${filename}`, content)
              await deleteFile(filePath)
            }}
            onDelete={async () => { await deleteFile(filePath) }}
          />
        </div>
      </header>

      {/* Canvas */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>

          {/* Project name */}
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Project name"
            style={{
              display: 'block', width: '100%',
              fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em',
              color: 'var(--text)', background: 'transparent',
              border: 'none', outline: 'none',
              padding: 0, marginBottom: 10, fontFamily: 'inherit',
            }}
          />

          {/* core_problem — subtitle */}
          <input
            type="text"
            value={coreProblem}
            onChange={e => setCoreProblem(e.target.value)}
            placeholder="What problem does this solve?"
            style={{
              display: 'block', width: '100%',
              fontSize: 15, fontWeight: 400,
              color: coreProblem ? 'var(--text-dim)' : 'var(--text-very-dim)',
              background: 'transparent', border: 'none', outline: 'none',
              padding: 0, marginBottom: 16, fontFamily: 'inherit',
            }}
          />

          {/* Pill row: status + owner + domain + stats */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Status chip — click to cycle */}
            <button
              onClick={cycleStatus}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px',
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: 5, fontSize: 12, fontWeight: 500,
                color: s.color, cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background .12s, border-color .12s',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {status}
            </button>

            {/* Owner pill */}
            <PillInput value={owner} onChange={setOwner} placeholder="Owner" />

            {/* Domain pill */}
            <PillInput value={domain} onChange={setDomain} placeholder="Domain" />

            {/* Open actions count */}
            {actionsCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{actionsCount}</span>
                {actionsCount === 1 ? 'action' : 'actions'}
              </span>
            )}

            {/* Open delegations count */}
            {delegateCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{delegateCount}</span>
                {delegateCount === 1 ? 'delegation' : 'delegations'}
              </span>
            )}

          </div>

          {/* Milkdown body */}
          <div key={filePath}>
            <EditorComponent />
          </div>

        </div>
      </div>

    </div>
  )
}

// ── PillInput ─────────────────────────────────────────────────────────────────

function PillInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  if (!value && !focused) {
    return (
      <button
        onClick={() => setFocused(true)}
        style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 8px', background: 'transparent',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 5, fontSize: 12,
          color: 'var(--text-very-dim)',
          cursor: 'text', fontFamily: 'inherit',
        }}
      >
        + {placeholder}
      </button>
    )
  }
  return (
    <input
      type="text"
      value={value}
      autoFocus={focused && !value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        padding: '3px 8px',
        background: 'transparent',
        border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 5, fontSize: 12,
        color: 'var(--text-dim)',
        outline: 'none', fontFamily: 'inherit', minWidth: 60,
        transition: 'border-color .12s',
      }}
    />
  )
}
```

> **Frontmatter adapter:** `buildFileContent` is used above — this may be called `stringifyFrontmatter` in your `frontmatter.js`. Check the pre-flight read and adapt the import + call accordingly.

---

## Step 5 — App.jsx: wire everything

### 5a — Destructure renameFile and fileExists

```js
const {
  vaultReady, folderName, openFolder,
  readFile, writeFile, listTree, fileExists,
  deleteFile,
  renameFile,   // ← add
} = useFileSystem()
```

### 5b — Add handleFileRenamed

```js
const handleFileRenamed = useCallback((newPath) => {
  setActivePath(newPath)
  listTree().then(setTree).catch(() => {})
}, [listTree])
```

### 5c — Add ProjectViewer import

```js
import ProjectViewer from './core/ProjectViewer'
```

### 5d — Update viewer routing

```jsx
{page === 'viewer' && activePath?.startsWith('notes/')    && <ProcessedNoteViewer ... />}

{page === 'viewer' && activePath?.startsWith('people/')   && (
  <PersonViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
    deleteFile={deleteFile}
    renameFile={renameFile}
    fileExists={fileExists}
    onFileRenamed={handleFileRenamed}
    onConfirmAction={showConfirm}
  />
)}

{page === 'viewer' && activePath?.startsWith('projects/') && (
  <ProjectViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
    deleteFile={deleteFile}
    renameFile={renameFile}
    fileExists={fileExists}
    onFileRenamed={handleFileRenamed}
    onConfirmAction={showConfirm}
  />
)}

{page === 'viewer' && activePath
  && !activePath.startsWith('notes/')
  && !activePath.startsWith('people/')
  && !activePath.startsWith('projects/') && (
  <VaultFileViewer ... />
)}
```

---

## Build check

1. `bun run build` — passes
2. **New project** — click + on PROJECTS → `ProjectViewer` opens → name input empty, `core_problem` placeholder visible, status chip shows "Untriaged" (gray dot)
3. **Status cycle** — click the status chip → Untriaged → Triaged (blue) → Building (green) → Blocked (red) → Done (gray) → loops
4. **Rename — projects** — open a project, change name to something different, click away → file renamed in sidebar, URL path updated, no data lost
5. **Rename — conflict** — rename to an existing project's name → name reverts silently
6. **Rename — people** — open a person file, change name, click away → same rename behavior
7. **core\_problem** — type a one-line problem statement → saves to frontmatter → reopen file → persists
8. **Stats** — after routing an action to this project via inbox processing → actions count chip appears
9. **Section headers** — Summary, Current Plan, Open Actions etc. all render as small-caps
10. **Existing v1 projects** — open an old project file that has the old template → renders without crashing, old sections visible in editor
