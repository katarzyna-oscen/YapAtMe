# Memory OS — Bug Fixes: Process Button, Mentions, Format
*Prepared for Copilot handoff · 2026-05-26*

---

## Bug 1 — Process button stays active after processing

**File:** `src/core/InboxPage.jsx`

**Problem:**
Once `processed: true` is written to frontmatter, "Process note" is disabled. The user can't reprocess if they edit the note.

**Fix — button label and active state:**

Replace the current button logic with:

```js
const isProcessed = inboxFrontmatter?.processed === true
const canProcess = hasContent  // always active if note has content
const canFile = isProcessed
const processLabel = isProcessed ? 'Reprocess' : 'Process note'
```

Both buttons always active when the note has content. "Process note" becomes "Reprocess" after first processing. "File note" unlocks after first process and stays unlocked regardless of subsequent reprocessing.

"Reprocess" runs the exact same Stage 1 flow as "Process note". It overwrites the existing frontmatter with fresh `processed_at` and updated `tags`. The note body gets re-annotated with wikilinks (idempotent — existing `[[wikilinks]]` are not double-linked because the pre-pass checks for existing brackets before inserting).

**Do not change:** any other button logic or the Stage 1 flow itself.

---

## Bug 2 — Mentions and tasks are mutually exclusive

**File:** `src/lib/approvalHandler.js`

**Problem:**
The current `if (isTask) { appendTaskEntry } else { appendToSection }` branch means a change either writes to the task index OR to markdown — never both. Mentions generated alongside tasks are dropped.

**Fix — parallel writes:**

Replace the either/or branch with two independent operations:

```js
export async function applyChange(readFile, writeFile, change) {
  if (!change?.target_file || !change?.target_section || !change?.content) return

  // Auto-create entity file if missing
  try {
    await readFile(change.target_file)
  } catch {
    const folder = String(change.target_file).split('/')[0]
    const filename = String(change.target_file).split('/').pop().replace(/\.md$/i, '')
    const displayName = filename.charAt(0).toUpperCase() + filename.slice(1).replace(/-/g, ' ')
    const generated = generateFile(folder, displayName)
    if (generated?.content) {
      await writeFile(change.target_file, generated.content)
    }
  }

  const isTaskSection = TASK_SECTIONS.has(change.target_section)
  const isTask = isTaskSection || isTaskChange(change)
  const isMention = change.target_section === '## Recent Mentions'

  // MENTION: always write to markdown, newest on top
  if (isMention) {
    await prependToSection(
      readFile,
      writeFile,
      change.target_file,
      change.target_section,
      formatMentionLine(change.content, change.noteFilename)
    )
    // Mentions do NOT go to task index
    return
  }

  // TASK: write to task index only (never to markdown)
  if (isTask) {
    const rawTitle = change.title || String(change.content || '').replace(/^-\s*(?:\[[ xX]\]\s*)?/, '')
    const markerTag = String(change.marker || 'action').toLowerCase()
    const combinedText = `${change.title || ''} ${change.content || ''}`.toLowerCase()
    const extraTags = Array.isArray(change.extraTags) ? change.extraTags : []
    const inferredTags = []
    if (/\b(urgent|asap|immediately|critical|blocker)\b/.test(combinedText) && markerTag !== 'urgent') inferredTags.push('urgent')
    if (/\b(important|high-priority|priority)\b/.test(combinedText) && markerTag !== 'important') inferredTags.push('important')

    await appendTaskEntry(readFile, writeFile, {
      file: change.target_file,
      module: change.module || change.target_file.split('/')[0],
      title: normalizeTaskTitle(rawTitle),
      section: change.target_section,
      tags: [...new Set([markerTag, ...extraTags, ...inferredTags])],
    })
    return
  }

  // NON-TASK, NON-MENTION: append to markdown section
  await appendToSection(
    readFile,
    writeFile,
    change.target_file,
    change.target_section,
    change.content
  )
}
```

