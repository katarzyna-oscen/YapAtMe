# MemoStack — Current State Summary and Handover Audit

Date: 2026-06-04 (updated)

## Scope of this document

This document captures:

1. The currently implemented feature set in the codebase.
2. A handover audit across all handover artifacts found in this repository.
3. Notes on what is fully implemented, partially implemented, superseded, or historical.

## Sources reviewed

### Repository handover files (fully inventoried)

All markdown handovers in `handovers/` were reviewed by filename and key title/status lines.

Files detected:

- BUGFIX_module_toggles.md
- CORRECTION_archive_structure.md
- HANDOVER_03_CATCHUP.md
- HANDOVER_04_dashboard_tasks_notes.md
- HANDOVER_05_entities_modules_archive.md
- HANDOVER_06_viewer_context_modules.md
- HANDOVER_07_actions_modules_precision.md
- HANDOVER_08_design_precision.md
- HANDOVER_DESIGN_integration.md
- HANDOVER_H09_dashboard_iteration.md
- HANDOVER_H09_dashboard_redesign.md
- HANDOVER_bugfix_routing.md
- HANDOVER_fix_cleanEntityFiles.md
- HANDOVER_indexeddb_processing_state.md
- HANDOVER_mention_fixes.md
- HANDOVER_module_gating_and_section_config.md
- HANDOVER_needscall_styling.md
- HANDOVER_next_session copy.md
- HANDOVER_next_session.md
- HANDOVER_patch1_revision.md
- HANDOVER_patch6_visual.md
- HANDOVER_patch_B_entity_viewers.md
- HANDOVER_patch_C_routing_pipeline.md
- HANDOVER_patch_D_settings_modal.md
- HANDOVER_pipeline_v2.md
- HANDOVER_settings_layout.md
- HANDOVER_taskpanel_and_mentions_fix.md
- HANDOVER_topbar_fix.md
- HANDOVER_two_button_flow.md
- HANDOVER_viewer_refresh_and_cleanup.md
- HOTFIX_NOTES_redesign.md
- HOTFIX_inbox_header_title.md
- HOTFIX_milkdown_prose_styling.md
- KNOWN_ISSUES_tasks_and_loader.md
- MICRO_template_placeholder_text.md
- PATCH_01_file_creation.md
- PATCH_02_sidebar_title_archive.md
- PATCH_03_visual_alignment.md
- PATCH_04_content_width_truncation.md
- PATCH_05_processed_note_viewer.md
- PATCH_06_people_entity.md
- PATCH_06b_person_viewer_fix.md
- PATCH_06c_stats_fix.md
- PATCH_07_projects_entity.md
- PATCH_08_tasks_full.md
- PATCH_08_tasks_page.md
- PATCH_A_entity_migration.md
- PATCH_dotgrid_loader.md
- RELEASE_SUMMARY_pipeline_hardening.md

### Design handoff bundles

Also reviewed:

- `.handoff/memory-os/README.md`
- ZIP manifests under `claude design handovers/`:
  - Memory OS-handoff.zip
  - Memory OS-handoff (1).zip
  - Memory OS-handoff (2).zip
  - Memory OS-handoff (3).zip
  - Memory OS-handoff (4).zip

The zip bundles contain earlier design prototypes and assets and are treated as historical design-source artifacts.

## Current product behavior (as implemented)

## 1) Vault and filesystem behavior

Implemented in `src/hooks/useFileSystem.js` and app wiring in `src/App.jsx`.

- Vault selection and persistence through File System Access API.
- IndexedDB-stored folder handle with reconnect support.
- Initial vault scaffold creation for key folders and context files.
- File CRUD support (`readFile`, `writeFile`, `deleteFile`, `renameFile`, `listTree`).
- One-time migration pass on vault open that strips markdown checkboxes from task sections in `people/` and `projects/`, with completion flag in IndexedDB.

## 2) Global app shell and navigation

Implemented in `src/App.jsx` + `src/components/Sidebar.jsx`.

