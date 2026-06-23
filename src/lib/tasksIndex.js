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
export const TASKS_INDEX_CHANGED_EVENT = 'memostack:tasks-index-changed'

export function notifyTasksIndexChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TASKS_INDEX_CHANGED_EVENT))
}

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
  notifyTasksIndexChanged()
}

export async function appendTaskEntry(readFile, writeFile, entry) {
  const existing = await readTasksIndex(readFile)
  const candidateTitle = String(entry?.title || '').trim().toLowerCase()
  const candidateFile = String(entry?.file || '').trim().toLowerCase()
  const candidateSource = String(entry?.sourceNote || '').trim().toLowerCase()

  if (candidateTitle && candidateFile && candidateSource) {
    const duplicate = existing.find((task) => {
      const taskTitle = String(task?.title || '').trim().toLowerCase()
      const taskFile = String(task?.file || '').trim().toLowerCase()
      const taskSource = String(task?.sourceNote || '').trim().toLowerCase()
      return taskTitle === candidateTitle && taskFile === candidateFile && taskSource === candidateSource
    })
    if (duplicate) return
  }

  const newEntry = {
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
    sourceNote: entry?.sourceNote ? String(entry.sourceNote) : undefined,
    status: 'open',
    last_updated: new Date().toISOString().split('T')[0],
  }
  await writeTasksIndex(writeFile, [...existing, newEntry])
}

// Batch version of appendTaskEntry — single read/write for multiple steps.
// Deduplicates by file + section + title (plan steps have no sourceNote).
export async function appendTaskEntries(readFile, writeFile, entries) {
  if (!Array.isArray(entries) || !entries.length) return
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().split('T')[0]
  const toAdd = entries
    .filter((entry) => {
      const t = String(entry?.title || '').trim().toLowerCase()
      const f = String(entry?.file || '').trim().toLowerCase()
      const s = entry?.section || ''
      return t && !existing.some((e) =>
        String(e?.title || '').trim().toLowerCase() === t &&
        String(e?.file || '').trim().toLowerCase() === f &&
        e?.section === s
      )
    })
    .map((entry) => ({
      ...entry,
      id: entry.id ?? crypto.randomUUID(),
      status: 'open',
      last_updated: today,
    }))
  if (toAdd.length) await writeTasksIndex(writeFile, [...existing, ...toAdd])
}

export async function resolveTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry.id !== entryId) return entry
    return {
      ...entry,
      status: 'done',
      resolved_at: today,
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function deleteTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  await writeTasksIndex(writeFile, existing.filter((entry) => entry.id !== entryId))
}

export async function unresolveTaskEntry(readFile, writeFile, entryId) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry.id !== entryId) return entry
    const { resolved_at, ...rest } = entry
    return {
      ...rest,
      status: 'open',
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function updateTaskEntry(readFile, writeFile, entryId, patch = {}) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry.id !== entryId) return entry
    const next = { ...entry, last_updated: today }
    if (typeof patch.title === 'string') next.title = patch.title
    if (Array.isArray(patch.tags)) next.tags = patch.tags
    if (typeof patch.section === 'string') next.section = patch.section
    return next
  })
  await writeTasksIndex(writeFile, updated)
}

function cleanEntityWikilinks(text, aliases = []) {
  let out = String(text || '')
  for (const alias of aliases) {
    const safe = String(alias || '').trim()
    if (!safe) continue
    const escaped = safe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const direct = new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, 'gi')
    const piped = new RegExp(`\\[\\[\\s*${escaped}\\s*\\|\\s*([^\\]]+?)\\s*\\]\\]`, 'gi')
    out = out.replace(piped, '$1').replace(direct, safe)
  }
  return out
}

