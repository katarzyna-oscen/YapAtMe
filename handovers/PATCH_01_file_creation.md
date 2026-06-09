# Patch 01 — File Creation and Management
**Scope:** Three focused fixes. No new components, no new pages. Surgical changes to existing files only.  
**Apply in order:** Step 1 → Step 2 → Step 3. Build check after each step.

---

## Pre-flight reads (do these before writing any code)

1. Open `~/Desktop/Work/Memory OS/src/lib/templates.js` — read the full file. You need the template strings for projects, people, and ideas. Note the exact function signatures and frontmatter fields.
2. Open `src/lib/vaultInit.js` — find `todayInboxPath()` and `dailyNoteTemplate()`. Note their exact signatures.
3. Open `src/core/InboxPage.jsx` — find where `headerDate` is set (the live clock effect). Note what state variable drives it and where it is used in JSX.
4. Open `src/components/VaultFileViewer.jsx` — find the `···` actions menu and the condition controlling the "Archive" button.
5. Open `src/App.jsx` — find where `vaultReady` is checked and where the Sidebar is rendered. Note how `onNavigate` is called and how `tree`/`setTree` is managed.

---

## Step 1 — Daily inbox note: auto-create + header date from filename

**Two problems, one step:**
- No new note is created when the day changes — the old note keeps showing with today's live clock in the header.
- The header date/time updates every minute from a live clock, even though the file hasn't been touched.

**What it should do:**
- On vault ready, and once per minute, check whether a note for today exists in `inbox/`. If not, create one using `todayInboxPath()` + `dailyNoteTemplate()`. Refresh the sidebar tree after creation.
- The header shows the note's date from its filename (fixed), plus the time of the last actual save (only updates when the user writes something).

### 1a — App.jsx: auto-create today's note

Find where `vaultReady` becomes true (the `useEffect` that watches it). Add a `createTodayNoteIfMissing` call:

```js
// Add this function in App.jsx (alongside other handlers):
const createTodayNoteIfMissing = async () => {
  if (!vaultReady) return
  const path = todayInboxPath()           // from vaultInit.js
  const exists = await fileExists(path)
  if (!exists) {
    await writeFile(path, dailyNoteTemplate())
    // Refresh sidebar tree
    listTree().then(setTree).catch(() => {})
  }
}

// Call on vault ready:
useEffect(() => {
  if (!vaultReady) return
  createTodayNoteIfMissing()

  // Re-check each minute so a new note is created if the day rolls over
  // while the app is open
  const timer = setInterval(createTodayNoteIfMissing, 60_000)
  return () => clearInterval(timer)
}, [vaultReady])
```

Add the imports at the top of App.jsx if not already present:
```js
import { todayInboxPath, dailyNoteTemplate } from './lib/vaultInit'
```

### 1b — InboxPage.jsx: replace live clock with filename date + last-save time

Open `src/core/InboxPage.jsx`. Find the `now` state and the clock `setInterval` effect. Remove them.

Replace `headerDate` logic with:

```js
// REMOVE the live clock state and effect:
// const [now, setNow] = useState(new Date())
// useEffect(() => { const t = setInterval(...) ... }, [])

// REPLACE with: derive date from filename, track last save time separately
const [lastSavedTime, setLastSavedTime] = useState('')

// Parse the note date from the file path (e.g. "inbox/22-05-2026.md" → "22-05-2026")
const noteDateStr = filePath
  ? filePath.replace('inbox/', '').replace('.md', '')
  : ''

// Derive the day name from the filename date if parseable
const headerDate = (() => {
  if (!noteDateStr) return ''
  // filename is DD-MM-YYYY — parse it
  const parts = noteDateStr.split('-')
  if (parts.length !== 3) return noteDateStr
  const [dd, mm, yyyy] = parts
  const d = new Date(`${yyyy}-${mm}-${dd}`)
  if (isNaN(d)) return noteDateStr
  const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  return `${noteDateStr} · ${day}${lastSavedTime ? ` · ${lastSavedTime}` : ''}`
})()
```

Then in the `save` function, after a successful `writeFile`, record the time:

```js
const save = useCallback(async (text) => {
  if (!filePath) return
  setSaveStatus('saving')
  try {
    await writeFile(filePath, fullContent)  // or however content is assembled
    const t = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    setLastSavedTime(t)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  } catch { setSaveStatus('error') }
}, [filePath, writeFile, title, content])
```

> The filename format from `todayInboxPath()` may differ (could be `YYYY-MM-DD.md`). Check `vaultInit.js` and adjust the parsing logic to match the actual format — the logic above assumes `DD-MM-YYYY`.

---

## Step 2 — New file creation from sidebar + button

**Problem:** The + button on section headers opens `EntityCreateModal` (leftover wiring from H05) instead of directly creating a blank file.

**What it should do:** Clicking + on any section header immediately creates a new `.md` file in that folder using the appropriate template, then opens it in the viewer. No modal.

### 2a — Read templates from v1

