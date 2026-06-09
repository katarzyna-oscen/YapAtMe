# Handover 05 — Entity Creation, AllowedFiles, Module Pages, Archive
**Status:** Ready for implementation  
**Scope:** (1) Replace the `alert()` entity creation stub with a real flow. (2) Populate `allowedFiles` so the LLM knows what files exist. (3) Replace the three module page stubs with a real list/detail view. (4) Build ArchivePage. (5) Correct archive structure throughout — notes live flat in `archive/`, the tasks log is `archive/tasks.md`.  
**Prerequisite:** H03 Catchup, H04, and Design Integration are all applied and building cleanly.  
**Ends with:** Every page in the sidebar is functional. Entity creation writes real vault files. The LLM receives a real file list. Module pages show entities. ArchivePage shows the done log and archived notes.

---

## Archive structure — canonical definition

This is the correct structure. Any previous code or documentation that says otherwise is wrong.

```
archive/
  tasks.md          ← resolved task log (append-only, one line per resolved task)
  2026-05-14.md     ← archived notes stored directly here — NO subfolder
  2026-05-13.md
```

- No `archive/notes/` subfolder
- Tasks file is `tasks.md`, not `tasks_done.md`

---

## Pre-flight checks (read before writing any code)

**Check 1 — frontmatter.js interface**  
Open `src/lib/frontmatter.js`. Find the two exports:
- Parse function — probably `parseFrontmatter(raw)` or `parse(raw)` → returns `{ data, content }`
- Serialize function — probably `stringifyFrontmatter(data, content)` or `stringify(data, content)` → returns full `.md` string

Note the exact function names. Step 3 uses them.

**Check 2 — templates.js interface**  
Open `src/lib/templates.js`. Check what `templateFn` returns when called with no arguments. Does the returned string include a `name:` frontmatter field already?

**Check 3 — MODULE_REGISTRY entries**  
Open `src/lib/modules.js`. Confirm `vaultFolder` values for each module (`"projects"`, `"people"`, `"ideas"`). Confirm `templateFn` is callable with no arguments.

**Check 4 — App.jsx navigation**  
Open `src/App.jsx`. Find how module pages are rendered and confirm `listTree` and `writeFile` are in scope.

**Check 5 — vaultInit.js archive structure**  
Open `src/lib/vaultInit.js`. Search for any of these strings and fix them now before running anything:

```
'archive/notes'      → remove — no subfolder
'archive/notes/'     → remove — no subfolder
'tasks_done.md'      → rename to tasks.md
```

If `vaultInit.js` writes a placeholder file to `archive/notes/.keep` or similar, remove that line entirely. The `archive/` folder only needs to exist as a flat directory.

---

## What is being built

```
New files:
  src/lib/vaultScanner.js              — scans vault, returns allowed file list
  src/components/EntityCreateModal.jsx — creation form overlay
  src/components/ModuleListPage.jsx    — shared list/detail for all three modules

Updated files:
  src/lib/taskResolver.js              — PATCH: fix archive path (deployed in H04 with wrong path)
  src/core/InboxPage.jsx               — wire allowedFiles + entity creation
  src/modules/projects/index.jsx       — use ModuleListPage
  src/modules/people/index.jsx         — use ModuleListPage
  src/modules/ideas/index.jsx          — use ModuleListPage
  src/core/ArchivePage.jsx             — replace stub (with correct paths)
  src/App.jsx                          — pass props to module pages + ArchivePage
```

---

## Step 1 — Patch taskResolver.js (deployed in H04 with wrong path)

Open `src/lib/taskResolver.js`. Find:

```js
const DONE_PATH = 'archive/tasks_done.md'
```

Replace with:

```js
const DONE_PATH = 'archive/tasks.md'
```

That is the only change needed in this file.

---

## Step 2 — vaultScanner.js (new)

Create `src/lib/vaultScanner.js` in full:

