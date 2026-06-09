# Handover — Design Integration (Deep Navy + Amber)
**Status:** Ready for immediate implementation  
**Scope:** Apply the design system from `Memory_OS_Dashboard_-_standalone.html` to the live codebase. Two file replacements (`index.html`, `index.css`), two targeted component updates (`RoutingReview.jsx`, `CommandPage.jsx`).  
**Prerequisite:** Handover 03 Catchup and Handover 04 are both applied. The app runs without console errors.  
**Ends with:** The app looks like the design — deep navy background, amber accent, Geist font, panel depth, custom scrollbars. No functional changes. No logic touched.

---

## What is changing

| Thing | Before | After |
|---|---|---|
| Background | Unknown | `#010619` — near-black navy |
| Sidebar bg | Unknown | `#02081f` — dark navy |
| Card/panel bg | `--bg-sidebar` flat | `#0a1230` — distinct panel layer |
| Accent colour | Indigo | Amber — `oklch(0.80 0.13 80)` |
| Font | Ubuntu Sans | Geist (Google Fonts) |
| CSS variables | Flat set | Extended with panel depth + semantic colours |
| Scrollbar | Browser default | Custom — matches the palette |

The accent change (indigo → amber) is the biggest visual shift. Every `bg-[var(--accent)]` button, active state, and link will become amber automatically once the variable is updated.

---

## Design token reference

Extract from the design file — use these exact values everywhere:

```
Backgrounds
  --bg-primary     #010619          main canvas
  --bg-sidebar     #02081f          sidebar
  --panel          #0a1230          card surface (level 1)
  --panel-2        #121b3d          nested card surface (level 2)
  --panel-pop      #0e1736          hover / elevated surface

Borders
  --border         #1c2750          standard border
  --border-strong  #2a3768          emphasis border
  --border-subtle  #131c40          very quiet separator

Text
  --text-primary   #e7ecff          primary — lavender-white
  --text-secondary #94a0c9          secondary — muted blue
  --text-muted     #5f6a96          tertiary — very dim

Accent + Semantic
  --accent         oklch(0.80 0.13 80)    amber
  --success        oklch(0.74 0.14 165)   green
  --info           oklch(0.72 0.13 240)   blue
  --danger         oklch(0.70 0.18 22)    red

Font
  --font-sans      "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

---

## Step 1 — index.html (add Geist from Google Fonts)

Open `index.html` (the Vite root, not inside `src/`). Add two lines in `<head>` before the closing `</head>` tag:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
```

> Geist is available on Google Fonts as of 2024. If the import fails (offline or network issue), the stack falls back to `-apple-system` — the layout will be fine, just the font differs.

---

## Step 2 — index.css (full replacement)

Replace `src/index.css` in full. Keep the Tailwind directives at the top — everything else changes.

```css
/* ── Tailwind directives — must stay at top ── */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Design tokens ───────────────────────────────────────────────────────── */
:root {
  /* Backgrounds — deep navy palette anchored on #010619 */
  --bg-primary:    #010619;
  --bg-sidebar:    #02081f;
  --panel:         #0a1230;
  --panel-2:       #121b3d;
  --panel-pop:     #0e1736;

  /* Legacy aliases — kept so existing components don't break */
  --bg-active:     #0e1736;   /* panel-pop */
  --bg-hover:      #0a1230;   /* panel */
  --bg-input:      #0a1230;   /* panel */

  /* Borders */
  --border:        #1c2750;
  --border-strong: #2a3768;
  --border-subtle: #131c40;

  /* Text */
  --text-primary:   #e7ecff;
  --text-secondary: #94a0c9;
  --text-muted:     #5f6a96;

  /* Accent + semantic colours */
  --accent:   oklch(0.80 0.13 80);   /* amber */
  --success:  oklch(0.74 0.14 165);  /* green */
  --info:     oklch(0.72 0.13 240);  /* blue  */
  --danger:   oklch(0.70 0.18 22);   /* red   */

  /* Typography */
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* ── Base reset ──────────────────────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "ss01", "cv11", "tnum";
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  line-height: 1.4;
}

button {
  font-family: inherit;
}

/* ── Selection ───────────────────────────────────────────────────────────── */
::selection {
  background: oklch(0.80 0.13 80 / 0.25);
}

/* ── Custom scrollbar ────────────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 5px;
  border: 2px solid var(--bg-primary);
}
::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
}

/* ── Input placeholders ──────────────────────────────────────────────────── */
input::placeholder,
textarea::placeholder {
  color: var(--text-muted);
  opacity: 1;
}

/* ── Animations ──────────────────────────────────────────────────────────── */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.55; transform: scale(0.85); }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── Milkdown editor overrides ───────────────────────────────────────────── */
/* Remove default ProseMirror border and match app background */
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

/* ── Utility: panel surface ──────────────────────────────────────────────── */
/* Use these class names in components for consistent card surfaces */
.surface-1  { background: var(--panel); }
.surface-2  { background: var(--panel-2); }
.surface-pop { background: var(--panel-pop); }
```

