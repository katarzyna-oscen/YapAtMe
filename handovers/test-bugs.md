# Memory OS — Test Bug Log
*Started: 2026-06-01 · Pipeline hardening test round*

---

## How to use this file

Add a new entry for each bug found during test runs. Use the template at the bottom.
Status options: `Open` · `In Progress` · `Fixed · Unverified` · `Closed`

---

## BUG-001 — Stage 1 entity extractor captures sentence-opening words as entity candidates

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 1 — Pre-flight / CleanupModal (Stage 1)
**Severity:** High — blocks correct entity detection on every note

**Description:**
The entity extractor in Stage 1 (CleanupModal) flags sentence-opening capitalised words as unknown entity candidates. Words like "Quick", "Need", "Also", "Could", "On" all appeared as entity cards in the review modal alongside the genuine unknown entity "Gloria".

**Observed behaviour:**
Cards shown: Quick · Gloria · Need · Also · Could · Gloria directly
Expected cards: Gloria (only legitimately unknown entity in the note)

**Secondary symptom:**
"Gloria" and "Gloria directly" both extracted as separate candidates — no deduplication or trailing-word trimming in place.

**Screenshot:** Screenshot_2026-06-01_at_10_53_28.png

**Root cause (hypothesis):**
Extractor scans for capitalised words in free text rather than restricting to [[wikilink]] syntax or proper-noun heuristics. No stoplist for common English words. No sentence-position filter.

**Fix options (to decide):**
A. Wikilink-first: extract ONLY names inside [[ ]] brackets that are not in the vault. Simplest and most reliable — user already did the linking.
B. NLP heuristic: filter to Title Case multi-word sequences, apply stoplist, exclude sentence-opening single words.
C. LLM-assisted: pass candidate list through a lightweight API call to classify proper nouns vs common words. Adds latency but highest accuracy.

**Open question:**
Does the note have [[Gloria]] as a wikilink or just free text "Gloria"? If wikilink-first (Option A) is viable, it's the right fix. If the model writes Gloria as free text without brackets, the LLM pre-pass needs to wikilink all proper nouns before Stage 1 runs.

**Recommended fix:** Option A (wikilink-first) if viable. Confirm by checking whether the LLM pre-pass adds [[ ]] to unknown names.

---

## BUG-002 — Double checkbox `- [ ] [ ]` in routing review card content preview

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 2.1 — RoutingReview card display
**Severity:** Low — cosmetic, doesn't affect routing or writes

**Description:**
The content preview inside the "Request IA spec for Product Bubbles" change card shows `- [ ] [ ] Request IA spec for Product Bubbles framework` — two checkbox sequences instead of one.

**Observed behaviour:**
`- [ ] [ ] Request IA spec for Product Bubbles framework`

**Expected behaviour:**
`- [ ] Request IA spec for Product Bubbles framework`

**Root cause (hypothesis):**
The `- [ ]` prefix is being added twice — once by the LLM in the generated content, and once by the card renderer when formatting task content for display. Double-formatting in the preview layer.

**Fix:**
In the change card content renderer, strip any leading `- [ ]` prefix from the content string before prepending the standard `- [ ]` display format. Or: instruct the LLM not to include `- [ ]` in the content field — that formatting belongs to the renderer only.

---

## BUG-003 — Follow-up task incorrectly assigned to newly-created entity (Gloria) instead of task owner

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 2.4 — Section routing and ownership check
**Severity:** Medium — wrong task ownership, task written to wrong file

**Description:**
The "Request IA spec for Product Bubbles" change targets `people/Gloria.md · ## Talk About`. Gloria is the person who needs to send the spec — she is the subject of the follow-up, not the owner of the task. The task should belong to the note author (writer file / unattached action) or to Sophie, who is blocked waiting on it.

Additionally, Gloria was only just created as an unknown entity in Stage 1. Routing a task to a brand-new file that may have empty sections is risky.

**Observed behaviour:**
Target: `people/Gloria.md · ## Talk About · follow-up`

**Expected behaviour:**
Either: unattached action (writer needs to chase Gloria), OR target `people/Sophie.md · ## Talk About` (Sophie is blocked, writer needs to follow up with Sophie about it). Should NOT target Gloria's file — Gloria is the subject, not the recipient of a task.

**Root cause (hypothesis):**
Run 2 task prompt assigns ownership to the person most mentioned in the sentence rather than identifying who the actor is. "Follow up with Gloria" → assigns to Gloria instead of to the note author.

**Fix:**
Strengthen Run 2 prompt: task owner = the person who needs to DO the action, not the person mentioned. "Follow up with X" → owner is the writer (unattached) or the person being asked to follow up, not X. Add example to prompt: `"I should follow up with Gloria" → action owner: writer, not Gloria`.

