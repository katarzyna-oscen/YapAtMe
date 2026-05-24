import { appendToSection } from './vaultWriter'
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

export async function applyChange(readFile, writeFile, change) {
  if (!change?.target_file || !change?.target_section || !change?.content) return

  // Auto-create entity file if it doesn't exist yet (e.g. task approved before entity created).
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

  const isTaskSection = TASK_SECTIONS.has(change.target_section)
  const isTask = isTaskSection || isTaskChange(change)

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
      file: change.target_file,
      module: change.module || change.target_file.split('/')[0],
      title: normalizeTaskTitle(rawTitle),
      section: change.target_section,
      tags: [...new Set([markerTag, ...extraTags, ...inferredTags])],
    })
  } else {
    // Non-task changes (mentions, notes, etc.): markdown only. No index entry.
    await appendToSection(
      readFile,
      writeFile,
      change.target_file,
      change.target_section,
      change.content
    )
  }
}
