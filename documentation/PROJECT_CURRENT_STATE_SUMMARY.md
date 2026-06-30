# MemoStack — Current State Summary and Handover Audit

Date: 2026-06-30 (updated)

Current app version: **v0.2.0** (see `package.json`). The running version is shown
in the app sidebar footer and on the onboarding landing screen, so anyone who
downloads the repo can tell which build they have.

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

---

## Session update — 2026-06-15

### Routing pipeline hardening — unassigned tasks, decision marker, vault owner locking

---

### Unassigned tasks now route to vault owner's `## My Actions`

**Problem:** First-person tasks ("I need to...", "I will...") and any task the LLM left without a `target_file` were accumulating as unattached items in the task index — not appearing in any entity's view.

**Previous approach:** A fragile first-person regex test after LLM processing attempted to redirect matching tasks. Missed non-first-person tasks with no owner; regex produced false negatives.

**Fix (`src/hooks/useNoteProcessor.js`):**
- Replaced the first-person regex map with a `flatMap` that catches any task-marker change where `target_file` is null/empty and `writerFile` is set, and routes it to `writerFile → ## My Actions`.
- Prompt updated: LLM explicitly told to output `target_file: null, module: "unattached"` for all unowned tasks (first-person or otherwise), with a note that they will be automatically assigned to the vault owner.

**Fix (`src/core/InboxPage.jsx`):**
- Added `resolvedWriterFile` lookup before calling `process()`: if `settings.writerFile` is empty, scans `people/*.md` frontmatter for `relationship: Me` and uses that path as the effective writer file.
- `effectiveSettings` (with resolved `writerFile`) is passed to `process()` instead of raw `settings`.

---

### Decision marker misrouting on people files — suppressed

**Problem:** The LLM occasionally emitted `decision` marker changes targeting `people/` files (e.g. "Diana's decision on Canonical Slides" → `people/diana.md · ## Decisions`). People files have no `## Decisions` section, so the entry was invalid. It also surfaced in the review queue as a confusing mention-like card.

**Root cause distinction clarified:**
- `decision` = open question where NO named vault person is the decision-maker.
- `follow-up` = writer needs input/approval from a named person.

**Fix — three suppression layers:**

1. **`mentionChanges` filter (`useNoteProcessor.js`):** `decision` items targeting `people/` files are dropped from the mention pass output.
2. **`taskChanges` flatMap (`useNoteProcessor.js`):** `decision` items targeting `people/` files return `[]` — removed from the task changes array entirely.
3. **InboxPage review queue filter (`src/core/InboxPage.jsx`):** An explicit guard strips any remaining `decision`-on-people entries before they reach the review modal.

**Prompt update (`useNoteProcessor.js`):**
- Marker definitions sharpened: `follow-up` now explicitly covers getting input or approval from a named person.
- `decision` definition restricted to cases with no named vault person as decision-maker.
- Added: `NEVER emit a decision change targeting a people/ file.`

---

### Settings — vault owner identity made read-only

**Problem:** The "You" section in Settings allowed changing `writerFile` via a dropdown. This could silently break routing if changed to the wrong person.

**Fix (`src/core/SettingsPage.jsx`):**
- Entire `writerFile` dropdown UI removed. The "You" section now only displays who the vault owner is (avatar initial + name + file path), with a note that identity is set during onboarding.
- Removed: `peopleWriterOptions` state, the `useEffect` that loaded people file options, and the `ensureWriterSectionIfNeeded` helper.
- Removed: unused `ensureWriterActionsSection` import from `templates.js`.

---

### Vault owner file locked against archive/delete

**Problem:** The vault owner's person file could be archived or deleted from the sidebar kebab menu or from within the PersonViewer header — which would break routing.

**Fix — two locations:**

**`src/core/PersonViewer.jsx`:**
- `TrashMenuButton` is conditionally rendered: hidden when `filePath === settings?.writerFile`.

**`src/components/Sidebar.jsx`:**
- `SidebarSection` now accepts a `lockedPath` prop.
- Archive and Delete menu items are wrapped in `selectedFile.path !== lockedPath` guards — they simply don't render for the locked file.
- The People `SidebarSection` is called with `lockedPath={settings?.writerFile}`.

---

### Files changed in this session

| File | Change |
|------|--------|
| `src/hooks/useNoteProcessor.js` | Unassigned task routing: first-person regex removed, replaced with `flatMap` fallback to `writerFile`; `mentionChanges` filter suppresses decision-on-people; `taskChanges` flatMap suppresses decision-on-people; prompt marker definitions sharpened; decision routing and follow-up distinction rules added |
| `src/core/InboxPage.jsx` | `resolvedWriterFile` lookup (scans `relationship: Me`); `effectiveSettings` passed to `process()`; review queue filter suppresses decision-on-people; `parseFrontmatter` import used for owner lookup |
| `src/core/SettingsPage.jsx` | "You" section replaced with read-only display; `peopleWriterOptions` state/effect/helper removed; `ensureWriterActionsSection` import removed |
| `src/core/PersonViewer.jsx` | `TrashMenuButton` hidden for vault owner file |
| `src/components/Sidebar.jsx` | `SidebarSection` accepts `lockedPath`; Archive/Delete hidden for locked file; People section receives `lockedPath={settings?.writerFile}` |

