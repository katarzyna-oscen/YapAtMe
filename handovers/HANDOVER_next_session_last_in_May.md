# Memory OS — Next Session Handover
*Written at end of session · 2026-06-01*

---

## Where we are

The two-run LLM pipeline is now the architecture. Run 1 (mentions) and Run 2 (tasks) execute in parallel via `Promise.all`. Gemma 4 via OpenRouter is the test model — the design principle is: if it works on Gemma, it will fly on Claude API. Pipeline is producing clean output with correct mention format, no task fan-out, correct ownership.

A batch of new fixes and architectural decisions were made this session. None are implemented yet — all are queued for Copilot.

---

## What changed this session (decisions made, not yet implemented)

### Two-run pipeline — DECIDED AND VALIDATED
- Run 1: people mentions only (projects deferred to later increment)
- Run 2: tasks only — action, follow-up, delegate, decision
- Parallel execution via `Promise.all`
- Merge in `useNoteProcessor.js` before returning to `InboxPage.jsx`
- `extractWikilinkMentionChanges` removed from `InboxPage.jsx` (Fix 1B from previous handover — still pending)

### Mention format — DECIDED
New format (replaces Source tag approach):
```
[[DD-MM-YYYY]] — concise one-sentence summary
```
The date wikilink IS the source reference. No separate `Source:` tag.
Dedup guard in `prependToSection` keys on `[[DD-MM-YYYY]]` at line start — if found, replace; if not, prepend.
`noteDateSlug` derived from note filename: strip `inbox/` and `.md` → `28-05-2026`.

### Post-merge sanitisation — DECIDED
Apply in `useNoteProcessor.js` after merging Run 1 + Run 2, before returning:

1. **Source tag append on mentions** — append `. Source: inbox/DD-MM-YYYY.md` if missing (belt-and-suspenders, main dedup relies on `[[date]]`)
2. **Marker/section guard** — enforce `MARKER_SECTION_MAP`:
   - `action` → `## Open Actions`
   - `follow-up` → `## Talk About`
   - `delegate` → `## Delegate`
   - `decision` → `## Decisions`
3. **Strip marker prefix from task content** — remove `follow-up:` / `decision:` / `action:` / `delegate:` prefix from `content` and `title` fields
4. **Capitalise task title** first character

### Module-aware routing — DECIDED
In `approvalHandler.js`, `normaliseChangeForModules(change, { peopleModuleEnabled })`:
- People OFF + `follow-up` or `delegate` → reroute to `action`, `target_file: null`, `module: "unattached"`
- People OFF + `mention` → drop (return null)
- Writer's own file bypasses People OFF rerouting — always write when People ON

### Writer identity — DECIDED
- Selector in Settings UI, inside the People module block (only visible when People module is ON)
- Stored in IndexedDB as `writerFile` (e.g. `people/katarzyna.md`)
- "I"-triggered `action` tasks → `target_file: writerFile`, `target_section: "## My Actions"`
- Add `## My Actions` section to writer's person file template; append to existing file if missing on first configure
- If `writerFile` not set → `target_file: null` as before
- Writer file bypasses People OFF rerouting

### Sentence pattern routing table — DECIDED
Full routing matrix saved as `memory_os_routing_matrix.xlsx` (in project outputs). Two sheets: Routing Matrix + Module Behaviour. Reference this when writing or updating Run 2 prompt.

Key rules baked into Run 2 prompt:
- Task ownership: one task per item, one owner, assign to actor not all mentioned people
- Deduplication: delegate and follow-up are mutually exclusive for same item
- First-person pending items are tasks: "I'm waiting on X" → action
- Title: ≤10 words, imperative, no wikilinks, no raw sentences

### Single source of truth for tasks — DECIDED (Patch B + C from previous handover)
- `tasks-index.json` is the ONLY place tasks live
- Entity markdown files: narrative content only (`## Summary`, `## Recent Mentions`, `## Notes`)
- NO `- [ ]` checkboxes in `people/*.md` or `projects/*.md`
- `PersonViewer.jsx` + `ProjectViewer.jsx` filter `tasks-index.json` by `target_file`
- All completion handlers call single `completeTask(id)` → writes `tasks-index.json` → increments `taskVersion` in React context → all subscribed views re-render
- Migration pass on vault open: strip `- [ ]` lines from task sections in all entity files, flag in IndexedDB so it runs once only