- Multi-page SPA navigation (`command`, `tasks`, `inbox`, `viewer`, `archive`, `settings`).
- Lazy loading for core pages.
- Confirm dialog framework for destructive actions.
- Sidebar with sections for inbox/notes/projects/people/ideas/archive/context.
- Busy indicator and refresh hooks.
- Archive and delete actions with selected-file reset to dashboard when active file is removed.

## 3) Settings and module controls

Implemented in `src/core/SettingsPage.jsx` and `src/hooks/useSettings.js`.

- AI provider/model/key settings and connection test.
- Vault maintenance actions (rebuild context, migration, cleanup actions).
- Module toggles for projects/people/ideas.
- Disable modal for task-bearing modules.
- Dashboard section ordering/visibility config.
- Writer identity setting (`writerFile`) in Modules section when People module is enabled.
- On writer selection, writer file is ensured to include `## My Actions` section.

## 4) Inbox processing pipeline

Implemented across `src/core/InboxPage.jsx`, `src/hooks/useNoteProcessor.js`, and `src/lib/processedNotes.js`.

- Two-button flow: process note, then file note.
- Processing state persisted in IndexedDB (`processedNotes` store) keyed by file path.
- Deterministic cleanup/prepass and unknown-entity handling.
- Parallel two-run LLM pipeline:
  - Run 1: mention extraction.
  - Run 2: task extraction.
- Mention format now wikilink-date based: `[[DD-MM-YYYY]] — ...`.
- Hashtag routing extraction exists and is merged with LLM routing.
- Routing review modal for approving/dismissing changes before filing.
- Automatic application of mention changes.

## 5) Approval and write path

Implemented in `src/lib/approvalHandler.js` and `src/lib/vaultWriter.js`.

- Mentions are normalized and deduplicated by date wikilink identity.
- `prependToSection` supports date-key replace behavior to avoid duplicate mention lines from the same note date.
- Task changes are index-first (and currently treated as index-only for core task sections including `## My Actions`).
- Mention duplicate prevention and no double-write fallthrough.

## 6) Tasks index as primary task store

Implemented in `src/lib/tasksIndex.js`, `src/core/TasksPage.jsx`, and entity viewers.

- Canonical task storage in `context/tasks-index.json`.
- Open/done/archive/disconnect/retarget flows supported.
- Task mutation utilities (`append`, `resolve`, `unresolve`, archive/delete by file).
- App-wide tasks-index change event broadcast (`memostack:tasks-index-changed`) used for reactive refresh.
- Tasks page supports categories, drag/drop ordering, comments, and done/open transitions.

## 7) Entity viewers (people/projects)

Implemented in `src/core/PersonViewer.jsx` and `src/core/ProjectViewer.jsx`.

- Frontmatter-backed entity fields with autosave.
- Task panels sourced from tasks index (open tasks by entity file).
- Entity-level archive/delete with task handling options (disconnect/archive/delete/retarget depending on mode).
- File rename on name change with collision handling and index invalidation.

## 8) Notes and generic file viewers

Implemented in:

- `src/core/ProcessedNoteViewer.jsx`
- `src/core/NotesPage.jsx`
- `src/components/VaultFileViewer.jsx`

Behavior:

- Editable markdown views with autosave.
- Note header/date display and tag extraction.
- Dictation support in processed notes and entity pages.

## 9) Markdown editor UX

Implemented in `src/components/MarkdownEditor.jsx` and `src/hooks/useMarkdownEditor.jsx`.

- Milkdown editor with token decorations for wikilinks and hashtags.
- Task checkbox toggling in editor DOM.
- Hashtag suggestion menu/autocomplete.
- Wikilinks clickable inside editor body via resolver callback plumbing.
- Unresolved wikilinks emit app toast (`File not found in vault`).

## 10) Wikilink resolution and navigation

Implemented in `src/lib/wikilinks.js` and callback wiring via `src/App.jsx`.

- Case-insensitive file matching.
- Date wikilink priority: `notes/` before `inbox/`.
- Resolver integrated in task panels and editor-body clicks.

## Handover-to-code audit

## Status legend

- Implemented: reflected in current codebase behavior.
- Partially implemented: some requested behavior present, but implementation differs in details.
- Superseded: older handover intent replaced by newer architecture.
- Historical/design source: artifact used for design direction; not a direct implementation checklist.