```js
// src/lib/vaultScanner.js
// Scans the vault and returns a list of vault-relative file paths
// that the LLM is allowed to write to.
// Excludes: inbox/, archive/, context/ — LLM must never write there.

import { MODULE_REGISTRY } from './modules'

/**
 * Returns an array of vault-relative paths for all existing module files.
 * e.g. ["projects/memostack.md", "people/alice.md", "ideas/backlog.md"]
 *
 * @param {Function} listTree — from useFileSystem
 * @returns {Promise<string[]>}
 */
export async function buildAllowedFiles(listTree) {
  const tree = await listTree()
  const allowedFolders = MODULE_REGISTRY.map(m => m.vaultFolder)
  const paths = []

  for (const folder of allowedFolders) {
    const files = tree[folder] || []
    for (const f of files) {
      if (f.name.endsWith('.md') && !f.name.startsWith('_') && !f.name.startsWith('.')) {
        paths.push(`${folder}/${f.name}`)
      }
    }
  }

  return paths
}
```

---

## Step 3 — Wire allowedFiles in InboxPage (surgical)

Open `src/core/InboxPage.jsx`. Add the import at the top:

```js
import { buildAllowedFiles } from '../lib/vaultScanner'
```

Find `handleProcess`. Replace the hardcoded empty array:

```js
// REMOVE:
const allowedFiles = []

// REPLACE with:
let allowedFiles = []
try {
  allowedFiles = await buildAllowedFiles(listTree)
} catch {
  // Non-fatal — LLM still works, just without an explicit file list
}
```

> Confirm `listTree` is destructured from `useFileSystem()` inside `InboxEditor`. If it isn't, add it alongside `readFile` and `writeFile`.

---

## Step 4 — EntityCreateModal (new)

Create `src/components/EntityCreateModal.jsx` in full:

```jsx
// src/components/EntityCreateModal.jsx
// Overlay for creating a new entity file from a module template.
// Renders on top of RoutingReview (z-[60]).

import { useState } from 'react'
import { MODULE_REGISTRY } from '../lib/modules'

const TYPE_TO_MODULE = {
  person:  'people',
  project: 'projects',
  idea:    'ideas',
}

export default function EntityCreateModal({ unknown, writeFile, onCreated, onCancel }) {
  const [name,   setName]   = useState(unknown.name)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const moduleId = TYPE_TO_MODULE[unknown.type] || unknown.type
  const mod = MODULE_REGISTRY.find(m => m.id === moduleId)

  if (!mod) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-6 w-96">
          <p className="text-[var(--danger)] text-sm">Unknown module type: {unknown.type}</p>
          <button onClick={onCancel} className="mt-4 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Close
          </button>
        </div>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    try {
      const slug = name.trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 60)

      const filePath = `${mod.vaultFolder}/${slug}.md`
      const templateContent = mod.templateFn()

      let finalContent = templateContent

      if (templateContent.startsWith('---')) {
        // Inject name into existing frontmatter
        finalContent = templateContent.replace(/^---\n/, `---\nname: "${name.trim()}"\n`)
        // Remove duplicate name: fields if template already had one
        const lines = finalContent.split('\n')
        const nameCount = lines.filter(l => l.startsWith('name:')).length
        if (nameCount > 1) {
          let removed = false
          finalContent = lines.filter(l => {
            if (l.startsWith('name:') && !removed) { removed = true; return true }
            if (l.startsWith('name:') && removed)  return false
            return true
          }).join('\n')
        }
      } else {
        // No frontmatter in template — prepend one
        const date = new Date().toISOString().split('T')[0]
        finalContent = `---\nname: "${name.trim()}"\ncreated: ${date}\ntags: []\n---\n\n${templateContent}`
      }

      await writeFile(filePath, finalContent)
      onCreated(filePath)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--panel)] border border-[var(--border-strong)] rounded-xl p-6 w-[420px] shadow-2xl">

        <div className="mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Create {mod.label.slice(0, -1)}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            A new file will be created in <span className="font-mono text-xs">{mod.vaultFolder}/</span>
          </p>
        </div>

        <label className="block mb-4">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="mt-1.5 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-lg
              px-3 py-2 text-sm text-[var(--text-primary)] outline-none
              focus:border-[var(--accent)] transition-colors"
            placeholder={`${mod.label.slice(0, -1)} name…`}
          />
        </label>

        {error && <p className="text-xs text-[var(--danger)] mb-4">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium
              rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Creating…' : `Create ${mod.label.slice(0, -1)}`}
          </button>
        </div>

      </div>
    </div>
  )
}
```

