import { appendToSection, prependToSection } from './vaultWriter'
import { appendTaskEntry } from './tasksIndex'
import { generateFile } from './templates'

// Mirrors FOLDER_TASK_SECTIONS in migrateEntityTasks.js.
// These sections are index-only: no checkbox lines are written to markdown.
// If task sections are added or renamed, update both files.
const TASK_SECTIONS = new Set([
  '## Open Actions',
  '## Delegations',
  '## Decisions',
  '## Delegate',
  '## Talk About',
  '## My Actions',
])

function normalizeTaskTitle(raw) {
  let text = String(raw || '').trim()
  if (!text) return text

  // Remove accidental heading/date prefixes leaking from source note context.
  text = text.replace(/^#\s*\d{2}-\d{2}-\d{4}\s+/i, '')
  text = text.replace(/^-\s*\[[ x]\]\s*/i, '')

  // Unescape markdown-escaped wikilinks.
  text = text.replace(/\\\[\[/g, '[[').replace(/\\\]\]/g, ']]')

  // Collapse nested wikilinks such as [[[[Muffin]]]] -> [[Muffin]].
  text = text.replace(/\[\[\[+\s*([^\]]+?)\s*\]+\]\]/g, '[[$1]]')
  text = text.replace(/\[{4,}\s*([^\]]+?)\s*\]{4,}/g, '[[$1]]')

  return text.replace(/\s+/g, ' ').trim()
}

// Fallback: detect task intent from marker/content when section isn't in TASK_SECTIONS.
function isTaskChange(change) {
  const marker = String(change?.marker || '').toLowerCase()
  const content = String(change?.content || '')
  if (/^-\s*\[[ x]\]/i.test(content)) return true
  return ['action', 'urgent', 'important', 'follow-up', 'delegate'].includes(marker)
}

function formatMentionLine(content, noteFilename) {
  const raw = String(content || '').trim()

  if (/^\[\[\d{2}-\d{2}-\d{4}\]\]\s+—\s+.+/.test(raw)) return raw

  const noteDateSlug = String(noteFilename || '').replace('inbox/', '').replace('.md', '').trim() || 'unknown-date'
  const stripped = raw
    .replace(/^\[\[\d{2}-\d{2}-\d{4}\]\]\s*[—-]\s*/i, '')
    .replace(/^\d{2}-\d{2}-\d{4}\s*[—-]\s*/i, '')
    .replace(/\.\s*Source:\s*\S+\s*$/i, '')
    .trim()

  const summary = stripped || 'Mentioned in note'
  return `[[${noteDateSlug}]] — ${summary}\n`
}

function normalizeMentionForCompare(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\[\[|\]\]/g, '')
    .trim()
}

function normalizeChangeForModules(change, { peopleModuleEnabled = true, writerFile = '' } = {}) {
  const marker = String(change?.marker || '').toLowerCase()
  const targetFile = String(change?.target_file || '')
  const normalizedWriterFile = String(writerFile || '').trim().toLowerCase()
  const isWriterTarget = normalizedWriterFile && targetFile.toLowerCase() === normalizedWriterFile

  if (isWriterTarget) return change
  if (peopleModuleEnabled) return change

  if (marker === 'mention') {
    return null
  }

  if (marker === 'follow-up' || marker === 'delegate') {
    return {
      ...change,
      marker: 'action',
      target_section: '## Open Actions',
      target_file: null,
      module: 'unattached',
    }
  }

  return change
}

export async function applyChange(readFile, writeFile, change, noteFilename, options = {}) {
  const normalized = normalizeChangeForModules(change, options)
  if (!normalized) return
  change = normalized

  if (!change?.target_section || !change?.content) return

  // Auto-create entity file if it doesn't exist yet (e.g. task approved before entity created).
  if (change?.target_file) {
    try {
      await readFile(change.target_file)
    } catch {
      const folder = String(change.target_file).split('/')[0]
      const filename = String(change.target_file).split('/').pop().replace(/\.md$/i, '')
      // Restore display name: slug is lowercase-hyphenated, capitalise first letter.
      const displayName = filename.charAt(0).toUpperCase() + filename.slice(1).replace(/-/g, ' ')
      const generated = generateFile(folder, displayName)
      if (generated?.content) {
        await writeFile(change.target_file, generated.content)
      }
    }
  }

  const isTaskSection = TASK_SECTIONS.has(change.target_section)
  const isTask = isTaskSection || isTaskChange(change)
  const isMention = change.target_section === '## Recent Mentions'

  if (isMention) {
    const formattedMention = formatMentionLine(change.content, noteFilename || change.noteFilename)
    const noteDateSlug = String(noteFilename || change.noteFilename || '')
      .replace('inbox/', '')
      .replace('.md', '')
      .trim()
    let alreadyPresent = false
    try {
      const current = await readFile(change.target_file)
      const normalizedTarget = normalizeMentionForCompare(formattedMention)
      alreadyPresent = String(current || '')
        .split('\n')
        .some((line) => normalizeMentionForCompare(line) === normalizedTarget)
    } catch {}

    if (!alreadyPresent) {
    await prependToSection(
      readFile,
      writeFile,
      change.target_file,
      change.target_section,
      formattedMention,
      noteDateSlug
    )
    }

    // Mention routing is handled fully above; avoid falling through to generic append.
    if (!isTask) return
  }

  if (isTask) {
    // Task changes: index only. Never write checkbox lines to markdown.
    const rawTitle = change.title || String(change.content || '').replace(/^-\s*(?:\[[ xX]\]\s*)?/, '')
    // Build tags: always include the marker, plus any priority keywords found in the title/content or pre-computed extraTags.
    const markerTag = String(change.marker || 'action').toLowerCase()
    const combinedText = `${change.title || ''} ${change.content || ''}`.toLowerCase()
    const extraTags = Array.isArray(change.extraTags) ? change.extraTags : []
    const inferredTags = []
    if (/\b(urgent|asap|immediately|critical|blocker)\b/.test(combinedText) && markerTag !== 'urgent') inferredTags.push('urgent')
    if (/\b(important|high-priority|priority)\b/.test(combinedText) && markerTag !== 'important') inferredTags.push('important')

    await appendTaskEntry(readFile, writeFile, {
      file: change.target_file ?? null,
      module: change.module || (change.target_file ? change.target_file.split('/')[0] : 'unattached'),
      title: normalizeTaskTitle(rawTitle),
      section: change.target_section,
      sourceNote: String(noteFilename || change.noteFilename || '').trim() || undefined,
      tags: [...new Set([markerTag, ...extraTags, ...inferredTags])],
    })
    return
  }

  if (!change?.target_file) return

  await appendToSection(
    readFile,
    writeFile,
    change.target_file,
    change.target_section,
    change.content
  )
}
