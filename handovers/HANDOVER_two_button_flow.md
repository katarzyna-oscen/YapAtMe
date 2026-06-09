# Memory OS — Two-Button Inbox Flow + Hashtag Routing
*Prepared for Copilot handoff · 2026-05-26*

---

## Overview

Split the current single "Process note" button into two explicit buttons with a clear state boundary between them. This makes the two-stage architecture visible to the user and enables reliable hashtag-based routing in Stage 2.

Apply in order. Build after each section.

---

## Part 1 — Frontmatter schema for inbox notes

**File:** `src/lib/frontmatter.js` (or wherever frontmatter helpers live)

Add a helper to read and write inbox note frontmatter:

```js
export function readInboxFrontmatter(raw) {
  // Returns { processed, processed_at, tags } or defaults
  const { fields } = parseFrontmatter(raw)
  return {
    processed: fields?.processed === true || fields?.processed === 'true',
    processed_at: fields?.processed_at || null,
    tags: Array.isArray(fields?.tags) ? fields.tags : [],
  }
}

export function buildInboxFrontmatter(existing, patch) {
  // Merges patch into existing fields, returns full frontmatter block
  const fields = {
    ...existing,
    ...patch,
  }
  return fields
}
```

**Frontmatter written after "Process note" completes:**
```yaml
---
processed: true
processed_at: YYYY-MM-DD
tags: [tag1, tag2]
---
[note body with wikilinks applied]
```

`tags` is the list of hashtags detected in the note body during processing (e.g. `action`, `follow-up`, `decision`) — stripped of the `#` prefix.

---

## Part 2 — Two buttons in the inbox top nav

**File:** `src/core/InboxPage.jsx`

### Button states

Replace the current single "Process note" button with two buttons, always visible in the top nav:

**"Process note"**
- Active when: note has content AND `processed !== true` in frontmatter
- Inactive (disabled, visually dimmed) when: note is empty OR already processed
- Clicking runs Stage 1 (CleanupModal flow)

**"File note"**
- Active when: `processed === true` in frontmatter
- Inactive when: `processed !== true`
- Clicking runs Stage 2 (LLM routing → RoutingReview)
- Label: "File note"

### Button rendering

Use `PrimaryButton` from `src/components/ui/Buttons.jsx` for the active button. Use `SecondaryButton` with `disabled` prop for the inactive one. Both buttons always render — never hide either one.

```jsx
<SecondaryButton
  disabled={!canProcess}
  onClick={handleProcessNote}
>
  Process note
</SecondaryButton>

<PrimaryButton
  disabled={!canFile}
  onClick={handleFileNote}
  loading={status === 'processing'}
>
  File note
</PrimaryButton>
```

Where:
```js
const canProcess = hasContent && !isProcessed
const canFile = isProcessed
const isProcessed = inboxFrontmatter?.processed === true
```

### Reading frontmatter on load

When the inbox note loads (in the existing `useEffect` that reads the file), also parse `processed`, `processed_at`, and `tags` from frontmatter using `readInboxFrontmatter`. Store in state:

```js
const [inboxFrontmatter, setInboxFrontmatter] = useState({ processed: false, processed_at: null, tags: [] })
```

---

## Part 3 — "Process note" handler (Stage 1 only)

**File:** `src/core/InboxPage.jsx`

`handleProcessNote` runs the existing Stage 1 flow:
1. Pre-pass: entity detection, wikilink insertion
2. CleanupModal: user reviews, corrects, creates new entities
3. On CleanupModal confirm: create entities, apply wikilinks to note body
4. Detect hashtags in the annotated note body (see Part 5)
5. Write frontmatter to the note:
   ```js
   const today = new Date().toISOString().slice(0, 10)
   const detectedTags = extractHashtags(annotatedBody)
   const newFields = { processed: true, processed_at: today, tags: detectedTags }
   const updatedContent = buildFileContent(newFields, annotatedBody)
   await writeFile(filePath, updatedContent)
   ```
6. Update `inboxFrontmatter` state so "File note" activates immediately
7. Show a subtle notice: "Note processed — review and hit File note when ready"

**"Process note" does NOT:**
- Call the LLM for routing
- Open RoutingReview
- Move the note out of inbox

---

## Part 4 — "File note" handler (Stage 2 only)

**File:** `src/core/InboxPage.jsx`

`handleFileNote` reads the already-processed note and routes it:

1. Read the current note content from disk (it may have been edited since processing)
2. Extract hashtag-tagged lines deterministically (see Part 5)
3. Build the LLM prompt with only the non-deterministic content
4. Call LLM routing
5. Merge deterministic changes + LLM changes into a single `result.changes` array
6. Open RoutingReview
7. On Done: move note from inbox/ to notes/, clear `inboxFrontmatter` state

**"File note" does NOT:**
- Run the pre-pass
- Open CleanupModal
- Create entities

---

## Part 5 — Hashtag hard-routing (deterministic extraction)

**New file:** `src/lib/hashtagRouter.js`

