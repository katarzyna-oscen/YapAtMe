# Handover — TaskPanel + Recent Mentions Format Fix

**Files to patch:**
- `src/core/PersonViewer.jsx` — TaskPanel was never added (Patch B was missed)
- `src/core/ProjectViewer.jsx` — verify TaskPanel is present; apply same fix if missing
- `src/hooks/useNoteProcessor.js` — Recent Mentions format instruction missing from prompt

**No changes to:** `src/lib/vaultWriter.js`, `src/lib/tasksIndex.js`

---

## Fix 1 — PersonViewer: add TaskPanel (Patch B re-apply)

The current file has `tasksVersion` prop and split useEffect but is missing everything
from Patch B. Apply all of the following:

### 1a — Add imports at the top
```js
import TaskPanel from '../components/TaskPanel'
import { readTasksIndex, resolveTaskEntry } from '../lib/tasksIndex'
```

### 1b — Add `tasks` state alongside existing state declarations
```js
const [tasks, setTasks] = useState([])
```

### 1c — Replace `loadStats` entirely

Current version only sets counts. Replace with:
```js
const loadStats = async (path) => {
  try {
    const entries = await readTasksIndex(readFile)
    const mine = Array.isArray(entries)
      ? entries.filter((e) => e?.file === path && e?.status !== 'done')
      : []
    setTasks(mine)
    setDelegateCount(mine.filter((e) => e?.section === '## Delegate').length)
    setTalkAboutCount(mine.filter((e) => e?.section === '## Talk About').length)
  } catch {
    setTasks([])
    setDelegateCount(0)
    setTalkAboutCount(0)
  }
}
```

### 1d — Add resolve handler (after `handleDictate`)
```js
const handleResolveTask = async (id) => {
  await resolveTaskEntry(readFile, writeFile, id)
  await loadStats(filePath)
}
```

### 1e — Mount TaskPanel between metadata row and editor

Find the closing `</div>` of the metadata row (the one containing PillInputs and
count badges) and insert TaskPanel immediately after it, before `milkdown-wrapper`:

```jsx
          </div> {/* end metadata row */}

          <TaskPanel
            tasks={tasks}
            sections={['## Delegate', '## Talk About']}
            onResolve={handleResolveTask}
          />

          {/* Milkdown body — remounts when filePath changes */}
          <div key={filePath} className="milkdown-wrapper">
            <EditorComponent initialValue={editorBody} onChange={handleBodyChange} />
          </div>
```

---

## Fix 2 — ProjectViewer: verify and apply same if missing

Read the current `src/core/ProjectViewer.jsx` and check for:
- `import TaskPanel` at the top
- `const [tasks, setTasks] = useState([])`
- `setTasks(mine)` inside `loadStats`
- `handleResolveTask` function
- `<TaskPanel sections={['## Open Actions', '## Delegations', '## Decisions']} ...>` in the canvas

If any of these are absent, apply the same pattern as Fix 1 with these differences:
- Sections: `['## Open Actions', '## Delegations', '## Decisions']`
- Counts to update in `loadStats`: `setActionsCount` and `setDelegateCount`

Full `loadStats` for ProjectViewer if missing:
```js
const loadStats = async (path) => {
  try {
    const entries = await readTasksIndex(readFile)
    const mine = Array.isArray(entries)
      ? entries.filter((e) => e?.file === path && e?.status !== 'done')
      : []
    setTasks(mine)
    setActionsCount(mine.filter((e) => e?.section === '## Open Actions').length)
    setDelegateCount(mine.filter((e) => e?.section === '## Delegations').length)
  } catch {
    setTasks([])
    setActionsCount(0)
    setDelegateCount(0)
  }
}
```

TaskPanel mount for ProjectViewer (after metadata row, before milkdown-wrapper):
```jsx
<TaskPanel
  tasks={tasks}
  sections={['## Open Actions', '## Delegations', '## Decisions']}
  onResolve={handleResolveTask}
/>
```

---

## Fix 3 — Recent Mentions: add format instruction to system prompt

**File:** `src/hooks/useNoteProcessor.js`
**Function:** `buildSystemPrompt`

The LLM returns bare dates (`2026-05-13 —`) for mention changes because there is
no format instruction in the prompt. Add an explicit rule.

Find the `Rules:` block in the system prompt string and add this rule after
`"- Keep changes concise and specific."`:

```
- For changes targeting "## Recent Mentions": content must follow this exact format:
  "YYYY-MM-DD — [one sentence describing what was discussed, decided, or referenced in relation to this person or project]. Source: [noteFilename]"
  Extract the date from the note filename (inbox/YYYY-MM-DD.md). Never return just a date with no sentence after the dash. The sentence must be specific — not "mentioned in note" but actual context from the note content.
```

Full updated Rules block for reference (insert the new rule after "Keep changes concise"):
```
Rules:
- Use only the content of the current note. Do not use or infer facts from any other vault note, context summary, or prior responses.
- You may match names mentioned in the current note against filenames from the allow list, but only to detect whether an existing person/project/idea file already exists. Do not infer any file contents.
- If the note is empty or has no actionable content, return the note unchanged with an empty changes array and empty unknown_entities.
- Keep annotated_note as markdown.
- Keep changes concise and specific.
- For changes targeting "## Recent Mentions": content must follow this exact format:
  "YYYY-MM-DD — [one sentence describing what was discussed, decided, or referenced]. Source: [noteFilename]"
  Extract the date from the note filename. Never return just a date with no sentence after the dash.
- Use marker values that match intent: action, decision, mention, delegate, follow-up, urgent, important.
- If text explicitly says urgent/important/ASAP, preserve that in marker (urgent or important), not plain action.
- target_section must be one of the standard sections for the target module/file. Never invent headings.
- For people files: default to marker=delegate unless the item is clearly a follow-up/check-in.
- If a file does not exist, return it as unknown_entities instead of inventing a file.
```

---

## Validation checklist

- [ ] Open Sophie's person file → TaskPanel appears between metadata row and editor
- [ ] "Delegate" and "Talk About" sections show with their tasks listed
- [ ] Checking a task removes it from the panel; badge count decrements
- [ ] Process a note that mentions Sophie → Recent Mentions entry shows full sentence, not just date
- [ ] Format: `2026-05-24 — [sentence]. Source: inbox/2026-05-24.md`
- [ ] Open a project file → TaskPanel shows Open Actions / Delegations / Decisions
- [ ] `bun run build` passes
