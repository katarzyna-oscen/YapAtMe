# Hotfix — Notes Page Redesign
**Problem:** NotesPage has an internal two-column file list that duplicates the sidebar, renders raw markdown in a `<pre>` tag, and is read-only.  
**Fix:** Remove the internal file list. Wire the sidebar note clicks to pass a file path to App.jsx. NotesPage becomes a single-column Milkdown editor that mirrors InboxPage's structure — same hook, same autosave, same feel.  
**Files changed:** `NotesPage.jsx` (full rewrite), `App.jsx` (surgical — add path tracking), `Sidebar.jsx` (surgical — pass path on note click).

---

## Pre-flight — check the Sidebar's current navigation call

Open `src/components/Sidebar.jsx`. Find where note files are listed and what happens on click. It probably looks like one of these:

```js
// Option A — just sets the page
onClick={() => onNavigate('notes')}

// Option B — already passes something
onClick={() => onNavigate('notes', somePath)}
```

Note the exact function name (`onNavigate`, `setPage`, `navigate`, etc.) — you'll need it in Steps 2 and 3.

Also check `src/App.jsx` for the navigation handler signature so you know what to update.

---

## Step 1 — App.jsx (surgical — add active file path state)

Open `src/App.jsx`. Make two small changes.

### 1a — Add `activePath` state

Find where `page` state is declared:
```js
const [page, setPage] = useState('command') // or whatever the default is
```

Add alongside it:
```js
const [activePath, setActivePath] = useState(null) // vault-relative path of the open file
```

### 1b — Update the navigation handler

Find the function that handles page changes from the sidebar (called by `onNavigate` or similar). Update it to accept an optional second argument:

```js
// BEFORE — something like:
const handleNavigate = (newPage) => {
  setPage(newPage)
}

// AFTER:
const handleNavigate = (newPage, filePath = null) => {
  setPage(newPage)
  setActivePath(filePath)
}
```

### 1c — Pass activePath to NotesPage

Find where NotesPage is rendered in the page switch:

```jsx
// BEFORE:
{page === 'notes' && (
  <NotesPage readFile={readFile} listTree={listTree} />
)}

// AFTER:
{page === 'notes' && (
  <NotesPage
    readFile={readFile}
    writeFile={writeFile}
    listTree={listTree}
    activePath={activePath}
  />
)}
```

---

## Step 2 — Sidebar.jsx (surgical — pass file path on note click)

Open `src/components/Sidebar.jsx`. Find the section that renders files under the NOTES tree section. Find the `onClick` for each note file item. Update it to pass the vault-relative path as the second argument:

```js
// BEFORE:
onClick={() => onNavigate('notes')}

// AFTER:
onClick={() => onNavigate('notes', `notes/${f.name}`)}
```

Where `f.name` is the filename from the tree (e.g. `"2026-05-14.md"`). Adjust if the variable name differs — the key is that the second argument is a vault-relative path like `"notes/2026-05-14.md"`.

> Also check: does the sidebar have a top-level "Notes" nav item (not a file item, just the section header)? If clicking the section header also navigates to `'notes'`, leave that call as `onNavigate('notes')` with no second argument — the Notes page will fall back to loading the first file.

---

## Step 3 — NotesPage.jsx (full rewrite)

Replace `src/core/NotesPage.jsx` in full.

The page now works like InboxPage:
- Loads the `activePath` file passed from App.jsx
- If no `activePath`, loads the first note from the vault
- Uses `useMarkdownEditor` (Milkdown) for rendering and editing
- Autosaves at 800ms debounce
- Shows the filename as the page title