---

## FEATURE-001 — "Approve All" button in RoutingReview

**Status:** Open
**Requested:** 2026-06-01
**Priority:** Medium

**Description:**
When reviewing routing changes, there is no way to approve all pending changes in one click. Users must approve each card individually even when the entire batch looks correct.

**Requested behaviour:**
Add an "Approve All" button alongside the existing Done/Cancel buttons in the RoutingReview header. Clicking it marks all pending change cards as approved in one action. Individual dismiss still works per-card after.

**Notes:**
Consider also a "Dismiss All" for symmetry, though less common use case.

---

## BUG-004 — Annotated note drops "Ubuntu." from project name ("com Home Page Revamp")

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 2.2 — Annotated note review
**Severity:** Medium — data loss in annotated note, routing still worked

**Description:**
The annotated note reads "the wireframes for the com Home Page Revamp are done" — the "Ubuntu." prefix was stripped. The original reads "the Ubuntu.com Home Page Revamp".

**Observed behaviour:**
`the wireframes for the com Home Page Revamp are done`

**Expected behaviour:**
`the wireframes for the Ubuntu.com Home Page Revamp are done`

**Root cause (hypothesis):**
Either the LLM dropped "Ubuntu." when rewriting the sentence during annotation, or the dot in "Ubuntu.com" caused the wikilink parser to split the token. Check whether the wikilink in the annotated output is `[[Ubuntu.com Home Page Revamp]]` or `[[com Home Page Revamp]]`.

**Fix:**
If model is dropping the subdomain prefix: add an example to the annotation prompt showing project names with dots must be preserved verbatim.
If it's a parser issue: fix wikilink regex to allow dots inside [[ ]] brackets.

---

## BUG-005 — CLOSED — `#follow-up` routed to Gloria

**Status:** Closed — not a bug
**Found:** 2026-06-01
**Closed:** 2026-06-01

**Description:**
Initially flagged as inconsistent ownership. On review: the sentence "[[Sophie]] is still waiting on the IA spec from [[Gloria]]" is genuinely ambiguous — three valid interpretations exist:
1. Assign to Sophie — talk to Sophie about chasing Gloria
2. Assign to writer — I should ping Gloria directly (supported by next sentence)
3. Assign to Gloria — it's Gloria's deliverable, check on it (what the LLM did)

The LLM chose option 3: routed to `people/Gloria.md · ## Talk About` with title "Request IA spec for Product Bubbles". This is a reasonable and defensible interpretation. Not a bug.

**Impact on BUG-003:** BUG-003 (wrong task ownership) needs reassessment — see updated BUG-003 notes.

---

## BUG-006 — Over-annotation risk: monitor with longer/messier notes

**Status:** Monitor
**Found:** 2026-06-01
**Test phase:** Phase 2.2 — Annotated note review

**Description:**
The original known bug (memory-os-full-summary.md) is that the model "puts marker after every sentence". In this test note it did NOT happen — only 5 tags for the whole note, correctly placed. May be fixed or suppressed by current prompt.

**Action:** Run a longer, messier note (10+ sentences, multiple topics) to confirm over-annotation is not triggered. If clean, close. If it recurs, file as active bug.

---

## BUG-007 — [Template — copy for new bugs]

**Status:** Open
**Found:** YYYY-MM-DD
**Test phase:** [Phase number and name from test protocol]
**Severity:** [High / Medium / Low]

**Description:**
[What the bug is]

**Observed behaviour:**
[What actually happened]

**Expected behaviour:**
[What should have happened]

**Root cause (hypothesis):**
[Best guess at the source]

**Fix:**
[If known]

---

## BUG-007 — Filed note appears at bottom of Notes list instead of top

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 3.1 — Apply and verify, sidebar update
**Severity:** Medium — UX friction, most recent note always hardest to find

**Description:**
After filing, the note moved to notes/ correctly but appeared at the bottom of the Notes sidebar section. Older notes listed first; 01-06-2026 last.

**Observed behaviour:**
28-05-2026 · 27-05-2026 · 24-05-2026 · 23-05-2026 · 2026-05-14 · 2026-05-13 · 01-06-2026

**Expected behaviour:**
Most recent note at top.

**Secondary observation:**
Two older notes use ISO format (2026-05-14, 2026-05-13), newer notes use DD-MM-YYYY (28-05-2026). Mixed formats break any sort — alphabetical on DD-MM-YYYY is already wrong chronologically, mixed formats make it worse.

**Root cause (hypothesis):**
Sidebar sorts notes/ alphabetically by filename. Mixed date formats produce incorrect order even before the new note was added.