---

## Session update — 2026-06-09

### Sidebar rename (all entity types)

Added inline rename support for Notes, Projects, People, and Ideas from the sidebar context menu. Inbox is excluded.

**`src/components/Sidebar.jsx`:**
- `SidebarSection` accepts `onRenameFile` prop.
- Right-click context menu gains a "Rename" item for all non-inbox sections.
- Activating rename replaces the file label with an inline `<input>`, auto-focused.
- **Enter** or blur commits; **Escape** cancels. A `renameHandledRef` prevents double-fire when Enter triggers both `keydown` and `blur`.
- Date-based filenames (`DD-MM-YYYY`) preserve hyphens in sidebar labels; other stems get humanized (hyphens→spaces, title-case) as before.

**`src/App.jsx` — `handleSidebarRename`:**
- Computes new slug via `toSlug`, checks for collision via `fileExists`.
- Reads the old file, updates the relevant frontmatter field (`full_name` for people, `name` for projects) or H1 line for notes.
- Writes the new path, deletes the old path.
- For people/projects: retargets tasks via `retargetTasksForFile`, updates context index files, calls `invalidateFileIndex`.
- Calls `setActiveFile(newPath)` if the renamed file was open, then `refreshTree`.

**`src/core/ProcessedNoteViewer.jsx`:**
- Non-date notes: editing the H1 title and blurring triggers a `ConfirmDialog` asking to rename the file.
- `executeRename` checks collision, writes new path with updated H1, deletes old file, dispatches toast, calls `onFileRenamed`.
- Date-based stems are detected via `/^\d{2}-\d{2}-\d{4}$/` and excluded from rename flow.

---

### BUG-025 — rebuildContext never updated index files / no auto-trigger after filing

**Issue A — Index files never updated:**
`rebuildContext` only read context index files, never wrote them. Projects/people/ideas added after the initial vault setup were absent from the LLM context.

**Fix:** `rebuildIndexFiles(readFile, writeFile, listTree)` added — scans `projects/`, `people/`, `ideas/` folders, reads frontmatter from each file, and rewrites the three index files (`context/projects-index.md`, `context/people-index.md`, `context/ideas-index.md`) on every rebuild. Called at the top of `rebuildContext` before the LLM pass.

**Issue B — No auto-trigger after filing:**
The `shouldTriggerRebuild` threshold (4+ activity log entries) was rarely met in normal use, so filing a note almost never triggered a rebuild.

**Fix (`src/core/InboxPage.jsx`):** Replaced the conditional `shouldTriggerRebuild` block with an unconditional background `rebuildContext(...)` call after every successful note filing. Non-blocking (`catch` swallows errors with `console.warn`).

---

### rebuildContext.js — full redesign (Task 2)

**Old design:** Every rebuild appended a full `_context.md` snapshot to `_context_log.md`. No structured output. No curation — context grew monotonically.

**New design:**

| Aspect | Old | New |
|--------|-----|-----|
| Sections | Narrative thread, Active projects, Standing decisions, Key people | + **Current focus** (5 sections total) |
| Activity input | Entries since last rebuild only | All entries in last 30 days, newest-first, capped at 30 |
| LLM output format | Raw markdown | `===CONTEXT===` / `===REMOVED===` / `===END===` delimiters |
| Curation logic | None (append only) | 14-day staleness threshold; max 5 items per section; LLM removes stale items |
| Context log write | Always: full snapshot appended | Only if items were removed; format: `- item | reason` |
| `pruneActivityLog` | Wrote pruned entries to `_context_log.md` | Silently drops old entries — no log write |
| Entity name fidelity | None | Post-process sanitizer replaces normalized names with exact vault names (fixes `Ubuntucom` → `Ubuntu.com`) |
| Mutex | Simple boolean flag | Boolean + timestamp; auto-expires after 2 minutes |

**`src/lib/activityLog.js`:**
- `pruneActivityLog` no longer writes to `_context_log.md`.
- Removed unused `CONTEXT_LOG_PATH` constant and `entryToContextLogText` function.

**Call sites updated** (all now pass `listTree` as 4th arg): `CommandPage.jsx`, `SettingsPage.jsx`, `InboxPage.jsx`.

---

### BUG-026 — Wikilink color coding: special-character names (Ubuntu.com)

**Problem:** `[[Ubuntu.com Home Page Revamp]]` showed as amber (unresolved) even though the project exists. The vault file is `projects/Ubuntucom-home-page-revamp.md` (dot stripped by `toSlug`). The known-set in `MarkdownEditor.jsx` stored `"ubuntucom home page revamp"` but the link text normalized to `"ubuntu.com home page revamp"` — mismatch on the dot.

