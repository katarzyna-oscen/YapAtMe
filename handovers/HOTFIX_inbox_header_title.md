# Hotfix — Inbox Header + Title Field
**Problem:** InboxPage header shows a raw filename and three mismatched buttons. There is no title field.  
**Fix:** Redesign the header to match the design spec (live date/time, two buttons). Add a separate title input above the editor. Title is stored as the first `# ` line of the note and extracted on load.  
**File changed:** `src/core/InboxPage.jsx` only — surgical additions, no logic changes to processing or autosave.

---

## What the header should look like

```
[ 2026-05-22 · FRIDAY 16:48 ]          [ ● Dictate ]  [ + Process note ]
```

- Left: live date + weekday + time, updated every minute
- Right: Dictate button with animated dot (blue at rest, red + pulse when recording), amber Process note button
- No "Use Plain Editor" button — removed

---

## Step 1 — Add a live clock hook (inline, no new file needed)

Inside the `InboxEditor` component, add this after the existing state declarations:

```js
// Live clock — updates every minute
const [now, setNow] = useState(new Date())
useEffect(() => {
  const timer = setInterval(() => setNow(new Date()), 60_000)
  return () => clearInterval(timer)
}, [])

const headerDate = (() => {
  const date = now.toISOString().split('T')[0] // 2026-05-22
  const day  = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() // FRIDAY
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }) // 16:48
  return `${date} · ${day} ${time}`
})()
```

---

## Step 2 — Add title state + extract from note on load

Add title state alongside existing state:

```js
const [title, setTitle] = useState('')
```

Find the function that loads the note content into the editor (the effect or handler that calls `readFile` for the inbox file). After reading the raw content, add title extraction:

```js
// After reading raw note content into `raw` or `content`:
if (raw.startsWith('# ')) {
  const lines = raw.split('\n')
  setTitle(lines[0].replace(/^# /, ''))
  // Set the editor content to everything after the title line
  // (the actual call depends on how useMarkdownEditor accepts initial content)
  const body = lines.slice(1).join('\n').trimStart()
  // use `body` instead of `raw` when initialising the editor
} else {
  setTitle('')
  // use `raw` as-is
}
```

> **Check the load pattern in your current InboxPage.** The note load may happen in a `useEffect` that reads from `useFileSystem` on mount, or it may be triggered by the `filePath` prop. Find where `readFile` is called and slot the title extraction right after. Do not change the autosave logic.

---

## Step 3 — Update the autosave to include the title

Find the autosave `writeFile` call. Update it to prepend the title as an H1 when saving:

```js
// BEFORE (roughly):
await writeFile(filePath, content)

// AFTER:
const fullContent = title.trim()
  ? `# ${title.trim()}\n\n${content}`
  : content
await writeFile(filePath, fullContent)
```

---

## Step 4 — Replace the header JSX

Find the existing header bar in the InboxPage/InboxEditor JSX. It currently contains the filename and three buttons. Replace it entirely:

```jsx
{/* Header */}
<div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] shrink-0">

  {/* Live date + time */}
  <span className="text-xs text-[var(--text-muted)] tracking-wide font-mono">
    {headerDate}
  </span>

  {/* Actions */}
  <div className="flex items-center gap-2">

    {/* Dictate button */}
    <button
      onClick={isListening ? stop : start}
      disabled={!isSupported}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg
        border border-[var(--border)] text-sm text-[var(--text-secondary)]
        hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]
        disabled:opacity-30 transition-colors"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 transition-colors
        ${isListening
          ? 'bg-[var(--danger)] animate-[pulse-dot_1s_ease-in-out_infinite]'
          : 'bg-[var(--info)]'
        }`}
      />
      {isListening ? 'Stop' : 'Dictate'}
    </button>

    {/* Process note button */}
    {isInboxFile && (
      <button
        onClick={handleProcess}
        disabled={status === 'loading'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium
          hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <span className="text-base leading-none">+</span>
        {status === 'loading' ? 'Processing…' : 'Process note'}
      </button>
    )}

  </div>
</div>
```

> `isListening`, `stop`, `start`, `isSupported` come from `useVoiceDictation` — check the exact variable names already in scope in your InboxEditor component and match them.  
> `isInboxFile` guards the Process button — keep whatever condition currently controls this.  
> `status` comes from `useNoteProcessor` — already in scope.

---

## Step 5 — Add the title input above the editor

Find the content area div that wraps `<EditorComponent />`. Add the title input directly above it, inside the same scroll container:

```jsx
{/* Content area */}
<div className="flex-1 overflow-y-auto">
  <div className="max-w-2xl mx-auto px-8 pt-8 pb-6">

    {/* Title field */}
    <input
      type="text"
      value={title}
      onChange={e => setTitle(e.target.value)}
      placeholder="Untitled — type a subject or leave blank"
      className="w-full bg-transparent outline-none border-none mb-6
        text-2xl font-semibold leading-tight
        text-[var(--text-primary)]
        placeholder:text-[var(--border-strong)]
        placeholder:font-normal"
    />

    {/* Milkdown editor */}
    <EditorComponent />

  </div>
</div>
```

> If the content area already has a `max-w-2xl mx-auto` wrapper, slot the title input inside it above `<EditorComponent />` — don't add a second wrapper.

---

## Verify

1. `npm run dev`
2. Inbox opens — header shows `2026-05-22 · FRIDAY HH:MM` on the left
3. Two buttons on the right: `● Dictate` (blue dot) and `+ Process note` (amber)
4. Title placeholder reads `Untitled — type a subject or leave blank` in a muted colour
5. Type a title — it appears in large bold text
6. Type in the editor below — autosave fires after 800ms
7. Reload — title and body both restore correctly
8. Click Dictate — dot turns red and pulses, button text changes to "Stop"
9. Process note button shows "Processing…" while the LLM call is in flight