**Fix:**
Sort notes/ by last-modified date descending. If filename sort is preferred, normalise all filenames to YYYY-MM-DD on vault open (one-time migration), then sort lexicographically descending.

---

## BUG-008 — New person chip has invisible/low-contrast text

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 3 — post-apply visual check
**Severity:** Low — cosmetic, accessibility concern

**Description:**
The type/status chip on a newly created person entity has invisible or very low contrast text.

**Root cause (hypothesis):**
New person files created from CleanupModal may be missing the type or status frontmatter field that drives chip colour. Chip component falls back to a colour that matches or is too close to text colour.

**Fix:**
Ensure newly created person files have `type: person` frontmatter set on creation. Add a safe high-contrast fallback in the chip component for undefined type/status.

---

## BUG-009 — Recent Mentions date wikilink [[DD-MM-YYYY]] does not navigate to note

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 5.2 — Wikilink click
**Severity:** Medium — core feature of the mention format not functional

**Description:**
Clicking [[01-06-2026]] in a Recent Mentions entry does not navigate to the note.

**Two possible causes:**
A. Wikilink click handler not wired in PersonViewer's markdown renderer.
B. Resolver checks notes/ but note was still in inbox/ at time of click (or vice versa).

**Expected behaviour:**
Clicking [[DD-MM-YYYY]] opens the note whether it lives in inbox/ or notes/.

**Fix:**
Confirm which path the resolver checks. Wire wikilink click handler to PersonViewer markdown renderer if missing. Resolver must check both notes/DD-MM-YYYY.md and inbox/DD-MM-YYYY.md and open whichever exists.

---

## PASSED — Phase 2.3 task titles · Phase 2.4 section routing · Recent Mentions dedup

**Recorded:** 2026-06-01
Task titles: clean, imperative, correctly cased. ✓
Section routing: action/decision/follow-up/delegate all correct. ✓
Recent Mentions: correctly deduplicated, concise phrasing, correct [[date]] format. ✓

---

## BUG-010 — [Template — copy for new bugs]

**Status:** Open
**Found:** YYYY-MM-DD
**Test phase:** [Phase number and name from test protocol]
**Severity:** [High / Medium / Low]

**Description:**

**Observed behaviour:**

**Expected behaviour:**

**Root cause (hypothesis):**

**Fix:**

---

## BUG-010 — Reprocess produces more tasks than first run (non-deterministic pipeline)

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 4 — Reprocess dedup test
**Severity:** High — breaks idempotency, core reliability issue

**Description:**
First processing of the note produced 6 changes. Reprocessing the same note produced 11 changes. The pipeline is not idempotent — running it twice on the same note gives different outputs.

**Observed behaviour:**
Run 1: 6 pending changes
Run 2 (reprocess): 11 pending changes — extra tasks extracted that weren't in run 1

**Expected behaviour:**
Reprocessing the same note should produce the same set of changes every time.

**Root cause (hypothesis):**
Two likely causes:
A. The annotated note from run 1 already has #action/#decision/#delegate tags embedded. Run 2 reads the annotated note (not the original), so the model sees the tags and generates additional changes on top of the previous ones — compounding rather than replacing.
B. LLM non-determinism: temperature > 0 means the model extracts different items on each call.

The `stripExistingWikilinks` pre-pass is supposed to handle idempotency but may not be stripping the inline #tags from the previous annotation pass before reprocessing.

**Fix:**
Add a `stripExistingTags` pre-pass alongside `stripExistingWikilinks`: before sending the note to the LLM, strip all inline `#action`, `#decision`, `#follow-up`, `#delegate` tags from the note body. This ensures the model always sees the clean original text regardless of how many times it's been annotated.

---

## BUG-011 — Double `#action` tag on same sentence after reprocess

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 4 — Reprocess annotated note review
**Severity:** Low — cosmetic, symptom of BUG-010

**Description:**
Reprocessed annotated note shows `#action #decision` on the same sentence: "I need to review them by end of week and give her feedback. #action #decision She also asked me..."

**Observed behaviour:**
`#action #decision` appearing together on one sentence; also `#action` appearing twice on the Memory OS paragraph.

**Expected behaviour:**
One tag per sentence, no duplicates.

**Root cause:**
Direct symptom of BUG-010 — the model sees existing tags from run 1 and adds new ones rather than replacing. Fix BUG-010 (strip tags pre-pass) and this resolves automatically.

**Fix:** Same as BUG-010 — strip inline tags before reprocessing.

---

## BUG-012 — Task deduplication not working: same task written twice on reprocess

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 4.3 — Check Gloria's file after reprocess
**Severity:** High — data corruption, tasks multiply on every reprocess

