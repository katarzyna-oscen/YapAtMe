// Marks tasks in tasks-index.json as done/open without removing them.
// Permanent removal is handled by resolveTask.

const INDEX_PATH = 'context/tasks-index.json'

export async function markTaskDone(readFile, writeFile, taskId) {
  let entries = []
  try {
    entries = JSON.parse(await readFile(INDEX_PATH))
  } catch {
    return
  }
  const updated = entries.map((entry) =>
    entry.id === taskId ? { ...entry, status: 'done' } : entry
  )
  await writeFile(INDEX_PATH, JSON.stringify(updated, null, 2))
}

export async function markTaskOpen(readFile, writeFile, taskId) {
  let entries = []
  try {
    entries = JSON.parse(await readFile(INDEX_PATH))
  } catch {
    return
  }
  const updated = entries.map((entry) =>
    entry.id === taskId ? { ...entry, status: 'open' } : entry
  )
  await writeFile(INDEX_PATH, JSON.stringify(updated, null, 2))
}

export async function addTaskComment(readFile, writeFile, taskId, text) {
  let entries = []
  try {
    entries = JSON.parse(await readFile(INDEX_PATH))
  } catch {
    return
  }

  const comment = { id: `c-${Date.now()}`, text, ts: new Date().toISOString() }
  const updated = entries.map((entry) =>
    entry.id === taskId
      ? { ...entry, comments: [...(entry.comments || []), comment] }
      : entry
  )

  await writeFile(INDEX_PATH, JSON.stringify(updated, null, 2))
}
