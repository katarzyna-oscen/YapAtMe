# Memory OS — Patch 1 Revision + Patch 1b Handover
*Prepared for Copilot handoff · 2026-05-26*

---

## Context

Two problems surfaced during testing of Patch 1 (deterministic entity pre-pass):

1. **Project over-matching** — every capitalised word is being treated as a potential project candidate, producing false positives like "We", "She", "Slides", "Use" as unknown entities.
2. **Dictation noise entering entity detection** — raw dictated text reaches the pre-pass before the user has corrected it, causing misheard names ("Tiana" instead of "Diana") to be matched or proposed as new entities.

These two patches address both problems. Apply in order. Build and confirm after each.

---

## Patch 1 Revision — Fix project over-matching in the pre-pass

**File:** `src/hooks/useNoteProcessor.js`

**Problem:**
The current pre-pass extracts capitalised phrases from the note and then tries to match them against known project filenames. This is backwards — it generates too many candidates and creates false positives for any capitalised word.

**Fix:**
Reverse the matching direction for projects. Instead of extracting candidates from the note and checking them against the project list, take each known project name from the allow-list and check whether it appears in the note text.

**Exact logic change for project matching (Pass 2):**

```
For each file in allowedFiles that starts with "projects/":
  1. Derive display name using humanizeEntityName(path)
  2. Also derive a slug version (lowercase, remove hyphens/underscores, collapse spaces)
  3. Check if the note text contains either the display name or slug as a substring (case-insensitive)
  4. If found → wikilink that occurrence in the note
  5. If not found → do nothing (do not add to unknownProjects)
```

No capitalised-word extraction for projects at all. Projects are only detected if a known project name actually appears in the note.

**Secondary signal (additive only):**
If the word "project" appears within 5 words of a capitalised phrase that does NOT match any known project name → add that phrase to `unknownProjects`. This handles "we started a new project called Lighthouse" where Lighthouse is genuinely new. This is the only place where free-text extraction is permitted for projects.

**People matching (Pass 1) — also tighten:**
The existing stop words list needs expanding. Add at minimum:
```
'we', 'she', 'he', 'they', 'it', 'use', 'other', 'slides',
'this', 'that', 'these', 'those', 'my', 'your', 'our',
'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
'saturday', 'sunday', 'today', 'tomorrow', 'yesterday'
```
Also add: any word that is a known technology, tool, font, or OS name. Specifically add: `'ubuntu', 'ubuntu sans', 'figma', 'jira', 'slack', 'github', 'notion'`.

**Do not change:** people matching logic beyond stop words, fast-path, dedup, unknown entity propagation.

**Acceptance criteria:**
- A note containing "I showed the new slide templates to Mark" → Mark detected as unknown person (if not in vault), "slide templates" NOT detected as unknown project unless a project named "Slide Templates" exists in allow-list
- "Ubuntu Sans" does not appear as an unknown person
- "We" and "She" do not appear as unknown entities
- A note containing "we started a new project called Lighthouse" → Lighthouse added to unknownProjects

---

## Patch 1b — Stage 1 modal: note cleanup and entity correction

**This is a new UI step inserted before the existing RoutingReview.**

### Overview of the two-stage flow

```
User hits "Process Note"
  → Stage 1: CleanupModal opens
      - Cleaned note text shown (editable)
      - Unknown entities shown as correction chips
      - User corrects, dismisses, or links to existing entities
      - User hits "Looks good, route this"
  → Stage 2: LLM routing runs on corrected note
      - Existing RoutingReview appears with proposed changes
      - Only unresolved unknowns carry through to RoutingReview
```

---

### New component: `CleanupModal`

**File:** `src/components/CleanupModal.jsx`

**Props:**
```js
{
  noteContent: string,          // raw note text
  noteFilename: string,
  unknownPeople: string[],      // from pre-pass
  unknownProjects: string[],    // from pre-pass
  allowedFiles: string[],       // full vault allow-list for autocomplete
  enabledModules: object,       // to filter entity type chips
  onConfirm: (correctedNote, resolvedEntities) => void,
  onCancel: () => void,
}
```