**Fix (`src/components/MarkdownEditor.jsx`):**
- When populating `_knownWikilinksRef`, each suggestion name now also adds a punctuation-stripped version (e.g. `"ubuntucom home page revamp"`).
- When checking resolution, also checks `innerTight` (link text with punctuation stripped) against the known set.
- Navigation already worked via the existing `tightSlug` candidate in `resolveWikilinkTarget`.

---

### BUG-027 — Dashboard context cards not populating after rebuild

**Issue A — Section name mismatch (Narrative thread):**
`rebuildContext.js` was writing `## Current focus` but the UI read `'Narrative thread'`. Fixed by renaming back to `## Narrative thread` in `REQUIRED_HEADINGS` and the LLM prompt template.

**Issue B — Current focus card "No focus data yet":**
`rebuildContext.js` had no `## Current focus` section at all after the redesign. Added it as a fifth section in `REQUIRED_HEADINGS` and the LLM output format with the instruction: *"max 3 bullets — the single most important priorities or next actions right now"*.

**Issue C — extractContextSection only returned first bullet:**
The `extractContextSection` regex used `im` flags together. The `m` flag makes `$` match end-of-line, causing the lazy `[\s\S]*?` to stop after the first line. Fixed by removing the `m` flag and changing `^##` to `(?:^|\n)##` so mid-document headings are still found.

**handleRebuildContext fixes (`CommandPage.jsx`):**
- Added `listTree` to the `useCallback` dependency array (was stale).
- Added error toast on rebuild failure (was only `console.error`).

---

### BUG-028 — Dashboard summary cards vs project cards visual inconsistency

`ContextCard` and `SummaryCard` used `padding: 12` and `fontSize: 14`; `ProjectCard` uses `padding: '16px 18px 14px'` and `fontSize: 13`.

**Fix (`src/core/dashboard-top.jsx`):**
- Both summary card types updated to `padding: '16px 18px 14px'` and `fontSize: 13`.

---

### BUG-029 — Current focus bullets not visible

**Problem:** The `<ul>` in `renderContextContent` was missing `listStyleType: 'disc'`. Browser CSS resets default `list-style-type` to `none`, so bullet markers were invisible. `paddingLeft: 16` was providing indent space for markers that never rendered.

**Fix (`src/core/dashboard-top.jsx`):**
- Added `listStyleType: 'disc'` to the `<ul>` style.
- Reduced `paddingLeft` from `16` to `14` to align bullet markers with the card title's left edge.

**`renderContextContent` also introduced this session:**
- Replaced `<pre>` in `ContextCard` with a proper markdown renderer: `- ` / `* ` lines → `<ul><li>`, prose lines → `<p>`.
- Applies to both Narrative thread and Current focus cards.

---

### Files changed in this session (2026-06-09)

| File | Change |
|------|--------|
| `src/components/Sidebar.jsx` | Inline rename input; date-format label fix (dashes preserved); `onRenameFile` prop wired to Notes/Projects/People/Ideas sections |
| `src/App.jsx` | `handleSidebarRename` function; imports `toSlug`, `retargetTasksForFile`, `parseFrontmatter`, `buildFileContent` |
| `src/core/ProcessedNoteViewer.jsx` | H1 edit → rename confirm dialog; `isDateBasedFile` guard; `executeRename` / `cancelRename` |
| `src/lib/rebuildContext.js` | Full redesign: 5 sections, curation model, delimiter output, entity name sanitizer, index file builder, stuck-mutex timeout |
| `src/lib/activityLog.js` | `pruneActivityLog` no longer writes to `_context_log.md`; removed unused `CONTEXT_LOG_PATH` and `entryToContextLogText` |
| `src/core/InboxPage.jsx` | Unconditional background rebuild after filing; removed `shouldTriggerRebuild` |
| `src/core/CommandPage.jsx` | `extractContextSection` regex fixed (no `m` flag); `listTree` dep added; error toast; diagnostic `console.log` |
| `src/core/SettingsPage.jsx` | `rebuildContext` call updated to pass `listTree` |
| `src/components/MarkdownEditor.jsx` | Punctuation-stripped wikilink name added to known-set; `innerTight` checked on resolution |
| `src/core/dashboard-top.jsx` | `renderContextContent` markdown renderer; `ContextCard` and `SummaryCard` padding/font normalized; `listStyleType: 'disc'` on `<ul>`; `paddingLeft: 14` |

---

## Session update — 2026-06-10

### Plan step consistency — three interconnected bugs fixed

**Problem (three bugs):**