**Key rule: mentions and tasks are never exclusive.** A sentence can generate both a task change (going to task index) and a mention change (going to ## Recent Mentions). They are processed as separate change objects and both applied.

---

## Bug 3 — Recent mentions format and ordering

**Files:** `src/lib/vaultWriter.js` + `src/lib/approvalHandler.js`

### Problem 1 — Wrong ordering

`appendToSection` adds new content at the bottom of a section. Recent Mentions should be newest-first — each new entry goes directly under the `## Recent Mentions` heading, pushing older entries down.

### Problem 2 — Inconsistent format

The mention content arriving from the LLM is inconsistent. It needs to be normalized to a single canonical format before writing.

### Fix A — Add `prependToSection` to `vaultWriter.js`

```js
export async function prependToSection(readFile, writeFile, filePath, heading, content) {
  let raw = ''
  try { raw = await readFile(filePath) } catch {}

  const lines = raw.split('\n')
  const headingIdx = lines.findIndex(
    (line) => line.trim().toLowerCase() === heading.trim().toLowerCase()
  )

  if (headingIdx === -1) {
    // Section doesn't exist — append it at the end
    const block = `\n${heading}\n${content}\n`
    await writeFile(filePath, raw.trimEnd() + block)
    return
  }

  // Insert content immediately after the heading line
  lines.splice(headingIdx + 1, 0, content)
  await writeFile(filePath, lines.join('\n'))
}
```

### Fix B — Add `formatMentionLine` to `approvalHandler.js`

Normalizes any mention content to the canonical format before writing:

```js
function formatMentionLine(content, noteFilename) {
  const raw = String(content || '').trim()

  // Already correctly formatted: DD-MM-YYYY — summary. Source: filename
  const alreadyFormatted = /^\d{2}-\d{2}-\d{4}\s+—\s+.+\.\s+Source:\s+\S+/.test(raw)
  if (alreadyFormatted) return raw

  // Extract date from note filename (inbox/DD-MM-YYYY.md or inbox/YYYY-MM-DD.md)
  let date = ''
  if (noteFilename) {
    const slug = noteFilename.replace('inbox/', '').replace('.md', '')
    // Handle YYYY-MM-DD → reformat to DD-MM-YYYY
    const isoMatch = slug.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      date = `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`
    } else {
      date = slug // already DD-MM-YYYY or unknown format
    }
  }

  // Strip any existing date prefix from content to avoid duplication
  const stripped = raw
    .replace(/^\d{2}-\d{2}-\d{4}\s*[—-]\s*/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}\s*[—-]\s*/i, '')
    .replace(/\.\s*Source:\s*\S+\s*$/i, '')
    .trim()

  const source = noteFilename || 'unknown'
  const summary = stripped || 'Mentioned in note'

  // Ensure summary ends with a period
  const summaryClean = summary.endsWith('.') ? summary : `${summary}.`

  return `${date} — ${summaryClean} Source: ${source}`
}
```

### Fix C — Pass `noteFilename` through to `applyChange`

`applyChange` needs to know the source note filename to build the mention line. Add it as an optional parameter:

```js
export async function applyChange(readFile, writeFile, change, noteFilename) {
```

In `InboxPage.jsx`, pass `filePath` as the fourth argument wherever `applyChange` is called:
```js
await applyChange(readFile, writeFile, change, filePath)
```

---

## Expected mention output in entity files

After these fixes, `## Recent Mentions` in a person or project file should look like:

```markdown
## Recent Mentions

26-05-2026 — Discussed workshop attendance and whether Lubo should join Friday session. Source: inbox/26-05-2026.md
24-05-2026 — Reviewed hiring data analysis and requested missing information on hired people. Source: inbox/24-05-2026.md
21-05-2026 — Mentioned in context of content system deployment planning. Source: inbox/21-05-2026.md
```

Newest entry always on top. Consistent format. No markdown fences, no duplicated dates, no missing sources.

---

## What does NOT change

- CleanupModal — no changes
- RoutingReview — no changes
- hashtagRouter.js — no changes
- tasksIndex.js — no changes
- Any entity viewer or sidebar

## Build order

1. Add `prependToSection` to `vaultWriter.js` → build
2. Add `formatMentionLine` and update `applyChange` signature in `approvalHandler.js` → build
3. Update `InboxPage.jsx` button label logic + pass `filePath` to `applyChange` → build