export async function retargetTasksForFile(readFile, writeFile, filePath, nextFilePath) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry.file !== filePath) return entry
    return {
      ...entry,
      file: nextFilePath,
      module: String(nextFilePath || '').split('/')[0] || entry.module,
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function disconnectTasksForFile(readFile, writeFile, filePath, aliases = []) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry.file !== filePath) return entry
    return {
      ...entry,
      file: 'context/tasks-index.json',
      module: 'tasks',
      title: cleanEntityWikilinks(entry.title, aliases),
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function archiveTasksForFile(readFile, writeFile, filePath) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry.file !== filePath) return entry
    return {
      ...entry,
      archived_from_status: entry.status,
      status: 'archived',
      archived_at: today,
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function deleteTasksForFile(readFile, writeFile, filePath) {
  const existing = await readTasksIndex(readFile)
  await writeTasksIndex(writeFile, existing.filter((entry) => entry.file !== filePath))
}

function restoreArchivedStatus(entry) {
  if (entry.status !== 'archived') return entry
  const nextStatus = entry.archived_from_status || 'open'
  const { archived_at, archived_from_status, ...rest } = entry
  return {
    ...rest,
    status: nextStatus,
  }
}

export async function restoreTasksForRecreatedPerson(readFile, writeFile, personFilePath) {
  const existing = await readTasksIndex(readFile)
  const personFilename = String(personFilePath || '').split('/').pop() || ''
  const archivePath = `archive/${personFilename}`
  const today = new Date().toISOString().slice(0, 10)

  const updated = existing.map((entry) => {
    const pointsToArchiveFile = entry.file === archivePath
    const pointsToPersonFile = entry.file === personFilePath
    if (!pointsToArchiveFile && !pointsToPersonFile) return entry

    const restored = restoreArchivedStatus(entry)
    return {
      ...restored,
      file: personFilePath,
      module: 'people',
      last_updated: today,
    }
  })

  await writeTasksIndex(writeFile, updated)
}

// ── Module-level operations ───────────────────────────────────────────────

export function countActiveTasksForModule(entries, moduleId) {
  return (entries || []).filter(
    (e) => e?.module === moduleId && e?.status === 'open'
  ).length
}

export function countArchivedTasksForModule(entries, moduleId) {
  return (entries || []).filter(
    (e) => e?.module === moduleId && e?.status === 'archived'
  ).length
}

export async function archiveTasksForModule(readFile, writeFile, moduleId) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry?.module !== moduleId || entry?.status !== 'open') return entry
    return {
      ...entry,
      archived_from_status: 'open',
      status: 'archived',
      archived_at: today,
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function unattachTasksForModule(readFile, writeFile, moduleId) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry?.module !== moduleId || entry?.status !== 'open') return entry
    return {
      ...entry,
      file: null,
      module: 'unattached',
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function restoreArchivedTasksForModule(readFile, writeFile, moduleId) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  const updated = existing.map((entry) => {
    if (entry?.module !== moduleId || entry?.status !== 'archived') return entry
    const nextStatus = entry.archived_from_status || 'open'
    const { archived_at, archived_from_status, ...rest } = entry
    return {
      ...rest,
      status: nextStatus,
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
}

export async function archiveDoneTasks(readFile, writeFile) {
  const existing = await readTasksIndex(readFile)
  const today = new Date().toISOString().slice(0, 10)
  let count = 0
  const updated = existing.map((entry) => {
    if (entry?.status !== 'done') return entry
    count++
    return {
      ...entry,
      archived_from_status: 'done',
      status: 'archived',
      archived_at: today,
      last_updated: today,
    }
  })
  await writeTasksIndex(writeFile, updated)
  return count
}

export async function deleteArchivedTasks(readFile, writeFile) {
  const existing = await readTasksIndex(readFile)
  const next = existing.filter((e) => e?.status !== 'archived' && e?.status !== 'done')
  const count = existing.length - next.length
  await writeTasksIndex(writeFile, next)
  return count
}

// ─── Plan-section utilities (match by file + section + title, not id) ─────────

export async function setPlanTaskStatus(readFile, writeFile, filePath, sectionName, title, done) {
  const existing = await readTasksIndex(readFile)
  const normalTitle = String(title || '').trim().toLowerCase()
  const today = new Date().toISOString().slice(0, 10)
  let found = false
  const updated = existing.map((e) => {
    if (e?.file !== filePath || e?.section !== sectionName) return e
    if (String(e?.title || '').trim().toLowerCase() !== normalTitle) return e
    found = true
    const base = { ...e, status: done ? 'done' : 'open', last_updated: today }
    if (done) base.resolved_at = today
    else delete base.resolved_at
    return base
  })
  if (found) await writeTasksIndex(writeFile, updated)
}

export async function removePlanTask(readFile, writeFile, filePath, sectionName, title) {
  const existing = await readTasksIndex(readFile)
  const normalTitle = String(title || '').trim().toLowerCase()
  const filtered = existing.filter((e) => {
    if (e?.file !== filePath || e?.section !== sectionName) return true
    return String(e?.title || '').trim().toLowerCase() !== normalTitle
  })
  if (filtered.length !== existing.length) await writeTasksIndex(writeFile, filtered)
}