1. **Done steps disappeared in viewer.** `TaskPanel` (used for the plan section in IdeaViewer and ProjectViewer) only shows tasks with `status !== 'done'` from the tasks index. Resolving a step made it vanish entirely instead of showing as crossed off.
2. **No edit or delete on plan steps in viewers.** `TaskPanel` has no per-step edit or delete affordances.
3. **Out-of-sync between viewers and PlansPage.** Viewers wrote to the tasks index only; PlansPage reads/writes the markdown `## Current Plan` section only. The two stores diverged silently on every toggle.

**Architecture — `PlanChecklist` component (`src/components/PlanChecklist.jsx`):**

New component that replaces `TaskPanel` for all plan sections. Key design:
- Reads from `sectionText` prop (raw content of `## Current Plan`, no heading) — same source as PlansPage.
- Renders ALL steps: open (checkbox, editable text on click, × delete on hover) and done (checked, strikethrough, × delete on hover).
- "Add step" inline input at bottom.
- Stats line ("N of M done · steps feed the Plans screen").
- Callbacks: `onChange(newSectionText)`, `onToggle(title, nowDone)`, `onDelete(title)`, `onAdd(title)`, `onRename(oldTitle, newTitle, isDone)`.

**`src/lib/tasksIndex.js` — two new exports:**
- `setPlanTaskStatus(readFile, writeFile, filePath, section, title, done)` — matches by file+section+title (not id), updates status and `resolved_at`.
- `removePlanTask(readFile, writeFile, filePath, section, title)` — removes entry by file+section+title.

**`src/core/IdeaViewer.jsx`:**
- Removed `TaskPanel`, `appendToSection`, `resolveTaskEntry` imports; removed `tasks`, `planCount`, `planDone`, `addingStep`, `newPlanStep` state; removed `loadStats`.
- Plan step count badge now computed inline from `parsePlanSteps(sectionCurrentPlan)`.
- `save(overrides)` extended: `sectionCurrentPlan` override prevents stale-closure writes.
- `queueSave(overrides)` now passes overrides through to `save`.
- `handlePlanToggle` / `handlePlanDelete` / `handlePlanAdd` / `handlePlanRename` handlers added — call `setPlanTaskStatus` / `removePlanTask` / `appendTaskEntry` after applying the change to `sectionCurrentPlan`.
- Plan section JSX replaced with `<PlanChecklist>`.

**`src/core/ProjectViewer.jsx`:**
- Added `sectionCurrentPlan` state + `sectionCurrentPlanRef` (ref for stale-closure-safe saves).
- `loadFile` extracts `## Current Plan` section via regex, stores it separately, strips it from `editorBody` before passing to Milkdown.
- `save(body)` re-injects the plan section from `sectionCurrentPlanRef.current` before `## Recent Mentions` (or at end of file).
- Removed `planCount`, `planDone`, `addingStep`, `newPlanStep` state; simplified `loadStats` to remove plan tracking.
- Existing plan UI (TaskPanel + add step) replaced with `<PlanChecklist>`.
- Same four plan handlers as IdeaViewer.

**`src/core/PlansPage.jsx`:**
- Imports `setPlanTaskStatus`.
- `handleToggleStep`: after `toggleStepInFile` (markdown), also calls `setPlanTaskStatus` — keeps tasks index in sync when toggling from the Plans screen.

---

### Entity picker (`src/components/EntityPicker.jsx`)

New chip-based entity selector component (implemented previous session, first commit this session):
- Shows existing selections as `[[Name]] ×` chips.
- Typeahead dropdown filtered by `filterType` ('project' | 'person' | 'idea' | null).
- `+ Add "query"` option for free-form entry.
- Wired into IdeaViewer Related Projects/People sections and PersonViewer Related Projects section (replaces old `WikilinkTextField`).

---

### Files changed in this session (2026-06-10)

| File | Change |
|------|--------|
| `src/lib/tasksIndex.js` | Added `setPlanTaskStatus`, `removePlanTask` |
| `src/components/PlanChecklist.jsx` | New component — renders all plan steps (open + done) from markdown section text |
| `src/components/EntityPicker.jsx` | New component — chip+typeahead entity picker |
| `src/core/IdeaViewer.jsx` | Replaced TaskPanel plan UI with PlanChecklist; removed loadStats; save/queueSave override support; plan handlers added |
| `src/core/ProjectViewer.jsx` | Replaced TaskPanel plan UI with PlanChecklist; plan section extracted from body + re-injected on save; plan handlers added |
| `src/core/PlansPage.jsx` | Syncs tasks index on step toggle via `setPlanTaskStatus` |

---

### Plans view polish (2026-06-10 continued)

#### PlanChecklist checkbox style

Replaced the native `<input type="checkbox">` (with `accentColor: var(--success)`) with a custom `<button>` matching `PlansPage`'s `PlanStepRow` exactly:
- Open: neutral `var(--border-strong)` border, transparent fill.
- Hover: border turns `var(--success)` green.
- Done: green fill + white SVG checkmark + green border.
- Added `boxHov` state to `StepRow` for the hover transition.

#### PlanChecklist indentation