Before writing any code, read `~/Desktop/Work/Memory OS/src/lib/templates.js`. Extract the template content for projects, people, and ideas. You will use these strings as the initial content for new files.

### 2b — App.jsx: add handleNewFile

```js
// Add to App.jsx alongside other handlers:

const handleNewFile = async (section) => {
  const date = new Date()
  const yyyy = date.getFullYear()
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const dd   = String(date.getDate()).padStart(2, '0')
  const ts   = `${yyyy}-${mm}-${dd}`

  let filename, content

  switch (section) {
    case 'inbox':
      // Inbox uses its own daily note flow — don't create from + button
      return

    case 'notes':
      filename = `${ts}.md`
      content  = `# \n\n`
      break

    case 'projects':
      filename = `untitled-${ts}.md`
      content  = projectTemplate()   // from templates.js — adapt name as needed
      break

    case 'people':
      filename = `untitled-${ts}.md`
      content  = personTemplate()    // from templates.js
      break

    case 'ideas':
      filename = `untitled-${ts}.md`
      content  = ideaTemplate()      // from templates.js
      break

    default:
      filename = `untitled-${ts}.md`
      content  = `# \n\n`
  }

  const path = `${section}/${filename}`

  try {
    await writeFile(path, content)
    // Refresh sidebar tree
    listTree().then(setTree).catch(() => {})
    // Navigate to the new file in the viewer
    handleNavigate('viewer', path)
  } catch (err) {
    console.error('Failed to create file:', err.message)
  }
}
```

Import templates at the top of App.jsx. Check the exact export names from the v1 `templates.js` after the pre-flight read and match them.

### 2c — Pass handleNewFile to Sidebar

Find the Sidebar render in App.jsx. Add the `onAdd` prop:

```jsx
<Sidebar
  ...existing props...
  onAdd={handleNewFile}
/>
```

### 2d — Sidebar.jsx: wire onAdd to section headers

Open `src/components/Sidebar.jsx`. Find `SidebarSection`. The component already has an `onAdd` prop and calls `onAdd?.()` when the + is clicked (from H08). The only change needed: pass the section name so App.jsx knows which folder to create in.

Update the `onAdd` call in `SidebarSection` to pass the section:

```jsx
// In SidebarSection, the + span onClick:
// BEFORE:
onClick={e => { e.stopPropagation(); onAdd?.() }}

// AFTER:
onClick={e => { e.stopPropagation(); onAdd?.(title.toLowerCase()) }}
```

Where `title` is the section title prop (e.g. "Notes", "Projects"). `title.toLowerCase()` gives "notes", "projects", etc. — matching the switch cases in `handleNewFile`.

> If the section title doesn't map cleanly to the vault folder name (e.g. if "Ideas" maps to folder `ideas/` but the title is something different), pass an explicit `sectionKey` prop to `SidebarSection` instead and use that.

---

## Step 3 — Archive and delete for all vault folders except context/

**Problem:** The `···` actions menu in VaultFileViewer only shows "Archive note" for `notes/` files. Files in `projects/`, `people/`, `ideas/`, and `archive/` (for delete) have no actions.

**Fix:** Show archive for all non-context, non-archive files. Show delete for all non-context files. The menu itself is already hidden for `context/` files.

Open `src/components/VaultFileViewer.jsx`. Find the actions menu JSX. Update the archive button condition:

```jsx
// BEFORE — only notes/ can be archived:
{filePath.startsWith('notes/') && (
  <button onClick={() => { setShowActions(false); handleArchive() }}>
    Archive note
  </button>
)}

// AFTER — anything except context/ and archive/ can be archived:
{!filePath.startsWith('archive/') && !filePath.startsWith('context/') && (
  <button
    onClick={() => { setShowActions(false); handleArchive() }}
    className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)]
      hover:bg-[var(--panel-pop)] hover:text-[var(--text-primary)] transition-colors"
  >
    Archive
  </button>
)}
```

The delete button condition and the outer menu guard (`!filePath.startsWith('context/')`) stay exactly as they are — no changes needed there.

---

## Build check

After all three steps:

1. `bun run build` — passes
2. **New daily note:** open app on a vault with no note for today → inbox section gains a new file immediately, named today's date
3. **Header date:** header shows the note's filename date (not live clock). Open old note → shows that note's date, not today's
4. **Header time:** blank on open, updates to HH:MM only after typing something and waiting 800ms
5. **Day rollover:** leave the app open past midnight → new note appears without reload
6. **+ on Notes:** click + → new `YYYY-MM-DD.md` appears in NOTES section, viewer opens with empty title ready to type
7. **+ on Projects:** new file appears in PROJECTS, viewer opens with the v1 project template content
8. **+ on People / Ideas:** same with their templates
9. **Archive from Projects:** open a project file in viewer → click `···` → "Archive" option visible → clicking it moves the file to `archive/`
10. **Archive from People/Ideas:** same
11. **Delete from any section:** `···` → "Delete file" → "Confirm delete" → file removed
12. **Context files:** `···` menu still absent for context/ files — no change