## A) Core evolution patches (PATCH_01 ... PATCH_08, PATCH_A)

Overall status: Implemented / superseded by later refinements.

- File creation, sidebar, archive/delete, visual alignment, processed note viewer, people/projects entities, tasks page, and migration streams are represented in current structure.
- Some older implementation assumptions are superseded by:
  - tasks-index single-source strategy,
  - IndexedDB processing state,
  - updated mention format and dedupe logic,
  - expanded settings/module behavior.

## B) Pipeline and routing handovers

Files: `HANDOVER_pipeline_v2.md`, `HANDOVER_patch_C_routing_pipeline.md`, `HANDOVER_bugfix_routing.md`, `HANDOVER_mention_fixes.md`, `HANDOVER_taskpanel_and_mentions_fix.md`, `HANDOVER_two_button_flow.md`, `HANDOVER_next_session*.md`, `HANDOVER_patch1_revision.md`, `RELEASE_SUMMARY_pipeline_hardening.md`.

Status: Implemented with targeted refactors.

Current code confirms:

- Two-step inbox workflow and routing review.
- Deterministic prepass + LLM extraction pipeline.
- IndexedDB processing-state migration complete.
- Mention dedupe and mention formatting updated to date-wikilink identity.
- Task writing to tasks index is active.

## C) Module/settings/dashboard handovers

Files: `HANDOVER_module_gating_and_section_config.md`, `HANDOVER_patch_D_settings_modal.md`, `HANDOVER_settings_layout.md`, `BUGFIX_module_toggles.md`, `HANDOVER_H09_*`, `HANDOVER_needscall_styling.md`, `HANDOVER_topbar_fix.md`, `HANDOVER_patch6_visual.md`.

Status: Implemented (with iterative visual and behavior updates).

Current code confirms:

- Module gating and disable modal behavior.
- Left-nav settings structure and dashboard section config.
- Dashboard and tasks visualization streams integrated.

## D) Entity/viewer maintenance handovers

Files: `HANDOVER_patch_B_entity_viewers.md`, `HANDOVER_viewer_refresh_and_cleanup.md`, `HANDOVER_fix_cleanEntityFiles.md`.

Status: Implemented.

Current code confirms:

- Entity viewers read tasks from index.
- Viewer refresh hooks and cleanup workflows.
- Entity cleanup/migration actions present in settings.

## E) Design integration and hotfix streams

Files: `HANDOVER_DESIGN_integration.md`, `HOTFIX_*`, `MICRO_*`, `PATCH_dotgrid_loader.md`, plus older design bundles in `claude design handovers/` and `.handoff/memory-os/`.

Status: Implemented/historical.

- Visual system and UI polish from these streams is reflected in component styling and layout.
- Zip bundles are historical prototypes and references, not active runtime code.

## F) Known issues records

File: `KNOWN_ISSUES_tasks_and_loader.md`.

Status: Mostly addressed over time, but should be treated as historical issue context rather than current source of truth.

## Current architecture summary

- Frontend: React + Vite SPA.
- Data persistence:
  - Vault markdown files via File System Access API.
  - IndexedDB for app handles/settings/processed note state.
  - `context/tasks-index.json` as canonical task store.
- AI routing:
  - deterministic prepass + parallel mention/task LLM runs.
- Navigation:
  - centralized in `App.jsx` with page/file routing.
- Task synchronization:
  - event-based tasks-index change signal, consumed for refresh.

## Notes for future maintainers

1. Prefer current code as source of truth over any single historical handover.
2. Use handovers as decision history and rationale.
3. Treat zipped design handoff bundles as UI/interaction references only.
4. Keep task semantics centralized in tasks index and avoid reintroducing markdown checkbox duplication.
5. Keep mention dedupe keyed on date wikilink identity to avoid regressions.

---

## Session update — 2026-06-02

### Wikilink resolution (case-insensitive slug lookup)

**Problem:** Clicking a wikilink like `[[Sophie]]` failed with "Could not resolve" because vault files use title-cased names (`Sophie.md`) while the resolver generated lowercase slug candidates.