Added `paddingLeft: 12` to step row containers so the left edge of PlanChecklist checkboxes aligns with TaskPanel rows.

#### PlansPage status chip keys fixed

`STATUS_STYLE` had stale project status keys (`active`, `planning`, `on_hold`, `completed`) that never matched frontmatter values — every project chip fell through to the grey default. Replaced with the correct `ProjectViewer` keys: `Untriaged`, `Triaged`, `Building`, `Blocked`, `Done`.

#### Plans archive

When all steps in a plan block are checked, an **Archive** button appears in the green "All steps done" footer. Behavior:
- Clicking writes `plan_archived: true` to the entity's frontmatter via `buildFileContent`.
- Optimistic update: card immediately moves out of the active list.
- A collapsible **Archived** section appears at the bottom of PlansPage (collapsed by default, chevron + count). Archived cards show "Archived" text in the footer instead of the Archive button.
- Archived entities are still loaded from disk on next page visit (read from `fields.plan_archived`).

**Files changed:**

| File | Change |
|------|--------|
| `src/components/PlanChecklist.jsx` | Checkbox: native input → styled button matching PlansPage; `boxHov` state; `paddingLeft: 12` on step rows |
| `src/core/PlansPage.jsx` | Status chip keys corrected; `buildFileContent` import added; `handleArchive`; `planArchived` in entity state; `ArchivedSection` collapsible component; `onArchive` prop wired in active `PlanBlock` renders |

---

## Session update — 2026-06-09 (continued)

### BUG-033 — Entity names in sidebar showing raw slugs

**Problem:** Sidebar displayed slug-derived names (`content-system`) instead of the actual entity display names (`Content System`) for People, Projects, and Ideas entities.

**Fix (`src/App.jsx`):**
- Added `entityDisplayNames` state (`Map<path, displayName>`).
- `useEffect` on `tree` change: reads frontmatter for people/projects/ideas and H1 for notes, builds the map.
- `handleDisplayNameChanged(path, name)` callback (memoized) lets viewers push real-time name updates into the map on every save.
- `entityDisplayNames` passed to `<Sidebar>`.

**Fix (`src/components/Sidebar.jsx`):**
- `filesFor()` checks `entityDisplayNames.has(filePath)` first; slug humanization is fallback only.

**Fix (all entity viewers):**
- `PersonViewer`, `ProjectViewer`, `ProcessedNoteViewer` accept `onDisplayNameChanged` prop and call it after each save, enabling real-time sidebar sync without waiting for a full tree refresh.

---

### FEATURE-003 — External link insertion (paste URL, Cmd+K)

**Link CSS (`src/index.css`):**
- `.milkdown-wrapper .milkdown .ProseMirror a[href]` → blue underlined, with hover state.

**Click handler (already in `handleDOMEvents.click`):**
- `target.closest('a[href]')` with `https?://` check → `window.open(..., '_blank', 'noopener,noreferrer')`. Prevents ProseMirror's default navigation.

**Auto-link plugin (`src/components/MarkdownEditor.jsx`):**
- `autoLinkPlugin` — ProseMirror `appendTransaction` plugin.
- After every document change, scans all text nodes for bare `https?://` URLs not already covered by a link mark, and applies `schema.marks.link` in a follow-up transaction.
- Works for both typed and pasted URLs; renders blue immediately without needing a reload.
- Registered via `prosePluginsCtx` so it is independent of Milkdown's preset config ordering.

**Cmd+K popover:**
- Cmd/Ctrl+K in the editor opens a small floating input anchored near the selection.
- Saves the ProseMirror selection (`from`, `to`, `text`) in a ref.
- On Enter: `insertLink(url)` applies a link mark over saved selection, or inserts `url` text with link mark if no selection.
- Esc closes without inserting.

---

### BUG — Project disappearing on rename

**Root cause:** `executeRename` in `ProjectViewer` (and `PersonViewer`) called `deleteFile(oldPath)` after `writeFile(newPath)`. On macOS's case-insensitive filesystem, when only the display name casing changed (same slug), `oldPath === newPath` — so the delete removed the file that was just written.

**Secondary cause:** `handleNameBlur` compared `newSlug === currentSlug` with case-sensitive equality. Since `toSlug` capitalises the first letter but older files on disk are all-lowercase, a case-only difference would incorrectly trigger the rename dialog, leading to the destructive delete.

**Fix (`src/core/ProjectViewer.jsx` and `src/core/PersonViewer.jsx`):**
- `handleNameBlur` (ProjectViewer): comparison is now `newSlug.toLowerCase() === currentSlug.toLowerCase()`. Cosmetic changes (same slug, different casing) now save silently in place rather than triggering a rename dialog.
- `executeRename` (both viewers): delete guard changed to `if (oldPath.toLowerCase() !== newPath.toLowerCase())` — macOS-safe case-insensitive path comparison.

