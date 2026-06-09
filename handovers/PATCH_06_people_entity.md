# Patch 06 — People Entity: Template + Viewer
**Scope:** Update the People template in `templates.js`. Create `PersonViewer.jsx` — a dedicated viewer for `people/` files with a computed stats strip, editable name, DictateButton, TrashMenuButton, and Milkdown body. Route `people/` paths to it from App.jsx.

---

## Pre-flight reads

1. `src/lib/frontmatter.js` — note the exact names of the parse and serialize functions. This file is called with `(rawString)` and returns `{ data, content }` where `data` is the frontmatter object and `content` is the markdown body. The serialize function takes `(data, content)` and returns the full file string. Use these exact names in Step 2.
2. `src/App.jsx` — find where `people/` paths are currently handled. Confirm `showConfirm`, `deleteFile`, `readFile`, `writeFile` are all in scope where you'll add the new route.
3. `src/core/ProcessedNoteViewer.jsx` — the header pattern (date left, buttons right), DictateBtn, TrashMenuButton are already implemented here. Import or copy these rather than rewriting.

---

## Step 1 — Update People template in templates.js

Open `src/lib/templates.js`. Find the `case 'people':` block. Replace it in full:

```js
case 'people':
  return {
    slug,
    content:
`---
type: person
full_name: ${name}
relationship: 
role: 
last_updated: ${today}
---

## Summary


## Related Projects


## Delegate


## Talk About


## Recent Mentions


## Notes
`,
  }
```

Changes from v1:
- Added `## Summary` section (second section, after the frontmatter)
- Added `## Notes` section at the end
- Removed the pre-filled `- [[]]` placeholder in Related Projects (starts empty)
- Removed the pre-filled `- [ ]` in Delegate and Talk About (AI populates these)
- Removed the pre-filled `- ${today} —` in Recent Mentions (AI populates these)
- Removed `company:` — not needed

---

## Step 2 — PersonViewer.jsx (new)

Create `src/core/PersonViewer.jsx` in full.