---

## Step 3 — Update RoutingReview.jsx marker colours

The marker colour function currently uses raw Tailwind colour classes that don't match the new palette. Replace the `markerColor` function at the bottom of `src/core/RoutingReview.jsx`:

**Find and replace this function:**

```js
// OLD
function markerColor(marker) {
  const map = {
    action:      'bg-blue-500/20 text-blue-300',
    decision:    'bg-purple-500/20 text-purple-300',
    delegate:    'bg-orange-500/20 text-orange-300',
    'follow-up': 'bg-yellow-500/20 text-yellow-300',
    idea:        'bg-green-500/20 text-green-300',
    mention:     'bg-gray-500/20 text-gray-300',
  }
  return map[marker] || 'bg-gray-500/20 text-gray-300'
}
```

```js
// NEW — palette-aware, uses oklch semantic colours
function markerColor(marker) {
  const map = {
    action:      'bg-[oklch(0.72_0.13_240/0.15)] text-[oklch(0.72_0.13_240)]',   // info blue
    decision:    'bg-[oklch(0.74_0.14_165/0.15)] text-[oklch(0.74_0.14_165)]',   // success green
    delegate:    'bg-[oklch(0.80_0.13_80/0.15)]  text-[oklch(0.80_0.13_80)]',    // accent amber
    'follow-up': 'bg-[oklch(0.70_0.18_22/0.15)]  text-[oklch(0.70_0.18_22)]',    // danger red
    idea:        'bg-[oklch(0.74_0.14_165/0.15)] text-[oklch(0.74_0.14_165)]',   // success green
    mention:     'bg-[#1c2750] text-[#94a0c9]',                                   // border / text-secondary
  }
  return map[marker] || 'bg-[#1c2750] text-[#94a0c9]'
}
```

Also update the **unknown entity card** border and text colours in the same file. Find:

```jsx
className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4"
```
```jsx
className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1"
```
```jsx
className="shrink-0 px-3 py-1.5 text-xs border border-yellow-500/40 text-yellow-400 rounded hover:bg-yellow-500/10 transition-colors"
```

Replace with amber (accent) variants:

```jsx
className="rounded-lg border border-[oklch(0.80_0.13_80/0.25)] bg-[oklch(0.80_0.13_80/0.05)] p-4"
```
```jsx
className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-1"
```
```jsx
className="shrink-0 px-3 py-1.5 text-xs border border-[oklch(0.80_0.13_80/0.35)] text-[var(--accent)] rounded hover:bg-[oklch(0.80_0.13_80/0.1)] transition-colors"
```

---

## Step 4 — Update CommandPage.jsx card surfaces

The current `CommandPage` uses `bg-[var(--bg-sidebar)]` for cards. Replace with the richer panel variable so cards have proper visual separation from the background.

Find all occurrences of this class in `src/core/CommandPage.jsx`:

```
bg-[var(--bg-sidebar)]
```

Replace with:

```
bg-[var(--panel)]
```

Also update the task row cards. Find:

```jsx
className="flex items-start gap-3 rounded-md px-3 py-2 bg-[var(--bg-sidebar)] border border-[var(--border)]"
```

