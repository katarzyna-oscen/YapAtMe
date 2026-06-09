# Patch A — Entity Templates + Task Migration
**Goal:** Strip task checklist sections from entity markdown files. Migrate any existing checkbox items from those sections into `tasks-index.json`. Going forward, entity files only store narrative content — tasks live exclusively in the index.

**Files changed:**
- `src/lib/templates.js` — remove task sections from projects + people templates
- `src/lib/migrateEntityTasks.js` — new migration utility
- `src/core/SettingsPage.jsx` — add "Migrate vault tasks" button

---

## Pre-flight reads

1. `src/lib/templates.js` — read current projects and people cases so you know exactly what to remove
2. `src/lib/frontmatter.js` — confirm `parseFrontmatter(raw)` → `{ fields, body }` and `buildFileContent(fields, body)` signatures
3. `src/core/SettingsPage.jsx` — find where to add the migration button
4. `context/tasks-index.json` — understand the current entry shape: `{ id, file, module, title, section, status, tags, last_updated, comments }`

---

## Step 1 — Update templates.js: remove task sections

Open `src/lib/templates.js`. Replace the `case 'projects':` and `case 'people':` content strings.

### projects

Task sections removed: `## Open Actions`, `## Delegations`, `## Decisions`.  
Kept: `## Summary`, `## Current Plan`, `## Recent Mentions`, `## Notes`.

```js
case 'projects':
  return {
    slug,
    content:
`---
type: project
name: ${name}
status: Untriaged
domain: 
owner: 
core_problem: 
last_updated: ${today}
---

## Summary
_What is this project and why does it matter?_

## Current Plan
_What's the current approach and the immediate next step?_

## Recent Mentions
_Populated by AI._

## Notes
_Observations, raw thoughts, context. AI will use this to keep the project current._
`,
  }
```

### people

Task sections removed: `## Delegate`, `## Talk About`.  
Kept: `## Summary`, `## Related Projects`, `## Recent Mentions`, `## Notes`.

```js
case 'people':
  return {
    slug,
    content:
`---
type: person
full_name: ${name}
relationship: 
role: 
last_updated: ${today}
---

## Summary
_Who is this person and why do they matter to you?_

## Related Projects
_Link projects this person is involved in._

## Recent Mentions
_Populated by AI._

## Notes
_Observations, context, anything worth remembering about this person._
`,
  }
```

### ideas — no change needed

Ideas never had task sections. Leave this case as-is.

---

## Step 2 — Create migrateEntityTasks.js

Create `src/lib/migrateEntityTasks.js`:

```js
// src/lib/migrateEntityTasks.js
// One-time migration: extracts - [ ] / - [x] checkbox items from entity
// markdown files and writes them into tasks-index.json.
// Safe to run multiple times — skips tasks already present in the index.
// After extraction, replaces checkbox lines with placeholder text.

import { parseFrontmatter, buildFileContent } from './frontmatter'

const INDEX_PATH = 'context/tasks-index.json'

// Which sections contain tasks, per folder
const FOLDER_TASK_SECTIONS = {
  projects: ['## Open Actions', '## Delegations', '## Decisions'],
  people:   ['## Delegate', '## Talk About'],
}

// Replacement placeholder per section (shown after task lines are removed)
const SECTION_PLACEHOLDER = {
  '## Open Actions': '_Add tasks directly or let AI route actions from your inbox._',
  '## Delegations':  '_Track what you\'ve delegated. AI will add items from your inbox._',
  '## Decisions':    '_Record decisions here. AI will capture them from your notes._',
  '## Delegate':     '_Tasks you\'ve delegated to this person. AI will add from your inbox._',
  '## Talk About':   '_Topics to raise next time you speak. AI will add from your inbox._',
}

// Section → module field for tasks-index entries
const SECTION_TO_MODULE = {
  '## Open Actions': 'projects',
  '## Delegations':  'projects',
  '## Decisions':    'projects',
  '## Delegate':     'people',
  '## Talk About':   'people',
}

/**
 * parseCheckboxes(body, sectionHeader)
 * Returns array of { text, done } for all checkbox lines under the section.
 */
function parseCheckboxes(body, sectionHeader) {
  const lines   = body.split('\n')
  const results = []
  let inSection = false

  for (const line of lines) {
    if (line.trim() === sectionHeader) { inSection = true; continue }
    if (inSection) {
      if (line.startsWith('## ')) break
      const m = line.match(/^- \[([ xX])\] (.+)/)
      if (m) results.push({ text: m[2].trim(), done: m[1].toLowerCase() === 'x' })
    }
  }
  return results
}

/**
 * removeCheckboxLines(body, sectionHeader)
 * Strips all - [ ] / - [x] lines from the section and replaces with placeholder.
 * Leaves the section header and any non-checkbox, non-empty lines intact.
 */
function removeCheckboxLines(body, sectionHeader) {
  const lines     = body.split('\n')
  const result    = []
  let inSection   = false
  let addedHolder = false

  for (const line of lines) {
    if (line.trim() === sectionHeader) {
      inSection   = true
      addedHolder = false
      result.push(line)
      continue
    }

    if (inSection) {
      if (line.startsWith('## ')) {
        inSection = false
        result.push(line)
        continue
      }

      const isCheckbox = /^- \[([ xX])\] /.test(line)
      const isExistingPlaceholder = /^_.*_$/.test(line.trim())

      if (isCheckbox) {
        // Replace the first checkbox line with placeholder (once per section)
        if (!addedHolder) {
          result.push(SECTION_PLACEHOLDER[sectionHeader] || '')
          addedHolder = true
        }
        // Skip subsequent checkbox lines
        continue
      }

      if (isExistingPlaceholder) {
        // Don't double-add placeholders
        if (!addedHolder) {
          result.push(line)
          addedHolder = true
        }
        continue
      }

      result.push(line)
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

/**
 * migrateEntityTasks({ readFile, writeFile, listTree })
 * Returns a summary: { scanned, migrated, skipped, filesUpdated }
 */
export async function migrateEntityTasks({ readFile, writeFile, listTree }) {
  const today   = new Date().toISOString().slice(0, 10)
  const summary = { scanned: 0, migrated: 0, skipped: 0, filesUpdated: 0 }

  // Load existing index
  let index = []
  try {
    index = JSON.parse(await readFile(INDEX_PATH))
  } catch { /* fresh vault — start with empty index */ }

  const existingTitles = new Set(index.map(e => `${e.file}::${e.title}`))

  // List entity files
  const tree = await listTree()

  for (const [folder, taskSections] of Object.entries(FOLDER_TASK_SECTIONS)) {
    const files = (tree[folder] || []).filter(f =>
      f.name.endsWith('.md') && !f.name.startsWith('_') && !f.name.startsWith('.')
    )

    for (const f of files) {
      const filePath = `${folder}/${f.name}`
      summary.scanned++

      let raw
      try { raw = await readFile(filePath) } catch { continue }

      const { fields, body } = parseFrontmatter(raw)
      let updatedBody  = body
      let fileModified = false

      for (const section of taskSections) {
        const tasks = parseCheckboxes(body, section)
        if (tasks.length === 0) continue

        for (const task of tasks) {
          const key = `${filePath}::${task.text}`
          if (existingTitles.has(key)) {
            summary.skipped++
            continue
          }

          const entry = {
            id:           crypto.randomUUID(),
            file:         filePath,
            module:       SECTION_TO_MODULE[section] ?? folder,
            title:        task.text,
            section,
            status:       task.done ? 'done' : 'open',
            tags:         [],
            last_updated: today,
            comments:     [],
          }

          index.push(entry)
          existingTitles.add(key)
          summary.migrated++
        }

        // Strip checkbox lines from the body
        updatedBody  = removeCheckboxLines(updatedBody, section)
        fileModified = true
      }

      if (fileModified) {
        const cleanedContent = buildFileContent(fields, updatedBody)
        await writeFile(filePath, cleanedContent)
        summary.filesUpdated++
      }
    }
  }

  // Write updated index
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2))

  return summary
}
```

