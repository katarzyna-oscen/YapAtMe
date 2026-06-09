# Patch 02 — Sidebar Refresh, Inbox +, Title Duplication, Archive/Delete
**Scope:** Four targeted fixes, no new files. Each step is independent — build after each one.

---

## Pre-flight reads

1. `src/components/Sidebar.jsx` — find NavItem for Dashboard, check how `badge` prop renders and whether it has an `onClick`
2. `src/hooks/useFileSystem.js` — check whether `deleteFile` exists in the return value
3. `src/components/VaultFileViewer.jsx` — find the `···` button and the archive/delete JSX. Check whether it actually renders (open browser devtools, inspect the viewer header — does the `···` button appear?)
4. `src/App.jsx` — find where VaultFileViewer is rendered. Check whether `deleteFile` and `onFileDeleted` are passed as props
5. `src/core/InboxPage.jsx` — find the `loadFile` function (or wherever `readFile` is called for inbox notes). Check what value is passed to `useMarkdownEditor` as `initialContent` — is it `raw` (the full file content including `# title`) or `body` (content after stripping the title line)?

---

## Step 1 — Sidebar: dashboard refresh button

**Problem:** The refresh indicator (`⟳`) next to Dashboard is rendered as a tiny dim badge with no click handler. It should be a discrete icon button that refreshes the dashboard.

### 1a — Add refreshDashboard callback to App.jsx

```js
// In App.jsx, add state for a refresh key:
const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)

const refreshDashboard = () => setDashboardRefreshKey(k => k + 1)
```

Pass both to the Sidebar and CommandPage:

```jsx
// Sidebar:
<Sidebar
  ...existing props...
  onRefreshDashboard={refreshDashboard}
/>

// CommandPage:
{page === 'command' && (
  <CommandPage
    key={dashboardRefreshKey}
    readFile={readFile}
    writeFile={writeFile}
    setPage={setPage}
  />
)}
```

The `key` prop on CommandPage forces a full remount (and data reload) when the refresh key increments.

### 1b — Sidebar.jsx: make refresh button properly sized and active

Open `src/components/Sidebar.jsx`. Find the Dashboard `NavItem`. The `badge="⟳"` is passed as a small dim text. Replace the Dashboard nav item to handle the refresh click separately from the navigation click — the dashboard icon navigates, the refresh button reloads.

Find the `NavItem` component. Update it to accept an `onBadgeClick` prop:

```jsx
function NavItem({ icon, label, active, badge, onClick, onBadgeClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 7,
        color: active ? 'var(--text)' : 'var(--text-dim)',
        background: active ? 'var(--panel-2)' : 'transparent',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer', fontSize: 13.5,
        transition: 'background .1s, color .1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = active ? 'var(--panel-2)' : 'transparent'; e.currentTarget.style.color = active ? 'var(--text)' : 'var(--text-dim)' } }}
    >
      <Icon name={icon} size={14} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && (
        <span
          onClick={onBadgeClick ? (e) => { e.stopPropagation(); onBadgeClick() } : undefined}
          style={{
            color: 'var(--text-very-dim)',
            fontSize: 13,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 4,
            cursor: onBadgeClick ? 'pointer' : 'default',
            transition: 'color .1s',
          }}
          onMouseEnter={e => { if (onBadgeClick) e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { if (onBadgeClick) e.currentTarget.style.color = 'var(--text-very-dim)' }}
        >
          {badge}
        </span>
      )}
    </div>
  )
}
```

Then pass `onBadgeClick` to the Dashboard nav item:

```jsx
<NavItem
  icon="grid"
  label="Dashboard"
  active={page === 'command'}
  badge="⟳"
  onClick={() => onNavigate('command')}
  onBadgeClick={onRefreshDashboard}
/>
```

---

## Step 2 — Inbox section: add + button

**Problem:** No + button on inbox. Clicking + on other sections creates a file — inbox should navigate to today's note (creating it if it doesn't exist yet).

Open `src/components/Sidebar.jsx`. Find the INBOX `SidebarSection`. Change `addable` from `false` (or absent) to `true`:

