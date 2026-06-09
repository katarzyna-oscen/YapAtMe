# Memory OS — Copilot Handover

*Written: 2026-06-02 — for next session*

---

## State of the app

The pipeline is solid. People and Projects modules are both implemented and routing correctly. The core loop — write note → process → review → file → vault updated — works end-to-end.

Today's session was full pipeline hardening: idempotency, dedup, unattached routing, entity rename safety, wikilink autocomplete, fuzzy matching, module disable dialog, vault owner setting, new note rename flow.

---

## What is working — do not touch

- Two-run LLM pipeline (Promise.all, Run 1 mentions + Run 2 tasks)
- People module routing — mention + task + unattached action rerouting when OFF
- Projects module routing — already implemented, same pattern as People
- tasks-index.json single source of truth for all tasks
- prependToSection [[date]] dedup guard in vaultWriter.js
- Entity rename flow (BUG-019) — full reference sweep across vault
- Wikilink autocomplete in editor ([[]] trigger, fuzzy filter, arrow + enter)
- Unresolved wikilink amber colour
- Fuzzy entity matching (three-tier: normalized / tight / bag-of-words)
- Module disable dialog with archive/restore
- Vault owner ("You") setting in Settings
- Approve All button in RoutingReview
- New note inline rename on + button
- H1-based rename fallback for untitled notes
- Diagnostic console.log statements — keep in place until public release

---

## Session goal — styling first, then features

**Do not add new modules or features until styling is done.** The app visually diverges from the v4 design handoff. This is the most important thing for demos and for user trust.

---

## Priority 1 — Global styling audit

Styling scope is not limited to the dashboard. Apply consistently across the whole app:

### 1. Replace all native browser dialogs
Search for `window.confirm`, `window.alert`, `confirm(`, `alert(` across the entire codebase. Every instance must be replaced with a styled in-app modal using the existing dialog/modal component pattern. The task deletion flow currently triggers a Chrome-default popup — this is the known example but there are likely others.

### 2. Replace all native `<select>` elements
Search for `<select` across the codebase. Every native select must be replaced with a styled custom dropdown consistent with the design system.

---

## Open bugs

| ID | Description | Severity |
|----|-------------|----------|
| BUG-022 | Project wikilink classified as PERSON | High — in progress |
| BUG-016 | Processing sometimes >1 minute | High — timing logs in place |
| BUG-009 | Project viewer wikilinks after module toggle | Medium |

---

## Roadmap after styling

1. ✓ People module
2. ✓ Projects module
3. Ideas module — routes to ideas/backlog.md, no person entity, different frontmatter
4. Patch 09 — Ideas entity viewer
5. Task commenting via note processing — complex, needs spec first
6. FEATURE-002 — click amber wikilink to create entity
7. FEATURE-003 — external link insertion
8. Later: AI onboarding, weekly review, Jira, browser extension, mobile

---

## Stack

Vite + React · Tailwind · Milkdown (CodeMirror) · File System Access API · IndexedDB · OpenRouter (configurable model) · tasks-index.json single source of truth

## Key files

```
src/
  hooks/useNoteProcessor.js      — two-run pipeline, pre-pass, fuzzy matching
  lib/approvalHandler.js         — normalizeChangeForModules, applyChange
  lib/vaultWriter.js             — prependToSection with [[date]] dedup
  lib/tasksIndex.js              — tasks-index.json read/write/dedup
  core/InboxPage.jsx             — Process note / File note flow
  core/ProcessedNoteViewer.jsx   — note viewer, H1-based rename
  core/SettingsPage.jsx          — module toggles, vault owner, API key
  hooks/useSettings.js           — IndexedDB settings persistence
  components/MarkdownEditor.jsx  — wikilink autocomplete, unresolved colour
  components/Sidebar.jsx         — inline new note rename, file tree
  App.jsx                        — wikilink resolver, file rename, navigation
tasks-index.json                 — single source of truth for all tasks
```