> If `templateFn` takes a `name` argument, call it as `mod.templateFn(name.trim())` and skip the frontmatter injection block.

---

## Step 5 — Wire entity creation in InboxPage (surgical)

Open `src/core/InboxPage.jsx`. Three changes.

### 5a — Add import
```js
import EntityCreateModal from '../components/EntityCreateModal'
```

### 5b — Add modal state inside InboxEditor
```js
const [createTarget, setCreateTarget] = useState(null) // { type, name } | null
```

### 5c — Replace handleCreateEntity stub
```js
// FIND:
const handleCreateEntity = (unknown) => {
  alert(`Create ${unknown.type}: ${unknown.name} — coming soon`)
}

// REPLACE with:
const handleCreateEntity = (unknown) => {
  setCreateTarget(unknown)
}
```

### 5d — Add modal JSX after the RoutingReview overlay
```jsx
{createTarget && (
  <EntityCreateModal
    unknown={createTarget}
    writeFile={writeFile}
    onCreated={() => setCreateTarget(null)}
    onCancel={() => setCreateTarget(null)}
  />
)}
```

---

## Step 6 — ModuleListPage (new shared component)

Create `src/components/ModuleListPage.jsx` in full:

```jsx
// src/components/ModuleListPage.jsx
// Generic list/detail view for a vault module folder.
// Left panel: file list. Right panel: read-only content with frontmatter summary.
// Used by all three module index pages.

import { useState, useEffect } from 'react'

export default function ModuleListPage({ label, vaultFolder, readFile, listTree }) {
  const [files,       setFiles]       = useState([])
  const [selected,    setSelected]    = useState(null)
  const [content,     setContent]     = useState('')
  const [loading,     setLoading]     = useState(true)
  const [loadingFile, setLoadingFile] = useState(false)

  useEffect(() => { loadFiles() }, [vaultFolder])

  const loadFiles = async () => {
    setLoading(true)
    try {
      const tree = await listTree()
      const entries = (tree[vaultFolder] || [])
        .filter(f => f.name.endsWith('.md') && !f.name.startsWith('_') && !f.name.startsWith('.'))
        .map(f => ({ name: f.name.replace('.md', ''), path: `${vaultFolder}/${f.name}` }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setFiles(entries)
      if (entries.length > 0) await loadFile(entries[0])
      else { setContent(''); setSelected(null) }
    } catch { setFiles([]) }
    setLoading(false)
  }

  const loadFile = async (file) => {
    setSelected(file)
    setLoadingFile(true)
    try { setContent(await readFile(file.path)) }
    catch { setContent('_Could not load this file._') }
    setLoadingFile(false)
  }

  const parseName = (raw) => raw.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? null
  const parseTags = (raw) => {
    const m = raw.match(/^tags:\s*\[(.+?)\]/m)
    return m ? m[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean) : []
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">Loading…</div>
  )

  if (files.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="text-[var(--text-muted)] text-sm">No {label.toLowerCase()} yet.</p>
      <p className="text-[var(--text-muted)] text-xs mt-1">
        Process a note or use the Create button in routing review to add the first entry.
      </p>
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden">

      {/* File list */}
      <div className="w-56 shrink-0 border-r border-[var(--border)] overflow-y-auto py-4">
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-4 mb-2">
          {label} · {files.length}
        </p>
        {files.map(file => (
          <button
            key={file.path}
            onClick={() => loadFile(file)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors
              ${selected?.path === file.path
                ? 'bg-[var(--panel-pop)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
          >
            {file.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loadingFile ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">Loading…</div>
        ) : selected ? (
          <div className="max-w-2xl mx-auto px-8 py-8">
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
              {parseName(content) || selected.name}
            </h1>
            {parseTags(content).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {parseTags(content).map(tag => (
                  <span key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--text-muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
              {content}
            </pre>
          </div>
        ) : null}
      </div>

    </div>
  )
}
```