**Fix (`src/App.jsx`):**
- `handleFileRenamed` simplified to call `refreshTree()` directly instead of duplicating its logic inline.

---

### Archive — notes.md no longer hidden

**Problem:** `archive/notes.md` (obsolete legacy file) was permanently filtered out of the Archive sidebar section by `filesFor()`, making it impossible to delete via the app. Only `tasks-archive.md` should be protected.

**Fix (`src/components/Sidebar.jsx`):**
- Removed `&& !(section === 'archive' && file.name === 'notes.md')` from the `filesFor()` filter. The file now appears with a normal `...` menu allowing deletion.

---

### Notes — title decoupled from filename

**Problem:** Editing the H1 title of a date-based note (`09-06-2026.md`) triggered a rename confirmation dialog. Renaming would break all `[[09-06-2026]]` wikilinks and disconnect "Recent Mentions" tracking.

**Decision:** Notes use their date slug as the stable, wikilink-referenced identity. The H1 title is a human label only. Only `untitled-*.md` notes (before first title entry) still auto-rename.

**Fix (`src/core/ProcessedNoteViewer.jsx`):**
- `handleTitleBlur`: for non-untitled files, saves in place via `save(editorBody, title)` — never triggers a rename dialog.
- `executeRename`, `cancelRename`, `renameDialog` state, and `ConfirmDialog` import all removed.
- The sidebar already displayed the H1 title (via `entityDisplayNames`) so UX is unchanged.

---

### Files changed in this session (2026-06-09 continued)

| File | Change |
|------|--------|
| `src/App.jsx` | `entityDisplayNames` Map state; `handleDisplayNameChanged` callback; `entityDisplayNames` → Sidebar; `handleFileRenamed` simplified |
| `src/components/Sidebar.jsx` | Uses `entityDisplayNames` for display names; removed `notes.md` archive filter |
| `src/core/ProjectViewer.jsx` | `handleNameBlur` case-insensitive comparison; `executeRename` case-insensitive delete guard; `onDisplayNameChanged` wired |
| `src/core/PersonViewer.jsx` | `executeRename` case-insensitive delete guard; `onDisplayNameChanged` wired |
| `src/core/ProcessedNoteViewer.jsx` | Title decoupled from filename for date notes; `executeRename`/`cancelRename`/`renameDialog` removed; `onDisplayNameChanged` wired |
| `src/components/MarkdownEditor.jsx` | `autoLinkPlugin` (appendTransaction URL auto-linker); Cmd+K popover; link click handler; `linkPastePlugin` and DOM paste listeners removed in favour of autolink |
| `src/index.css` | Link styling: `.milkdown-wrapper .milkdown .ProseMirror a[href]` |

---

## Session update — 2026-06-16

### Entity detection hardening — dictated (lowercase, Unicode) text

**Context:** Real-world notes are dictated and rarely capitalise mid-sentence words. The previous entity detection relied on capital letters, which made it miss dictated person names and project phrases entirely.

---

#### Person detection — Unicode support

**Problem:** People with non-ASCII names (e.g. `Paweł`, `ł = U+0142`) were not matched by the name-context regex because the character class only covered ASCII word characters.

**Fix (`src/hooks/useNoteProcessor.js` — `extractEntityCandidates`):**
- `NAME_CONTEXT_RE` and `POSSESSIVE_RE` updated to use `\u00C0-\u017E` in character classes and the `u` flag: `/\b(?:with|and|...)\s+([A-Z][\w\u00C0-\u017E]+(?:\s+[A-Z][\w\u00C0-\u017E]+){0,2})/gu`.

---

#### Person detection — conjunction lists

**Problem:** `NAME_CONTEXT_RE` only captures the word *after* a trigger verb. In `"survey that Paweł and Alorah compiled"`, `"and"` is the trigger — so `Alorah` is captured but `Paweł` (before `and`) is missed entirely.

**Fix (`src/hooks/useNoteProcessor.js` — `extractEntityCandidates`, step 2b):**
- Added `CONJ_RE = /\b([A-Z][\w\u00C0-\u017E]+)\s*(?:,|and|&)\s*([A-Z][\w\u00C0-\u017E]+)\b/gu` that captures **both** sides of a conjunction pair.
- Both `match[1]` and `match[2]` are processed through the same `STOP_WORDS` guard and `buckets` deduplication map.

---

#### Project detection — anchored on literal "project" word only

**Problem (before this session):** Project detection used a greedy backward regex anchored on any project noun (`design`, `survey`, `research`, `ops`, etc.). This produced false positives: `"Late To The AI Design"`, `"Preliminary Results From The Survey"`, `"Started To Create The Template"` were all surfaced as unknown projects.