```js
// Maps hashtag to routing target
const HASHTAG_MARKER_MAP = {
  'action':    { marker: 'action',    section: '## Open Actions' },
  'decision':  { marker: 'decision',  section: '## Decisions' },
  'delegate':  { marker: 'delegate',  section: '## Delegate' },
  'follow-up': { marker: 'follow-up', section: '## Talk About' },
  'important': { marker: 'important', section: '## Open Actions' },
  'urgent':    { marker: 'urgent',    section: '## Open Actions' },
}

// Extract all hashtags from note body (returns string[] without #)
export function extractHashtags(noteBody) {
  const matches = String(noteBody || '').match(/#([a-z][a-z0-9_-]*)/gi) || []
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))]
}

// Extract lines that contain a routing hashtag AND a wikilink
// Returns deterministic changes[] ready to merge into routing result
export function extractHashtagChanges(noteBody, noteFilename) {
  const lines = String(noteBody || '').split('\n')
  const changes = []
  const date = (noteFilename || '').replace('inbox/', '').replace('.md', '')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Find routing hashtags on this line
    const tagMatches = [...trimmed.matchAll(/#([a-z][a-z0-9_-]*)/gi)]
    const routingTags = tagMatches
      .map((m) => m[1].toLowerCase())
      .filter((t) => HASHTAG_MARKER_MAP[t])

    if (routingTags.length === 0) continue

    // Find wikilinks on this line — these are the routing targets
    const wikilinkMatches = [...trimmed.matchAll(/\[\[([^\]]+)\]\]/g)]
    if (wikilinkMatches.length === 0) continue

    const tag = routingTags[0] // use first routing tag found
    const { marker, section } = HASHTAG_MARKER_MAP[tag]

    // Clean the line: remove hashtags, trim whitespace
    const cleanLine = trimmed
      .replace(/#[a-z][a-z0-9_-]*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    for (const wikilink of wikilinkMatches) {
      const entityName = wikilink[1]
      // Derive target_file from entity name
      // Person wikilinks → people/, project wikilinks → projects/
      // Use slug conversion
      const slug = entityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      // We don't know folder here — that's resolved by the allow-list check in the caller
      changes.push({
        id: `hashtag-${slug}-${tag}-${Math.random().toString(16).slice(2, 8)}`,
        title: cleanLine,
        content: marker === 'mention'
          ? `${date} — ${cleanLine}. Source: ${noteFilename}`
          : `- [ ] ${cleanLine}`,
        target_file: null, // caller resolves from allow-list
        target_section: section,
        marker,
        entityName, // caller uses this to find target_file
        fromHashtag: true,
      })
    }
  }

  return changes
}

// Resolve target_file for hashtag changes using the allow-list
export function resolveHashtagTargets(hashtagChanges, allowedFiles) {
  return hashtagChanges
    .map((change) => {
      if (!change.entityName) return null
      const slug = change.entityName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      // Try people/ first, then projects/
      const peopleFile = allowedFiles.find((f) => f === `people/${slug}.md`)
      const projectFile = allowedFiles.find((f) => f === `projects/${slug}.md`)
      const targetFile = peopleFile || projectFile

      if (!targetFile) return null // entity not in vault, skip

      return {
        ...change,
        target_file: targetFile,
        module: targetFile.split('/')[0],
        entityName: undefined,
      }
    })
    .filter(Boolean)
}
```

**Wiring into `handleFileNote`:**

```js
const hashtagRaw = extractHashtagChanges(noteBody, filePath)
const hashtagChanges = resolveHashtagTargets(hashtagRaw, allowedFiles)

// Pass to LLM routing — mark these lines so the LLM skips them
const noteForLLM = noteBody // LLM sees full note but prompt tells it hashtag lines are pre-routed

// After LLM returns result:
const allChanges = [
  ...hashtagChanges,
  ...(result?.changes || []).filter((c) => !c.fromHashtag),
]
// Dedupe by content key (same logic as RoutingReview grouping)
result.changes = dedupeChanges(allChanges)
```

Add to the LLM system prompt in `buildSystemPrompt`:
```
Lines containing #action, #decision, #delegate, #follow-up, #urgent, or #important
have already been routed deterministically. Do not generate duplicate changes for
lines that already contain these hashtags.
```

---

## Part 6 — Visual state in the editor

**File:** `src/core/InboxPage.jsx`

When `isProcessed === true`, show a subtle indicator below the top nav:

```jsx
{isProcessed && (
  <div style={{
    padding: '6px 48px',
    fontSize: 11.5,
    color: 'var(--text-very-dim)',
    borderBottom: '1px solid var(--border-subtle)',
    letterSpacing: '0.03em',
  }}>
    ✓ Processed {inboxFrontmatter.processed_at} · ready to file
  </div>
)}
```

---

## What does NOT change

- CleanupModal component — no changes
- RoutingReview component — no changes (already cleaned up)
- approvalHandler.js — no changes
- tasksIndex.js — no changes
- Any other page or component

## Build order

1. Add `readInboxFrontmatter` / `buildInboxFrontmatter` to frontmatter.js → build
2. Create `hashtagRouter.js` → build
3. Split InboxPage into `handleProcessNote` + `handleFileNote` with frontmatter state → build
4. Wire `extractHashtagChanges` into `handleFileNote` → build
5. Add visual state indicator → build
