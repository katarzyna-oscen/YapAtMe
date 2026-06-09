import { callLLM } from './llm'
import { parseFrontmatter } from './frontmatter'
import { getEntriesSinceLastRebuild, setActivityLogLastRebuild, pruneActivityLog } from './activityLog'

const CONTEXT_PATH = 'context/_context.md'
const CONTEXT_LOG_PATH = 'context/_context_log.md'
const REQUIRED_HEADINGS = [
  'Narrative thread',
  'Current focus',
  'Active projects',
  'Standing decisions',
  'Key people',
]

let rebuildInProgress = false

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

function normalizeDecisionLine(line) {
  return String(line || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function mergeStandingDecisions(existing, proposed) {
  const existingLines = String(existing || '').split('\n').map((line) => line.trimEnd()).filter((line) => line.trim())
  const proposedLines = String(proposed || '').split('\n').map((line) => line.trimEnd()).filter((line) => line.trim())

  const merged = [...existingLines]
  const seen = new Set(existingLines.map(normalizeDecisionLine))

  for (const line of proposedLines) {
    const key = normalizeDecisionLine(line)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(line)
  }

  if (merged.length === 0) return 'None currently.'
  return merged.join('\n')
}

function stripMarkdownFences(text) {
  return String(text || '').replace(/```markdown|```/gi, '').trim()
}

function validateContextStructure(content) {
  const text = String(content || '')
  for (const heading of REQUIRED_HEADINGS) {
    const rx = new RegExp(`^##\\s+${heading}\\s*$`, 'gim')
    const matches = text.match(rx) || []
    if (matches.length !== 1) {
      return { valid: false, reason: `Heading \"${heading}\" must appear exactly once` }
    }

    const section = extractSection(text, heading)
    if (!section || !section.trim()) {
      return { valid: false, reason: `Heading \"${heading}\" must contain content` }
    }
  }
  return { valid: true, reason: '' }
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

function formatActivityEntries(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return '(none)'
  return entries
    .map((entry) => {
      const ts = String(entry?.timestamp || '')
      const src = String(entry?.note_source || 'unknown')
      const entities = Array.isArray(entry?.entities_mentioned) && entry.entities_mentioned.length > 0
        ? entry.entities_mentioned.join(', ')
        : 'none'
      const decisions = Array.isArray(entry?.decisions) && entry.decisions.length > 0
        ? entry.decisions.join(' | ')
        : 'none'
      const tasks = Number.isFinite(entry?.tasks_created) ? entry.tasks_created : 0
      const summary = String(entry?.summary || '').trim() || 'none'
      return `- ${ts} | source=${src} | entities=${entities} | tasks_created=${tasks} | decisions=${decisions} | summary=${summary}`
    })
    .join('\n')
}

// ── Index file builders ──────────────────────────────────────────────────────

async function rebuildIndexFiles(readFile, writeFile, listTree) {
  if (typeof listTree !== 'function') return

  let tree = []
  try { tree = await listTree() } catch { return }

  const getFolder = (folder) => {
    if (Array.isArray(tree)) {
      const dir = tree.find((e) => e?.kind === 'directory' && e.name === folder)
      return (dir?.children || []).filter((e) => e?.kind === 'file' && e.name?.endsWith('.md') && !e.name.startsWith('_') && !e.name.startsWith('.'))
    }
    return (tree?.[folder] || []).filter((e) => e.name?.endsWith('.md') && !e.name.startsWith('_') && !e.name.startsWith('.'))
  }

  const today = new Date().toISOString().slice(0, 10)

  // Projects index
  try {
    const projectFiles = getFolder('projects')
    const lines = []
    for (const f of projectFiles) {
      try {
        const raw = await readFile(f.path || `projects/${f.name}`)
        const { fields } = parseFrontmatter(raw)
        const name = String(fields?.name || f.name.replace(/\.md$/i, '')).trim()
        const status = String(fields?.status || '').trim()
        const domain = String(fields?.domain || '').trim()
        const owner = String(fields?.owner || '').trim()
        const coreProblem = String(fields?.core_problem || '').trim()
        const parts = [`**${name}**`]
        if (status) parts.push(`status: ${status}`)
        if (domain) parts.push(`domain: ${domain}`)
        if (owner) parts.push(`owner: ${owner}`)
        if (coreProblem) parts.push(`core_problem: ${coreProblem}`)
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
        const relationship = String(fields?.relationship || '').trim()
        const role = String(fields?.role || '').trim()
        const parts = [`**${name}**`]
        if (relationship) parts.push(`relationship: ${relationship}`)
        if (role) parts.push(`role: ${role}`)
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
        const status = String(fields?.status || '').trim()
        const domain = String(fields?.domain || '').trim()
        const tags = Array.isArray(fields?.tags) ? fields.tags.join(', ') : String(fields?.tags || '').trim()
        const parts = [`**${name}**`]
        if (status) parts.push(`status: ${status}`)
        if (domain) parts.push(`domain: ${domain}`)
        if (tags) parts.push(`tags: ${tags}`)
        lines.push(`- ${parts.join(' | ')}`)
      } catch {}
    }
    const content = `# Ideas Index\n*Last updated: ${today}*\n\n${lines.length ? lines.join('\n') : '_No ideas found._'}\n`
    await writeFile('context/ideas-index.md', content)
  } catch {}
}

export async function rebuildContext(readFile, writeFile, settings, listTree) {
  if (rebuildInProgress) {
    console.warn('rebuildContext skipped: rebuild already in progress')
    return
  }

  rebuildInProgress = true

  let currentContext = ''
  try {
    try {
      currentContext = await readFile(CONTEXT_PATH)
    } catch {}

    // Rebuild index files from entity folders before reading them into the prompt
    try {
      await rebuildIndexFiles(readFile, writeFile, listTree)
    } catch (err) {
      console.warn('rebuildIndexFiles failed (non-fatal):', err?.message || err)
    }

    let projectsIndex = '', peopleIndex = '', ideasIndex = ''
    try { projectsIndex = await readFile('context/projects-index.md') } catch {}
    try { peopleIndex = await readFile('context/people-index.md') } catch {}
    try { ideasIndex = await readFile('context/ideas-index.md') } catch {}

    let recentEntries = []
    try {
      recentEntries = await getEntriesSinceLastRebuild(readFile)
    } catch {
      recentEntries = []
    }

    const existingStandingDecisions = extractSection(currentContext, 'Standing decisions')
    const recentEntityNames = [...new Set(
      (recentEntries || [])
        .flatMap((entry) => Array.isArray(entry?.entities_mentioned) ? entry.entities_mentioned : [])
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    )]

    const activityText = formatActivityEntries(recentEntries)
    const entitiesText = recentEntityNames.length ? recentEntityNames.join(', ') : '(none)'

    const prompt = `You are rebuilding a working memory context file for a knowledge worker.

Use ONLY these inputs:

Activity log entries (since last rebuild):
${activityText}

Projects index:
${projectsIndex || '(missing)'}

People index:
${peopleIndex || '(missing)'}

Ideas index:
${ideasIndex || '(missing)'}

Current standing decisions from existing _context.md (carry forward unless contradicted):
${existingStandingDecisions || '(none)'}

Recent activity entity names (for Key people intersection):
${entitiesText}

Output requirements:
- Return markdown ONLY with this exact heading order and exact heading text:
## Narrative thread
[2–3 sentence flowing paragraph about recent activity]

## Current focus
[paragraph + active themes as bullet list]

## Active projects
[only projects with status: In Progress / To Be Deployed / Blocked, one entry each]

## Standing decisions
[ONLY propose NEW standing decisions discovered in activity entries. Do NOT rewrite or restate existing decisions.]

## Key people
[only people that appear in recent activity entity names and are present in people index, with why relevant]

Rules:
- Do not scan or infer from any source other than the inputs provided above.
- Keep wording concise.
- Preserve exact casing of proper nouns.
- If a section has no data, write one short line: "None currently."`

    const raw = await callLLM(
      [{ role: 'user', content: prompt }],
      'You are a precise markdown writer. Return only the requested markdown, nothing else.',
      settings
    )

    let newContext = stripMarkdownFences(raw)

    const proposedDecisions = extractSection(newContext, 'Standing decisions')
    const mergedDecisions = mergeStandingDecisions(existingStandingDecisions, proposedDecisions)
    newContext = setSection(newContext, 'Standing decisions', mergedDecisions)

    const repairedContext = repairContextStructure(newContext)
    const validation = validateContextStructure(repairedContext)
    if (!validation.valid) {
      console.warn(`Context rebuild validation failed. Keeping existing context. Reason: ${validation.reason}`)
      return
    }

    const date = new Date().toISOString().split('T')[0]
    const logEntry = `\n---\n## Archived ${date}\n\n${currentContext}\n`

    try {
      const existingLog = await readFile(CONTEXT_LOG_PATH)
      await writeFile(CONTEXT_LOG_PATH, existingLog + logEntry)
    } catch {
      await writeFile(CONTEXT_LOG_PATH, `# Context Log\n${logEntry}`)
    }

    await writeFile(CONTEXT_PATH, repairedContext)

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