```jsx
// src/core/PersonViewer.jsx
// Dedicated viewer/editor for files in people/.
// Header: last_updated date (left) + DictateButton + TrashMenuButton (right).
// Stats strip: open delegates + open talk-about from tasks-index.json.
// Body: editable full_name (from frontmatter) + Milkdown editor.
// Autosaves the full file (frontmatter + body) on 800ms debounce.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor'
import { useVoiceDictation } from '../hooks/useVoiceDictation'

// ── Import from frontmatter.js — adapt names after pre-flight read ──────────
// e.g. import { parseFrontmatter, stringifyFrontmatter } from '../lib/frontmatter'
import { parseFrontmatter, stringifyFrontmatter } from '../lib/frontmatter'

// ── Import shared button components ─────────────────────────────────────────
// If DictateBtn and TrashMenuButton were extracted to shared files in Patch 03/05:
import DictateBtn      from '../components/DictateBtn'
import TrashMenuButton from '../components/TrashMenuButton'
// If they were NOT extracted, copy the component definitions from
// ProcessedNoteViewer.jsx to the bottom of this file instead.

export default function PersonViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  onConfirmAction,
}) {
  // Frontmatter fields
  const [fullName,     setFullName]     = useState('')
  const [relationship, setRelationship] = useState('')
  const [role,         setRole]         = useState('')
  const [lastUpdated,  setLastUpdated]  = useState('')

  // Editor body (markdown without frontmatter)
  const [editorBody, setEditorBody] = useState('')

  // Computed stats from tasks-index.json
  const [delegateCount,  setDelegateCount]  = useState(0)
  const [talkAboutCount, setTalkAboutCount] = useState(0)
  const [lastMentioned,  setLastMentioned]  = useState(null)

  const [loading,       setLoading]       = useState(true)
  const [saveStatus,    setSaveStatus]    = useState('idle')
  const [lastSavedTime, setLastSavedTime] = useState('')
  const saveTimer = useRef(null)

  const { EditorComponent } = useMarkdownEditor({
    initialContent: editorBody,
    onChange: handleBodyChange,
  })

  const { isListening, isSupported, start, stop } = useVoiceDictation()

  // Load file + stats when path changes
  useEffect(() => {
    if (filePath) {
      loadFile(filePath)
      loadStats(filePath)
    }
  }, [filePath])

  const loadFile = async (path) => {
    setLoading(true)
    setSaveStatus('idle')
    setLastSavedTime('')
    try {
      const raw = await readFile(path)
      const { data, content } = parseFrontmatter(raw)
      setFullName(    data.full_name    || '')
      setRelationship(data.relationship || '')
      setRole(        data.role         || '')
      setLastUpdated( data.last_updated || '')
      setEditorBody(content.trimStart())
    } catch {
      setFullName('')
      setEditorBody('')
    }
    setLoading(false)
  }

  const loadStats = async (path) => {
    try {
      const raw     = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw).filter(e => e.file === path && e.status !== 'done')
      setDelegateCount( entries.filter(e => e.section === '## Delegate').length)
      setTalkAboutCount(entries.filter(e => e.section === '## Talk About').length)
    } catch {
      setDelegateCount(0)
      setTalkAboutCount(0)
    }
    // Parse last mention date from body content
    try {
      const raw     = await readFile(path)
      const { content } = parseFrontmatter(raw)
      const mentionsBlock = content.match(/## Recent Mentions\n([\s\S]*?)(?=\n## |\s*$)/)
      if (mentionsBlock) {
        const dates = [...mentionsBlock[1].matchAll(/(\d{4}-\d{2}-\d{2})/g)]
        if (dates.length) setLastMentioned(dates[dates.length - 1][1])
      }
    } catch {}
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
    const today = new Date().toISOString().slice(0, 10)
    const data  = {
      type:         'person',
      full_name:    fullName.trim() || 'Untitled',
      relationship: relationship,
      role:         role,
      last_updated: today,
    }
    // Adapt stringifyFrontmatter call to match your frontmatter.js signature
    const full = stringifyFrontmatter(data, body)
    try {
      await writeFile(filePath, full)
      const t = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
      setLastSavedTime(t)
      setLastUpdated(today)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch { setSaveStatus('error') }
  }, [filePath, writeFile, fullName, relationship, role])

  // Trigger save when name/role/relationship change
  useEffect(() => {
    if (!filePath || loading) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(editorBody), 800)
  }, [fullName, relationship, role])

  // Header date from last_updated frontmatter field
  const headerDate = (() => {
    if (!lastUpdated) return ''
    const d = new Date(lastUpdated)
    if (isNaN(d)) return lastUpdated.toUpperCase()
    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    }).toUpperCase()
    const daysAgo = Math.floor((Date.now() - d) / 86_400_000)
    const age = daysAgo === 0 ? 'TODAY'
      : daysAgo === 1        ? '1 DAY AGO'
      : `${daysAgo} DAYS AGO`
    return `UPDATED ${formatted} · ${age}`
  })()

  const fileLabel = fullName || filePath?.replace('people/', '').replace('.md', '') || 'this person'

  const hasStats = delegateCount > 0 || talkAboutCount > 0 || lastMentioned

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--text-very-dim)', fontSize: 13,
    }}>
      Loading…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 16, flexShrink: 0,
      }}>
        <div style={{
          fontSize: 13, color: 'var(--text-very-dim)',
          letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
        }}>
          {headerDate}
          {lastSavedTime && (
            <span style={{ marginLeft: 8, opacity: 0.6 }}>· saved {lastSavedTime}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DictateBtn
            active={isListening}
            disabled={!isSupported}
            onClick={isListening ? stop : start}
          />
          <TrashMenuButton
            label={fileLabel}
            onConfirmAction={onConfirmAction}
            onArchive={async () => {
              const filename = filePath.split('/').pop()
              const content  = await readFile(filePath)
              await writeFile(`archive/${filename}`, content)
              await deleteFile(filePath)
            }}
            onDelete={async () => {
              await deleteFile(filePath)
            }}
          />
        </div>
      </header>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      {hasStats && (
        <div style={{
          display: 'flex', gap: 20, alignItems: 'center',
          padding: '10px 48px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          {delegateCount > 0 && (
            <Stat
              color="var(--accent)"
              label={`${delegateCount} delegate${delegateCount !== 1 ? 's' : ''}`}
            />
          )}
          {talkAboutCount > 0 && (
            <Stat
              color="var(--info)"
              label={`${talkAboutCount} talk about`}
            />
          )}
          {lastMentioned && (
            <Stat
              color="var(--text-very-dim)"
              label={`last mentioned ${lastMentioned}`}
            />
          )}
        </div>
      )}

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>

          {/* Full name — editable, 30px like note title */}
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Full name"
            style={{
              display: 'block', width: '100%',
              fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em',
              color: 'var(--text)', background: 'transparent',
              border: 'none', outline: 'none',
              padding: 0, marginBottom: 8, fontFamily: 'inherit',
            }}
          />

          {/* Role / relationship metadata row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <MetaInput
              value={role}
              onChange={setRole}
              placeholder="Role"
            />
            <MetaInput
              value={relationship}
              onChange={setRelationship}
              placeholder="Relationship"
            />
          </div>

          {/* Milkdown body — remounts when filePath changes */}
          <div key={filePath}>
            <EditorComponent />
          </div>

        </div>
      </div>

    </div>
  )
}

// ── Stat chip ────────────────────────────────────────────────────────────────

function Stat({ color, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12.5, color: 'var(--text-dim)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
      }} />
      {label}
    </span>
  )
}

// ── Inline meta input (role, relationship) ───────────────────────────────────

function MetaInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontSize: 12.5,
        color: value ? 'var(--text-dim)' : 'var(--text-very-dim)',
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        borderRadius: 5,
        padding: '3px 8px',
        fontFamily: 'inherit',
        outline: 'none',
        minWidth: 80,
        transition: 'border-color .12s',
      }}
      onFocus={(e)  => e.target.style.borderColor = 'var(--border)'}
      onBlur={(e)   => e.target.style.borderColor = 'var(--border-subtle)'}
    />
  )
}
```

