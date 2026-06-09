# Handover 03 — CATCHUP (Missing H03 Files)
**Status:** Ready for immediate implementation  
**Why this exists:** Handover 03 was planned but not applied. Handover 04 (CommandPage, TasksPage, NotesPage, taskResolver) is already in the repo but has no data source — `tasks-index.json` never gets written because the Process Note flow is missing. This document implements all missing H03 files so H04 becomes functional.  
**Prerequisite:** Handover 04 is already applied. Verify `src/core/CommandPage.jsx`, `src/core/TasksPage.jsx`, `src/core/NotesPage.jsx`, and `src/lib/taskResolver.js` exist before starting.  
**Ends with:** The full core loop works. Write a note → click Process → routing review screen → approve → vault files updated, tasks index written, note moved, context rebuilt. CommandPage and TasksPage now show real data.

---

## Files to create (all new)

```
src/
  lib/
    vaultWriter.js        ← NEW
    approvalHandler.js    ← NEW
    rebuildContext.js     ← NEW
  hooks/
    useNoteProcessor.js   ← NEW
  core/
    RoutingReview.jsx     ← NEW
```

## Files to update (surgical — do not rewrite)

```
src/
  core/
    InboxPage.jsx         ← ADD imports + handlers + overlay
  components/
    Sidebar.jsx           ← ADD tombstone filter to filesFor()
```

---

## Pre-flight check — llm.js signature

Before writing any code, open `src/lib/llm.js` and find the `callLLM` export. Check which signature it uses:

```js
// Option A — messages array
callLLM({ settings, messages: [{ role, content }] })

// Option B — systemPrompt / userPrompt
callLLM({ settings, systemPrompt, userPrompt })
// or: callLLM({ apiKey, model, provider, systemPrompt, userPrompt })
```

Note which option it is. In Steps 2 and 4 below, `useNoteProcessor.js` and `rebuildContext.js` both call `callLLM` — use the exact signature from your `llm.js`. The code below uses Option B. If your `llm.js` uses Option A, adapt the callers — do not modify `llm.js` itself.

---

## Step 1 — vaultWriter.js

Create `src/lib/vaultWriter.js` in full:

```js
// src/lib/vaultWriter.js
// Core file-write primitives used by the approval handler.
// Appends content under a specific markdown heading — never overwrites.
// Creates the section heading if it doesn't exist.

/**
 * Appends `content` under `section` heading in `filePath`.
 * If the section heading doesn't exist, appends it to the end of the file.
 *
 * @param {Function} readFile
 * @param {Function} writeFile
 * @param {string}   filePath  — vault-relative e.g. "projects/my-project.md"
 * @param {string}   section   — markdown heading e.g. "## Open Actions"
 * @param {string}   content   — text to append (single line or multiline)
 */
export async function appendToSection(readFile, writeFile, filePath, section, content) {
  let raw = ''
  try {
    raw = await readFile(filePath)
  } catch {
    // File doesn't exist — create it with just the section and content
    await writeFile(filePath, `${section}\n\n${content}\n`)
    return
  }

  const lines = raw.split('\n')
  const sectionIndex = lines.findIndex(l => l.trim() === section.trim())

  if (sectionIndex === -1) {
    // Section not found — append section + content at end of file
    const appended = raw.trimEnd() + `\n\n${section}\n\n${content}\n`
    await writeFile(filePath, appended)
    return
  }

  // Find the end of this section (next heading of same or higher level, or EOF)
  const sectionLevel = (section.match(/^#+/) || [''])[0].length
  let insertAt = lines.length

  for (let i = sectionIndex + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s/)
    if (match && match[1].length <= sectionLevel) {
      insertAt = i
      break
    }
  }

  // Find the last non-empty line before insertAt to avoid blank line accumulation
  let actualInsert = insertAt
  while (actualInsert > sectionIndex + 1 && lines[actualInsert - 1].trim() === '') {
    actualInsert--
  }

  lines.splice(actualInsert, 0, content, '')
  await writeFile(filePath, lines.join('\n'))
}

/**
 * Moves a file from one vault path to another.
 * Used to move processed notes from inbox/ to notes/.
 * File System Access API has no delete — overwrites source with a tombstone.
 */
export async function moveFile(readFile, writeFile, fromPath, toPath) {
  const content = await readFile(fromPath)
  await writeFile(toPath, content)
  // Tombstone — sidebar filters files starting with _moved
  await writeFile(fromPath, `_moved to ${toPath}_\n`)
}
```

