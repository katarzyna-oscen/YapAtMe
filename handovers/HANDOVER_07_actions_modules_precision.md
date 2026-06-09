# Handover 07 — Note Actions, Module Toggles, Routing Precision, Lazy Imports
**Status:** Ready for implementation  
**Scope:** (1) Delete and archive actions on notes. (2) Module enable/disable toggles in Settings. (3) Vault file index — cache `allowedFiles` in IndexedDB so routing is fast and reliable. (4) Routing precision — validate LLM output against the actual file list, reject invented paths. (5) Lazy-load heavy surfaces for production bundle size.  
**Prerequisite:** Handover 06 fully applied and building cleanly.  
**Ends with:** Notes can be archived or deleted. Modules can be turned off. The LLM only ever routes to files that actually exist. Bundle splits on first load.

---

## Pre-flight checks

**Check 1 — useFileSystem interface**  
Open `src/hooks/useFileSystem.js`. Confirm the full interface. Note whether `deleteFile` already exists. If not, Step 1 adds it using `FileSystemDirectoryHandle.removeEntry()`.

**Check 2 — useSettings schema**  
Open `src/hooks/useSettings.js`. Note the current default settings shape and how `saveSettings` works. Step 4 adds `enabledModules` to the schema.

**Check 3 — VaultFileViewer header**  
Open `src/components/VaultFileViewer.jsx`. The header currently has a breadcrumb and save status. Step 2 adds an actions menu to the right of the header.

**Check 4 — useNoteProcessor allowedFiles flow**  
Open `src/hooks/useNoteProcessor.js` and `src/core/InboxPage.jsx`. Find where `allowedFiles` is built (currently via `buildAllowedFiles(listTree)` on every Process click) and passed to the LLM. Steps 5 and 6 cache this and add output validation.

**Check 5 — App.jsx lazy import readiness**  
Open `src/App.jsx`. Note which heavy components are imported at the top. Step 7 converts these to `React.lazy()`.

---

## Complete file list

```
src/
  hooks/
    useFileSystem.js        ← UPDATED — add deleteFile (Step 1)
    useSettings.js          ← UPDATED — add enabledModules to schema (Step 4)
  lib/
    fileIndex.js            ← NEW — IndexedDB cache for allowedFiles (Step 5)
  components/
    VaultFileViewer.jsx     ← UPDATED — archive + delete actions (Step 2)
  core/
    InboxPage.jsx           ← UPDATED — archive action, routing validation (Steps 3, 6)
    SettingsPage.jsx        ← UPDATED — module toggle UI (Step 4)
  components/
    Sidebar.jsx             ← UPDATED — hide disabled module sections (Step 4)
  App.jsx                   ← UPDATED — lazy imports (Step 7)
```

---

## Step 1 — useFileSystem: add deleteFile

Open `src/hooks/useFileSystem.js`. Add a `deleteFile` function alongside the existing `readFile` and `writeFile`.

The File System Access API exposes `removeEntry()` on directory handles. Navigate to the parent directory of the target file, then call `removeEntry` on the filename.

```js
// Add inside useFileSystem, alongside readFile and writeFile:

const deleteFile = async (path) => {
  const parts    = path.split('/')
  const filename = parts.pop()

  // Navigate to parent directory handle
  let dirHandle = rootHandle  // or whatever your root handle variable is called
  for (const part of parts) {
    dirHandle = await dirHandle.getDirectoryHandle(part, { create: false })
  }

  await dirHandle.removeEntry(filename)
}
```

Expose it in the return value:
```js
return { vaultReady, folderName, openFolder, readFile, writeFile, listTree, fileExists, deleteFile }
```

> **Check the root handle variable name** — it may be called `rootHandle`, `folderHandle`, `dirHandle`, or similar. Match the existing code.

Pass `deleteFile` through wherever `readFile`/`writeFile` are passed in `App.jsx`:
```jsx
// In App.jsx, add deleteFile wherever readFile/writeFile are destructured and passed:
const { vaultReady, folderName, openFolder, readFile, writeFile, listTree, fileExists, deleteFile } = useFileSystem()
```

---

## Step 2 — VaultFileViewer: archive + delete actions

Open `src/components/VaultFileViewer.jsx`.

### 2a — Add props

```jsx
// Add deleteFile and onFileDeleted to props:
export default function VaultFileViewer({ filePath, readFile, writeFile, deleteFile, onFileDeleted }) {
```

### 2b — Add action state

```js
const [showActions, setShowActions] = useState(false)
const [confirming,  setConfirming]  = useState(false) // delete confirmation
```

### 2c — Add action handlers