```jsx
// src/core/NotesPage.jsx
// Read/edit view for processed notes in vault/notes/.
// Receives activePath from App.jsx (set when user clicks a note in the sidebar).
// Falls back to the first available note if no path is given.
// Uses Milkdown — same editor as InboxPage — with autosave.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor'

export default function NotesPage({ readFile, writeFile, listTree, activePath }) {
  const [filePath,    setFilePath]    = useState(null)
  const [content,     setContent]     = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saveStatus,  setSaveStatus]  = useState('idle') // idle | saving | saved | error
  const saveTimer = useRef(null)

  const { EditorComponent, appendText } = useMarkdownEditor({
    initialContent: content,
    onChange: handleChange,
  })

  // Load file whenever activePath changes (sidebar click) or on first mount
  useEffect(() => {
    if (activePath) {
      loadFile(activePath)
    } else {
      loadFirstNote()
    }
  }, [activePath])

  const loadFirstNote = async () => {
    setLoading(true)
    try {
      const tree = await listTree()
      const files = (tree['notes'] || [])
        .filter(f => f.name.endsWith('.md') && !f.name.startsWith('_moved'))
        .sort((a, b) => b.name.localeCompare(a.name)) // most recent first
      if (files.length > 0) {
        await loadFile(`notes/${files[0].name}`)
      } else {
        setFilePath(null)
        setContent('')
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    try {
      const raw = await readFile(path)
      setFilePath(path)
      setContent(raw)
    } catch (err) {
      console.error('Failed to load note:', err.message)
      setContent('')
    }
    setLoading(false)
  }

  function handleChange(newContent) {
    setContent(newContent)
    setSaveStatus('idle')

    // Debounced autosave — 800ms, same as InboxPage
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save(newContent)
    }, 800)
  }

  const save = useCallback(async (text) => {
    if (!filePath) return
    setSaveStatus('saving')
    try {
      await writeFile(filePath, text)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }, [filePath, writeFile])

  // Derive a clean display name from the file path
  const displayName = filePath
    ? filePath.replace('notes/', '').replace('.md', '')
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        Loading…
      </div>
    )
  }

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-[var(--text-muted)] text-sm">No notes yet.</p>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Processed notes appear here. Select one from the sidebar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base font-semibold text-[var(--text-primary)] truncate">
            {displayName}
          </h1>
          <span className="text-xs text-[var(--text-muted)] shrink-0">
            notes/
          </span>
        </div>

        {/* Save status */}
        <span className={`text-xs shrink-0 transition-opacity
          ${saveStatus === 'idle'   ? 'opacity-0' : 'opacity-100'}
          ${saveStatus === 'saving' ? 'text-[var(--text-muted)]' : ''}
          ${saveStatus === 'saved'  ? 'text-[var(--success)]' : ''}
          ${saveStatus === 'error'  ? 'text-[var(--danger)]' : ''}
        `}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved'  && 'Saved'}
          {saveStatus === 'error'  && 'Save failed'}
        </span>
      </div>

      {/* Editor — full width, same as InboxPage */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <EditorComponent />
        </div>
      </div>

    </div>
  )
}
```

---

## One thing to verify — useMarkdownEditor signature

Open `src/hooks/useMarkdownEditor.js`. Check how it accepts `initialContent` and `onChange`. The hook was rewritten in HOTFIX_01 to use `useEditor`. It may use different prop names, e.g.:

```js
// Possible interface A
useMarkdownEditor({ initialContent, onChange })

// Possible interface B  
useMarkdownEditor(initialContent, onChange)

// Possible interface C — no onChange, uses a ref or getter
const { EditorComponent, getContent, appendText } = useMarkdownEditor(initialContent)
```

If the hook doesn't accept an `onChange` callback, you have two options:

**Option A** — Add an `onChange` prop to the hook (preferred). In `useMarkdownEditor.js`, find where the editor is configured and add a listener:

```js
// Inside useEditor config, add an onChange listener:
editor.on('updated', () => {
  const md = editor.action(getMarkdown)
  onChange?.(md)
})
```

**Option B** — Use a polling approach in NotesPage. Replace `handleChange` with a getter called on a timer — simpler but less elegant.

If the hook already has `onChange`, the code in Step 3 works as-is.

---

## Build check

After applying all three steps:

1. `bun run build` — must pass
2. `npm run dev` — open the app
3. Click a note in the sidebar — no secondary file list, Milkdown editor fills the page
4. Type something — "Saved" appears after 800ms
5. Reload — content persists (file was written to disk)
6. Click a different note in the sidebar — editor switches to that file

---

## File list

```
src/
  core/
    NotesPage.jsx       ← FULL REWRITE
  App.jsx               ← SURGICAL — activePath state + pass to NotesPage
  components/
    Sidebar.jsx         ← SURGICAL — pass vault path on note click
```
