# Memory OS — Pipeline v2 Handover
*Prepared for Copilot handoff · 2026-05-25*

---

## Context

This handover covers a series of targeted patches to the note processing pipeline and dashboard. The goal is to reduce LLM burden, make note processing reliable on long notes, and make the system self-maintaining through an activity log and threshold-based context rebuild.

**Do not implement all patches at once. Each patch is self-contained and should be reviewed before the next one starts.**

---

## Architectural decisions made this session

- **LLM job is narrowed**: entity matching (people, projects) is done deterministically before the LLM call. The LLM only extracts intent and routes to already-identified entities.
- **Single source of truth for tasks**: `tasks-index.json` — unchanged, already implemented.
- **Activity log**: new file `context/activity-log.json` — append-only, capped at 30 days, feeds context rebuild.
- **Context rebuild trigger**: threshold-based (every 3–5 new activity log entries) + manual button on dashboard. Not triggered on every note processing.
- **Index files**: `projects-index.md`, `people-index.md`, `ideas-index.md` are the structural state layer. The activity log is the recency layer. Context rebuild reads both — never scans individual vault files.

---

## Patch 1 — Note processing: deterministic entity pre-pass

**File:** `src/hooks/useNoteProcessor.js`

**What to change:**

Before the LLM call, run two deterministic passes:

**Pass 1 — People matching**
- Take the note text
- Extract candidate names: capitalised words, `[[wikilinks]]`, and names adjacent to verbs like "talk to", "meet with", "ask", "tell"
- Compare against the file list: `people/*.md` filenames (already available as `allowedFiles`)
- For each match, replace the bare name with `[[Name]]` wikilink in the note
- Collect unmatched names as `unknownPeople[]`

**Pass 2 — Projects matching**
- Same logic on `projects/*.md` filenames
- Partial matches count (e.g. "Memory OS" matches `projects/memory-os-app.md`)
- Wikilink matched project names in the note
- Collect unmatched as `unknownProjects[]`

**Result:** By the time the LLM sees the note, all known entities are already `[[wikilinked]]`. The LLM does not need to discover or match anything.

**What does NOT change:**
- The fast-path for short notes (`tryFastRouteShortNote`) — keep as is
- The deduplication logic — keep as is
- The unknown entity handling in RoutingReview — unknown people and projects from the pre-pass are passed through as `unknown_entities` exactly as today

**Acceptance criteria:**
- A note containing "I need to talk to Diana about expensify" becomes "I need to talk to [[Diana]] about expensify" before LLM call if `people/diana.md` exists
- A note containing "Memory OS is almost ready" becomes "[[Memory OS App]] is almost ready" before LLM call if `projects/memory-os-app.md` exists
- Unknown names still surface in RoutingReview as unknown entity cards

---

## Patch 2 — Note processing: slim the LLM prompt

**File:** `src/hooks/useNoteProcessor.js` — `buildSystemPrompt()` and `buildUserPrompt()`

**What to change:**

**`buildSystemPrompt`** — remove the raw file path list from the system prompt. Replace with:
- A compact entity reference block (names → paths only, derived from `allowedFiles`)
- The mandatory mention rule (see below)
- Keep module list and routing rules

The allow-list of valid write targets stays for validation but is not dumped into the prompt body. The LLM matches by wikilink name, not by scanning filenames.

**`buildUserPrompt`** — wire in `contextContent` which is already passed to `process()` but currently ignored. Add it as:
```
Current working context (_context.md):
[contextContent]

Current note:
[noteContent]
```

**Add mandatory mention rule to prompt:**
```
MANDATORY: For every person or project explicitly named (wikilinked) in the note, 
emit a change targeting their ## Recent Mentions section with marker=mention. 
This is required even when no task was generated for them.
Format: "YYYY-MM-DD — [one sentence summary]. Source: [noteFilename]"
```

**What does NOT change:**
- JSON response shape
- Retry logic
- Token budget (1200)

**Acceptance criteria:**
- `contextContent` appears in the prompt sent to the LLM (verify via console log)
- A note mentioning `[[Diana]]` always produces a Recent Mentions change for `people/diana.md`
- System prompt no longer contains the raw `allowedFiles.join('\n')` block

---

## Patch 3 — Activity log: data structure and write

**New file:** `src/lib/activityLog.js`

**What to build:**

A module that manages `context/activity-log.json`.

**Shape of each entry:**
```json
{
  "id": "uuid",
  "timestamp": "2026-05-25T14:32:00.000Z",
  "note_source": "inbox/2026-05-25.md",
  "entities_mentioned": ["Diana", "Memory OS App"],
  "tasks_created": 3,
  "decisions": ["Using File System Access API for local storage"],
  "summary": "One sentence AI-generated summary of what was processed"
}
```

**Functions to export:**
- `appendActivityEntry(writeFile, readFile, entry)` — appends one entry to the log
- `readActivityLog(readFile)` — returns parsed entries array, empty array if file missing
- `pruneActivityLog(readFile, writeFile)` — removes entries older than 30 days, appends pruned entries to `context/_context_log.md` as plain text, rewrites the log with remaining entries
- `getEntriesSinceLastRebuild(readFile)` — returns entries since the `last_rebuild` timestamp stored in the log metadata

