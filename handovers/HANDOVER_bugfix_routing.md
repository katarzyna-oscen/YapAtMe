# Memory OS — Bug Fix Handover: Routing Review Issues
*Prepared for Copilot handoff · 2026-05-26*

---

## Context

Three bugs surfaced during testing of Patch 1b (CleanupModal + deterministic pre-pass). Apply all three fixes in one pass. Build and confirm after.

---

## Architectural rule to enforce first

**Stage 1 is the only place wikilinks are created.**
Stage 2 (LLM routing) receives a pre-wikilinked note and extracts tasks, decisions, and mentions only. The LLM does not create wikilinks, does not detect entity names, and does not do any matching. It reads `[[wikilinks]]` that are already in the note and routes based on them.

This rule affects the LLM prompt (Bug 2 fix) and should be stated explicitly in the system prompt.

---

## Bug 1 — "Slide templates" and "Slide" leaking into RoutingReview as person unknowns

**File:** `src/hooks/useNoteProcessor.js` — `runDeterministicEntityPrepass`

**Problem:**
A candidate like "Slide templates" passes the capitalised-word check for people extraction AND the near-keyword check for project extraction. Both end up in their respective unknown lists. CleanupModal shows only the project chip, but the person version leaks through to RoutingReview.

**Fix — mutual exclusion between people and project candidates:**

In `runDeterministicEntityPrepass`, after building `unknownProjects` (both known-match linked projects and near-keyword unknowns), exclude any candidate from `unknownPeople` that:
- Already matched a known project (i.e. was wikilinked as a project)
- Appears in `unknownProjects`
- Is a substring of any known project display name or slug
- Is a single common noun that could be a project word: add to stop words: `'slide', 'slides', 'template', 'templates', 'system', 'process', 'platform', 'tool', 'app', 'page', 'site', 'flow', 'board', 'doc', 'docs', 'spec', 'plan', 'report', 'brief', 'deck', 'deck'`

Apply this exclusion as a filter on `unknownPeople` before returning from the pre-pass.

**Also fix the suppression in `applyEntityResolutions` in `InboxPage.jsx`:**

When a candidate appears in `unknownProjects` and the user handled it in CleanupModal (any resolution — create, link, or dismissed), add both the original name AND any single-word substrings of that name to `suppressedUnknownEntities`. This prevents "Slide" from leaking through when "Slide templates" was already handled.

---

## Bug 2 — LLM generating routing changes for non-existent files

**File:** `src/hooks/useNoteProcessor.js` — `buildSystemPrompt` and the post-parse validation step

**Problem:**
The LLM generates changes targeting `people/Slide templates.md` and `people/Slide.md` because the wikilinked note contains `[[Slide templates]]`. These files don't exist in the allow-list. The allow-list validation should block them but the changes still reach RoutingReview.

**Two fixes:**

**Fix A — Clarify the LLM prompt:**
Replace the current mandatory mention rule with this stricter version:

```
STAGE 2 RULES — your only job is to extract tasks, decisions, and mentions:
- The note has already been processed: all known entities are wikilinked as [[Name]].
- DO NOT create new wikilinks. DO NOT detect or match entity names yourself.
- For routing: only emit changes targeting files that exist in the Valid write targets list below.
- For mentions: for each [[wikilinked name]] in the note, emit a mention change ONLY if that
  name's file appears in Valid write targets. If the file is not in the list, skip it entirely.
- Never emit a change targeting a file that is not in Valid write targets.
```

Remove the old mandatory mention rule entirely. Replace it with the above.

**Fix B — Strip invalid targets after parsing:**
In the post-parse step (after `parseRoutingResponseWithRetry` returns), add a hard filter:

```js
parsed.changes = (parsed.changes || []).filter((change) => {
  const target = String(change?.target_file || '')
  return promptAllowFiles.includes(target)
})
```

This is a safety net. Changes targeting files not in the allow-list are silently dropped before RoutingReview ever sees them. This should already exist — if it does, verify it is running after the retry path too, not just the happy path.

---

## Bug 3 — Same task appearing as two separate approval cards

**File:** `src/components/RoutingReview.jsx`

**Problem:**
When the LLM legitimately routes the same content to two different files (e.g. a task that belongs to both a person and a project), two identical-looking cards appear. The user has to approve the same thing twice.

**Fix — group changes by content before rendering:**

In RoutingReview, before rendering the change cards, group changes by a content key:

```js
function makeContentKey(change) {
  return [
    String(change?.title || '').trim().toLowerCase(),
    String(change?.marker || '').trim().toLowerCase(),
    String(change?.content || '').trim().toLowerCase().slice(0, 120),
  ].join('||')
}
```

Group changes that share the same `contentKey` into a single card. The card shows:
- The shared title and content (once)
- A list of all target files: `people/diana.md · ## Talk About` and `projects/memory-os-app.md · ## Open Actions`
- A single Approve button and a single Dismiss button

When the user approves a grouped card, all changes in the group are approved together. When dismissed, all are dismissed together.

**Ungrouped cards** (unique content key) render exactly as today — no change to single-target cards.

**Do not change:** the approve/dismiss state management, the unknown entities section, the Done/Cancel buttons, or any other RoutingReview behaviour.

---

## What does NOT change

- CleanupModal component — no changes
- Stage 1 pre-pass logic beyond the mutual exclusion fix above
- Activity log, context rebuild, dashboard — no changes
- The note move/write flow after approval

## Build and confirm

Run `bun run build` after all three fixes. Then confirm:
1. "Slide templates" does not appear as a person unknown in RoutingReview
2. No routing changes target files outside the allow-list
3. Two changes with identical title/content render as one grouped card