---

## Step 7 — Replace the three module stubs

**`src/modules/projects/index.jsx`** — replace in full:
```jsx
import ModuleListPage from '../../components/ModuleListPage'
export default function ProjectsPage(props) {
  return <ModuleListPage {...props} label="Projects" vaultFolder="projects" />
}
```

**`src/modules/people/index.jsx`** — replace in full:
```jsx
import ModuleListPage from '../../components/ModuleListPage'
export default function PeoplePage(props) {
  return <ModuleListPage {...props} label="People" vaultFolder="people" />
}
```

**`src/modules/ideas/index.jsx`** — replace in full:
```jsx
import ModuleListPage from '../../components/ModuleListPage'
export default function IdeasPage(props) {
  return <ModuleListPage {...props} label="Ideas" vaultFolder="ideas" />
}
```

---

## Step 8 — ArchivePage (new — correct paths throughout)

Replace `src/core/ArchivePage.jsx` in full.

```jsx
// src/core/ArchivePage.jsx
// Two tabs: resolved tasks (archive/tasks.md) and archived notes (flat in archive/).
// No subfolders — notes are stored directly in archive/, not archive/notes/.

import { useState, useEffect } from 'react'

export default function ArchivePage({ readFile, listTree }) {
  const [tab,          setTab]          = useState('tasks')
  const [tasksDone,    setTasksDone]    = useState('')
  const [noteFiles,    setNoteFiles]    = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [noteContent,  setNoteContent]  = useState('')
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { loadArchive() }, [])

  const loadArchive = async () => {
    setLoading(true)

    // Resolved tasks log — archive/tasks.md
    try {
      setTasksDone(await readFile('archive/tasks.md'))
    } catch {
      setTasksDone('')
    }

    // Archived notes — flat in archive/, exclude tasks.md
    try {
      const tree = await listTree()
      const files = (tree['archive'] || [])
        .filter(f => f.name.endsWith('.md')
          && !f.name.startsWith('_')
          && !f.name.startsWith('.')
          && f.name !== 'tasks.md')
        .map(f => ({
          name: f.name.replace('.md', ''),
          path: `archive/${f.name}`,
        }))
        .sort((a, b) => b.name.localeCompare(a.name)) // most recent first
      setNoteFiles(files)
    } catch {
      setNoteFiles([])
    }

    setLoading(false)
  }

  const loadNote = async (file) => {
    setSelectedNote(file)
    try { setNoteContent(await readFile(file.path)) }
    catch { setNoteContent('_Could not load this file._') }
  }

  // Parse resolved task lines — "- [x] ..."
  const doneTasks = tasksDone
    .split('\n')
    .filter(l => l.startsWith('- [x]'))
    .reverse() // most recent first

  if (loading) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">Loading…</div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header + tabs */}
      <div className="px-8 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Archive</h1>
        <div className="flex gap-1 border-b border-[var(--border)]">
          {[
            { key: 'tasks', label: `Resolved Tasks (${doneTasks.length})` },
            { key: 'notes', label: `Notes (${noteFiles.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm transition-colors
                ${tab === key
                  ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)] -mb-px'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {doneTasks.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">No resolved tasks yet.</p>
          ) : (
            <div className="space-y-1">
              {doneTasks.map((line, i) => {
                const parts   = line.replace('- [x] ', '').split(' · ')
                const title   = parts[0] || line
                const file    = parts[1] || ''
                const resolved = parts[parts.length - 1]?.replace('resolved ', '') || ''
                return (
                  <div key={i}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-md bg-[var(--panel)] border border-[var(--border)]">
                    <span className="text-[var(--success)] mt-0.5 shrink-0">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-secondary)] line-through decoration-[var(--text-muted)]">
                        {title}
                      </p>
                      {file && (
                        <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5 truncate">
                          {file}{resolved && ` · ${resolved}`}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes tab */}
      {tab === 'notes' && (
        <div className="flex flex-1 overflow-hidden">

          <div className="w-56 shrink-0 border-r border-[var(--border)] overflow-y-auto py-4">
            {noteFiles.length === 0 ? (
              <p className="px-4 text-sm text-[var(--text-muted)]">No archived notes.</p>
            ) : noteFiles.map(file => (
              <button
                key={file.path}
                onClick={() => loadNote(file)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors
                  ${selectedNote?.path === file.path
                    ? 'bg-[var(--panel-pop)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
              >
                {file.name}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-8">
            {selectedNote ? (
              <>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-6">
                  {selectedNote.name}
                </h2>
                <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
                  {noteContent}
                </pre>
              </>
            ) : (
              <p className="text-[var(--text-muted)] text-sm">Select a note to view it.</p>
            )}
          </div>

        </div>
      )}

    </div>
  )
}
```

---

## Step 9 — Wire module pages + ArchivePage in App.jsx

Open `src/App.jsx`. Update the page switch:

```jsx
{page === 'projects' && (
  <ProjectsPage readFile={readFile} writeFile={writeFile} listTree={listTree} />
)}
{page === 'people' && (
  <PeoplePage readFile={readFile} writeFile={writeFile} listTree={listTree} />
)}
{page === 'ideas' && (
  <IdeasPage readFile={readFile} writeFile={writeFile} listTree={listTree} />
)}
{page === 'archive' && (
  <ArchivePage readFile={readFile} listTree={listTree} />
)}
```

---

## Smoke test

1. `bun run build` — passes
2. `npm run dev` — zero console errors
3. **AllowedFiles:** add one file manually to `projects/` in your vault. Process a note mentioning it. RoutingReview proposes a write to that file (not an invented path).
4. **Entity creation:** process a note mentioning an unknown person. Click "Create person" in RoutingReview. Modal appears, name pre-filled. Confirm. Check `people/` on disk — new `.md` file with frontmatter.
5. **Projects / People / Ideas pages:** navigate to each — file list appears, click a file, content renders with name and tags above it.
6. **Archive → Resolved Tasks:** tick a task on Tasks page. Navigate to Archive. Task appears at top with strikethrough. Check `archive/tasks.md` on disk — one line written. Confirm the file is NOT named `tasks_done.md`.
7. **Archive → Notes:** confirm the tab loads from `archive/` directly with no subfolder lookup errors.

---

## Complete file list

```
src/
  lib/
    taskResolver.js              ← PATCH — fix DONE_PATH (Step 1)
    vaultScanner.js              ← NEW (Step 2)
    vaultInit.js                 ← CHECK — remove archive/notes/, rename tasks_done.md (Check 5)
  components/
    EntityCreateModal.jsx        ← NEW (Step 4)
    ModuleListPage.jsx           ← NEW (Step 6)
  core/
    ArchivePage.jsx              ← REPLACED — correct paths throughout (Step 8)
    InboxPage.jsx                ← UPDATED — allowedFiles + entity creation (Steps 3, 5)
  modules/
    projects/index.jsx           ← REPLACED — one-liner (Step 7)
    people/index.jsx             ← REPLACED — one-liner (Step 7)
    ideas/index.jsx              ← REPLACED — one-liner (Step 7)
  App.jsx                        ← UPDATED — props for module pages + ArchivePage (Step 9)
```

---

## Handover 06 preview (do not build yet)

- **Context rebuild on demand** — "Rebuild Context" button in Settings that manually triggers `rebuildContext()` without processing a note
- **Vault file index** — persist `allowedFiles` to IndexedDB so it doesn't require a full `listTree()` scan on every Process click
- **Module detail editing** — make the module detail panel editable (Milkdown instead of `<pre>`) so users can update entity files directly
- **Search** — simple text search across all vault files using `listTree` + `readFile` + string match
