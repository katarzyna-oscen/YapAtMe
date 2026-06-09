# Handover — Patch C: Routing Pipeline Writes Tasks to Index Only
**File to patch:** `src/lib/approvalHandler.js`
**No changes needed to:** `src/hooks/useNoteProcessor.js`, `src/lib/tasksIndex.js`

---

## What changes and why

`applyChange` currently writes task content to **both** the markdown file
(via `appendToSection`) **and** the task index (via `appendTaskEntry`).

After this patch, the routing rule is:

| Change targets a task section | Write to markdown | Write to index |
|---|---|---|
| Yes | ✗ Never | ✓ Always |
| No | ✓ Always | ✗ Never |

Task sections are identified by their heading string, which is authoritative —
the processor already resolves the correct section before `applyChange` is called.
The existing `isTaskChange` marker heuristic is kept as a fallback for edge cases
where content looks like a checkbox but lands in an unrecognised section.

---

## Full replacement for `src/lib/approvalHandler.js`

Replace the entire file:

```js
import { appendToSection } from './vaultWriter'
import { appendTaskEntry } from './tasksIndex'

// Mirrors FOLDER_TASK_SECTIONS in migrateEntityTasks.js.
// These sections are index-only: no checkbox lines are written to markdown.
// If task sections are added or renamed, update both files.
const TASK_SECTIONS = new Set([
  '## Open Actions',
  '## Delegations',
  '## Decisions',
  '## Delegate',
  '## Talk About',
])

function normalizeTaskTitle(raw) {
  let text = String(raw || '').trim()
  if (!text) return text

  // Remove accidental heading/date prefixes leaking from source note context.
  text = text.replace(/^#\s*\d{2}-\d{2}-\d{4}\s+/i, '')
  text = text.replace(/^-\s*\[[ x]\]\s*/i, '')

  // Unescape markdown-escaped wikilinks.
  text = text.replace(/\\\[\[/g, '[[').replace(/\\\]\]/g, ']]')

  // Collapse nested wikilinks such as [[[[Muffin]]]] -> [[Muffin]].
  text = text.replace(/\[\[\[+\s*([^\]]+?)\s*\]+\]\]/g, '[[$1]]')
  text = text.replace(/\[{4,}\s*([^\]]+?)\s*\]{4,}/g, '[[$1]]')

  return text.replace(/\s+/g, ' ').trim()
}

// Fallback: detect task intent from marker/content when section isn't in TASK_SECTIONS.
function isTaskChange(change) {
  const marker = String(change?.marker || '').toLowerCase()
  const content = String(change?.content || '')
  if (/^-\s*\[[ x]\]/i.test(content)) return true
  return ['action', 'urgent', 'important', 'follow-up', 'delegate'].includes(marker)
}

export async function applyChange(readFile, writeFile, change) {
  if (!change?.target_file || !change?.target_section || !change?.content) return

  const isTaskSection = TASK_SECTIONS.has(change.target_section)
  const isTask = isTaskSection || isTaskChange(change)

  if (isTask) {
    // Task changes: index only. Never write checkbox lines to markdown.
    const rawTitle = change.title || String(change.content || '').replace(/^-\s*(?:\[[ xX]\]\s*)?/, '')
    await appendTaskEntry(readFile, writeFile, {
      file: change.target_file,
      module: change.module || change.target_file.split('/')[0],
      title: normalizeTaskTitle(rawTitle),
      section: change.target_section,
      tags: [String(change.marker || 'action').toLowerCase()],
    })
  } else {
    // Non-task changes (mentions, notes, etc.): markdown only. No index entry.
    await appendToSection(
      readFile,
      writeFile,
      change.target_file,
      change.target_section,
      change.content
    )
  }
}
```

---

## What was removed and why

| Removed | Reason |
|---|---|
| `toChecklistContent()` helper | Only served to format `- [ ] text` before writing to markdown. Tasks no longer go to markdown. |
| `appendToSection` call inside the `if (taskChange)` branch | Was the double-write. Now tasks skip markdown entirely. |
| Dual-write pattern | Replaced by a clean if/else: task → index, non-task → markdown. |

---

## What stays the same

- `normalizeTaskTitle` — still cleans up the title before writing to the index
- `isTaskChange` — kept as fallback for checkbox-shaped content landing outside known task sections
- `appendTaskEntry` call shape — unchanged, same fields
- `appendToSection` call shape — unchanged, used only for non-task sections now
- `useNoteProcessor.js` — no changes needed; it still resolves the correct `target_section` before `applyChange` is called

---

## Decisions are now task-index entries

Previously `isTaskChange` did not include `decision` as a marker, so decision
changes were written to `## Decisions` in the markdown file without an index entry.

After this patch, `## Decisions` is in `TASK_SECTIONS`, so decision changes go
to the index only — consistent with the single-source-of-truth architecture.
The decision text lands in the index as a task entry with `section: '## Decisions'`
and `tags: ['decision']`.

---

## Validation checklist

- [ ] Process a note with an action item → task appears in `tasks-index.json`, NOT in the project markdown file
- [ ] Process a note with a delegation → task appears in index under `## Delegations`, NOT in markdown
- [ ] Process a note with a decision → task appears in index under `## Decisions`, NOT in markdown
- [ ] Process a note with a delegate/follow-up to a person → task appears in index, NOT in people markdown
- [ ] Process a note with a `## Recent Mentions` entry → prose appended to markdown file as before, NOT to index
- [ ] Entity markdown files contain no new checkbox lines after processing
- [ ] ProjectViewer task panel (Patch B) shows newly routed tasks immediately after approval
- [ ] `bun run build` passes

---

## Sync note for future patches

`TASK_SECTIONS` in `approvalHandler.js` must stay in sync with `FOLDER_TASK_SECTIONS`
in `migrateEntityTasks.js`. If a task section is ever added or renamed, update both.
Consider extracting to a shared constant in `tasksIndex.js` in a future cleanup pass.