```js
const handleArchive = async () => {
  if (!filePath) return
  const filename    = filePath.split('/').pop()
  const archivePath = `archive/${filename}`
  try {
    const content = await readFile(filePath)
    await writeFile(archivePath, content)
    await deleteFile(filePath)
    onFileDeleted?.()
  } catch (err) {
    console.error('Archive failed:', err.message)
  }
}

const handleDelete = async () => {
  if (!filePath) return
  try {
    await deleteFile(filePath)
    onFileDeleted?.()
  } catch (err) {
    console.error('Delete failed:', err.message)
  }
  setConfirming(false)
}
```

### 2d — Add actions menu to the header JSX

Add this between the breadcrumb and the save status span, inside the header div:

```jsx
{/* Actions menu — shown for notes/ and archive/ files, not context/ */}
{filePath && !filePath.startsWith('context/') && (
  <div className="relative shrink-0 mx-2">
    <button
      onClick={() => setShowActions(s => !s)}
      className="px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]
        rounded transition-colors text-lg leading-none"
      aria-label="File actions"
    >
      ···
    </button>

    {showActions && (
      <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--panel-2)]
        border border-[var(--border)] rounded-lg shadow-xl z-20 py-1"
        onBlur={() => setShowActions(false)}
      >
        {/* Archive — only for notes/, not archive/ (already archived) */}
        {filePath.startsWith('notes/') && (
          <button
            onClick={() => { setShowActions(false); handleArchive() }}
            className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)]
              hover:bg-[var(--panel-pop)] hover:text-[var(--text-primary)] transition-colors"
          >
            Archive note
          </button>
        )}

        {/* Delete */}
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full text-left px-3 py-2 text-sm text-[var(--danger)]
              hover:bg-[var(--panel-pop)] transition-colors"
          >
            Delete file
          </button>
        ) : (
          <button
            onClick={handleDelete}
            className="w-full text-left px-3 py-2 text-sm font-medium text-[var(--danger)]
              hover:bg-[var(--panel-pop)] transition-colors"
          >
            Confirm delete
          </button>
        )}
      </div>
    )}
  </div>
)}
```

### 2e — Pass deleteFile through in App.jsx

```jsx
{page === 'viewer' && (
  <VaultFileViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
    deleteFile={deleteFile}
    onFileDeleted={() => setActivePath(null)}
  />
)}
```

---

## Step 3 — InboxPage: archive action

Open `src/core/InboxPage.jsx`. Add an "Archive" button to the inbox header — for when a user wants to file away a note without processing it.

### 3a — Add deleteFile to InboxEditor props and wire it down from App.jsx

```js
// In App.jsx, pass deleteFile to InboxPage:
{page === 'inbox' && (
  <InboxPage
    ...existing props...
    deleteFile={deleteFile}
  />
)}
```

### 3b — Add archive handler inside InboxEditor

```js
const handleArchiveNote = async () => {
  if (!filePath) return
  const filename    = filePath.split('/').pop()
  const archivePath = `archive/${filename}`
  try {
    const raw = await readFile(filePath)
    await writeFile(archivePath, raw)
    await deleteFile(filePath)
    // Navigate away — the note is gone from inbox
    // Call whatever function currently loads the next inbox note,
    // or navigate to command: setPage('command')
  } catch (err) {
    console.error('Archive failed:', err.message)
  }
}
```

### 3c — Add Archive button to the inbox header JSX

Add between the Dictate button and the Process note button:

```jsx
{isInboxFile && (
  <button
    onClick={handleArchiveNote}
    className="px-3 py-1.5 rounded-lg border border-[var(--border)]
      text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)]
      hover:text-[var(--text-primary)] transition-colors"
  >
    Archive
  </button>
)}
```

---

## Step 4 — Module toggles in Settings

### 4a — Update useSettings default schema

Open `src/hooks/useSettings.js`. Find the default settings object. Add `enabledModules`:

```js
// In the defaults / initial state:
const DEFAULT_SETTINGS = {
  apiKey:   '',
  model:    'meta-llama/llama-3.3-70b-instruct',
  provider: 'openrouter',
  enabledModules: {
    projects: true,
    people:   true,
    ideas:    true,
  },
  // ...existing fields
}
```

### 4b — Add toggle UI to SettingsPage

Open `src/core/SettingsPage.jsx`. Add a new section after the existing API key / model fields:

