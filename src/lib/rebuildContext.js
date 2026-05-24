import { callLLM } from './llm'

const CONTEXT_PATH = 'context/_context.md'
const CONTEXT_LOG_PATH = 'context/_context_log.md'
const MAX_ENTRIES = 5

export async function rebuildContext(readFile, writeFile, settings) {
  let currentContext = ''
  try {
    currentContext = await readFile(CONTEXT_PATH)
  } catch {}

  const prompt = `You are rebuilding a working memory context file for a knowledge worker.

Current context:
${currentContext}

Instructions:
- Write a new _context.md with exactly these sections: Current Focus, Active Projects, Standing Decisions, Key People
- Maximum ${MAX_ENTRIES} entries per section
- If a section would exceed ${MAX_ENTRIES} entries, drop the oldest (least recently mentioned)
- Current Focus should be a short narrative paragraph (2-3 sentences) summarising active themes
- Be concise - this file is read at the start of every AI session
- Preserve exact casing of all proper nouns and acronyms

Return ONLY the markdown content of _context.md. No preamble, no fences.`

  const raw = await callLLM(
    [{ role: 'user', content: prompt }],
    'You are a precise markdown writer. Return only the requested markdown, nothing else.',
    settings
  )

  const newContext = raw.replace(/```markdown|```/g, '').trim()

  const date = new Date().toISOString().split('T')[0]
  const logEntry = `\n---\n## Archived ${date}\n\n${currentContext}\n`

  try {
    const existingLog = await readFile(CONTEXT_LOG_PATH)
    await writeFile(CONTEXT_LOG_PATH, existingLog + logEntry)
  } catch {
    await writeFile(CONTEXT_LOG_PATH, `# Context Log\n${logEntry}`)
  }

  await writeFile(CONTEXT_PATH, newContext)
}