**Description:**
After reprocessing and approving, Gloria's file shows "Request IA spec for Product Bubbles" twice in `## Talk About`. The dedup guard that works correctly for Recent Mentions is not applied to task writes.

**Observed behaviour:**
`## Talk About` in people/Gloria.md contains the same task entry twice.

**Expected behaviour:**
One entry per task per file. Reprocessing should detect the existing task and skip or replace, not append again.

**Root cause (hypothesis):**
The dedup guard using `[[DD-MM-YYYY]]` line matching is implemented for mention entries in `prependToSection` but task entries use a different write path (tasks-index.json write + possibly a markdown write). The task dedup either isn't implemented or the existing entry isn't being detected.

**Fix:**
Two-part fix:
A. BUG-010 fix (strip tags pre-pass) prevents the extra tasks from being generated in the first place.
B. In tasks-index.json write path: before adding a new task, check for an existing entry with the same `title` + `file` combination from the same source note. If found, skip. Dedup key: `(title, file, sourceNote)`.

---

## BUG-009 — UPDATE: Wikilinks confirmed non-functional in all viewers

**Status:** Open (updated)
**Found:** 2026-06-01
**Update:** 2026-06-01 — confirmed wikilinks do nothing on click across all contexts tested. Not limited to date wikilinks or PersonViewer — appears to be a global wiring failure. The resolver may exist but the click handler is not connected anywhere in the current build.

---

## PHASE 4 RESULT — FAILED on idempotency and task dedup

Recent Mentions dedup: PASSED ✓ (no duplicate mention entries after reprocess)
Task dedup: FAILED ✗ (duplicate task in Gloria's Talk About)
Pipeline idempotency: FAILED ✗ (11 changes on reprocess vs 6 on first run)
Wikilinks: FAILED ✗ (confirmed non-functional)

---

## BUG-013 — [Template — copy for new bugs]

**Status:** Open
**Found:** YYYY-MM-DD
**Test phase:** [Phase number and name from test protocol]
**Severity:** [High / Medium / Low]

**Description:**

**Observed behaviour:**

**Expected behaviour:**

**Root cause (hypothesis):**

**Fix:**

---

## PHASE 5.3 RESULT — People module OFF: PARTIAL PASS

**Recorded:** 2026-06-01

**What passed:**
- Sophie not detected as a person entity in Stage 1 when People module is OFF ✓
- Module flag correctly suppresses person entity extraction ✓

**What failed:**
- "I need to talk with Sophie about weather in Berlin" produced zero tasks after filing
- Expected: one unattached action (People OFF → follow-up/delegate reroutes to unattached action)
- Actual: no task at all — change was dropped rather than rerouted

**Verdict:** Module-aware routing (normaliseChangeForModules) is dropping people-related changes entirely instead of rerouting follow-up/delegate to unattached action.

---

## BUG-013 — People module OFF drops tasks instead of rerouting to unattached action

**Status:** Open
**Found:** 2026-06-01
**Test phase:** Phase 5.3 — People module OFF
**Severity:** High — tasks silently lost when People module is disabled

**Description:**
With People module OFF, a sentence containing a clear follow-up item ("I need to talk with Sophie about weather in Berlin") produced zero tasks after processing and filing. The change was dropped entirely.

**Expected behaviour:**
People OFF + follow-up → reroute to unattached action (target_file: null, module: "unattached"), surface in the writer's own action list or as a floating task.

**Actual behaviour:**
Change dropped. No task written anywhere.

**Root cause (hypothesis):**
`normaliseChangeForModules` is returning null for follow-up/delegate changes when People module is OFF, rather than rerouting them. The null return causes the change to be filtered out before writing. The reroute-to-unattached branch may be missing or not implemented.

**Fix:**
In `normaliseChangeForModules` in `approvalHandler.js`:
- People OFF + marker is `follow-up` or `delegate` → do NOT return null. Instead return the change with `target_file: null`, `module: "unattached"`, `marker: "action"`, keep the title.
- Only `mention` changes should return null (be dropped) when People is OFF.
- Verify the unattached action write path exists in `applyChange` — it must handle `target_file: null` gracefully and write to tasks-index.json with no file reference.

---

## PHASE 6 RESULT — Post-delete navigation: PASSED ✓

**Recorded:** 2026-06-01
Deleting/archiving a file correctly navigates back to Dashboard. No ghost file rendering. ✓

---

## BUG-014 — [Template — copy for new bugs]

**Status:** Open
**Found:** YYYY-MM-DD
**Test phase:**
**Severity:**

**Description:**

**Observed behaviour:**

**Expected behaviour:**

**Root cause (hypothesis):**

**Fix:**

---
