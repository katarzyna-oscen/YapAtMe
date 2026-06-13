import { callLLM } from './llm'
import { parseFrontmatter } from './frontmatter'
import { readActivityLog, setActivityLogLastRebuild, pruneActivityLog } from './activityLog'
import { dbGet, dbPut } from './db'
import { extractTagsFromMarkdown, mergeTagsIntoIndex } from './tags'

const CONTEXT_PATH = 'context/_context.md'
const CONTEXT_LOG_PATH = 'context/_context_log.md'
const CONTEXT_LOG_MIGRATION_KEY = 'contextLogMigrated_v1'
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

// ── Context log helpers ───────────────────────────────────────────────────────

let _contextLogMigrated = false

// Extract compare key from a context text block (Current focus + Active projects)
function extractLogCompareKey(text) {
  const focus = extractSection(text, 'Current focus').replace(/\s+/g, ' ').trim()
  const projects = extractSection(text, 'Active projects').replace(/\s+/g, ' ').trim()
  return `${focus}|||${projects}`
}

// Split a _context_log.md file into its archived blocks
function splitLogBlocks(logText) {
  return String(logText || '')
    .split(/\n---\n(?=## Archived)/i)
    .map((b) => b.trim())
    .filter(Boolean)
}

// Append a new context snapshot to _context_log.md, skipping if identical to last block
async function appendToContextLog(readFile, writeFile, newContextContent) {
  let existingLog = ''
  try { existingLog = await readFile(CONTEXT_LOG_PATH) } catch {}

  const newKey = extractLogCompareKey(newContextContent)

  if (newKey && newKey !== '|||') {
    const blocks = splitLogBlocks(existingLog)
    if (blocks.length > 0) {
      const lastKey = extractLogCompareKey(blocks[blocks.length - 1])
      if (lastKey === newKey) {
        console.log('[rebuildContext] context log dedup: skipping identical block')
        return
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  const block = `## Archived ${date}\n${newContextContent}`
  const base = existingLog.trimEnd() || '# Context Log'
  await writeFile(CONTEXT_LOG_PATH, `${base}\n\n---\n${block}\n`)
}

// One-time migration: dedup + cap at 20 blocks in _context_log.md
async function trimContextLog(readFile, writeFile) {
  if (_contextLogMigrated) return

  try {
    const done = await dbGet('settings', CONTEXT_LOG_MIGRATION_KEY)
    if (done) { _contextLogMigrated = true; return }
  } catch {}

  try {
    const raw = await readFile(CONTEXT_LOG_PATH)
    const blocks = splitLogBlocks(raw)

    const seen = new Set()
    const deduped = []
    for (const block of blocks) {
      const key = extractLogCompareKey(block)
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(block)
    }

    const capped = deduped.slice(0, 20)
    const removed = blocks.length - capped.length
    if (removed > 0) {
      console.log(`[trimContextLog] removed ${removed} duplicate/excess blocks from _context_log.md`)
    }

    const body = capped.map((b) => `---\n${b}`).join('\n\n')
    await writeFile(CONTEXT_LOG_PATH, `# Context Log\n\n${body}\n`)
  } catch (err) {
    console.warn('[trimContextLog] failed (non-fatal):', err?.message || err)
  }

  try { await dbPut('settings', CONTEXT_LOG_MIGRATION_KEY, true) } catch {}
  _contextLogMigrated = true
}

// ── Index file builders ──────────────────────────────────────────────────────

function extractSectionBody(markdown, heading) {
  const rx = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i')
  return markdown.match(rx)?.[1] || ''
}

function parseRecentMention(markdown) {
  const body = extractSectionBody(markdown, 'Recent Mentions')
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    // [[DD-MM-YYYY]] — summary  or  DD-MM-YYYY — summary
    const m = line.match(/^-?\s*(?:\[\[)?(\d{2}-\d{2}-\d{4})(?:\]\])?\s*[—–-]+\s*(.+)/)
    if (m) return { date: m[1], summary: m[2].trim() }
  }
  return null
}

function parseIdeaSummary(markdown) {
  const lines = String(markdown || '').split('\n')
  let inSummary = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+Summary\s*$/i.test(trimmed)) { inSummary = true; continue }
    if (!inSummary) continue
    if (/^##\s/.test(trimmed)) return null  // hit next section heading — stop
    if (!trimmed) continue  // empty line
    if (/^_.*_$/.test(trimmed)) continue  // italic placeholder
    if (trimmed.startsWith('_')) continue
    return trimmed
  }
  return null
}

function humanizeName(filename) {
  return filename
    .replace(/\.md$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Resolve display name: frontmatter title → other frontmatter keys → H1 → truncated slug
// Any resolved name longer than 60 chars is truncated with …
function resolveDisplayName(fields, body, filename, ...altKeys) {
  const cap = (str) => str.length > 60 ? str.slice(0, 59) + '\u2026' : str

  const title = String(fields?.title || '').trim()
  if (title) return cap(title)
  for (const key of altKeys) {
    const val = String(fields?.[key] || '').trim()
    if (val) return cap(val)
  }
  const h1 = String(body || '').match(/^#\s+(.+)$/m)?.[1]?.trim()
  if (h1) return cap(h1)
  return cap(humanizeName(filename))
}

export async function rebuildIndexFiles(readFile, writeFile, listTree) {
  if (typeof listTree !== 'function') return { changed: false, entityNameMap: new Map() }

  let tree = []
  try { tree = await listTree() } catch { return { changed: false, entityNameMap: new Map() } }

  let changed = false

  // Write only when content has changed; set `changed` flag if any file differs
  async function writeIfChanged(path, content) {
    let existing = ''
    try { existing = await readFile(path) } catch {}
    if (existing === content) return
    await writeFile(path, content)
    changed = true
  }

  const getFolder = (folder) => {
    if (Array.isArray(tree)) {
      const dir = tree.find((e) => e?.kind === 'directory' && e.name === folder)
      return (dir?.children || []).filter((e) => e?.kind === 'file' && e.name?.endsWith('.md') && !e.name.startsWith('_') && !e.name.startsWith('.'))
    }
    return (tree?.[folder] || []).filter((e) => e.name?.endsWith('.md') && !e.name.startsWith('_') && !e.name.startsWith('.'))
  }

  const today = new Date().toISOString().slice(0, 10)
  const exactEntityNames = []

  // Read tasks index once for all counts
  let taskEntries = []
  try {
    const raw = await readFile('context/tasks-index.json')
    taskEntries = JSON.parse(raw)
  } catch {}

  function countTasks(filePath, section) {
    return taskEntries.filter(
      (e) => e?.file === filePath && e?.status === 'open' && e?.section === section
    ).length
  }

  // ── People index ────────────────────────────────────────────────────────────
  try {
    const peopleFiles = getFolder('people')
    const entries = []
    for (const f of peopleFiles) {
      try {
        const fp = f.path || `people/${f.name}`
        const raw = await readFile(fp)
        const { fields, body } = parseFrontmatter(raw)
        const name = resolveDisplayName(fields, body, f.name, 'full_name', 'name')
        exactEntityNames.push(name)

        const role = String(fields?.role || '').trim()
        const relationship = String(fields?.relationship || '').trim()
        const delegates = countTasks(fp, '## Delegate')
        const talkAbout = countTasks(fp, '## Talk About')
        const mention = parseRecentMention(body)

        const lines = [`## ${name}`]
        if (role || relationship) {
          const parts = []
          if (role) parts.push(`Role: ${role}`)
          if (relationship) parts.push(`Relationship: ${relationship}`)
          lines.push(parts.join(' · '))
        }
        if (delegates > 0 || talkAbout > 0) {
          const parts = []
          if (delegates > 0) parts.push(`${delegates} delegate${delegates !== 1 ? 's' : ''}`)
          if (talkAbout > 0) parts.push(`${talkAbout} to talk about`)
          lines.push(`Tasks: ${parts.join(' · ')}`)
        }
        if (mention) lines.push(`Last: ${mention.date} — ${mention.summary}`)
        lines.push(`→ ${fp}`)

        entries.push(lines.join('\n'))
      } catch {}
    }
    const body = entries.length
      ? entries.join('\n\n---\n\n') + '\n\n---'
      : '_No people found._'
    await writeIfChanged('context/people-index.md', `# People Index\n*Last updated: ${today}*\n\n---\n\n${body}\n`)
  } catch {}

  // ── Projects index ──────────────────────────────────────────────────────────
  try {
    const projectFiles = getFolder('projects')
    const entries = []
    for (const f of projectFiles) {
      try {
        const fp = f.path || `projects/${f.name}`
        const raw = await readFile(fp)
        const { fields, body } = parseFrontmatter(raw)
        const name = resolveDisplayName(fields, body, f.name, 'name')
        exactEntityNames.push(name)

        const status = String(fields?.status || '').trim()
        const owner = String(fields?.owner || '').trim()
        const actions = countTasks(fp, '## Open Actions')
        const decisions = countTasks(fp, '## Decisions')
        const mention = parseRecentMention(body)

        const lines = [`## ${name}`]
        const headerParts = []
        if (status) headerParts.push(`Status: ${status}`)
        if (owner) headerParts.push(`Owner: ${owner}`)
        if (headerParts.length) lines.push(headerParts.join(' · '))
        if (actions > 0 || decisions > 0) {
          const parts = []
          if (actions > 0) parts.push(`${actions} action${actions !== 1 ? 's' : ''}`)
          if (decisions > 0) parts.push(`${decisions} decision${decisions !== 1 ? 's' : ''} pending`)
          lines.push(`Open: ${parts.join(' · ')}`)
        }
        if (mention) lines.push(`Last: ${mention.date} — ${mention.summary}`)
        lines.push(`→ ${fp}`)

        entries.push(lines.join('\n'))
      } catch {}
    }
    const body = entries.length
      ? entries.join('\n\n---\n\n') + '\n\n---'
      : '_No projects found._'
    await writeIfChanged('context/projects-index.md', `# Projects Index\n*Last updated: ${today}*\n\n---\n\n${body}\n`)
  } catch {}

  // ── Ideas index ─────────────────────────────────────────────────────────────
  try {
    const ideasFiles = getFolder('ideas').filter((f) => f.name !== 'backlog.md')
    const entries = []
    for (const f of ideasFiles) {
      try {
        const fp = f.path || `ideas/${f.name}`
        const raw = await readFile(fp)
        const { fields, body } = parseFrontmatter(raw)
        const name = resolveDisplayName(fields, body, f.name, 'name')
        exactEntityNames.push(name)

        const status = String(fields?.status || '').trim()
        const summary = parseIdeaSummary(body)

        const lines = [`## ${name}`]
        if (status) lines.push(`Status: ${status}`)
        if (summary) lines.push(`Summary: ${summary}`)
        lines.push(`→ ${fp}`)

        entries.push(lines.join('\n'))
      } catch {}
    }
    const body = entries.length
      ? entries.join('\n\n---\n\n') + '\n\n---'
      : '_No ideas found._'
    await writeIfChanged('context/ideas-index.md', `# Ideas Index\n*Last updated: ${today}*\n\n---\n\n${body}\n`)
  } catch {}

  // ── Tags harvest ────────────────────────────────────────────────────────────
  // Scan all user-facing markdown files for hashtags and merge into tags.md
  try {
    const SCAN_FOLDERS = ['people', 'projects', 'ideas', 'notes', 'inbox']
    const harvestedTags = new Set()

    for (const folder of SCAN_FOLDERS) {
      const files = getFolder(folder)
      for (const f of files) {
        try {
          const fp = f.path || `${folder}/${f.name}`
          const raw = await readFile(fp)
          for (const tag of extractTagsFromMarkdown(raw)) {
            harvestedTags.add(tag)
          }
        } catch {}
      }
    }

    if (harvestedTags.size > 0) {
      await mergeTagsIntoIndex(readFile, writeFile, [...harvestedTags])
      console.log(`[rebuildIndexFiles] merged ${harvestedTags.size} tags into tags.md`)
    }
  } catch (err) {
    console.warn('[rebuildIndexFiles] tag harvest failed (non-fatal):', err?.message || err)
  }

  return { changed, entityNameMap: buildEntityNameMap(exactEntityNames) }
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function rebuildContext(readFile, writeFile, settings, entityNameMap = new Map()) {
  // Run one-time context log migration (fire-and-forget; failure is non-fatal)
  trimContextLog(readFile, writeFile).catch((err) =>
    console.warn('[trimContextLog] failed (non-fatal):', err?.message || err)
  )

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

    // Index files are already built by caller — read them directly
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
6. Entity names must be preserved exactly as they appear in the source files, including dots, hyphens, and special characters. For example: Ubuntu.com Home Page Revamp, NOT Ubuntucom Home Page Revamp. Never normalise or alter entity names.
7. Never include self-correction text, parenthetical notes, or meta-commentary in your output. Output only clean, structured content.`

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
List up to 5 people from people-index.md only. Never include project names, idea names, or any entity that is not a person. Each entry: one line, format: "* [Name]: [one sentence on why they are relevant right now]"

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

    // Archive outgoing context to log (dedup guard skips if identical to last block)
    try {
      await appendToContextLog(readFile, writeFile, repairedContext)
    } catch (err) {
      console.warn('Failed to append to context log:', err?.message || err)
    }

    // ── Step 4b: Generate week summary ──────────────────────────────────────

    try {
      const cutoff7 = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const weekEntries = allEntries
        .filter((e) => String(e?.timestamp || '') >= cutoff7)
        .sort((a, b) => String(a?.timestamp || '').localeCompare(String(b?.timestamp || '')))

      const weekLines = weekEntries.length > 0
        ? weekEntries
            .map((e) => `${String(e.timestamp || '').slice(0, 10)} — ${String(e.summary || '').trim()}`)
            .join('\n')
        : '(no activity in the last 7 days)'

      const weekPrompt = `Based on the activity log entries and current context below, write a single paragraph (3-4 sentences) summarising what happened this week: what was worked on, what moved forward, what is still pending. Write in third person, past tense for completed items, present tense for ongoing. No bullet points. No headings.

Activity log (last 7 days):
${weekLines}

Current context:
${repairedContext}`

      const weekRaw = await callLLM(
        [{ role: 'user', content: weekPrompt }],
        'You are a concise summariser. Write exactly one paragraph with no headings or bullet points.',
        settings,
        150
      )

      const weekText = stripMarkdownFences(weekRaw).trim()
      if (weekText) {
        await writeFile(
          'context/week-summary.json',
          JSON.stringify({ text: weekText, generated_at: new Date().toISOString() }, null, 2)
        )
      }
    } catch (err) {
      console.warn('[rebuildContext] week-summary generation failed (non-fatal):', err?.message || err)
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

