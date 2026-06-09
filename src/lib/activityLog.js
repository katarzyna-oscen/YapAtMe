const ACTIVITY_LOG_PATH = 'context/activity-log.json'
const DAYS_TO_KEEP = 30

function toIsoNow() {
  return new Date().toISOString()
}

function cutoffIso(days = DAYS_TO_KEEP) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

async function readActivityLogState(readFile) {
  try {
    const raw = await readFile(ACTIVITY_LOG_PATH)
    const parsed = JSON.parse(raw)
    return {
      last_rebuild: parsed?.last_rebuild || null,
      entries: safeArray(parsed?.entries),
    }
  } catch {
    return { last_rebuild: null, entries: [] }
  }
}

async function writeActivityLogState(writeFile, state) {
  const next = {
    last_rebuild: state?.last_rebuild || null,
    entries: safeArray(state?.entries),
  }
  await writeFile(ACTIVITY_LOG_PATH, JSON.stringify(next, null, 2))
}

export async function readActivityLog(readFile) {
  const state = await readActivityLogState(readFile)
  return state.entries
}

export async function pruneActivityLog(readFile, writeFile) {
  const state = await readActivityLogState(readFile)
  const cutoff = cutoffIso(DAYS_TO_KEEP)

  const keep = []
  for (const entry of state.entries) {
    const ts = String(entry?.timestamp || '')
    if (ts && ts >= cutoff) keep.push(entry)
    // Pruned entries are silently dropped — not written to _context_log.md
  }

  await writeActivityLogState(writeFile, {
    last_rebuild: state.last_rebuild,
    entries: keep,
  })

  return keep
}

export async function appendActivityEntry(writeFile, readFile, entry) {
  await pruneActivityLog(readFile, writeFile)
  const state = await readActivityLogState(readFile)

  const normalized = {
    id: entry?.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: entry?.timestamp || toIsoNow(),
    note_source: entry?.note_source || '',
    entities_mentioned: safeArray(entry?.entities_mentioned),
    tasks_created: Number.isFinite(entry?.tasks_created) ? entry.tasks_created : 0,
    decisions: safeArray(entry?.decisions),
    summary: String(entry?.summary || '').trim(),
  }

  const entries = [...state.entries, normalized]
  await writeActivityLogState(writeFile, {
    last_rebuild: state.last_rebuild,
    entries,
  })

  return normalized
}

export async function getEntriesSinceLastRebuild(readFile) {
  const state = await readActivityLogState(readFile)
  const last = state.last_rebuild
  if (!last) return state.entries
  return state.entries.filter((entry) => String(entry?.timestamp || '') > String(last))
}

export async function shouldTriggerRebuild(readFile, threshold = 4) {
  const entries = await getEntriesSinceLastRebuild(readFile)
  return entries.length >= threshold
}

export async function setActivityLogLastRebuild(writeFile, readFile, timestamp = toIsoNow()) {
  const state = await readActivityLogState(readFile)
  await writeActivityLogState(writeFile, {
    last_rebuild: timestamp,
    entries: state.entries,
  })
}