```jsx
<SidebarSection
  title="Inbox"
  addable              // ← add this
  files={filesFor('inbox')}
  activePath={activePath}
  onFileClick={path => onNavigate('inbox', path)}
  onAdd={() => onAdd?.('inbox')}
/>
```

Then in `App.jsx`, the `handleNewFile` switch already has a `case 'inbox':`. Update it to navigate to today's note (not return early):

```js
case 'inbox': {
  const path = todayInboxPath()
  const exists = await fileExists(path)
  if (!exists) {
    await writeFile(path, dailyNoteTemplate())
    listTree().then(setTree).catch(() => {})
  }
  handleNavigate('inbox', path)
  return
}
```

---

## Step 3 — InboxPage: fix title duplication

**Problem:** The daily note template includes `# DD-MM-YYYY` as its first line. The title input field correctly extracts it — but the Milkdown editor is also receiving the full raw content including the `# ` line, so the title appears twice.

**Root cause:** The `loadFile` function sets `content` to the full raw string and passes it as `initialContent` to `useMarkdownEditor`. The title-stripping happens in state but doesn't feed back into the editor's initial value.

### 3a — Add separate editor body state

Open `src/core/InboxPage.jsx`. Find the state declarations. Add:

```js
const [editorBody, setEditorBody] = useState('')
```

### 3b — Fix loadFile to split title from body

Find the function that reads the inbox file and sets `content` state. Update it to separate title and body:

```js
const loadFile = async (path) => {
  setLoading(true)
  setSaveStatus('idle')
  try {
    const raw = await readFile(path)
    if (raw.trimStart().startsWith('# ')) {
      const lines = raw.split('\n')
      const titleLine = lines[0].replace(/^#+ /, '').trim()
      const bodyLines = lines.slice(1).join('\n').trimStart()
      setTitle(titleLine)
      setEditorBody(bodyLines)
    } else {
      setTitle('')
      setEditorBody(raw)
    }
    setFilePath(path)
  } catch {
    setTitle('')
    setEditorBody('')
  }
  setLoading(false)
}
```

### 3c — Pass editorBody to useMarkdownEditor

Find the `useMarkdownEditor` call. Change `initialContent`:

```js
// BEFORE:
const { EditorComponent } = useMarkdownEditor({
  initialContent: content,
  onChange: handleChange,
})

// AFTER:
const { EditorComponent } = useMarkdownEditor({
  initialContent: editorBody,
  onChange: handleChange,
})
```

### 3d — Wrap EditorComponent in a key to force remount on file change

When `filePath` changes (user clicks a different inbox note), the editor must reinitialise with the new `editorBody`. Add a `key` wrapper:

```jsx
{/* In the content area, wrap the editor: */}
<div key={filePath}>
  <EditorComponent />
</div>
```

### 3e — Fix save to use editorBody not content

Find the autosave/save function. It assembles `fullContent = title ? \`# ${title}\n\n${content}\` : content`. Update so it uses `editorBody` as the body:

```js
// In handleChange (onChange callback):
function handleChange(newBody) {
  setEditorBody(newBody)   // ← was: setContent(newBody)
  setSaveStatus('idle')
  clearTimeout(saveTimer.current)
  saveTimer.current = setTimeout(() => save(newBody), 800)
}

// In save:
const save = useCallback(async (body) => {
  if (!filePath) return
  setSaveStatus('saving')
  const fullContent = title.trim()
    ? `# ${title.trim()}\n\n${body}`
    : body
  try {
    await writeFile(filePath, fullContent)
    const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    setLastSavedTime(t)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 1500)
  } catch { setSaveStatus('error') }
}, [filePath, writeFile, title])
```

---

## Step 4 — Archive and delete: diagnose and fix properly

This requires a specific read-before-write sequence. Follow each check before the corresponding fix.

### 4a — Check: does useFileSystem expose deleteFile?

Open `src/hooks/useFileSystem.js`. Find the return statement. If `deleteFile` is **not** in the return object, add it now:

```js
const deleteFile = async (path) => {
  const parts = path.split('/')
  const filename = parts.pop()
  let dirHandle = rootHandle  // adapt to your actual root handle variable name
  for (const part of parts) {
    dirHandle = await dirHandle.getDirectoryHandle(part, { create: false })
  }
  await dirHandle.removeEntry(filename)
}