**Fix (`src/App.jsx` — `resolveWikilinkTarget`):**
- Builds a `Map<lowercase-path → original-path>` over the full vault tree.
- All slug candidates are looked up case-insensitively.
- Added a `tightSlug` candidate that strips all non-alphanumeric characters before hyphenating, so `[[Ubuntu.com Home Page Revamp]]` resolves to `ubuntucom-home-page-revamp.md`.
- Added a `tightSlug + 's'` candidate to handle plural project file names (e.g. `product-bubbles.md` resolved from `[[Product Bubble]]`).

---

### Project detection via Process Note (three-tier matching)

**Problem:** Project names in prose (e.g. "Ubuntu.com Home Page Revamp", "Information Architecture Framework For Product Bubble") were not being wikilinked by the deterministic prepass. Root causes:
1. Those phrases were not picked up by `extractEntityCandidates` (which only scans wikilinks and names after certain prepositions).
2. The old full-text scan compared humanized display names against raw prose, failing for slug-named projects (e.g. `humanizeEntityName("ubuntucom-home-page-revamp.md")` = `"Ubuntucom Home Page Revamp"` ≠ `"Ubuntu.com Home Page Revamp"`).

**Fix — three-tier matching in `matchEntityPath` (`src/hooks/useNoteProcessor.js`):**

| Tier | Strategy | Score |
|------|----------|-------|
| 1 — Normalized | `lower → strip non-[a-z0-9\s-] → collapse spaces` on both sides | 1000 (exact) / partial |
| 2 — Tight | Strip ALL non-alphanumeric: `"Ubuntu.com"` → `"ubuntucom"` | 500 (exact) |
| 3 — Bag-of-words | Content tokens of candidate must cover ≥80% of path tokens (min 2 hits); handles `"architecture for product bubble"` → `"information-architecture-framework-for-product-bubbles"` | up to 200 |

A stop-word list (`extractContentTokens`) removes filler words (for, and, the, of, …) and crude-depluralizes tokens before comparison.

**Fix — multi-word capitalized sequence scan:**
- Replaced the broken display-name scan with a regex that extracts capitalized word runs from the output text: `/(?<!\[\[)\b([A-Z][A-Za-z0-9.]*(?:\s+[A-Z][A-Za-z0-9.]+)+)\b(?!\]\])/g`
- Each extracted phrase is run through `matchEntityPath(candidate, projectPaths, true)`.
- If matched, `ensureEntityWikilink` wraps the user's original text (preserving punctuation like dots).
- Sequences starting with a stop/preposition word (`on`, `in`, `at`, `to`, `for`, `with`, `the`, `a`, `an`, …) are skipped to avoid false positives like `[[On Memory OS App]]`.

**Fix — candidate loop preserves user text:**
- When the candidate loop resolves a project, it now calls `ensureEntityWikilink(out, candidate)` (original wording) instead of the humanized slug name, so `[[Ubuntu.com Home Page Revamp]]` is written with dots intact.

---

### Wikilink autocomplete in the editor

**Implemented in `src/components/MarkdownEditor.jsx` + `src/core/InboxPage.jsx`.**

- Typing `[[` triggers a dropdown listing all vault entities (people → projects → ideas → notes, alphabetical within type).
- Continuing to type filters the list: every typed word must appear somewhere in the entity name, so `[[home page` matches `Ubuntu.com Home Page Revamp`.
- Arrow Up/Down to navigate, Enter or Tab to confirm, Esc to close.
- Selecting an item replaces the partial `[[query` with `[[Entity Name]]` via `document.execCommand('insertText')`.
- The suggestion list is derived from `allowedFiles` (loaded on mount from `getFileIndex`), typed with `{ name, path, type }`.

---

### Unresolved wikilink styling

**Implemented in `src/components/MarkdownEditor.jsx` (decoration plugin) + `src/index.css`.**

