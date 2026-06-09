# Hotfix — Inbox Editor Prose Styling
**Problem:** The Milkdown editor in InboxPage renders with raw ProseMirror defaults — massive paragraph gaps, no max-width, no document feel.  
**Fix:** Two changes: (1) add prose typography CSS to `index.css`, (2) confirm the InboxPage content area has a max-width wrapper.  
**Files changed:** `src/index.css` (add Milkdown prose block), `src/core/InboxPage.jsx` (verify/add max-width wrapper — one line).

---

## Step 1 — Add Milkdown prose styles to index.css

Open `src/index.css`. Find the existing Milkdown override block:

```css
/* ── Milkdown editor overrides ── */
.milkdown,
.milkdown .editor {
  outline: none !important;
  border: none !important;
  background: transparent !important;
  color: var(--text-primary);
  font-family: var(--font-sans);
}

.milkdown .editor:focus {
  outline: none !important;
  box-shadow: none !important;
}
```

Replace that entire block with the expanded version below:

```css
/* ── Milkdown editor overrides ─────────────────────────────────────────── */

/* Container reset */
.milkdown,
.milkdown .editor,
.ProseMirror {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.75;
  caret-color: var(--accent);
}

/* ── Paragraphs ── */
.milkdown .editor p,
.ProseMirror p {
  margin: 0 0 0.6em 0;
  color: var(--text-primary);
  line-height: 1.75;
}
.milkdown .editor p:last-child,
.ProseMirror p:last-child {
  margin-bottom: 0;
}

/* ── Headings ── */
.milkdown .editor h1,
.ProseMirror h1 {
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
.milkdown .editor h2,
.ProseMirror h2 {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 1.5rem 0 0.5rem 0;
  line-height: 1.3;
}
.milkdown .editor h3,
.ProseMirror h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 1.25rem 0 0.4rem 0;
}

/* ── Inline ── */
.milkdown .editor strong,
.ProseMirror strong {
  font-weight: 600;
  color: var(--text-primary);
}
.milkdown .editor em,
.ProseMirror em {
  font-style: italic;
  color: var(--text-secondary);
}
.milkdown .editor code,
.ProseMirror code {
  font-family: var(--font-sans);
  font-size: 0.85em;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.1em 0.4em;
  color: var(--accent);
}

/* ── Lists ── */
.milkdown .editor ul,
.milkdown .editor ol,
.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.4rem;
  margin: 0 0 0.6em 0;
}
.milkdown .editor li,
.ProseMirror li {
  margin-bottom: 0.2rem;
  line-height: 1.7;
  color: var(--text-primary);
}

/* ── Task list checkboxes ── */
.milkdown .editor li[data-task],
.ProseMirror li[data-task] {
  list-style: none;
  margin-left: -1.4rem;
  padding-left: 1.4rem;
  position: relative;
}
.milkdown .editor input[type="checkbox"],
.ProseMirror input[type="checkbox"] {
  accent-color: var(--accent);
  margin-right: 0.5rem;
  cursor: pointer;
}

/* ── Blockquote ── */
.milkdown .editor blockquote,
.ProseMirror blockquote {
  border-left: 2px solid var(--border-strong);
  padding-left: 1rem;
  color: var(--text-muted);
  margin: 0.75rem 0;
  font-style: italic;
}

/* ── Horizontal rule ── */
.milkdown .editor hr,
.ProseMirror hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.5rem 0;
}

/* ── Placeholder (empty paragraph) ── */
.ProseMirror p.is-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  float: left;
  height: 0;
}
```

---

## Step 2 — Add max-width wrapper in InboxPage

Open `src/core/InboxPage.jsx`. Find the div that wraps the `<EditorComponent />`. It probably looks like one of these:

```jsx
// Option A — no max-width
<div className="flex-1 overflow-y-auto px-8 py-6">
  <EditorComponent />
</div>

// Option B — already has a wrapper
<div className="flex-1 overflow-y-auto px-8 py-6">
  <div className="max-w-2xl mx-auto">
    <EditorComponent />
  </div>
</div>
```

If Option A (no inner wrapper), update to Option B — add `<div className="max-w-2xl mx-auto">` around `<EditorComponent />`. This constrains the writing column to a readable width, same as NotesPage.

If it already has a max-width wrapper, no change needed.

---

## Verify

1. `npm run dev`
2. Open the inbox note — the H1 title is large and tight (not huge with a gap below)
3. Paragraph spacing is compact — lines follow each other like a document, not like slides
4. Bold text renders correctly in `var(--text-primary)` with weight 600
5. The writing column is centred and has a comfortable reading width (not edge-to-edge)