---

## Step 3 — SettingsPage: add migration button

Open `src/core/SettingsPage.jsx`. Find a logical place to add a "Vault maintenance" or "Data" section — below the module toggles is fine.

Add state for migration status:

```js
const [migrating,   setMigrating]   = useState(false)
const [migrateResult, setMigrateResult] = useState(null) // null | { migrated, skipped, filesUpdated }
```

Add import:

```js
import { migrateEntityTasks } from '../lib/migrateEntityTasks'
```

Add the button and result display in the JSX:

```jsx
{/* ── Vault maintenance ───────────────────────────────────────────── */}
<section style={{ marginTop: 32 }}>
  <h2 style={{
    fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-very-dim)',
    margin: '0 0 12px',
  }}>
    Vault maintenance
  </h2>

  <div style={{
    padding: '16px 18px',
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 8,
  }}>
    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
      Migrate entity tasks to index
    </div>
    <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5 }}>
      Moves task checkboxes from project and people files into the central task index.
      Safe to run multiple times — existing tasks are not duplicated.
    </div>

    {migrateResult && (
      <div style={{
        padding: '10px 14px', marginBottom: 12,
        background: 'oklch(0.74 0.14 165 / 0.10)',
        border: '1px solid oklch(0.74 0.14 165 / 0.30)',
        borderRadius: 6, fontSize: 12.5, color: 'var(--text-dim)',
        lineHeight: 1.6,
      }}>
        ✓ Done — {migrateResult.migrated} task{migrateResult.migrated !== 1 ? 's' : ''} migrated,
        {' '}{migrateResult.skipped} already in index,
        {' '}{migrateResult.filesUpdated} file{migrateResult.filesUpdated !== 1 ? 's' : ''} updated
      </div>
    )}

    <button
      onClick={async () => {
        if (migrating) return
        setMigrating(true)
        setMigrateResult(null)
        try {
          const result = await migrateEntityTasks({ readFile, writeFile, listTree })
          setMigrateResult(result)
        } catch (err) {
          console.error('Migration failed:', err.message)
        } finally {
          setMigrating(false)
        }
      }}
      disabled={migrating}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 16px',
        background: migrating ? 'var(--panel-2)' : 'var(--panel-2)',
        color: migrating ? 'var(--text-very-dim)' : 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: 7, fontSize: 13, cursor: migrating ? 'default' : 'pointer',
        fontFamily: 'inherit', transition: 'background .12s, color .12s',
      }}
      onMouseEnter={e => { if (!migrating) { e.currentTarget.style.background = 'var(--panel-pop)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = migrating ? 'var(--text-very-dim)' : 'var(--text-dim)' }}
    >
      {migrating ? 'Migrating…' : 'Run migration'}
    </button>
  </div>
</section>
```

Ensure `readFile`, `writeFile`, `listTree` are available in SettingsPage — they should already be passed as props. If not, confirm the prop interface and add them.

---

## Build check

1. `bun run build` — passes
2. **New project file** — create a project → template shows Summary, Current Plan, Recent Mentions, Notes only. No Open Actions, Delegations, or Decisions sections.
3. **New person file** — create a person → template shows Summary, Related Projects, Recent Mentions, Notes only. No Delegate or Talk About sections.
4. **Migration button** — go to Settings → "Vault maintenance" section visible → "Run migration" button present
5. **Migration dry run (no tasks)** — click Run migration on a fresh vault with no checkbox items → result shows "0 tasks migrated, 0 already in index, 0 files updated"
6. **Migration with tasks** — on a vault with existing entity files containing `- [ ] task text` → click Run migration → result shows correct counts → reopen the entity file → checkbox lines gone, replaced with italic placeholder text → open tasks page → migrated tasks visible in correct categories
7. **Migration idempotency** — run migration a second time → result shows "0 migrated, N already in index" → no duplicates in tasks-index.json → no double placeholders in entity files
8. **Done tasks preserved** — entity files with `- [x] done task` → after migration, those tasks appear in the Done category in TasksPage with `status: 'done'`