```jsx
{/* Module toggles */}
<div className="border-t border-[var(--border)] pt-6 mt-6">
  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
    Active Modules
  </h2>
  <p className="text-xs text-[var(--text-muted)] mb-4">
    Disabled modules are hidden from the sidebar and excluded from AI routing.
  </p>
  <div className="space-y-3">
    {['projects', 'people', 'ideas'].map(mod => (
      <label key={mod} className="flex items-center justify-between cursor-pointer group">
        <span className="text-sm text-[var(--text-secondary)] capitalize group-hover:text-[var(--text-primary)] transition-colors">
          {mod}
        </span>
        <button
          role="switch"
          aria-checked={settings.enabledModules?.[mod] ?? true}
          onClick={() => saveSettings({
            ...settings,
            enabledModules: {
              ...settings.enabledModules,
              [mod]: !(settings.enabledModules?.[mod] ?? true),
            }
          })}
          className={`relative w-9 h-5 rounded-full transition-colors
            ${(settings.enabledModules?.[mod] ?? true)
              ? 'bg-[var(--accent)]'
              : 'bg-[var(--border-strong)]'
            }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white
            transition-transform
            ${(settings.enabledModules?.[mod] ?? true) ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
      </label>
    ))}
  </div>
</div>
```

### 4c — Hide disabled module sections in Sidebar

Open `src/components/Sidebar.jsx`. Find where PROJECTS, PEOPLE, and IDEAS tree sections are rendered. Wrap each with a check against `settings.enabledModules`:

```jsx
// Sidebar needs access to settings — add useSettings() at the top if not already present:
const { settings } = useSettings()

// Then wrap each module section:
{(settings.enabledModules?.projects ?? true) && (
  // ... PROJECTS tree section
)}
{(settings.enabledModules?.people ?? true) && (
  // ... PEOPLE tree section
)}
{(settings.enabledModules?.ideas ?? true) && (
  // ... IDEAS tree section
)}
```

### 4d — Filter module routing in useNoteProcessor

Open `src/hooks/useNoteProcessor.js`. Find `buildSystemPrompt()`. It currently lists all modules from `MODULE_REGISTRY`. Pass `enabledModules` in and filter:

```js
// Change the signature:
function buildSystemPrompt(enabledModules = {}) {
  const activeModules = MODULE_REGISTRY.filter(m => enabledModules[m.id] !== false)

  const routingRules = activeModules.flatMap(m =>
    m.matchRules.map(r =>
      `- [${r.marker}]: route to ${m.vaultFolder}/ files under "${r.targetSection}"`
    )
  ).join('\n')

  const moduleList = activeModules.map(m =>
    `${m.id}: folder="${m.vaultFolder}"`
  ).join(', ')

  // rest of prompt unchanged
}
```

Pass `enabledModules` from `settings` when calling `process()` in InboxPage:

```js
// In handleProcess:
await process({
  noteContent,
  noteFilename: filePath,
  contextContent,
  allowedFiles,
  settings,
  enabledModules: settings.enabledModules ?? { projects: true, people: true, ideas: true },
})
```

---

## Step 5 — fileIndex.js: IndexedDB cache for allowedFiles

Create `src/lib/fileIndex.js`. This caches the vault's allowed file list in IndexedDB so `buildAllowedFiles(listTree)` only runs when the vault actually changes — not on every Process click.

```js
// src/lib/fileIndex.js
// Caches the allowedFiles list in IndexedDB.
// Invalidated whenever a new file is written to a module folder.
// Falls back to a fresh scan if the cache is missing or stale.

import { get, set } from 'idb-keyval'

const CACHE_KEY     = 'memostack:fileIndex'
const CACHE_VERSION = 1

/**
 * Returns cached allowedFiles or rebuilds by scanning the vault.
 * @param {Function} listTree
 * @param {Function} buildAllowedFiles — the scanner from vaultScanner.js
 * @param {boolean}  forceRefresh
 */
export async function getFileIndex(listTree, buildAllowedFiles, forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = await get(CACHE_KEY)
      if (cached?.version === CACHE_VERSION && Array.isArray(cached.files)) {
        return cached.files
      }
    } catch {}
  }

  // Cache miss or forced refresh — rebuild
  const files = await buildAllowedFiles(listTree)
  await set(CACHE_KEY, { version: CACHE_VERSION, files, updatedAt: Date.now() })
  return files
}

/**
 * Invalidates the cache — call this after writing a new entity file.
 */
export async function invalidateFileIndex() {
  try { await set(CACHE_KEY, null) } catch {}
}
```

### 5b — Use getFileIndex in InboxPage

Open `src/core/InboxPage.jsx`. Update `handleProcess`:

```js
import { getFileIndex, invalidateFileIndex } from '../lib/fileIndex'

// In handleProcess, replace:
let allowedFiles = []
try { allowedFiles = await buildAllowedFiles(listTree) } catch {}

// With:
let allowedFiles = []
try { allowedFiles = await getFileIndex(listTree, buildAllowedFiles) } catch {}
```

### 5c — Invalidate on entity creation

Open `src/components/EntityCreateModal.jsx`. After `writeFile(filePath, finalContent)` succeeds, invalidate the cache:

```js
import { invalidateFileIndex } from '../lib/fileIndex'