**Log file shape:**
```json
{
  "last_rebuild": "2026-05-25T10:00:00.000Z",
  "entries": []
}
```

**What triggers `appendActivityEntry`:**
- Called in `InboxPage.jsx` after all approved changes are applied (same place that currently triggers note move)
- The entry summary can be a simple concatenation of entity names + task count for now — no extra LLM call

**Acceptance criteria:**
- Processing a note appends one entry to `context/activity-log.json`
- Entries older than 30 days are pruned on next append
- File is created automatically if missing

---

## Patch 4 — Context rebuild: read index files and activity log

**File:** `src/lib/rebuildContext.js`

**What to change:**

Currently `rebuildContext` reads only `_context.md` and rewrites it from itself — circular. Replace with:

**Inputs (read these files):**
- `context/activity-log.json` — recency layer (what happened recently)
- `context/projects-index.md` — structural state (what projects exist and their status)
- `context/people-index.md` — structural state (who is relevant)
- `context/ideas-index.md` — structural state (ideas)
- `context/_context.md` — carry forward Standing Decisions only

**Do not read:** individual project/people/ideas files. Index files are sufficient.

**LLM prompt inputs:**
```
Activity log (last 30 days):
[activity log entries as readable text]

Projects index:
[projects-index.md content]

People index:
[people-index.md content]

Current standing decisions (carry forward unless contradicted):
[standing decisions section from _context.md]
```

**LLM output:** full `_context.md` in the format:
```markdown
## Narrative thread
[flowing paragraph about recent activity, derived from activity log]

## Current focus
[paragraph + active themes bullets]

## Active projects
[only projects with status: In Progress / To Be Deployed / Blocked]

## Standing decisions
[carried forward + any new ones from activity log]

## Key people
[people appearing in recent activity log entries, with why they're relevant]
```

**After LLM writes new context:**
- Archive old `_context.md` to `_context_log.md` (existing behaviour, keep)
- Update `last_rebuild` timestamp in `activity-log.json`
- Call `pruneActivityLog` to clean entries older than 30 days

**Acceptance criteria:**
- Rebuilt context contains entities from projects-index and people-index, not just what was already in _context.md
- Narrative thread references recent activity log entries
- `_context_log.md` receives the archived previous context
- `last_rebuild` timestamp updates in activity-log.json

---

## Patch 5 — Threshold trigger for context rebuild

**File:** `src/lib/activityLog.js` (add function) + `src/pages/InboxPage.jsx` (call site)

**What to build:**

Add to `activityLog.js`:
```js
export async function shouldTriggerRebuild(readFile, threshold = 4) {
  const log = await readActivityLog(readFile)
  const entriesSinceLast = getEntriesSinceLastRebuild(log)
  return entriesSinceLast.length >= threshold
}
```

In `InboxPage.jsx`, after `appendActivityEntry`:
```js
const shouldRebuild = await shouldTriggerRebuild(readFile)
if (shouldRebuild) {
  // fire and forget — do not await, do not block UI
  rebuildContext(readFile, writeFile, settings).catch(console.warn)
}
```

**Threshold:** 4 entries (configurable, add to Settings later).

**Acceptance criteria:**
- Processing 4 notes triggers a background context rebuild automatically
- UI does not block or show a loading state during the background rebuild
- Processing fewer than 4 notes since last rebuild does not trigger rebuild

---

## Patch 6 — Dashboard: Summaries section redesign

**File:** `src/components/dashboard/dashboard-top.jsx` (or equivalent)

**What to change:**

Replace the current two-card Summaries section (Summary of the Week + Updates) with three cards:

**Card 1 — Narrative thread**
- Reads `## Narrative thread` section from `context/_context.md`
- No generate button of its own
- Shows a "Rebuild context" button (calls `rebuildContext`, shows loading state on this card only)
- Shows `last_rebuild` timestamp from `activity-log.json` as "updated [date]"
- Falls back to "Context not yet built — click Rebuild to generate" if file missing or section empty

**Card 2 — Current focus**
- Reads `## Current focus` section from `context/_context.md`
- Read-only, no button
- Same fallback behaviour as Card 1

**Card 3 — Updates**
- Keep existing behaviour exactly — completed tasks from previous day
- Keep its own Generate button unchanged

**Layout:** three equal-width cards in a row, same visual treatment as current cards.

**Remove:** the "Generate" button from the Narrative thread / Summary card. Context is rebuilt via the Rebuild button, not generated ad hoc.

**Acceptance criteria:**
- Dashboard loads Narrative thread and Current focus from `_context.md` without an LLM call
- Rebuild button on Card 1 triggers `rebuildContext` and shows loading state
- Updates card behaviour is unchanged
- If `_context.md` is missing, cards show fallback text, not an error

---

## What is NOT in this handover

These are agreed for later, do not implement now:

- Tag settings page (user-configurable keyword → tag mappings)
- Weekly review session (heavier periodic synthesis)
- Index file auto-update on entity create/delete (people, projects)
- Manual rebuild button in top nav (dashboard placement agreed instead)
- `rebuildContext` called from Settings (keep for now as manual fallback)
