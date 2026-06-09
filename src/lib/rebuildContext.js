import { callLLM } from './llm'
import { parseFrontmatter } from './frontmatter'
import { readActivityLog, setActivityLogLastRebuild, pruneActivityLog } from './activityLog'

const CONTEXT_PATH = 'context/_context.md'
const CONTEXT_LOG_PATH = 'context/_context_log.md'
const REQUIRED_HEADINGS = [
  'Narrative thread',
  'Current focus',
  'Active projects',
  'Standing decisions',
  'Key people',
]
const ACTIVITY_WINDOW_DAYS = 30

let rebuildInProgress = false
let rebuildStartedAt = 0
const REBUILD_TIMEOUT_MS = 120_000 // 2 minutes — auto-clear stuck mutex

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripMarkdownFences(text) {
  return String(text || '').replace(/```(?:markdown|json)?|```/gi, '').trim()
}

function extractSection(markdown, heading) {
  const text = String(markdown || '')
  const rx = new RegExp(`^##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'im')
  const m = text.match(rx)
  return m?.[1]?.trim() || ''
}

function setSection(markdown, heading, content) {
  const text = String(markdown || '')
  const block = `## ${heading}\n${String(content || '').trim() || 'None currently.'}`
  const rx = new RegExp(`(^##\\s+${heading}\\s*\\n[\\s\\S]*?)(?=\\n##\\s+|$)`, 'im')
  if (rx.test(text)) {
    return text.replace(rx, block)
  }
  return `${text.trim()}\n\n${block}`.trim()
}

function repairContextStructure(content) {
  let out = stripMarkdownFences(content)
  if (!out.trim()) out = ''
  for (const heading of REQUIRED_HEADINGS) {
    const section = extractSection(out, heading)
    if (!section) {
      out = setSection(out, heading, 'None currently.')
    }
  }
  return out.trim()
}

function validateContextStructure(content) {
  const text = String(content || '')
  for (const heading of REQUIRED_HEADINGS) {
    const rx = new RegExp(`^##\\s+${heading}\\s*$`, 'gim')
    const matches = text.match(rx) || []
    if (matches.length !== 1) {
      return { valid: false, reason: `Heading "${heading}" must appear exactly once` }
    }
    const section = extractSection(text, heading)
    if (!section || !section.trim()) {
      return { valid: false, reason: `Heading "${heading}" must contain content` }
    }
  }
  return { valid: true, reason: '' }
}

function formatActivityEntries(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return '(none)'
  const cutoff = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000).toISOString()
  const recent = entries
    .filter((e) => String(e?.timestamp || '') >= cutoff)
    .sort((a, b) => String(b?.timestamp || '').localeCompare(String(a?.timestamp || '')))
    .slice(0, 30)
  if (recent.length === 0) return '(none in last 30 days)'
  return recent
    .map((entry) => {
      const ts = String(entry?.timestamp || '').slice(0, 10)
      const src = String(entry?.note_source || 'unknown')
      const entities = Array.isArray(entry?.entities_mentioned) && entry.entities_mentioned.length > 0
        ? entry.entities_mentioned.join(', ')
        : 'none'
      const tasks = Number.isFinite(entry?.tasks_created) ? entry.tasks_created : 0
      const summary = String(entry?.summary || '').trim() || 'no summary'
      return `- ${ts} | ${src} | entities: ${entities} | tasks: ${tasks} | ${summary}`
    })
    .join('\n')
}

function parseRebuildResponse(raw) {
  const text = stripMarkdownFences(raw)

  const contextMatch = text.match(/===CONTEXT===\s*([\s\S]*?)(?:===REMOVED===|===END===|$)/i)
  const removedMatch = text.match(/===REMOVED===\s*([\s\S]*?)(?:===END===|$)/i)

  // Fallback: if no delimiters, treat entire response as context
  const contextContent = contextMatch?.[1]?.trim() || text
  const removedText = removedMatch?.[1]?.trim() || ''

  const removedItems = removedText
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0 && line !== '(none)' && line !== 'none')

  return { contextContent, removedItems }
}

// ── Entity name sanitizer ────────────────────────────────────────────────────

// Build a map of normalised-name → exact-name so we can fix LLM output that
// drops special chars (e.g. "Ubuntucom" → "Ubuntu.com Home Page Revamp").
function buildEntityNameMap(exactNames) {
  const map = new Map()
  for (const exact of exactNames) {
    if (!exact) continue
    const normalized = exact.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
    // Only add if normalization actually changes the name (i.e. special chars exist)
    if (normalized && normalized !== exact.toLowerCase()) {
      map.set(normalized, exact)
    }
  }
  return map
}

function sanitizeEntityNames(text, entityNameMap) {
  let result = text
  for (const [normalized, exact] of entityNameMap) {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'gi'), exact)
  }
  return result
}

// ── Index file builders ──────────────────────────────────────────────────────