---

## Step 2 — useNoteProcessor.js

Create `src/hooks/useNoteProcessor.js` in full:

```js
// src/hooks/useNoteProcessor.js
// Sends the current inbox note to the LLM and returns proposed changes.
// Does NOT write any files — that is the approval handler's job.

import { useState } from 'react'
import { callLLM } from '../lib/llm'
import { MODULE_REGISTRY } from '../lib/modules'

function buildSystemPrompt() {
  const routingRules = MODULE_REGISTRY.flatMap(m =>
    m.matchRules.map(r =>
      `- [${r.marker}]: route to ${m.vaultFolder}/ files under "${r.targetSection}"`
    )
  ).join('\n')

  const moduleList = MODULE_REGISTRY.map(m =>
    `${m.id}: folder="${m.vaultFolder}"`
  ).join(', ')

  return `You are a knowledge routing assistant. You read daily notes and extract structured information into a personal knowledge vault.

Registered modules: ${moduleList}

Routing rules:
${routingRules}
- [mention]: route person mentions to people/ ## Recent Mentions, project mentions to projects/ ## Recent Mentions
- [idea]: route to ideas/backlog.md ## Backlog
- [decision]: route to relevant project ## Decisions
- [delegate]: route to relevant person ## Delegate
- [follow-up]: route to relevant person ## Talk About

Hard rules:
- NEVER write to inbox/ or archive/
- ONLY write to files that exist in the vault (from the allowedFiles list provided)
- Append-only — never suggest overwriting existing content
- Unknown people/projects (not in vault) go in the "unknown" array — do not fabricate file paths
- Annotate sparingly — only annotate sentences that contain clear actionable information
- Recent Mentions format MUST be: "YYYY-MM-DD — [one sentence of context]. Source: inbox/FILENAME.md"
- Preserve original casing of all proper nouns and acronyms exactly as written

Return ONLY valid JSON. No preamble, no markdown fences, no explanation outside the JSON.`
}

function buildUserPrompt(noteContent, contextContent, allowedFiles, noteFilename) {
  return `Today's note filename: ${noteFilename}

Vault context (_context.md):
${contextContent}

Existing vault files (you may only write to these):
${allowedFiles.join('\n')}

Note to process:
${noteContent}

Return JSON in exactly this shape:
{
  "annotated_note": "the original note text with [marker: label] inserted inline after relevant sentences",
  "changes": [
    {
      "id": "unique-id-string",
      "file": "vault-relative/path.md",
      "section": "## Section Heading",
      "content": "exact text to append",
      "marker": "action|decision|delegate|follow-up|idea|mention",
      "reason": "one sentence explaining why"
    }
  ],
  "unknown": [
    { "type": "person|project|idea", "name": "exact name as written" }
  ]
}`
}

export function useNoteProcessor() {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)   // { annotated_note, changes[], unknown[] }
  const [error,  setError]  = useState(null)

  const process = async ({ noteContent, noteFilename, contextContent, allowedFiles, settings }) => {
    setStatus('loading')
    setResult(null)
    setError(null)

    try {
      const raw = await callLLM({
        settings,
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(noteContent, contextContent, allowedFiles, noteFilename),
      })

      // Strip markdown fences if the model wrapped the JSON anyway
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      if (!parsed.changes || !Array.isArray(parsed.changes)) {
        throw new Error('LLM returned unexpected shape — missing changes array')
      }

      // Ensure every change has an id
      parsed.changes = parsed.changes.map(c => ({
        ...c,
        id: c.id || crypto.randomUUID(),
      }))

      setResult(parsed)
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  return { process, status, result, error, reset }
}
```