- A module-level `_knownWikilinksRef` set is updated whenever `wikilinkSuggestions` changes.
- The `buildTokenDecorations` ProseMirror plugin reads this set on every document change.
- `[[Name]]` whose inner text appears in the known set renders in the existing gold (`oklch(0.90 0.12 80)`).
- `[[Name]]` whose inner text is **not** found in the vault renders in a darker amber (`oklch(0.70 0.14 55)`) — visually distinct but still warm-toned, matching the product's color language.
- No plugin rebuild required; the ref is read live on each decoration pass.

---

### Files changed in this session

| File | Change |
|------|--------|
| `src/App.jsx` | Case-insensitive slug lookup; `tightSlug` + plural candidates in `resolveWikilinkTarget` |
| `src/hooks/useNoteProcessor.js` | `tightNorm`, `extractContentTokens`, bag-of-words tier in `matchEntityPath`; multi-word cap sequence scan; stop-word guard; candidate loop uses original text |
| `src/components/MarkdownEditor.jsx` | `_knownWikilinksRef`; unresolved wikilink decoration class; `wikilinkMenu` state; `applyWikilinkRef`; wikilink autocomplete event wiring; dropdown JSX; `wikilinkSuggestions` prop |
| `src/core/InboxPage.jsx` | `allowedFiles` state; warm-up effect stores result; `wikilinkSuggestions` useMemo; passes prop to `EditorComponent`; added `useMemo` import |
| `src/index.css` | `.ms-token-wikilink-unresolved` rule |

---

## Session update — 2026-06-02 (continued)

### BUG-020 — Recent Mentions concatenation

**Problem:** Each approved mention was being appended directly against the previous entry with no blank line separator, and the mention line itself had no trailing newline, causing merge artifacts.

**Fix:**
- `formatMentionLine` in `src/lib/approvalHandler.js` now returns the mention string with a trailing `\n`.
- `prependToSection` in `src/lib/vaultWriter.js` normalizes the incoming entry to `entryLine` (ensures single trailing newline), then detects whether the next existing line is immediately adjacent content (not a blank line) and inserts a blank separator line before it.

---

### BUG-021 — Duplicate `writerFile` field in Settings

**Problem:** The `writerFile` (vault owner) input was rendered twice — once in the AI Setup section and once in the Modules section. Only the Modules location is correct (it relates to People module, not AI config).

**Fix:** Removed the `writerFile` block from the AI Setup section of `src/core/SettingsPage.jsx`. The `migrateEntityTasks` import was retained because it is still used in the Vault Maintenance section.

---

### BUG-022 — PERSON/PROJECT misclassification in CleanupModal

**Problem (two parts):**

1. **Post-routing (`extractUnknownPeopleFromWikilinks`):** Only checked `people/` basenames, used a narrow regex that excluded dots, so `[[Ubuntu.com Home Page Revamp]]` was missed entirely and not surfaced for linking.
2. **CleanupModal prepass (`runDeterministicEntityPrepass`):** The fallback for unmatched wikilink candidates always called `unknownPeople.push(candidate.trim())`. The `unknownProjects = []` array was declared but never populated. So every unmatched wikilink — including clearly project-like names — appeared as a PERSON chip.

**Fix:**
- Added `classifyUnknownEntityType(name)` heuristic (3+ words → project; contains a project noun like "revamp/platform/app" → project; contains `.` or digit → project; else → person).
- Added `_PROJECT_NOUNS` const Set at module level.
- `extractUnknownPeopleFromWikilinks` rewritten: checks people + projects + ideas paths, uses `classifyUnknownEntityType`, respects `enabledModules` per type.
- `runDeterministicEntityPrepass` candidate loop fallback now calls `classifyUnknownEntityType` and routes to `unknownProjects` or `unknownPeople` accordingly.
- A `filteredUnknown` safety net uses cross-type fuzzy matching to catch any strays.

---

### BUG-023 — `<br />` tags visible in note preview / routing modal

**Problem:** Notes dictated or pasted with `<br />` HTML tags showed raw tags in the CleanupModal textarea and in the processed note body.

**Fix:**
- `normalizeInboxMarkdown` in `src/core/InboxPage.jsx` now opens with `.replace(/<br\s*\/?>/gi, '\n\n')` before `splitTitleBody`.
- Also applied to `prepass.noteContent` before `setCleanupDraft`, so the CleanupModal textarea shows clean text before the user clicks "Route this".