// After writeFile succeeds:
await writeFile(filePath, finalContent)
await invalidateFileIndex()  // ← add this
onCreated(filePath)
```

---

## Step 6 — Routing precision: validate LLM output

Open `src/hooks/useNoteProcessor.js`. After parsing the LLM response, add a validation pass that removes any changes targeting files not in `allowedFiles`.

Find the section that sets `parsed.changes`. Add after the id-injection:

```js
// Validate changes against allowedFiles — reject any invented paths
if (allowedFiles && allowedFiles.length > 0) {
  const validFiles = new Set(allowedFiles)
  const rejected   = parsed.changes.filter(c => !validFiles.has(c.file))
  
  if (rejected.length > 0) {
    console.warn(
      `Routing validator: rejected ${rejected.length} change(s) to unknown files:`,
      rejected.map(c => c.file)
    )
  }

  parsed.changes = parsed.changes.filter(c => validFiles.has(c.file))
}
```

Pass `allowedFiles` into the `process` function so it's available here:

```js
// process() signature — add allowedFiles:
const process = async ({ noteContent, noteFilename, contextContent, allowedFiles = [], settings, enabledModules }) => {
  // ...
  // After parsing, run the validator with the passed allowedFiles
}
```

This ensures the RoutingReview never shows a change to a file that doesn't exist in the vault, regardless of what the LLM returns.

---

## Step 7 — Lazy imports

Open `src/App.jsx`. Convert heavy components to `React.lazy()` to split the bundle.

### 7a — Add lazy + Suspense imports at the top

```js
import { lazy, Suspense } from 'react'
```

### 7b — Convert heavy imports to lazy

```js
// REMOVE these static imports:
// import InboxPage from './core/InboxPage'
// import VaultFileViewer from './components/VaultFileViewer'
// import RoutingReview from './core/RoutingReview'
// import EntityCreateModal from './components/EntityCreateModal'

// REPLACE with lazy:
const InboxPage         = lazy(() => import('./core/InboxPage'))
const VaultFileViewer   = lazy(() => import('./components/VaultFileViewer'))
const RoutingReview     = lazy(() => import('./core/RoutingReview'))
const EntityCreateModal = lazy(() => import('./components/EntityCreateModal'))
```

Keep these as static imports (needed immediately on first render):
- `App.jsx` shell components
- `Sidebar`
- `CommandPage`
- `TasksPage`
- `SettingsPage`

### 7c — Wrap the page switch in Suspense

Find the main content area where pages are rendered. Wrap it:

```jsx
<Suspense fallback={
  <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
    Loading…
  </div>
}>
  {page === 'inbox'  && <InboxPage ... />}
  {page === 'viewer' && <VaultFileViewer ... />}
  {/* etc. */}
</Suspense>
```

> Keep `CommandPage`, `TasksPage`, `SettingsPage` outside the Suspense boundary (or in their own separate Suspense) so a slow Milkdown load doesn't block the dashboard from rendering.

---

## Smoke test

1. `bun run build` — passes, chunk-size warning reduced or gone
2. **Archive from viewer** — open a note in `notes/`, click `···` → "Archive note" → note disappears from sidebar, appears in `archive/`
3. **Delete from viewer** — open an archive file, click `···` → "Delete file" → "Confirm delete" → file gone from sidebar and disk
4. **Archive from inbox** — open an inbox note, click "Archive" button → note disappears from INBOX section, appears in ARCHIVE section
5. **Disable People module** — Settings → toggle People off → PEOPLE section disappears from sidebar → process a note mentioning a person → RoutingReview shows no people routing changes
6. **Re-enable People** — toggle back on → section reappears
7. **File index cache** — process a note → check IndexedDB in DevTools (Application → IndexedDB → `memostack:fileIndex`) → cache entry exists. Process again → no `listTree` scan (same cache used).
8. **Routing validator** — if the LLM ever returns a change to a non-existent file path, it is silently filtered out before RoutingReview. Test by temporarily removing a file from the vault and processing a note that would route to it — no card for that file should appear.
9. **Lazy split** — DevTools → Network → reload → look for separate JS chunks loading after the initial bundle. The Milkdown/viewer chunk should load only when first needed.

---

## Handover 08 preview (do not build yet)

- **Search** — text search across all vault files, accessible from sidebar
- **`+` shortcut on tree sections** — create a new entity/note directly from the sidebar header button, opens in viewer
- **Loading skeletons** — replace "Loading…" text with proper skeleton screens for the lazy-loaded surfaces
- **Error boundaries** — catch chunk load failures gracefully rather than crashing the whole app
