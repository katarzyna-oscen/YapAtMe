# Patch 06b — PersonViewer: Fix to Match Design
**Fixes from review:** Missing `## Notes` in template, role/relationship displaying scattered, section headers unstyled, stats box not matching design.  
**Source of truth:** Design screenshot (Elaine Liman view).

---

## Pre-flight reads

1. `src/lib/templates.js` — read the current `case 'people':` block. Confirm whether `## Notes` and `## Summary` are present.
2. `src/core/PersonViewer.jsx` — read the full current file. Note exactly how `fields` from `parseFrontmatter` is destructured and how `editorBody` is set.
3. `src/index.css` — find the Milkdown overrides block (`.milkdown .editor h2`). You will add entity-specific section header styles here.

---

## Step 1 — Fix template: add Summary and Notes

Open `src/lib/templates.js`. Replace the `case 'people':` content string in full:

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

---

## Step 2 — Fix PersonViewer layout and meta chips

Open `src/core/PersonViewer.jsx`. This is a full canvas section replacement — find the canvas div and replace everything inside it:

```jsx
{/* ── Canvas ─────────────────────────────────────────────────────────── */}
<div style={{ flex: 1, overflowY: 'auto' }}>
  <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>

    {/* Name — large editable title */}
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
        padding: 0, marginBottom: 12, fontFamily: 'inherit',
      }}
    />

    {/* Role + relationship pill chips */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
      <PillInput
        value={role}
        onChange={setRole}
        placeholder="Role"
      />
      <PillInput
        value={relationship}
        onChange={setRelationship}
        placeholder="Relationship"
      />
    </div>

    {/* Stats box — only shown when there is something to display */}
    {hasStats && (
      <div style={{
        display: 'flex', gap: 28, alignItems: 'center',
        padding: '16px 20px',
        background: 'var(--panel-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        marginBottom: 32,
        flexWrap: 'wrap',
      }}>
        {delegateCount > 0 && (
          <StatItem
            count={delegateCount}
            label="open delegates"
            countColor="var(--text)"
          />
        )}
        {talkAboutCount > 0 && (
          <StatItem
            count={talkAboutCount}
            label="to talk about"
            countColor="var(--accent)"
          />
        )}
        {lastMentioned && (
          <LastMentionedChip age={formatMentionAge(lastMentioned)} />
        )}
      </div>
    )}

    {/* Milkdown body — remounts when filePath changes */}
    <div key={filePath} className="entity-body">
      <EditorComponent />
    </div>

  </div>
</div>
```

Add these helper components at the bottom of `PersonViewer.jsx` (replacing or adding to the existing `Stat` and `MetaInput` components):

```jsx
// ── PillInput ────────────────────────────────────────────────────────────────
// Looks like a tag chip, behaves like an input.

function PillInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  const show = value || focused
  if (!show) {
    return (
      <button
        onClick={() => {}} // will focus below — handled by onFocus
        style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '4px 10px',
          background: 'var(--panel-2)',
          border: '1px dashed var(--border)',
          borderRadius: 6, fontSize: 12.5,
          color: 'var(--text-very-dim)',
          cursor: 'text', fontFamily: 'inherit',
        }}
      >
        + {placeholder}
      </button>
    )
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '4px 10px',
        background: focused ? 'var(--panel-2)' : 'var(--panel-2)',
        border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 6, fontSize: 12.5,
        color: 'var(--text-dim)',
        outline: 'none', fontFamily: 'inherit',
        minWidth: 60,
        transition: 'border-color .12s',
      }}
    />
  )
}

// ── StatItem ─────────────────────────────────────────────────────────────────

function StatItem({ count, label, countColor, bold }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, fontSize: 13.5 }}>
      <span style={{
        color: countColor || 'var(--text)',
        fontWeight: bold ? 600 : 500,
      }}>
        {count}
      </span>
      <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
        {label}
      </span>
    </span>
  )
}

// ── LastMentionedChip ─────────────────────────────────────────────────────────

function LastMentionedChip({ age }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px',
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 5,
      fontSize: 12.5,
      color: 'var(--text-dim)',
    }}>
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{age}</span>
      last mentioned
    </span>
  )
}

// ── formatMentionAge ──────────────────────────────────────────────────────────

function formatMentionAge(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  const daysAgo = Math.floor((Date.now() - d) / 86_400_000)
  if (daysAgo === 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  if (daysAgo < 7)  return `${daysAgo}d ago`
  return dateStr
}
```

---

## Step 3 — Section header CSS for entity files

Open `src/index.css`. Find the Milkdown `h2` override block. Replace or add the following — **no `.entity-body` scope**, applies to all Milkdown editors across the app:

```css
/* ── Section headers — all Milkdown editors ── */
.milkdown .editor h2,
.ProseMirror h2 {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-very-dim);
  margin: 32px 0 12px 0;
  padding-bottom: 0;
  border: none;
}

.milkdown .editor h2:first-child,
.ProseMirror h2:first-child {
  margin-top: 0;
}
```

This applies to InboxPage, ProcessedNoteViewer, VaultFileViewer, PersonViewer, and all future entity viewers — consistent small-caps section headers everywhere. The `.entity-body` class is no longer needed for scoping; remove it from the `<div>` wrapper in `PersonViewer.jsx` too.

---

## Step 4 — Verify frontmatter body is not leaking into editor

Open `src/core/PersonViewer.jsx`. Find the `loadFile` function. Confirm the `editorBody` is set from the `body` (or `content`) field returned by `parseFrontmatter` — NOT from the raw string. It must look like:

```js
const { fields, body } = parseFrontmatter(raw)
// ...
setEditorBody(body.trimStart())
```

If `editorBody` is being set to the full `raw` string (including `---` frontmatter), the YAML block will render in Milkdown. Fix by ensuring only `body` (the part after `---`) goes to the editor.

---

## Build check

1. `bun run build` — passes
2. **New person file** — click + on PEOPLE → PersonViewer opens → title input empty (placeholder "Full name"), `+ Role` and `+ Relationship` dashed pill placeholders visible below, no stats box, editor shows: Summary / Related Projects / Delegate / Talk About / Recent Mentions / Notes as small-caps section headers
3. **Existing person with data** — open a person with role filled in → role + relationship show as styled pill chips below the name
4. **Stats box** — visible only when tasks-index has open items for this file. Numbers match: delegate count (amber), talk-about count (accent), last mentioned shown as "yesterday" / "2d ago"
5. **Section headers** — render as small-caps, very dim, 11px, letter-spaced. Not bold `h2`s.
6. **No YAML in editor** — the `---\ntype: person\n---` frontmatter block does NOT appear inside the Milkdown editor
7. **Save roundtrip** — edit the name → wait 800ms → reopen file → name persists in frontmatter, `full_name` field updated
