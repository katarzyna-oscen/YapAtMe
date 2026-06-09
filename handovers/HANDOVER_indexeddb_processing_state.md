# Memory OS — Processing State via IndexedDB
*Prepared for Copilot handoff · 2026-05-27*

---

## Overview

Remove frontmatter from inbox notes entirely. Track processing state in IndexedDB instead. Note files stay clean — pure markdown, no `---` blocks.

Apply in order. Build after each section.

---

## Part 1 — IndexedDB store for processing state

**File:** `src/lib/db.js`

Add a new store `processedNotes` to the existing IndexedDB setup. Use the same database that already holds settings and folder handles.

Add to the existing `upgradeDB` / `onupgradeneeded` handler:
```js
if (!db.objectStoreNames.contains('processedNotes')) {
  db.createObjectStore('processedNotes', { keyPath: 'filePath' })
}
```

---

## Part 2 — Processing state helpers

**New file:** `src/lib/processedNotes.js`

```js
import { openDB } from './db'

const STORE = 'processedNotes'

export async function getProcessedState(filePath) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readonly')
    const result = await tx.objectStore(STORE).get(filePath)
    await tx.done
    return result || null
  } catch {
    return null
  }
}

export async function setProcessedState(filePath, state) {
  // state: { processed: true, processed_at: 'YYYY-MM-DD', tags: [] }
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    await tx.objectStore(STORE).put({ filePath, ...state })
    await tx.done
  } catch (err) {
    console.warn('Failed to save processed state:', err?.message || err)
  }
}

export async function clearProcessedState(filePath) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    await tx.objectStore(STORE).delete(filePath)
    await tx.done
  } catch (err) {
    console.warn('Failed to clear processed state:', err?.message || err)
  }
}
```

If `openDB` in `db.js` uses a different pattern (e.g. returns the db directly or uses a callback), match the existing pattern exactly. Do not introduce a new db connection pattern.

---

## Part 3 — Remove frontmatter from inbox notes

**File:** `src/lib/frontmatter.js`

Remove `buildInboxNoteContent`, `readInboxFrontmatter`, and `buildInboxFrontmatter` — these are no longer needed. If other files import them, remove those imports too.

---

## Part 4 — Update InboxPage.jsx

**File:** `src/core/InboxPage.jsx`

### 4a — Imports

Replace frontmatter-based processing state imports with:
```js
import { getProcessedState, setProcessedState, clearProcessedState } from '../lib/processedNotes'
```

Remove imports of `buildInboxNoteContent`, `readInboxFrontmatter`, `buildInboxFrontmatter` if present.

### 4b — State

Keep `inboxFrontmatter` state but simplify it — it now only holds processing state from IndexedDB, never from file content:
```js
const [processedState, setProcessedStateLocal] = useState({ processed: false, processed_at: null, tags: [] })
```

Replace all references to `inboxFrontmatter` with `processedState`.

### 4c — `loadFile`

After reading and parsing the file, load processing state from IndexedDB:
```js
const loadFile = useCallback(async (path) => {
  setLoading(true)
  try {
    const raw = await readFile(path)
    const { body } = parseFrontmatter(raw)
    // Strip any legacy frontmatter from old notes that were saved with it
    const cleanBody = stripLegacyFrontmatter(body || raw)
    const unescaped = unescapeWikilinks(cleanBody)
    const parsed = splitTitleBody(unescaped)
    if (parsed.title) {
      setTitle(parsed.title)
      setEditorBody(parsed.body)
    } else {
      setTitle('')
      setEditorBody(unescaped)
    }
    setFilePath(path)

    // Load processing state from IndexedDB
    const saved = await getProcessedState(path)
    setProcessedStateLocal(saved || { processed: false, processed_at: null, tags: [] })
  } catch {
    setTitle('')
    setEditorBody('')
    setFilePath(path)
    setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
  }
  setLoading(false)
}, [readFile])
```

Add this helper alongside `unescapeWikilinks`:
```js
function stripLegacyFrontmatter(text) {
  // Remove any --- frontmatter block that may have been written by previous versions
  return String(text || '').replace(/^---[\s\S]*?---\n?/, '').trimStart()
}
```

### 4d — `handleCleanupConfirm` — write state to IndexedDB, not file

After writing the annotated note body to disk, save processing state to IndexedDB:

```js
// Write clean note body to disk — no frontmatter
const cleanBody = unescapeWikilinks(noteBody)
await writeFile(filePath, cleanBody)

// Save processing state to IndexedDB
const today = new Date().toISOString().slice(0, 10)
const detectedTags = extractHashtags(cleanBody)
const nextState = { processed: true, processed_at: today, tags: detectedTags }
await setProcessedState(filePath, nextState)
setProcessedStateLocal(nextState)
```

Remove any call to `buildFileContent` or `buildInboxNoteContent` in this handler.

### 4e — `handleFileNote` — read state from IndexedDB

Replace the current frontmatter read from file with:
```js
const currentState = await getProcessedState(filePath)
if (!currentState?.processed) {
  setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
  setProcessNotice('This note must be processed before filing.')
  return
}
```

### 4f — After filing — clear state from IndexedDB

After the note is successfully moved from inbox to notes (after `moveFile` call):
```js
await clearProcessedState(filePath)
setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
```

### 4g — Button logic and status bar

Replace `inboxFrontmatter?.processed` with `processedState?.processed` everywhere:
```js
const isProcessed = processedState?.processed === true
const canProcess = hasContent
const canFile = isProcessed
const processLabel = isProcessed ? 'Reprocess' : 'Process note'
```

Status bar:
```jsx
{isProcessed && (
  <div style={{
    padding: '6px 48px',
    fontSize: 11.5,
    color: 'var(--text-very-dim)',
    borderBottom: '1px solid var(--border-subtle)',
    letterSpacing: '0.03em',
  }}>
    ✓ Processed {processedState.processed_at} · ready to file
  </div>
)}
```

---

## Part 5 — Auto-save: write clean body only

**File:** `src/core/InboxPage.jsx` — auto-save / `queueSave` function

The auto-save must write only the clean note body — no frontmatter. Confirm it calls `writeFile(filePath, cleanBody)` where `cleanBody = unescapeWikilinks(editorBody)` with no frontmatter prepended.

If it currently calls `buildFileContent` or `buildInboxNoteContent`, remove that and write just the body.

---

## What does NOT change

- `approvalHandler.js`
- `useNoteProcessor.js`
- `hashtagRouter.js`
- `tasksIndex.js`
- Any entity viewer, sidebar, or other page

## Build order

1. Add `processedNotes` store to `db.js` → build
2. Create `processedNotes.js` → build
3. Update `InboxPage.jsx` (all sub-parts together) → build
4. Remove dead frontmatter helpers from `frontmatter.js` → build