// Add to return:
return { vaultReady, folderName, openFolder, readFile, writeFile, listTree, fileExists, deleteFile }
```

### 4b — Check: is deleteFile passed to VaultFileViewer in App.jsx?

Open `src/App.jsx`. Find where VaultFileViewer is rendered. Confirm it receives `deleteFile` and `onFileDeleted`:

```jsx
{page === 'viewer' && (
  <VaultFileViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
    deleteFile={deleteFile}        // ← must be present
    onFileDeleted={() => {
      setActivePath(null)
      listTree().then(setTree).catch(() => {})   // refresh tree
    }}
  />
)}
```

If either prop is missing, add it.

### 4c — Check: does VaultFileViewer render the ··· button?

Open `src/components/VaultFileViewer.jsx`. Find the `···` button. Confirm:

1. The outer condition `!filePath.startsWith('context/')` is present and correct
2. The `showActions` state is declared and toggled by the button
3. The button itself has an `onClick`

If the button is there but clicking does nothing: check that `showActions` is declared as `useState(false)` and that `setShowActions` is called correctly.

### 4d — Fix VaultFileViewer if props are missing

If `deleteFile` or `onFileDeleted` were not being received, the `handleDelete` and `handleArchive` functions were calling undefined functions silently. After adding the props in 4b, no further change to VaultFileViewer is needed — the handlers already reference the props by name.

### 4e — Verify archive condition covers all module files

Open `src/components/VaultFileViewer.jsx`. Find the archive button. Confirm the condition is:

```jsx
{!filePath.startsWith('archive/') && !filePath.startsWith('context/') && (
  <button onClick={() => { setShowActions(false); handleArchive() }}>
    Archive
  </button>
)}
```

If it still says `filePath.startsWith('notes/')`, replace it with the condition above.

### 4f — Fix menu staying open after click outside

The actions menu has no click-outside handler so it never closes unless you click a button. Add one:

```jsx
// In the actions menu container:
<div
  style={{ position: 'relative', flexShrink: 0, margin: '0 8px' }}
  onBlur={() => setShowActions(false)}
>
  <button onClick={() => setShowActions(s => !s)}>···</button>
  {showActions && (
    <div
      tabIndex={-1}
      onBlur={() => setShowActions(false)}
      style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', ... }}
    >
      ...menu items...
    </div>
  )}
</div>
```

> `onBlur` on a `div` only fires when focus leaves the div entirely. You may need `onMouseLeave` + a short delay, or a document-level click listener. The simplest reliable approach: add a transparent overlay behind the menu:

```jsx
{showActions && (
  <>
    {/* Overlay to catch outside clicks */}
    <div
      onClick={() => { setShowActions(false); setConfirming(false) }}
      style={{ position: 'fixed', inset: 0, zIndex: 19 }}
    />
    {/* Menu */}
    <div style={{ position: 'absolute', right: 0, top: '...', zIndex: 20, ... }}>
      ...menu items...
    </div>
  </>
)}
```

---

## Build check

1. `bun run build` — passes
2. **Dashboard ⟳:** click ⟳ beside "Dashboard" → button is readable size, clicking it reloads CommandPage data
3. **Inbox +:** + icon visible on INBOX section header. Clicking it navigates to today's note. If vault is fresh (no today note), one is created first.
4. **Title not duplicated:** open today's inbox note → title field shows the date, editor body starts with the note body text, not another `# date` heading
5. **Switch notes:** click a different inbox note → editor resets to that note's body, title field shows that note's title
6. **Archive from Projects:** open a project file → `···` visible → click Archive → file moves to `archive/`, viewer closes (or navigates to null state)
7. **Archive from People, Ideas, Notes:** same
8. **Delete any file:** `···` → Delete → Confirm → file gone, tree refreshed
9. **Context files:** no `···` menu visible
10. **Menu closes:** clicking outside the `···` dropdown closes it without triggering any action