async function rebuildIndexFiles(readFile, writeFile, listTree) {
  if (typeof listTree !== 'function') return new Map()

  let tree = []
  try { tree = await listTree() } catch { return new Map() }

  const getFolder = (folder) => {
    if (Array.isArray(tree)) {
      const dir = tree.find((e) => e?.kind === 'directory' && e.name === folder)
      return (dir?.children || []).filter((e) => e?.kind === 'file' && e.name?.endsWith('.md') && !e.name.startsWith('_') && !e.name.startsWith('.'))
    }
    return (tree?.[folder] || []).filter((e) => e.name?.endsWith('.md') && !e.name.startsWith('_') && !e.name.startsWith('.'))
  }

  const today = new Date().toISOString().slice(0, 10)
  const exactEntityNames = []

  // Projects index
  try {
    const projectFiles = getFolder('projects')
    const lines = []
    for (const f of projectFiles) {
      try {
        const raw = await readFile(f.path || `projects/${f.name}`)
        const { fields } = parseFrontmatter(raw)
        const name = String(fields?.name || f.name.replace(/\.md$/i, '')).trim()
        exactEntityNames.push(name)
        const status = String(fields?.status || '').trim()
        const domain = String(fields?.domain || '').trim()
        const owner = String(fields?.owner || '').trim()
        const coreProblem = String(fields?.core_problem || '').trim()
        const lastUpdated = String(fields?.last_updated || '').trim()
        const parts = [`**${name}**`]
        if (status) parts.push(`status: ${status}`)
        if (domain) parts.push(`domain: ${domain}`)
        if (owner) parts.push(`owner: ${owner}`)
        if (coreProblem) parts.push(`core_problem: ${coreProblem}`)
        if (lastUpdated) parts.push(`last_updated: ${lastUpdated}`)
        lines.push(`- ${parts.join(' | ')}`)
      } catch {}
    }
    const content = `# Projects Index\n*Last updated: ${today}*\n\n${lines.length ? lines.join('\n') : '_No projects found._'}\n`
    await writeFile('context/projects-index.md', content)
  } catch {}

  // People index
  try {
    const peopleFiles = getFolder('people')
    const lines = []
    for (const f of peopleFiles) {
      try {
        const raw = await readFile(f.path || `people/${f.name}`)
        const { fields } = parseFrontmatter(raw)
        const name = String(fields?.full_name || f.name.replace(/\.md$/i, '')).trim()
        exactEntityNames.push(name)
        const relationship = String(fields?.relationship || '').trim()
        const role = String(fields?.role || '').trim()
        const lastUpdated = String(fields?.last_updated || '').trim()
        const parts = [`**${name}**`]
        if (relationship) parts.push(`relationship: ${relationship}`)
        if (role) parts.push(`role: ${role}`)
        if (lastUpdated) parts.push(`last_updated: ${lastUpdated}`)
        lines.push(`- ${parts.join(' | ')}`)
      } catch {}
    }
    const content = `# People Index\n*Last updated: ${today}*\n\n${lines.length ? lines.join('\n') : '_No people found._'}\n`
    await writeFile('context/people-index.md', content)
  } catch {}

  // Ideas index
  try {
    const ideasFiles = getFolder('ideas')
    const lines = []
    for (const f of ideasFiles) {
      try {
        const raw = await readFile(f.path || `ideas/${f.name}`)
        const { fields } = parseFrontmatter(raw)
        const stem = f.name.replace(/\.md$/i, '')
        const name = String(fields?.name || stem).trim()
        exactEntityNames.push(name)
        const status = String(fields?.status || '').trim()
        const domain = String(fields?.domain || '').trim()
        const tags = Array.isArray(fields?.tags) ? fields.tags.join(', ') : String(fields?.tags || '').trim()
        const lastUpdated = String(fields?.last_updated || '').trim()
        const parts = [`**${name}**`]
        if (status) parts.push(`status: ${status}`)
        if (domain) parts.push(`domain: ${domain}`)
        if (tags) parts.push(`tags: ${tags}`)
        if (lastUpdated) parts.push(`last_updated: ${lastUpdated}`)
        lines.push(`- ${parts.join(' | ')}`)
      } catch {}
    }
    const content = `# Ideas Index\n*Last updated: ${today}*\n\n${lines.length ? lines.join('\n') : '_No ideas found._'}\n`
    await writeFile('context/ideas-index.md', content)
  } catch {}

  return buildEntityNameMap(exactEntityNames)
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function rebuildContext(readFile, writeFile, settings, listTree) {
  const now = Date.now()
  if (rebuildInProgress && (now - rebuildStartedAt) < REBUILD_TIMEOUT_MS) {
    console.warn('rebuildContext skipped: rebuild already in progress')
    return
  }

  rebuildInProgress = true
  rebuildStartedAt = now

  try {
    // ── Step 1: Gather inputs ───────────────────────────────────────────────

    let currentContext = ''
    try { currentContext = await readFile(CONTEXT_PATH) } catch {}

    // Rebuild index files from entity folders before reading them into the prompt
    let entityNameMap = new Map()
    try {
      entityNameMap = await rebuildIndexFiles(readFile, writeFile, listTree) ?? new Map()
    } catch (err) {
      console.warn('rebuildIndexFiles failed (non-fatal):', err?.message || err)
    }

    let projectsIndex = '', peopleIndex = '', ideasIndex = ''
    try { projectsIndex = await readFile('context/projects-index.md') } catch {}
    try { peopleIndex = await readFile('context/people-index.md') } catch {}
    try { ideasIndex = await readFile('context/ideas-index.md') } catch {}

    let allEntries = []
    try { allEntries = await readActivityLog(readFile) } catch {}
    const activityText = formatActivityEntries(allEntries)

    const cutoff14 = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    // ── Step 2: LLM curation pass ───────────────────────────────────────────

    const systemPrompt = `You are curating a working memory file for a knowledge worker. Current context and recent activity are provided. Your job:
1. Keep items that have been actively touched in the last 14 days
2. Remove items with no activity in 14+ days — return them in a 'removed' list with a one-line reason
3. Resurface items if they appear in recent notes (check for name matches in activity log)
4. Enforce max 5 items per section: Narrative thread (narrative only), Current focus (top priorities right now), Active projects, Standing decisions, Key people
5. Write _context.md as clean markdown. Be selective — only what matters right now.
6. Entity names must be preserved exactly as they appear in the source files, including dots, hyphens, and special characters. For example: Ubuntu.com Home Page Revamp, NOT Ubuntucom Home Page Revamp. Never normalise or alter entity names.`

    const userPrompt = `Today's date: ${today}
14-day cutoff: ${cutoff14}

Current _context.md:
${currentContext || '(empty — generate fresh from available data)'}

Recent activity log (last 30 days, newest first):
${activityText}

Projects index (with last_updated dates):
${projectsIndex || '(missing)'}

People index (with last_updated dates):
${peopleIndex || '(missing)'}

Ideas index (with last_updated dates):
${ideasIndex || '(missing)'}

Output format — use EXACTLY these delimiters, no exceptions:

===CONTEXT===
## Narrative thread
[narrative paragraph only — 2–4 sentences about the overall situation right now. No bullet lists.]

## Current focus
[max 3 bullets — the single most important priorities or next actions right now. What should be worked on today/this week.]

## Active projects
[max 5 projects with recent activity or status In Progress / Blocked. One bullet per project.]

## Standing decisions
[max 5 decisions relevant to active work. Add new ones from recent activity if any.]

## Key people
[max 5 people who appear in recent activity. One bullet per person with why they are relevant right now.]

===REMOVED===
[One line per removed item: "item text | reason it was removed". If nothing removed, write exactly: (none)]

===END===`

    const raw = await callLLM(
      [{ role: 'user', content: userPrompt }],
      systemPrompt,
      settings
    )

    // ── Step 3: Parse, repair, validate ────────────────────────────────────

    const { contextContent, removedItems } = parseRebuildResponse(raw)

    // Fix LLM-normalised entity names (e.g. "Ubuntucom" → "Ubuntu.com")
    const sanitizedContent = sanitizeEntityNames(contextContent, entityNameMap)
    console.log('[rebuildContext] entity name map size:', entityNameMap.size)

    const repairedContext = repairContextStructure(sanitizedContent)
    const validation = validateContextStructure(repairedContext)
    if (!validation.valid) {
      console.warn(`Context rebuild validation failed. Keeping existing context. Reason: ${validation.reason}`)
      return
    }

    // ── Step 4: Write outputs ───────────────────────────────────────────────

    await writeFile(CONTEXT_PATH, repairedContext)

    // Append ONLY removed items — skip entirely if nothing was removed
    if (removedItems.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const logBlock = `\n## Rebuild ${timestamp} — ${removedItems.length} item${removedItems.length === 1 ? '' : 's'} removed\n${removedItems.map((item) => `- ${item}`).join('\n')}\n`
      let existingLog = ''
      try { existingLog = await readFile(CONTEXT_LOG_PATH) } catch {}
      await writeFile(CONTEXT_LOG_PATH, `${existingLog || '# Context Log'}${logBlock}`)
    }

    // ── Step 5: Bookkeeping ─────────────────────────────────────────────────

    try {
      await setActivityLogLastRebuild(writeFile, readFile)
    } catch (err) {
      console.warn('Failed to update activity log last_rebuild timestamp:', err?.message || err)
    }

    try {
      await pruneActivityLog(readFile, writeFile)
    } catch (err) {
      console.warn('Failed to prune activity log:', err?.message || err)
    }
  } finally {
    rebuildInProgress = false
  }
}

