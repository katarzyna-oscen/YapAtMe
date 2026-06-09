# Handover — Viewer Task Refresh + People File Cleanup
**Files to patch:** `src/App.jsx`, `src/core/ProjectViewer.jsx`, `src/core/PersonViewer.jsx`
**No changes needed to:** `src/lib/templates.js`, `src/components/EntityCreateModal.jsx`

---

## Issue 1 — Tasks not showing in entity viewers (root cause + fix)

`loadStats` in both viewers runs once when `filePath` changes. There is no signal
to re-run it after the routing pipeline writes new tasks to the index. Opening the
file before processing a note → `loadStats` runs → finds nothing → panel stays empty.
Processing a note → tasks land in index → viewer never re-checks.

**Fix: thread a `tasksVersion` counter from App down to both viewers.**

---

### Step 1 — `src/App.jsx`

**Add state** alongside `dashboardRefreshKey`:
```js
const [tasksVersion, setTasksVersion] = useState(0)
```

**Add refresh helper** alongside `refreshDashboard`:
```js
const refreshTasks = () => setTasksVersion((v) => v + 1)
```

**Update `onProcessedNote`** in the InboxPage render to call both:
```jsx
onProcessedNote={async () => {
  refreshTree()
  refreshTasks()   // ← add this line
}}
```

**Pass `tasksVersion` to both viewers:**

PersonViewer (around line 331):
```jsx
<PersonViewer
  filePath={activeFile}
  readFile={readFile}
  writeFile={writeFile}
  deleteFile={deleteFile}
  renameFile={renameFile}
  fileExists={fileExists}
  tasksVersion={tasksVersion}   // ← add
  onFileRenamed={handleFileRenamed}
  onConfirmAction={showConfirm}
  onFileDeleted={() => {
    refreshTree()
    setActiveFile(null)
    setActivePage('command')
  }}
/>
```

ProjectViewer (around line 349):
```jsx
<ProjectViewer
  filePath={activeFile}
  readFile={readFile}
  writeFile={writeFile}
  deleteFile={deleteFile}
  renameFile={renameFile}
  fileExists={fileExists}
  tasksVersion={tasksVersion}   // ← add
  onFileRenamed={handleFileRenamed}
  onConfirmAction={showConfirm}
  onFileDeleted={() => {
    refreshTree()
    setActiveFile(null)
    setActivePage('command')
  }}
/>
```

---

### Step 2 — `src/core/ProjectViewer.jsx`

**Add `tasksVersion` to the props destructure:**
```js
export default function ProjectViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  fileExists,
  tasksVersion,        // ← add
  onFileRenamed,
  onConfirmAction,
  onFileDeleted,
}) {
```

**Split the existing combined useEffect into two:**

Replace:
```js
useEffect(() => {
  if (!filePath) return
  loadFile(filePath)
  loadStats(filePath)
}, [filePath])
```

With:
```js
// File content — only reload when file path changes
useEffect(() => {
  if (!filePath) return
  loadFile(filePath)
}, [filePath])

// Task stats — reload when file changes OR after note processing
useEffect(() => {
  if (!filePath) return
  loadStats(filePath)
}, [filePath, tasksVersion])
```

---

### Step 3 — `src/core/PersonViewer.jsx`

Same two changes as ProjectViewer:

**Add `tasksVersion` to props destructure:**
```js
export default function PersonViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  fileExists,
  tasksVersion,        // ← add
  onFileRenamed,
  onConfirmAction,
  onFileDeleted,
}) {
```

**Split the useEffect:**
```js
useEffect(() => {
  if (!filePath) return
  loadFile(filePath)
}, [filePath])

useEffect(() => {
  if (!filePath) return
  loadStats(filePath)
}, [filePath, tasksVersion])
```

---

## Issue 2 — People files messy / wrong sections

**Root cause:** Before Patch C was applied, `applyChange` was writing checkbox lines to
markdown via `appendToSection`. If the target section (`## Delegate`, `## Talk About`)
didn't exist in the file, `appendToSection` created it. This bypassed the template
and left files with sections that shouldn't be there.

**Going forward:** Patch C already fixes this — task content goes to the index only,
`appendToSection` is never called for task sections anymore.

**Existing damaged files:** Need a one-time cleanup pass.

Add a **"Clean entity files"** action to the Vault maintenance section in `SettingsPage`.
The cleaner should:
1. Scan all `projects/*.md` and `people/*.md` files
2. For each file, strip any section not in the allowed schema:
   - Projects keep: `## Summary`, `## Current Plan`, `## Recent Mentions`, `## Notes`
   - People keep: `## Summary`, `## Related Projects`, `## Recent Mentions`, `## Notes`
3. Strip sections: `## Open Actions`, `## Delegations`, `## Decisions`, `## Delegate`,
   `## Talk About`, `## Status`, `## Backlog` — and any other heading not in the schema
4. Write the cleaned file back to disk
5. Return a summary: N files cleaned, N sections removed

Implement this as `src/lib/cleanEntityFiles.js` with a function signature matching
`migrateEntityTasks`:
```js
export async function cleanEntityFiles({ readFile, writeFile, listTree }) → { filesChecked, filesCleaned, sectionsRemoved }
```

Add the button in SettingsPage Vault maintenance section, same pattern as "Run migration".

---

## Issue 3 — Template correctness

`src/lib/templates.js` is **already correct** after Patch A. No changes needed.

Current schemas (confirmed clean):

**Projects:**
- `## Summary`
- `## Current Plan`
- `## Recent Mentions` _(Populated by AI)_
- `## Notes`

**People:**
- `## Summary`
- `## Related Projects`
- `## Recent Mentions` _(Populated by AI)_
- `## Notes`

No task sections in either template. `EntityCreateModal` calls `generateFile` correctly.
New entity files created via the modal will have the right structure.

---

## Validation checklist

- [ ] Open a project or person file → task panel is empty (no tasks yet)
- [ ] Process an inbox note that routes tasks to that file
- [ ] Without navigating away, task panel updates automatically
- [ ] Count badges in the metadata row also update
- [ ] `tasksVersion` does NOT cause `loadFile` to re-run (editor content stable)
- [ ] "Clean entity files" button appears in Settings → Vault maintenance
- [ ] Running cleaner removes `## Delegate`, `## Talk About`, etc. from existing people files
- [ ] Clean files retain `## Summary`, `## Recent Mentions`, `## Notes` content
- [ ] `bun run build` passes