**Fix (`src/hooks/useNoteProcessor.js` — project detection block ~line 650):**
- Completely rewrote to a forward/backward **word-walk** strategy anchored **only** on the literal token `"project"`.
- `PROJ_STOP` set of ~40 stop-words terminates the backward walk.
- `collectBackward(anchorIdx, maxWords=4)` walks left from the `"project"` token, collecting up to 4 non-stop words.
- `pushProject(words)` title-cases the collected tokens and deduplicates against known paths.
- `"AI design ops project"` → backward walk collects `ops`, `design`, `AI`, stops at `the` → project name `"Ai Design Ops"` ✓.
- `"within this project"` → `this` is a stop-word → empty → no project created ✓.
- `"[[Canonical slides]] project"` → `]]` is a break marker → empty → no project created ✓.
- Project-noun anchor loop removed entirely — was the source of all false positives.

**`_PROJECT_NOUNS` set** — removed the noisy generic nouns added in an earlier attempt (`process`, `program`, `campaign`, `product`, `design`, `research`, `survey`, `study`). `_PROJECT_NOUNS` is now only consulted by `classifyUnknownEntityType`, not for detection anchoring.

---

### Project viewer — Owner field upgraded to people picker

**Problem:** The Owner field in `ProjectViewer` was a free-text `PillInput`. There was no way to select an existing person entity.

**Fix (`src/core/ProjectViewer.jsx`):**
- Replaced the `PillInput` for owner with a new `OwnerPicker` combobox component (defined in the same file).
- `ownerPeople` is derived from `wikilinkSuggestions` filtered to `type === 'person'`.
- `OwnerPicker` behaviour:
  - Collapsed: shows `+ Owner` dashed pill if empty.
  - On click/focus: opens a typeahead `<input>` with a floating dropdown list of all person entities.
  - Typing filters the list by substring match.
  - Clicking a person sets them as owner.
  - For a non-entity owner (free text): typing a name not in the list shows a `+ Add "name"` option; pressing Enter also accepts the typed value directly.
  - Closes on outside click or Escape.
  - Dropdown is position-`absolute`, `zIndex: 50`, max-height 220 px with scroll.

---

### PersonViewer — Related Projects YAML round-trip bug fixed

**Problem:** Related projects were stored in frontmatter as raw `[[Name]]` strings, e.g.:
```yaml
related_projects: [[Ai Design Ops]]
```
The frontmatter parser treated the leading `[` and trailing `]` as YAML inline-array delimiters, stripped one bracket from each end, and on reload the chip label became `[Ai Design Ops` (one bracket remaining).

**Fix (`src/core/PersonViewer.jsx`):**
- **Save path:** `related_projects` is now saved as a clean **array of bare names** (no `[[` `]]`). The YAML serializer writes `related_projects: [Ai Design Ops]` which round-trips correctly as a single-element array.
- **Load path:** when reading the `rawRel` array, each element has any stray brackets stripped before re-wrapping: `.replace(/^\[+|\]+$/g, '').trim()`. Existing corrupted files self-heal on the first save.

---

### Files changed in this session (2026-06-16)

| File | Change |
|------|--------|
| `src/hooks/useNoteProcessor.js` | Unicode char class in `NAME_CONTEXT_RE` + `POSSESSIVE_RE`; new `CONJ_RE` conjunction-list detection (step 2b); project detection rewritten to word-walk anchored on literal `"project"` only; project-noun anchor loop removed; noisy generic nouns removed from `_PROJECT_NOUNS` |
| `src/core/ProjectViewer.jsx` | `PillInput` for owner replaced with `OwnerPicker` combobox; `ownerPeople` derived from `wikilinkSuggestions`; `OwnerPicker` component added (people dropdown + free-text fallback) |
| `src/core/PersonViewer.jsx` | Related projects saved as bare-name array; load-path strips stray brackets before re-wrapping |

---

## Session update — 2026-06-17

### Vault switch — wikilink dropdown cache invalidation

**Problem:** After switching vaults, the sidebar displayed correct entities from the new vault, but the wikilink autocomplete dropdown (`[[` trigger) in the Inbox editor still showed stale entities from the previous vault.

**Root cause investigation:**
- The sidebar state updates correctly when vault changes because it reads from `src/App.jsx`'s `tree` state, which is reset on vault switch.
- The Inbox editor's wikilink suggestions are **separate** — they come from `src/core/InboxPage.jsx`, which computes its own `wikilinkSuggestions` useMemo based on `allowedFiles`.
- `allowedFiles` is loaded via `getFileIndex(listTree, buildAllowedFiles)` from `src/lib/fileIndex.js`.
- `getFileIndex` uses a **module-level global IndexedDB cache** (`memostack:fileIndex`) that is **not vault-scoped**.
- On vault switch, the cache was never cleared, so InboxPage read stale cached file lists.

**Fix (`src/App.jsx` — `handleChangeVaultFolder`):**
- Added `await invalidateFileIndex()` call immediately after `openFolderWithHandle(handle)` and before state resets.
- `invalidateFileIndex()` sets the IndexedDB key to `null`, clearing the cache.
- When `rootHandle` updates → `listTree` reference changes → InboxPage's effect re-runs with `[listTree, filePath]` dependency → calls `getFileIndex` again → cache is empty → fresh file list loaded from new vault → wikilink dropdown now shows correct entities.