Replace with:

```jsx
className="flex items-start gap-3 rounded-md px-3 py-2 bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors"
```

---

## Step 5 — Update TasksPage.jsx card surfaces

Same pattern. In `src/core/TasksPage.jsx`, find:

```jsx
className={`flex items-start gap-3 rounded-md px-3 py-2.5
      border border-[var(--border)] bg-[var(--bg-sidebar)]
```

Replace `bg-[var(--bg-sidebar)]` with `bg-[var(--panel)]`:

```jsx
className={`flex items-start gap-3 rounded-md px-3 py-2.5
      border border-[var(--border)] bg-[var(--panel)]
```

---

## Step 6 — Update NotesPage.jsx panel colours

In `src/core/NotesPage.jsx`, the right panel uses default background. Update the note content area so it has clear visual structure. Find the content wrapper div:

```jsx
<div className="max-w-2xl mx-auto px-8 py-8">
```

Replace with:

```jsx
<div className="max-w-2xl mx-auto px-8 py-8">
```

(No change here — the content area sits on `--bg-primary` by default which is correct.)

In the left file list panel, find the active state class:

```jsx
'bg-[var(--bg-active)] text-[var(--text-primary)]'
```

`--bg-active` already maps to `--panel-pop` in the new CSS, so this is automatically correct. No change needed.

---

## Step 7 — tailwind.config.js (optional but recommended)

Add the new panel colours to Tailwind so you can use `bg-panel`, `bg-panel-2`, `border-border-strong` as shorthand instead of `bg-[var(--panel)]`. Open `tailwind.config.js` and extend the theme:

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'panel':         'var(--panel)',
        'panel-2':       'var(--panel-2)',
        'panel-pop':     'var(--panel-pop)',
        'border-strong': 'var(--border-strong)',
        'border-subtle': 'var(--border-subtle)',
        'accent':        'var(--accent)',
        'success':       'var(--success)',
        'info':          'var(--info)',
        'danger':        'var(--danger)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
    },
  },
  plugins: [],
}
```

> This is optional for this handover — existing `bg-[var(--panel)]` syntax works. But adding it now means future components can use the cleaner `bg-panel` syntax consistently.

---

## Verification checklist

After applying all steps, run `npm run dev` (or `bun run dev`) and check visually:

- [ ] Background is near-black navy (`#010619`) — not white, not grey
- [ ] Sidebar is a distinct but subtle darker shade
- [ ] Cards/panels are clearly raised from the background (not flush)
- [ ] Buttons (Process Note, Approve, Done) are **amber** — not indigo or blue
- [ ] Active sidebar item has amber accent or amber-tinted highlight
- [ ] Font is Geist — open DevTools → Elements and check `font-family` on body
- [ ] Scrollbar is dark and matches the palette (not the browser default grey)
- [ ] Marker badges in RoutingReview use the new palette colours
- [ ] Text is lavender-white (`#e7ecff`), not pure white or grey

---

## File list

```
index.html                     ← UPDATED — Geist Google Fonts link (Step 1)
src/
  index.css                    ← REPLACED — full design token system (Step 2)
  core/
    RoutingReview.jsx           ← UPDATED — marker colours + unknown entity badge (Step 3)
    CommandPage.jsx             ← UPDATED — bg-panel surface (Step 4)
    TasksPage.jsx               ← UPDATED — bg-panel surface (Step 5)
  (NotesPage.jsx)               ← NO CHANGE needed
tailwind.config.js             ← UPDATED — optional panel colour aliases (Step 7)
```

---

## Note for future handovers

All new components written after this handover should use the panel variables for surfaces:

```
Cards / panels          → bg-[var(--panel)]        border border-[var(--border)]
Nested content areas    → bg-[var(--panel-2)]       border border-[var(--border-subtle)]
Hover / elevated items  → bg-[var(--panel-pop)]
Accent buttons          → bg-[var(--accent)] text-[var(--bg-primary)]
Success indicators      → text-[var(--success)]
Error/danger            → text-[var(--danger)]
```

Never hardcode hex values. Use the CSS variables only.