### Clickable wikilinks — DECIDED
In markdown preview click handler, case-insensitive resolver:
- Date format `[[DD-MM-YYYY]]` → check `notes/` first, then `inbox/`
- Person `[[Name]]` → check `people/`
- Project → check `projects/`
- Idea → check `ideas/`
- Unresolved → toast "File not found in vault"
- Resolved → call `onSelectFile(path)` to open in viewer

### Post-deletion navigation — DECIDED
After file deletion (sidebar or top menu), call `setSelectedFile(null)` to trigger default Dashboard view. Apply to both archive and delete flows. Prevents ghost file rendering.

---

## Fix 3 from previous handover — still pending

Note doesn't move to `notes/` after filing when zero changes approved. Remove zero-approval guard in `handleDone` in `InboxPage.jsx`:
```js
// Remove this guard entirely:
// if (approvedChangeIds.size === 0) return
// Note must always move on Done click regardless of approvals
await clearProcessedState(filePath)
setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
```

---

## Roadmap order (agreed)

1. **Now:** Implement all decisions from this session (pipeline + formatting + module routing + writer identity + wikilinks + deletion nav + task single source of truth)
2. **Next:** Projects module — same two-run pattern, tested separately
3. **Then:** Ideas module — different shape, routes to `ideas/backlog.md`, no person entity
4. **Then:** Patch 09 — Ideas entity viewer
5. **Then:** Patch D — Module disable dialog with archive/restore flow
6. **Then:** H09 — Dashboard redesign from v4 handoff
7. **Later:** AI onboarding, weekly review, idea refinement flow, achievements module, Jira, browser extension, mobile

### Achievements module (ideated this session, not yet specced)
Goals + personal OKRs tracked via inbox updates and manual metrics. Vault addition: `achievements/` folder, one file per Objective, `achievements-index.md` in `context/`. Fits after Ideas on the roadmap. Full spec to be written when reaching that increment.

---

## Debug logging — still needs removal

Remove before next release from `useNoteProcessor.js` and `InboxPage.jsx`:
- `[Processor] raw LLM response`
- `[Processor] parsed changes`
- `[FileNote] LLM raw result`
- `[FileNote] changes count`
- `[FileNote] noteForLLM length`
- `[FileNote] allowedFiles count`

---

## What is working correctly — do not touch

- Two-button flow: Process note / Reprocess / File note
- IndexedDB processing state (`processedNotes` store in `db.js`)
- Wikilink unescape on save/load (`unescapeWikilinks`)
- `stripExistingWikilinks` in pre-pass (idempotent reprocessing)
- Entity creation in Stage 1 (CleanupModal) before LLM runs
- Sidebar task-handling dialog on delete/archive (`SidebarTaskActionModal`)
- ProjectViewer task-handling dialog on delete/archive
- Button system (`PrimaryButton`, `SecondaryButton`, `IconButton` in `Buttons.jsx`)
- Activity log (`activityLog.js`) and threshold-based rebuild trigger
- `rebuildContext.js` reading index files + activity log
- Dashboard three-card Summaries section (Narrative thread, Current focus, Updates)
- `prependToSection` base logic in `vaultWriter.js`
- `formatMentionLine` in `approvalHandler.js`
- DotGrid in sidebar header

---

## Stack reminder

Vite + React · Tailwind · Milkdown (CodeMirror) · File System Access API · IndexedDB · OpenRouter (Gemma 4 / configurable) · `tasks-index.json` single source of truth for tasks

## Key files

```
src/
  components/Sidebar.jsx
  hooks/useFileSystem.js
  hooks/useSettings.js
  lib/db.js
  lib/llm.js
  lib/vaultWriter.js
  lib/approvalHandler.js
  lib/rebuildContext.js
  lib/activityLog.js
  pages/Dashboard.jsx
  pages/Editor.jsx (InboxPage.jsx)
  pages/Settings.jsx
  components/Buttons.jsx
  components/PersonViewer.jsx
  components/ProjectViewer.jsx
tasks-index.json  ← single source of truth for all tasks
```
