# Micro Patch — Template Instructive Text + Font Fix
**Scope:** `src/lib/templates.js` (all three entity templates) + `src/index.css` (remove TASA Orbiter, lock Geist).  
**Rule:** Every section gets a single line of italic guide text. AI-managed sections explain what the AI will add — the AI appends *below* the guide line so it stays readable as content grows.

---

## Step 1 — templates.js: replace all three entity cases

### projects

```js
case 'projects':
  return {
    slug,
    content:
`---
type: project
name: ${name}
status: Untriaged
domain: 
owner: 
core_problem: 
last_updated: ${today}
---

## Summary
_What is this project and why does it matter?_

## Current Plan
_What's the current approach and the immediate next step?_

## Open Actions
_Add tasks directly or let AI route actions from your inbox._

## Delegations
_Track what you've delegated. AI will add items from your inbox._

## Decisions
_Record decisions here. AI will capture them from your notes._

## Recent Mentions
_Populated by AI._

## Notes
_Observations, raw thoughts, context. AI will use this to keep the project current._
`,
  }
```

### people

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
_Who is this person and why do they matter to you?_

## Related Projects
_Link projects this person is involved in._

## Delegate
_Tasks you've delegated to this person. AI will add from your inbox._

## Talk About
_Topics to raise next time you speak. AI will add from your inbox._

## Recent Mentions
_Populated by AI._

## Notes
_Observations, context, anything worth remembering about this person._
`,
  }
```

### ideas

```js
case 'ideas':
  return {
    slug,
    content:
`---
type: idea
domain: 
status: Spark
origin: ${today}
related_projects: []
related_people: []
tags: []
last_updated: ${today}
---

## Summary
_What is this idea in one paragraph?_

## Problem It Solves
_What specific problem or gap does this address?_

## Next Step
_What's the smallest action to move this forward?_

## Notes
_Raw thoughts, links, context. AI will refine Summary from this._
`,
  }
```

---

## Step 2 — index.css: remove TASA Orbiter, lock Geist everywhere

### 2a — Search and remove TASA Orbiter

Search for every occurrence of `TASA Orbiter` in `src/index.css`. Remove it from any `font-family` declaration, leaving only `var(--font-sans)`.

### 2b — Confirm the core Milkdown block

Find the block starting with `.milkdown, .milkdown .editor, .ProseMirror`. Confirm `font-family` is:

```css
font-family: var(--font-sans);
```

### 2c — Add explicit italic font lock

Find the `.milkdown .editor em, .ProseMirror em` rule and ensure it reads:

```css
.milkdown .editor em,
.ProseMirror em {
  font-style: italic;
  font-family: var(--font-sans);
  color: var(--text-secondary);
}
```

### 2d — Check component inline styles

Search these files for `TASA Orbiter` and remove any occurrence, replacing with `'inherit'` or removing the property:
- `src/core/ProcessedNoteViewer.jsx`
- `src/core/InboxPage.jsx`
- `src/components/VaultFileViewer.jsx`
- `src/core/ProjectViewer.jsx`
- `src/core/PersonViewer.jsx`

---

## Build check

1. `bun run build` — passes
2. **New project** — all seven sections have italic guide text; Summary and Current Plan have user-focused prompts; Open Actions, Delegations, Decisions, Recent Mentions explain what AI will add
3. **New person** — all six sections populated with guide text
4. **New idea** — all four sections populated with guide text
5. **AI appends correctly** — after routing an inbox note to a project, the new action appears *below* the guide line in Open Actions, not replacing it
6. **Italic in Geist** — guide text renders in clean Geist italic, same weight and style as surrounding text, no serif fallback