**Layout:**

```
[ Modal header: "Review before routing" ]

[ Note text area — freely editable, pre-filled with noteContent ]

[ Entity corrections section — only shown if unknowns exist ]
  "We found these names — correct, link, or dismiss each:"

  [ Chip per unknown entity ]

[ Footer: Cancel button · "Looks good, route this" button ]
```

---

### Entity correction chip behaviour

One chip per unknown entity. Each chip has:

1. **Editable name field** — pre-filled with the detected name. User can type to correct.
2. **Autocomplete dropdown** — appears as user types. Searches existing vault entities of the matching type only:
   - If classified as `person` → search `people/` filenames, humanized
   - If classified as `project` → search `projects/` filenames, humanized
   - Dropdown shows top 5 matches, ranked by string similarity
3. **State indicator** — one of three states:
   - `create` — name doesn't match any existing entity → "Will create new [type]"
   - `link` — user selected an existing entity from dropdown → "Will link to [name]"
   - `dismissed` — user dismissed → chip greyed out, name left as plain text in note
4. **Dismiss button (×)** — sets chip to `dismissed` state

**Module awareness:**
- If People module is disabled → do not show person chips at all
- If Projects module is disabled → do not show project chips at all

---

### `onConfirm` payload

When user hits "Looks good, route this", call `onConfirm` with:

```js
{
  correctedNote: string,  // current content of the text area (may have been edited)

  resolvedEntities: [
    {
      originalName: 'Tiana',
      correctedName: 'Diana',         // what user typed or selected
      type: 'person',
      resolution: 'link',             // 'create' | 'link' | 'dismissed'
      targetFile: 'people/diana.md',  // populated if resolution === 'link', else null
    },
    ...
  ]
}
```

---

### How correctedNote is prepared before Stage 2

Before passing `correctedNote` to Stage 2 (the LLM routing call), apply the resolved entities:

```
For each resolved entity:
  If resolution === 'link':
    Replace occurrences of originalName in correctedNote with [[correctedName]]
    (case-insensitive, whole-word match only)
  If resolution === 'create':
    Replace occurrences of originalName with [[correctedName]]
    Add to unknown_entities list for RoutingReview creation flow
  If resolution === 'dismissed':
    Leave plain text as-is, do not add to unknown_entities
```

This means by the time the LLM sees the note, all resolved entities are already wikilinked. Dismissed entities are invisible to the LLM.

---

### Wiring CleanupModal into the processing flow

**File:** `src/core/InboxPage.jsx` (or wherever "Process Note" is handled)

Current flow:
```
Process Note clicked → pre-pass → LLM routing → RoutingReview
```

New flow:
```
Process Note clicked
  → pre-pass (people + project matching, existing logic)
  → CleanupModal opens with (noteContent, unknownPeople, unknownProjects)
  → User confirms → correctedNote + resolvedEntities returned
  → Apply entity resolutions to correctedNote (wikilink replacements)
  → LLM routing runs on correctedNote
  → RoutingReview shows (unchanged, existing behaviour)
    → Only 'create'-resolution unknowns appear here
    → 'link' and 'dismissed' unknowns do not appear in RoutingReview
```

**Do not change:** RoutingReview component, the LLM routing call, change approval logic, note move/write flow.

---

### Autocomplete implementation notes

- Source list for autocomplete: derive from `allowedFiles` using `humanizeEntityName`, same as the entity reference block in `buildSystemPrompt`
- Match algorithm: case-insensitive substring match is sufficient, no need for fuzzy matching at this stage
- Dropdown appears after 1 character typed
- Selecting from dropdown sets resolution to `link` and populates `targetFile`
- Clearing the field back to empty resets to `create` state

---

## What is NOT in this handover

- Stage 1 LLM cleanup call for dictation artifacts — the text area is freely editable so the user fixes dictation errors manually. An AI-assisted cleanup pass is a future improvement.
- Fuzzy name matching in autocomplete — substring match is sufficient for now.
- Inline wikilink highlighting in the text area — plain editable textarea is fine for now.
