# H09 Iteration Addendum

## Task resolution contract

### `src/lib/tasksIndex.js` — separate functions

```js
// Mark done — keeps entry, adds timestamp. Used by checkbox in TaskPanel + dashboard.
export async function resolveTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map(e =>
    e.id === entryId
      ? { ...e, status: 'done', resolved_at: today }
      : e
  )
  await writeTasksIndex(writeFile, updated)
}

// Permanently delete — no trace. Used by explicit remove action.
export async function deleteTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  await writeTasksIndex(writeFile, existing.filter(e => e.id !== entryId))
}

// Un-resolve — clears done status and resolved_at.
export async function unresolveTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  const updated = existing.map(e => {
    if (e.id !== entryId) return e
    const { resolved_at, ...rest } = e
    return { ...rest, status: 'open' }
  })
  await writeTasksIndex(writeFile, updated)
}
```

### Updates column read rules

Use only tasks matching:
- `status === 'done'`
- `resolved_at === yesterday`

Implications:
- Tasks removed via `deleteTaskEntry` never appear.
- Tasks un-resolved via `unresolveTaskEntry` lose `resolved_at` and will not match.

### Bulk remove warning

Wherever a bulk remove action exists, show this warning before execute:

```txt
Removed tasks are permanently deleted and won't appear in your daily Updates. Mark as done instead to keep a record. Continue?
```

Bulk remove must call `deleteTaskEntry` per item, not `resolveTaskEntry`.

### Open task lists

Dashboard open task lists continue to filter with `status !== 'done'`.
