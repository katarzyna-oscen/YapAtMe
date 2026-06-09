# Correction — Archive Structure
**Problem:** Code was written with `archive/notes/` subfolder and `tasks_done.md`. Both are wrong.  
**Correct structure:**
```
archive/
  tasks.md          ← all resolved tasks compiled here
  2026-05-14.md     ← archived notes stored directly here, no subfolder
  2026-05-13.md
```

Three files need updating. All changes are string replacements — no logic changes.

---

## Fix 1 — taskResolver.js

Open `src/lib/taskResolver.js`. Find:

```js
const DONE_PATH = 'archive/tasks_done.md'
```

Replace with:

```js
const DONE_PATH = 'archive/tasks.md'
```

That's the only change needed in this file.

---

## Fix 2 — ArchivePage.jsx

Open `src/core/ArchivePage.jsx`. Make two changes.

### 2a — Tasks file path

Find:
```js
const done = await readFile('archive/tasks_done.md')
```

Replace with:
```js
const done = await readFile('archive/tasks.md')
```

### 2b — Note files lookup

The current code tries to read from `tree['archive/notes']` or `tree['archive']`. Since notes live directly in `archive/`, simplify this to read only from `tree['archive']` and filter out `tasks.md`:

Find the note files loading block (inside `loadArchive`):

```js
// OLD — remove this entire try block and replace:
try {
  const tree = await listTree()
  const files = (tree['archive/notes'] || tree['archive'] || [])
    .filter(f => f.name && f.name.endsWith('.md') && !f.name.startsWith('_'))
    .map(f => ({
      name: f.name.replace('.md', ''),
      path: `archive/notes/${f.name}`,
    }))
    .sort((a, b) => b.name.localeCompare(a.name))
  setNoteFiles(files)
} catch {
  setNoteFiles([])
}
```

```js
// NEW:
try {
  const tree = await listTree()
  const files = (tree['archive'] || [])
    .filter(f => f.name && f.name.endsWith('.md')
      && !f.name.startsWith('_')
      && f.name !== 'tasks.md')   // exclude the tasks log
    .map(f => ({
      name: f.name.replace('.md', ''),
      path: `archive/${f.name}`,  // flat path, no subfolder
    }))
    .sort((a, b) => b.name.localeCompare(a.name))
  setNoteFiles(files)
} catch {
  setNoteFiles([])
}
```

---

## Fix 3 — vaultInit.js

Open `src/lib/vaultInit.js`. Check if it creates the archive folder structure on first run. Look for any of these strings and update them:

```js
// If you find this — change to archive/tasks.md
'archive/tasks_done.md'

// If you find this — remove it (no subfolder needed)
'archive/notes'
'archive/notes/'
```

If `vaultInit.js` creates folders by writing placeholder files, the `archive/notes/.keep` or similar placeholder should be removed. The `archive/` folder only needs to exist — no subfolders.

---

## Fix 4 — Check SESSION_HANDOVER.md vault structure comment

The vault structure documented in `SESSION_HANDOVER.md` says:
```
archive/
  notes/            ← archived notes
  tasks_done.md     ← append-only resolved task log
```

This is now outdated. Update it to:
```
archive/
  tasks.md          ← resolved task log (append-only)
  [note files]      ← archived notes stored directly here, no subfolder
```

This is documentation only — no code effect.

---

## Verify

1. `bun run build` — passes
2. Tick a task on the Tasks page → check `archive/tasks.md` on disk (not `tasks_done.md`)
3. Navigate to Archive → Resolved Tasks tab shows the entry
4. Archive → Notes tab: if any notes are in `archive/` directly, they appear (no subfolder needed)
