// Write-through task index. Written at approval time, read by Tasks screen and Dashboard.
// The AI never re-reads all project files to build the task list —
// only reads files that changed since last routing.
//
// IndexEntry shape:
// {
//   id:           string   — crypto.randomUUID() at write time
//   file:         string   — vault-relative path e.g. "projects/my-project.md"
//   module:       string   — module id e.g. "projects"
//   title:        string   — display text of the task
//   section:      string   — source section e.g. "## Open Actions"
//   status:       string   — "open" | "done"
//   tags:         string[] — tags present on this entry
//   last_updated: string   — ISO date YYYY-MM-DD
// }
//
// Storage: context/tasks-index.json in the vault

export const TASKS_INDEX_PATH = 'context/tasks-index.json'

export async function readTasksIndex(readFile) {
  try {
    const raw = await readFile(TASKS_INDEX_PATH)
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function writeTasksIndex(writeFile, entries) {
  await writeFile(TASKS_INDEX_PATH, JSON.stringify(entries, null, 2))
}

export async function appendTaskEntry(readFile, writeFile, entry) {
  const existing = await readTasksIndex(readFile)
  const newEntry = {
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
    status: 'open',
    last_updated: new Date().toISOString().split('T')[0],
  }
  await writeTasksIndex(writeFile, [...existing, newEntry])
}

export async function resolveTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  const updated = existing.map((entry) => {
    if (entry.id !== entryId) return entry
    return {
      ...entry,
      status: 'done',
      last_updated: new Date().toISOString().split('T')[0],
    }
  })
  await writeTasksIndex(writeFile, updated)
}