---

## Step 3 — App.jsx: route people/ to PersonViewer

### 3a — Add import

```js
import PersonViewer from './core/PersonViewer'
```

### 3b — Add route in the viewer page switch

Find the `page === 'viewer'` block. Add a branch for `people/` paths before the catch-all VaultFileViewer:

```jsx
{page === 'viewer' && activePath?.startsWith('people/') && (
  <PersonViewer
    filePath={activePath}
    readFile={readFile}
    writeFile={writeFile}
    deleteFile={deleteFile}
    onConfirmAction={showConfirm}
  />
)}
```

The full viewer routing should now read, in order:

```jsx
{page === 'viewer' && activePath?.startsWith('notes/')  && <ProcessedNoteViewer ... />}
{page === 'viewer' && activePath?.startsWith('people/') && <PersonViewer ... />}
{page === 'viewer' && activePath && !activePath.startsWith('notes/')
                                 && !activePath.startsWith('people/') && <VaultFileViewer ... />}
```

---

## Step 4 — frontmatter.js adapter note

The `stringifyFrontmatter(data, content)` call in `save()` assumes your frontmatter.js produces output like:

```
---
type: person
full_name: Elaine Chen
relationship: colleague
role: Design Lead
last_updated: 2026-05-22
---

## Summary
...
```

After the pre-flight read, confirm this is the case. If the function signature differs (e.g. it takes the raw string and a patch object rather than `data` + `content`), adapt the `save()` function accordingly.

---

## Build check

1. `bun run build` — passes
2. **New person from + button** — click + on PEOPLE in sidebar → new file created from updated template → PersonViewer opens → Full name input is empty (placeholder "Full name"), body shows the section headers
3. **Existing person** — click a person file → PersonViewer opens with name populated from frontmatter, role and relationship in the meta row
4. **Header** — shows "UPDATED MONDAY, MAY 19 · 4 DAYS AGO" (from `last_updated` frontmatter), not a filename
5. **Stats strip** — visible only if there are open delegates, talk-about items, or a mention. Hidden for a brand new file. Coloured dots: amber for delegates, blue for talk-about, dim for last mentioned
6. **Editable name** — type in the name input → autosaves after 800ms → "saved HH:MM" appears in header → file on disk has updated `full_name` in frontmatter
7. **Role / relationship inputs** — small inline inputs, dim border, darkens on focus, saves on change
8. **Milkdown body** — editable, autosaves correctly, section headings render as styled markdown headings
9. **DictateButton** — red + pulse when recording, correct hover states from Patch 05 v3
10. **TrashMenu** — Archive and Delete both route through ConfirmDialog
11. **Stats after processing** — process an inbox note that mentions this person with a delegate → approve → navigate to the person file → delegate count appears in stats strip
12. **People/ in VaultFileViewer** — confirm people/ no longer falls through to VaultFileViewer (check the routing order in App.jsx)