---

### Track 2 — Module disable dialog handlers

**Problem:** The module toggle in Settings was half-wired: clicking a disable toggle on a module with active tasks did nothing useful. The `handleModalDisable` / `handleMigrateAndDisable` stubs were not connected to real task operations.

**Fix in `src/core/SettingsPage.jsx`:**
- `handleModuleToggle` now calls `countActiveTasksForModule` before showing the disable dialog. If 0 tasks → disables immediately. If >0 → sets `pendingDisable` state with task count.
- Re-enable path calls `countArchivedTasksForModule` and auto-restores via `restoreArchivedTasksForModule`, showing a notice.
- `handleArchiveAndDisable` calls `archiveTasksForModule` then `commitModuleToggle`.
- `handleUnattachAndDisable` calls `unattachTasksForModule` then `commitModuleToggle`.
- `handleModalCancel` sets `pendingDisable(null)`.
- New functions added to `src/lib/tasksIndex.js`: `countActiveTasksForModule`, `countArchivedTasksForModule`, `archiveTasksForModule`, `unattachTasksForModule`, `restoreArchivedTasksForModule`.

---

### Wikilink color — all-amber on load (before vault loads)

**Problem:** All wikilinks showed amber (unresolved) on initial render, then snapped to yellow only after the user clicked something, because `_knownWikilinksReadyRef` was set to `true` in a `useEffect` but ProseMirror's decoration plugin only reruns on a state transaction.

**Fix in `src/components/MarkdownEditor.jsx`:**
- Added `_knownWikilinksReadyRef = { current: false }` as a module-level ref.
- After populating `_knownWikilinksRef`, the effect now dispatches a no-op ProseMirror transaction via `editor.get().action(ctx => view.dispatch(view.state.tr))`, forcing immediate re-decoration.
- The effect was also moved to after `const editor = useEditor(...)` (it was previously before it, causing a `ReferenceError: Cannot access 'editor' before initialization` crash).
- `isResolved` logic changed from `!knownSet.size || knownSet.has(...)` to `_knownWikilinksReadyRef.current && knownSet.has(...)`.

---

### Wikilinks in entity/note viewers all amber

**Problem:** `ProjectViewer`, `PersonViewer`, and `ProcessedNoteViewer` passed no `wikilinkSuggestions` to `EditorComponent`, so the decoration plugin's known-set was always empty and every wikilink appeared amber.

**Fix:**
- `src/App.jsx` now computes `wikilinkSuggestions` (same transform as InboxPage — path → title-cased display name + type) from the existing `tree` state via `useMemo`.
- `wikilinkSuggestions` passed as prop to `ProjectViewer`, `PersonViewer`, `ProcessedNoteViewer`, who forward it to `EditorComponent`.
- `settings` passed to `PersonViewer` to support the vault-owner badge (see below).

---

### Wikilinks in Recent Mentions still amber (date links)

**Problem:** The known-set used the display name (`02 06 2026`, with spaces) but `[[02-06-2026]]` wikilinks were matched against the raw wikilink text (with hyphens). They never matched.

**Fix in `src/components/MarkdownEditor.jsx`:**
- The known-set now also adds the raw filename stem (hyphens preserved) for every suggestion: `s.path.split('/').pop().replace(/\.md$/i, '')`. So `02-06-2026` resolves even though the display name is `"02 06 2026"`.

---

### PersonViewer — vault owner badge

**Problem:** When viewing the person who is the vault owner (`filePath === settings.writerFile`), the "Relationship" pill was displayed — which is meaningless and misleading for the user themselves.

**Fix in `src/core/PersonViewer.jsx`:**
- When `filePath === settings?.writerFile`, the Relationship `PillInput` is replaced by a `VAULT OWNER` badge styled in the wikilink amber tone (`oklch(0.85 0.16 95)`) with a subtle tinted background and solid border — consistent with the product's color language.

---

### Title fields cut off (ProjectViewer / PersonViewer / ProcessedNoteViewer)

