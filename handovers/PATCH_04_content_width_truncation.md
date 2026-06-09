# Patch 04 — Note Content Width + Sidebar Label Truncation
**Source of truth:** `note-view.jsx` canvas styles, `sidebarStyles.fileLabel` from design handoff.  
**Scope:** Two surgical changes. No new files.

---

## The two problems

**Content spans full screen width:**  
InboxPage and VaultFileViewer use `max-w-2xl mx-auto` which centres the content and caps it at ~672px. The design specifies left-aligned content with `maxWidth: 760` and `padding: "32px 48px 48px"` — anchored to the left, comfortable reading width, 48px left margin.

**Long filenames push the 3-dots icon off screen:**  
The sidebar file row uses `flex` layout. Without `minWidth: 0` on the label span, a flex child won't shrink below its content width — so long names overflow instead of truncating. The design's `sidebarStyles.fileLabel` explicitly sets `minWidth: 0`.

---

## Step 1 — InboxPage: fix canvas layout

Open `src/core/InboxPage.jsx`. Find the content area wrapper — the div that contains the title `<input>` and `<EditorComponent />`. It currently has something like:

```jsx
<div className="flex-1 overflow-y-auto">
  <div className="max-w-2xl mx-auto px-8 py-6">
    ...
  </div>
</div>
```

Replace the inner wrapper with inline styles matching the design exactly:

```jsx
<div style={{ flex: 1, overflowY: 'auto' }}>
  <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>

    {/* Title input */}
    <input
      type="text"
      value={title}
      onChange={e => setTitle(e.target.value)}
      placeholder="Untitled — type a subject or leave blank"
      style={{
        display: 'block',
        width: '100%',
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: 'var(--text)',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        padding: 0,
        marginBottom: 20,
        fontFamily: 'inherit',
      }}
    />

    {/* Milkdown editor */}
    <div key={filePath}>
      <EditorComponent />
    </div>

  </div>
</div>
```

> The `maxWidth: 760` without `margin: auto` keeps the content left-anchored. The 48px left padding matches the header's `padding: "24px 48px 20px"` so title and header date align vertically.

---

## Step 2 — VaultFileViewer: same canvas layout

Open `src/components/VaultFileViewer.jsx`. Find the editor content area. Apply the same layout:

```jsx
<div style={{ flex: 1, overflowY: 'auto' }}>
  <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>
    <EditorComponent />
  </div>
</div>
```

For the VaultFileViewer the title is shown in the header breadcrumb (not a separate input), so there's no title field in the canvas — just the editor starting at the top of the padding.

---

## Step 3 — Sidebar: fix label truncation

Open `src/components/Sidebar.jsx`. Find the file label element inside `SidebarFileRow` (or the equivalent file row component). It renders the filename.

The current style likely has `flex: 1` but is missing `minWidth: 0`. Without `minWidth: 0`, a flex child cannot shrink below its content size, so long names overflow rather than truncate.

Update the label span style to match `sidebarStyles.fileLabel` from the design exactly:

```jsx
{/* File label */}
<span style={{
  flex: 1,
  minWidth: 0,                  // ← required for flex truncation
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}}>
  {item.label || item.name}
</span>
```

Also confirm the file row itself has `gap: 4` (not `gap: 8`) between label and menu button — the tighter gap from the design gives more space to the label before it truncates:

```jsx
// fileRow gap:
gap: 4,   // ← design spec (was possibly 8)
```

---

## Build check

1. `bun run build` — passes
2. **Inbox content width** — open a note: title and body are left-aligned, content starts at ~48px from the left edge, maximum 760px wide. Does not stretch to the right edge on wide screens.
3. **Inbox alignment** — the header date (`padding: "24px 48px"`) and the title input (`padding left: 48px`) are vertically aligned. No horizontal mismatch.
4. **Viewer content width** — same check: opens left-aligned at 48px, capped at 760px.
5. **Short names** — sidebar shows full name, 3-dots button visible on hover as expected.
6. **Long names** — a filename like `ia-framework-canonical-site-redesign-2026` truncates with `…` before the 3-dots button. The button remains visible and clickable.
7. **Truncation threshold** — the name truncates, not the 3-dots button. The button always has its full 20px width.
