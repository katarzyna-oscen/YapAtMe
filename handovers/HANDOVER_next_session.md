# Memory OS — Next Session Handover
*Written at end of session · 2026-05-27*

---

## Where we are

The two-button inbox flow (Process note → File note) is working structurally. Wikilinks apply correctly. IndexedDB tracks processing state. Entity creation happens in Stage 1. The core pipeline is sound.

Three things need fixing before the next feature work.

---

## Fix 1 — Recent Mentions deduplication (HIGH PRIORITY)

**Problem:**
Diana's `## Recent Mentions` section has ~20 duplicate entries from testing. Every "File note" run appended another entry. The `prependToSection` function has no source-deduplication guard.

**Two sources of mentions writing simultaneously:**
1. `extractWikilinkMentionChanges` in `InboxPage.jsx` — deterministic, runs before LLM, copies full raw note paragraph as content (wrong — should be a one-line summary)
2. LLM-generated mention changes — correct short summaries but also prepended every run

**Fix A — Deduplicate by source in `vaultWriter.js` `prependToSection`:**

Before prepending, scan the existing section content for any line containing `Source: [noteFilename]`. If found, replace that line instead of prepending a new one. One entry per source note per person/project file.

```js
export async function prependToSection(readFile, writeFile, filePath, heading, content, sourceFilename) {
  let raw = ''
  try { raw = await readFile(filePath) } catch {}

  if (sourceFilename) {
    const sourceTag = `Source: ${sourceFilename}`
    if (raw.includes(sourceTag)) {
      const lines = raw.split('\n')
      const sourceIdx = lines.findIndex(l => l.includes(sourceTag))
      if (sourceIdx !== -1) {
        lines[sourceIdx] = content
        await writeFile(filePath, lines.join('\n'))
        return
      }
    }
  }

  const lines = raw.split('\n')
  const headingIdx = lines.findIndex(l => l.trim().toLowerCase() === heading.trim().toLowerCase())
  if (headingIdx === -1) {
    await writeFile(filePath, raw.trimEnd() + `\n${heading}\n${content}\n`)
    return
  }
  lines.splice(headingIdx + 1, 0, content)
  await writeFile(filePath, lines.join('\n'))
}
```

Pass `noteFilename` as 6th argument from `applyChange` in `approvalHandler.js`.

**Fix B — Remove `extractWikilinkMentionChanges`:**

Remove this function from `handleFileNote` in `InboxPage.jsx` entirely. The LLM mandatory mention rule already ensures every wikilinked entity gets a mention change. The deterministic version copies raw note paragraphs (wrong quality) and causes duplicates.

**Fix C — Manual cleanup:**

Manually edit `people/Diana.md` and delete all duplicate `## Recent Mentions` entries. Leave one correct entry:
```
27-05-2026 — Met for one-to-one; approved expense report and laptop order; discussed workshop attendance for Mattea, Elaine, and Lyubo. Source: inbox/27-05-2026.md
```

---

## Fix 2 — LLM generates only mentions, no tasks (HIGH PRIORITY)

**Problem:**
Gemma 4 follows the mandatory mention rule but ignores task extraction. All 4 changes returned were `marker: "mention"`. After the mention filter in `handleFileNote`, `mergedResult.changes` is empty. RoutingReview gets nothing.

**Console confirmed:**
```
[Processor] parsed changes: 4   ← all 4 are mentions
[FileNote] changes count: 4     ← filtered to 0 after mention strip
```

**Fix A — Strengthen task extraction in `buildSystemPrompt` in `useNoteProcessor.js`:**

Add alongside the mandatory mention rule:

```
MANDATORY TASK RULE: In addition to mention changes, you MUST also extract task changes.
For every sentence containing:
- something pending or unresolved ("waiting on", "need to", "should", "will", "to be decided")
- a delegation (someone else needs to do something)
- a follow-up required with a person
- a decision that needs to be made

emit a SEPARATE task change with the appropriate marker (action, follow-up, delegate, decision).
Tasks and mentions are PARALLEL — the same sentence must generate BOTH a mention change
AND a task change if it contains actionable content. Never emit only mentions.
```

**Fix B — Fallback in `handleFileNote` in `InboxPage.jsx`:**

Show RoutingReview even when zero task changes are found:

```js
if (mergedResult.changes.length === 0 && autoMentionChanges.length > 0) {
  setProcessNotice('Mentions applied automatically. No tasks found — review and file or add tasks manually.')
}
setRoutingResult(mergedResult)
setShowReview(true)
```

---

## Fix 3 — Note doesn't move to notes/ after filing (MEDIUM PRIORITY)

**Problem:**
`handleDone` prevents note filing when `approvedChangeIds.size === 0`. Note stays in inbox even when user hits Done with zero approvals.

**Fix in `InboxPage.jsx` `handleDone`:**

Remove the zero-approval guard entirely. Note must always move to notes/ when Done is clicked. After moving:
```js
await clearProcessedState(filePath)
setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
```

---

## Format issues (LOW PRIORITY — after fixes 1–3)

Mention format is inconsistent across entries. `formatMentionLine` in `approvalHandler.js` should normalise all variants. Verify it is actually being called — it may have been bypassed when `extractWikilinkMentionChanges` was added.

Target format:
```
DD-MM-YYYY — [one sentence summary]. Source: inbox/DD-MM-YYYY.md
```

---

## Remove debug logging before next release

Remove these from `useNoteProcessor.js` and `InboxPage.jsx`:
- `[Processor] raw LLM response`
- `[Processor] parsed changes`
- `[FileNote] LLM raw result`
- `[FileNote] changes count`
- `[FileNote] noteForLLM length`
- `[FileNote] allowedFiles count`

---

## What is working correctly — do not touch

- Two-button flow: Process note / Reprocess / File note
- IndexedDB processing state (`processedNotes` store in `db.js`)
- Wikilink unescape on save/load (`unescapeWikilinks`)
- `stripExistingWikilinks` in pre-pass (idempotent reprocessing)
- Entity creation in Stage 1 (CleanupModal) before LLM runs
- Sidebar task-handling dialog on delete/archive (`SidebarTaskActionModal`)
- ProjectViewer task-handling dialog on delete/archive
- Button system (`PrimaryButton`, `SecondaryButton`, `IconButton` in `Buttons.jsx`)
- Activity log (`activityLog.js`) and threshold-based rebuild trigger
- `rebuildContext.js` reading index files + activity log
- Dashboard three-card Summaries section (Narrative thread, Current focus, Updates)
- `prependToSection` base logic in `vaultWriter.js`
- `formatMentionLine` in `approvalHandler.js`

---

## Stack reminder

Vite + React · Tailwind · Milkdown (CodeMirror) · File System Access API · IndexedDB · OpenRouter (Gemma 4 / configurable) · `tasks-index.json` single source of truth for tasks