**Problem:** All three viewer title inputs were `<input type="text">` — single-line, so long names like "information architecture framework for product bubbles" were visually clipped with no indication of the full text.

**Fix:** Converted title fields (and the core problem description in ProjectViewer) to auto-expanding `<textarea>` elements — `rows={1}`, `overflow: hidden`, `resize: none`, with an inline `ref` callback that immediately sets height to `scrollHeight`, and an `onChange` that updates height on each keystroke.

---

### BUG-024 — New note filename stays "untitled"

**Problem:** Clicking `+` in the Notes sidebar immediately created `notes/Untitled-<timestamp>.md`, navigated to it, and the user had no guided way to name it. The file persisted as "untitled" even after typing a title.

**Fix — two parts:**

**Part 1 — Inline rename input on new note creation (Sidebar):**
- `SidebarSection` for the `notes` folder no longer calls `onAdd` immediately on `+` click.
- Instead it shows an inline `<input>` at the top of the file list, auto-focused, with placeholder "Note title…".
- **Enter** or blur with text → calls `onAdd('notes', typedName)` → `handleCreateFile` in App.jsx slugifies the name and creates `notes/<slug>.md` with `# Title\n\n`.
- **Escape** or blur with empty → cancels, no file created.
- All other sections (`inbox`, `people`, `projects`, `ideas`) are unaffected.

**Part 2 — H1-based rename fallback for existing untitled files (ProcessedNoteViewer):**
- `ProcessedNoteViewer` accepts `renameFile`, `fileExists`, `onFileRenamed` props.
- Detects when the open file's stem matches `/^untitled/i`.
- On title field **blur** with non-empty title: derives slug, checks for collision via `fileExists`, writes content to `notes/<slug>.md`, deletes the old file, fires `memostack:toast` ("Renamed to `<slug>.md`"), and calls `onFileRenamed(newPath)` so App updates `activeFile` and refreshes the tree.
- Title field also converted from `<input>` to auto-expanding `<textarea>` for consistency.

---

### Files changed in this session (continued)

| File | Change |
|------|--------|
| `src/lib/approvalHandler.js` | BUG-020: `formatMentionLine` trailing `\n` |
| `src/lib/vaultWriter.js` | BUG-020: `prependToSection` blank-line separator |
| `src/core/SettingsPage.jsx` | BUG-021: removed duplicate `writerFile` block; Track 2: full disable/restore modal wiring |
| `src/hooks/useNoteProcessor.js` | BUG-022: `classifyUnknownEntityType`, `_PROJECT_NOUNS`, `extractUnknownPeopleFromWikilinks` rewrite, prepass candidate loop classification |
| `src/core/InboxPage.jsx` | BUG-023: `<br />` strip in `normalizeInboxMarkdown` and before `setCleanupDraft` |
| `src/lib/tasksIndex.js` | Track 2: five new module-level task functions |
| `src/components/MarkdownEditor.jsx` | Wikilink color: `_knownWikilinksReadyRef`, no-op transaction dispatch, effect moved after `useEditor`, known-set includes raw filename stems |
| `src/App.jsx` | `wikilinkSuggestions` useMemo from tree; passed to all viewers; `settings` to PersonViewer; `renameFile`/`fileExists`/`onFileRenamed` to ProcessedNoteViewer; `handleCreateFile` accepts `customName`; `useMemo` import |
| `src/core/ProjectViewer.jsx` | Accepts `wikilinkSuggestions`; passes to editor; title + description → auto-expanding textarea |
| `src/core/PersonViewer.jsx` | Accepts `settings` + `wikilinkSuggestions`; VAULT OWNER badge; passes suggestions to editor; title → auto-expanding textarea |
| `src/core/ProcessedNoteViewer.jsx` | Accepts new props; `renameToTitle` / `handleTitleBlur` rename flow; title → auto-expanding textarea; passes `wikilinkSuggestions` to editor |
| `src/components/Sidebar.jsx` | BUG-024 Part 1: inline new-note `<input>` in Notes section; `useRef` import; `pendingNew` state |

---