**Adapt `callLLM` if needed:** if your `llm.js` takes a messages array instead of `systemPrompt`/`userPrompt`, replace the `callLLM` call with:

```js
const raw = await callLLM({
  settings,
  messages: [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user',   content: buildUserPrompt(noteContent, contextContent, allowedFiles, noteFilename) },
  ],
})
```

---

## Step 3 — approvalHandler.js

Create `src/lib/approvalHandler.js` in full:

```js
// src/lib/approvalHandler.js
// Handles a single approved routing change:
//   1. Appends content to the target vault file (section-aware)
//   2. If the marker is task-type, appends to tasks-index.json
// Both writes happen together — no partial state.

import { appendToSection } from './vaultWriter'
import { appendTaskEntry } from './tasksIndex'

// Markers that should also be written to the tasks index
const TASK_MARKERS = ['action', 'delegate', 'decision']

/**
 * @param {Function} readFile
 * @param {Function} writeFile
 * @param {Object}   change
 * @param {string}   change.id
 * @param {string}   change.file
 * @param {string}   change.section
 * @param {string}   change.content
 * @param {string}   change.marker
 * @param {string}   change.reason
 */
export async function applyChange(readFile, writeFile, change) {
  // Safety guard — never write to inbox/ or archive/
  if (change.file.startsWith('inbox/') || change.file.startsWith('archive/')) {
    throw new Error(`Blocked write to protected path: ${change.file}`)
  }

  // 1. Append to target vault file under the specified section
  await appendToSection(readFile, writeFile, change.file, change.section, change.content)

  // 2. If task-type marker, also write to the tasks index
  if (TASK_MARKERS.includes(change.marker)) {
    const moduleId = change.file.split('/')[0] // e.g. "projects" from "projects/foo.md"
    await appendTaskEntry(readFile, writeFile, {
      id:      change.id,
      file:    change.file,
      module:  moduleId,
      title:   change.content.replace(/^- \[ \]\s*/, '').split('\n')[0].slice(0, 120),
      section: change.section,
      tags:    [],
    })
  }
}
```

> **Check `tasksIndex.js` signature:** open `src/lib/tasksIndex.js` and find the `appendTaskEntry` export. Confirm it accepts `(readFile, writeFile, entry)`. If the signature is different, adapt the call above — do not modify `tasksIndex.js`.

---

## Step 4 — rebuildContext.js

Create `src/lib/rebuildContext.js` in full:

```js
// src/lib/rebuildContext.js
// Rebuilds _context.md from the current vault state after note processing.
// Non-fatal — if it throws, the caller should log and continue.

import { callLLM } from './llm'

const CONTEXT_PATH     = 'context/_context.md'
const CONTEXT_LOG_PATH = 'context/_context_log.md'
const MAX_ENTRIES      = 5

/**
 * @param {Function} readFile
 * @param {Function} writeFile
 * @param {Object}   settings  — from useSettings()
 */
export async function rebuildContext(readFile, writeFile, settings) {
  // Read current _context.md for continuity
  let currentContext = ''
  try { currentContext = await readFile(CONTEXT_PATH) } catch {}

  const prompt = `You are rebuilding a working memory context file for a knowledge worker.

Current context:
${currentContext}

Instructions:
- Write a new _context.md with exactly these sections: Current Focus, Active Projects, Standing Decisions, Key People
- Maximum ${MAX_ENTRIES} entries per section
- If a section would exceed ${MAX_ENTRIES} entries, drop the oldest (least recently mentioned)
- Current Focus should be a short narrative paragraph (2-3 sentences) summarising active themes
- Be concise — this file is read at the start of every AI session
- Preserve exact casing of all proper nouns and acronyms