**Secondary fix (`src/components/MarkdownEditor.jsx` — `EditorCore` component):**
- Added explicit clearing of module-level refs `_knownWikilinksRef.current = new Set()` and `_knownWikilinksReadyRef.current = false` in the effect that watches `wikilinkSuggestions` change.
- Ensures ProseMirror's token decoration plugin has fresh data when suggestions change.

**Key insight:** Multi-page components (InboxPage, ProjectViewer, PersonViewer) compute their own `wikilinkSuggestions` from different sources and at different times. Always ensure **all** related caches are invalidated on vault switch, not just the sidebar's `tree` state.

### Files changed in this session (2026-06-17)

| File | Change |
|------|--------|
| `src/App.jsx` | `handleChangeVaultFolder`: added `await invalidateFileIndex()` call to clear global IndexedDB cache when switching vaults; added `setEntityDisplayNames(new Map())` and `setTree({})` to clear sidebar cache |
| `src/components/MarkdownEditor.jsx` | Added reset of `_knownWikilinksRef.current` and `_knownWikilinksReadyRef.current` in effect watching `wikilinkSuggestions` to ensure stale module-level refs don't linger |

## Session update — 2026-06-30

### App versioning surfaced in the UI

**Why:** The app changes frequently. Someone who clones the repo or installs a
`.deb` had no way to tell which build they were running.

**Implementation:**
- `package.json` `version` is the single source of truth. Bumped to **0.2.0**.
- `vite.config.js` injects it as a compile-time global `__APP_VERSION__` via Vite
  `define` (reads `package.json` at config load).
- The version is rendered as `v{__APP_VERSION__}` in the sidebar footer
  (`src/components/Sidebar.jsx`) and as `YapAtMe v{__APP_VERSION__}` on the
  onboarding landing screen (`src/core/OnboardingFlow.jsx`).
- Note: a `vite.config.js` change requires a dev-server restart (HMR does not pick
  up `define` changes).

### New-person name reverting to "Untitled"

**Problem:** Creating a new person and typing a name reverted it to "Untitled".

**Root cause:** A rename-confirmation dialog introduced for existing people also
fired for brand-new `untitled-*` files; its collision / cancel branch reset the
name back to the old slug, and a racing debounced autosave could resurrect the
old file.

**Fix (`src/core/PersonViewer.jsx`):**
- Fresh `untitled-*` files rename silently (no dialog); named files still confirm.
- Added `renamingRef` / `activePathRef` guards so autosave skips stale/racing
  writes during a rename.
- On a real name collision the typed name is kept and a toast is shown instead of
  reverting to "Untitled".

### Idea detection — proposals were silently swallowed

**Problem:** Clear idea sentences (e.g. "[[Isaac]] gave me a good idea to include
a QR code generator in the slide deck") never reached `ideas/backlog.md`; the
inbox reported "No tasks found".

**Root causes (two, stacked):**
1. The deterministic idea regex didn't match several natural phrasings, and the
   LLM prompt under-specified what an idea is.
2. **Primary bug:** A detected idea's content shape `"[[DD-MM-YYYY]] — title"`
   collided with the *mention* shape in `InboxPage.isMentionShaped`, so the idea
   was misclassified as a Recent Mention — auto-applied and dropped from the
   review queue.

**Fixes:**
- `src/hooks/useNoteProcessor.js` (Option B): high-precision `IDEA_INTRO_RE`,
  a new `IDEA_NEGATION_RE` guard ("no idea", "bad idea"), lead-in stripping for
  clean titles, and a richer task system prompt (idea definition, a "NOT an idea"
  list, and few-shot examples). The LLM owns recall; the regex is a narrow
  high-precision safety net that guarantees obvious ideas reach the backlog.
- `src/core/InboxPage.jsx`: `isMentionShaped` now treats `marker === 'idea'` as
  authoritative and returns `false`, so ideas are never misrouted to mentions.

### Files changed in this session (2026-06-30)

| File | Change |
|------|--------|
| `package.json` | Version bumped to `0.2.0` |
| `vite.config.js` | Inject `__APP_VERSION__` global from `package.json` via `define` |
| `src/components/Sidebar.jsx` | Footer version label `v{__APP_VERSION__}` |
| `src/core/OnboardingFlow.jsx` | Landing-screen version label `YapAtMe v{__APP_VERSION__}` |
| `src/core/PersonViewer.jsx` | New-person name no longer reverts to "Untitled"; rename guards + collision toast |
| `src/hooks/useNoteProcessor.js` | Idea detection Option B: tightened intro regex, negation guard, richer LLM prompt |
| `src/core/InboxPage.jsx` | `isMentionShaped` treats `idea` marker as authoritative so ideas route to backlog |