## Session update — 2026-06-04

### Handover H10 filed

New handover written and saved as `handovers/HANDOVER_H10_styling_audit.md`. Captures the styling-first mandate, open bugs (BUG-016, BUG-022, BUG-009), and post-styling roadmap (Ideas module, task commenting, amber wikilink creation).

---

### Global styling audit — pass 1

**Goal:** Align the live app with the v5 design handoff (`claude design handovers/Memory OS (5)_.zip`). Scope: no structural changes, styling only.

#### Design token correction — `--active`

**Problem:** `--active` was undefined in `:root`, so any `color: var(--active)` in nav components (settings left-nav, sidebar top-nav) silently fell back to nothing, making active items invisible or plain white.

**Fix (`src/index.css`):**
- Added `--active: #e9b452` — exact hex from the design HTML's `<style>` block, a warm amber used wherever a nav row is the current selection.

#### Sidebar nav — active item colour

**Problem:** `NavItem` used `color: var(--text)` (white) for active state, not the amber token.

**Fix (`src/components/Sidebar.jsx`):**
- Active `NavItem` now uses `color: var(--active)` (#e9b452), matching the design screenshot exactly.

#### Settings left-nav — removed vertical accent bar, corrected layout

**Problem:** The current implementation rendered a `2px` absolute-positioned accent bar on the left of each active settings nav item. The design has no such bar — active state is purely amber text + `panel-2` background.

Additional mismatches:
- `padding: '32px 0 32px'` (no side padding) vs design `padding: '28px 14px'`
- Section label `letterSpacing: '0.12em'` vs design `0.16em`
- Font size `13` vs design `13.5`
- Hover did not restore text color (only background was reset)

**Fix (`src/core/SettingsPage.jsx`):**
- Removed the `<span>` accent bar entirely.
- Corrected padding, letter-spacing, font-size to match design.
- Hover `onMouseLeave` now restores both `background` and `color`.
- Removed `position: 'relative'` from button (no longer needed).

#### Native `<select>` replaced with custom dropdown

**Problem:** `StyledSelect` in `SettingsPage.jsx` used a native browser `<select>` element, which renders with OS-native chrome and breaks the visual consistency of the app.

**Fix (`src/core/SettingsPage.jsx`):**
- `StyledSelect` rewritten as a fully custom dropdown: floating panel, animated chevron (rotates 180° when open), hover highlight per option, active checkmark, closes on outside click via `useRef` + `mousedown` listener.
- Matches the `SelectField` pattern from the v5 design reference exactly.
- Added `useRef` to the import.

#### Sidebar file names humanized

**Problem:** Sidebar file entries displayed raw slugs: `information-architecture-fra...`, `design-tokens-v2`, `hackathon-demo`. The design shows title-cased readable names.

**Fix (`src/components/Sidebar.jsx`):**
- `filesFor()` map now humanizes each stem: hyphens → spaces, then title-case each word. `design-tokens-v2` → `Design Tokens V2`, `hackathon-demo` → `Hackathon Demo`.

#### PrimaryButton loading spinner

**Problem:** `PrimaryButton` with `loading={true}` rendered only the text `"Loading…"` with no visual indicator.

**Fix (`src/components/ui/Buttons.jsx`):**
- Loading state now renders an animated spinner SVG (using the existing `spin` keyframe) alongside `"Loading…"` text.

#### Settings content width

All settings section containers widened from `maxWidth: 520` → `maxWidth: 640` to match the design's content area proportions.

---

### Files changed in this session

| File | Change |
|------|--------|
| `src/index.css` | Added `--active: #e9b452` design token |
| `src/components/Sidebar.jsx` | `NavItem` active color → `var(--active)`; `filesFor()` humanizes slug filenames |
| `src/core/SettingsPage.jsx` | Settings left-nav: removed accent bar, corrected padding/size/spacing, fixed hover; `StyledSelect` replaced with custom dropdown; section max-width 520→640 |
| `src/components/ui/Buttons.jsx` | `PrimaryButton` loading state shows spinner SVG |
| `handovers/HANDOVER_H10_styling_audit.md` | New handover filed |