Return ONLY the markdown content of _context.md. No preamble, no fences.`

  const newContext = await callLLM({
    settings,
    systemPrompt: 'You are a precise markdown writer. Return only the requested markdown, nothing else.',
    userPrompt: prompt,
  })

  // Archive what is being replaced
  const date = new Date().toISOString().split('T')[0]
  const logEntry = `\n---\n## Archived ${date}\n\n${currentContext}\n`

  try {
    const existingLog = await readFile(CONTEXT_LOG_PATH)
    await writeFile(CONTEXT_LOG_PATH, existingLog + logEntry)
  } catch {
    await writeFile(CONTEXT_LOG_PATH, `# Context Log\n${logEntry}`)
  }

  await writeFile(CONTEXT_PATH, newContext)
}
```

Same `callLLM` signature note as Step 2 — adapt if your `llm.js` uses a messages array.

---

## Step 5 — RoutingReview.jsx

Create `src/core/RoutingReview.jsx` in full:

```jsx
// src/core/RoutingReview.jsx
// Full-screen overlay showing proposed routing changes as cards.
// User approves or dismisses each individually, or approves all at once.

import { useState } from 'react'

export default function RoutingReview({
  result,          // { annotated_note, changes[], unknown[] }
  onApprove,       // async (change) => void
  onDismiss,       // (changeId) => void
  onDone,          // () => void — called when the user finishes reviewing
  onCreateEntity,  // (unknown) => void — for unknown people/projects
}) {
  const [processing, setProcessing] = useState(new Set())
  const [approved,   setApproved]   = useState(new Set())
  const [dismissed,  setDismissed]  = useState(new Set())

  const pending = result.changes.filter(
    c => !approved.has(c.id) && !dismissed.has(c.id)
  )

  const handleApprove = async (change) => {
    setProcessing(s => new Set(s).add(change.id))
    try {
      await onApprove(change)
      setApproved(s => new Set(s).add(change.id))
    } catch (err) {
      alert(`Failed to apply change: ${err.message}`)
    } finally {
      setProcessing(s => { const n = new Set(s); n.delete(change.id); return n })
    }
  }

  const handleDismiss = (id) => {
    setDismissed(s => new Set(s).add(id))
    onDismiss(id)
  }

  const handleApproveAll = async () => {
    for (const change of pending) {
      await handleApprove(change)
    }
  }

  const allResolved = result.changes.every(
    c => approved.has(c.id) || dismissed.has(c.id)
  )

  return (
    <div className="fixed inset-0 bg-[var(--bg-primary)] z-50 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Review Changes</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {pending.length} pending · {approved.size} approved · {dismissed.size} dismissed
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pending.length > 0 && (
            <button
              onClick={handleApproveAll}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded text-sm hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-colors"
            >
              Approve All
            </button>
          )}
          <button
            onClick={onDone}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded text-sm hover:opacity-90 transition-opacity"
          >
            {allResolved ? 'Done' : 'Done (skip remaining)'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Changes column */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">

          {/* Unknown entities — shown first as warnings */}
          {result.unknown?.map((u, i) => (
            <div key={i} className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-1">
                    Unknown {u.type}
                  </div>
                  <div className="text-sm text-[var(--text-primary)] font-medium">{u.name}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">
                    Not found in vault — create a new {u.type} file?
                  </div>
                </div>
                <button
                  onClick={() => onCreateEntity(u)}
                  className="shrink-0 px-3 py-1.5 text-xs border border-yellow-500/40 text-yellow-400 rounded hover:bg-yellow-500/10 transition-colors"
                >
                  Create {u.type}
                </button>
              </div>
            </div>
          ))}

          {/* Change cards */}
          {result.changes.map(change => {
            const isApproved   = approved.has(change.id)
            const isDismissed  = dismissed.has(change.id)
            const isProcessing = processing.has(change.id)

            return (
              <div
                key={change.id}
                className={`rounded-lg border p-4 transition-opacity
                  ${isApproved  ? 'border-green-500/30 bg-green-500/5 opacity-60' : ''}
                  ${isDismissed ? 'border-[var(--border)] opacity-30' : ''}
                  ${!isApproved && !isDismissed ? 'border-[var(--border)] bg-[var(--bg-sidebar)]' : ''}
                `}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">

                    {/* Marker badge + file path */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${markerColor(change.marker)}`}>
                        {change.marker}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-mono truncate">
                        {change.file}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {'->'} {change.section}
                      </span>
                    </div>

                    {/* Content preview */}
                    <div className="text-sm text-[var(--text-primary)] font-mono bg-[var(--bg-primary)] rounded px-3 py-2 mb-2 whitespace-pre-wrap">
                      {change.content}
                    </div>

                    {/* Reason */}
                    <div className="text-xs text-[var(--text-muted)]">{change.reason}</div>
                  </div>

                  {/* Action buttons */}
                  {!isApproved && !isDismissed && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(change)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {isProcessing ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleDismiss(change.id)}
                        className="px-3 py-1.5 border border-[var(--border)] text-[var(--text-muted)] text-xs rounded hover:text-[var(--text-primary)] transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {isApproved  && <span className="text-green-400 text-xs shrink-0">✓ Applied</span>}
                  {isDismissed && <span className="text-[var(--text-muted)] text-xs shrink-0">Dismissed</span>}
                </div>
              </div>
            )
          })}

          {result.changes.length === 0 && (
            <div className="text-center py-16 text-[var(--text-muted)]">
              No changes proposed for this note.
            </div>
          )}
        </div>

        {/* Annotated note — right panel */}
        <div className="w-80 border-l border-[var(--border)] overflow-y-auto p-6 shrink-0">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Annotated Note
          </h2>
          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
            {result.annotated_note}
          </pre>
        </div>

      </div>
    </div>
  )
}

function markerColor(marker) {
  const map = {
    action:      'bg-blue-500/20 text-blue-300',
    decision:    'bg-purple-500/20 text-purple-300',
    delegate:    'bg-orange-500/20 text-orange-300',
    'follow-up': 'bg-yellow-500/20 text-yellow-300',
    idea:        'bg-green-500/20 text-green-300',
    mention:     'bg-gray-500/20 text-gray-300',
  }
  return map[marker] || 'bg-gray-500/20 text-gray-300'
}
```

---

## Step 6 — Update InboxPage.jsx (surgical — do not rewrite)

Open `src/core/InboxPage.jsx`. Make four targeted changes.

### 6a — Add imports at the top of the file

```js
import { useState } from 'react'  // already imported — skip if present
import { useNoteProcessor } from '../hooks/useNoteProcessor'
import { applyChange } from '../lib/approvalHandler'
import { rebuildContext } from '../lib/rebuildContext'
import { moveFile } from '../lib/vaultWriter'
import RoutingReview from './RoutingReview'
```

### 6b — Add state inside the InboxEditor component (after existing useState calls)

```js
const { process, status, result, error, reset } = useNoteProcessor()
const [showReview, setShowReview] = useState(false)
```

### 6c — Replace the disabled Process Note button

Find the existing disabled `<button>` that says "Process Note". Replace it with:

```jsx
{isInboxFile && (
  <button
    onClick={handleProcess}
    disabled={status === 'loading'}
    className={`px-4 py-1.5 rounded text-sm transition-all
      ${status === 'loading'
        ? 'bg-[var(--accent)] text-white opacity-60 cursor-wait'
        : 'bg-[var(--accent)] text-white hover:opacity-90'
      }`}
  >
    {status === 'loading' ? 'Processing…' : 'Process Note'}
  </button>
)}
```

> If `isInboxFile` doesn't exist in the current InboxPage, check what condition currently guards the button (it may be a different variable name). Use the same condition.

### 6d — Add handler functions inside the InboxEditor component (before the return statement)

```js
const handleProcess = async () => {
  let contextContent = ''
  try { contextContent = await readFile('context/_context.md') } catch {}

  // allowedFiles is empty for now — LLM is instructed not to invent paths.
  // Populated in a later handover via vault index scan.
  const allowedFiles = []

  await process({
    noteContent: content,
    noteFilename: filePath,
    contextContent,
    allowedFiles,
    settings,
  })
  setShowReview(true)
}

const handleApprove = async (change) => {
  await applyChange(readFile, writeFile, change)
}

const handleDismiss = (_changeId) => {
  // Dismissed changes are not applied — no persistence needed at this stage
}

const handleDone = async () => {
  setShowReview(false)

  if (result && filePath) {
    const annotated = result.annotated_note || content
    const notesPath = filePath.replace('inbox/', 'notes/')
    try {
      await moveFile(readFile, writeFile, filePath, notesPath)
      await writeFile(notesPath, annotated)
    } catch (err) {
      console.error('Failed to move note:', err.message)
    }
  }

  try {
    await rebuildContext(readFile, writeFile, settings)
  } catch (err) {
    console.error('Context rebuild failed — non-fatal:', err.message)
  }

  reset()
}

const handleCreateEntity = (unknown) => {
  // Stub — entity creation wired in a later handover
  alert(`Create ${unknown.type}: ${unknown.name} — coming soon`)
}
```

> **Props check:** `handleProcess` uses `content`, `filePath`, `readFile`, `writeFile`, and `settings`. Confirm all five are in scope inside `InboxEditor`. They should be — `content` and `filePath` are editor state, `readFile`/`writeFile` come from `useFileSystem`, `settings` from `useSettings`. If any are missing, check how other handlers in the same component access them and follow the same pattern.

### 6e — Add the overlay and error toast at the bottom of the InboxEditor return (before the closing tag)

```jsx
{showReview && result && (
  <RoutingReview
    result={result}
    onApprove={handleApprove}
    onDismiss={handleDismiss}
    onDone={handleDone}
    onCreateEntity={handleCreateEntity}
  />
)}

{status === 'error' && (
  <div className="fixed bottom-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded shadow-lg z-50">
    Processing failed — check API key in Settings
  </div>
)}
```

---

## Step 7 — Update Sidebar.jsx (one-line change)

Open `src/components/Sidebar.jsx`. Find the function that filters the file tree for display (likely called `filesFor` or similar). Add `!f.name.startsWith('_moved')` to the filter:

```js
// Find this filter — it probably already excludes dotfiles:
.filter(f => !f.name.startsWith('.'))

// Update it to also exclude tombstone files:
.filter(f => !f.name.startsWith('.') && !f.name.startsWith('_moved'))
```

---

## Smoke test

Run through in order. Each step validates a dependency of the next.

1. `npm run dev` (or `bun run dev`) — zero console errors on load
2. Settings — confirm a valid OpenRouter API key is saved
3. Inbox — open today's note, write 3–4 sentences mentioning a person or project name
4. Click **Process Note** — button changes to "Processing…"
5. Routing Review overlay appears — change cards visible with marker badges
6. Approve one change — card shows "✓ Applied"
7. Check vault on disk — the target `.md` file contains the appended content
8. Dismiss one change — card dims, no write happens
9. Click **Done** — overlay closes
10. Inbox note is gone from sidebar (tombstone filter working)
11. Notes page — processed note appears in the left panel; click it to confirm content
12. Command page — approved task appears under its module group
13. Tasks page — same task appears in the list
14. Tick the task resolved — disappears from list; check `archive/tasks_done.md` on disk
15. Check `context/_context.md` on disk — updated content (may be sparse on first run)

---

## Complete file list

```
src/
  lib/
    vaultWriter.js        ← CREATED (Steps 1)
    approvalHandler.js    ← CREATED (Step 3)
    rebuildContext.js     ← CREATED (Step 4)
  hooks/
    useNoteProcessor.js   ← CREATED (Step 2)
  core/
    RoutingReview.jsx     ← CREATED (Step 5)
    InboxPage.jsx         ← UPDATED (Step 6 — surgical additions only)
  components/
    Sidebar.jsx           ← UPDATED (Step 7 — one filter line)
```
