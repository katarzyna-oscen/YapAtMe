import { parseFrontmatter, buildFileContent } from './frontmatter'

// Allowed sections per folder - must match current templates.js schema exactly.
const ALLOWED_SECTIONS = {
  projects: ['## Summary', '## Current Plan', '## Recent Mentions', '## Notes'],
  people: ['## Summary', '## Related Projects', '## Recent Mentions', '## Notes'],
}

// Placeholder text inserted when a required section is missing.
// Must match the placeholder text in templates.js generateFile().
const SECTION_PLACEHOLDERS = {
  projects: {
    '## Summary': '_What is this project and why does it matter?_',
    '## Current Plan': "_What's the current approach and the immediate next step?_",
    '## Recent Mentions': '_Populated by AI._',
    '## Notes': '_Observations, raw thoughts, context. AI will use this to keep the project current._',
  },
  people: {
    '## Summary': '_Who is this person and why do they matter to you?_',
    '## Related Projects': '_Link projects this person is involved in._',
    '## Recent Mentions': '_Populated by AI._',
    '## Notes': '_Observations, context, anything worth remembering about this person._',
  },
}

function normalizeTreeEntries(tree, folder) {
  if (Array.isArray(tree)) {
    const dir = tree.find((entry) => entry?.kind === 'directory' && entry.name === folder)
    return (dir?.children || []).filter((entry) => entry?.kind === 'file')
  }
  return tree?.[folder] || []
}

// Strips non-allowed sections from body.
// Returns { cleanedBody, sectionsRemoved }
function stripDisallowedSections(body, allowedSet) {
  const lines = String(body || '').split('\n')
  const kept = []
  let keepCurrentSection = true
  let sectionsRemoved = 0

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const heading = line.trim()
      keepCurrentSection = allowedSet.has(heading)
      if (keepCurrentSection) {
        kept.push(line)
      } else {
        sectionsRemoved += 1
      }
      continue
    }
    if (keepCurrentSection) {
      kept.push(line)
    }
  }

  return {
    cleanedBody: kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd(),
    sectionsRemoved,
  }
}

// Rebuilds body in canonical section order, preserving kept content and filling missing sections.
// Returns { body, sectionsAdded }
function reorderAndFillSections(body, orderedSections, placeholders) {
  const lines = String(body || '').split('\n')
  const intro = []
  const sectionMap = new Map()
  let currentSection = null

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      currentSection = line.trim()
      if (!sectionMap.has(currentSection)) {
        sectionMap.set(currentSection, [])
      }
      continue
    }

    if (currentSection == null) {
      intro.push(line)
    } else if (sectionMap.has(currentSection)) {
      sectionMap.get(currentSection).push(line)
    }
  }

  let sectionsAdded = 0
  const parts = []
  const introText = intro.join('\n').trim()
  if (introText) parts.push(introText)

  for (const section of orderedSections) {
    const existingLines = sectionMap.get(section)
    const hasExisting = Array.isArray(existingLines)
    const content = hasExisting
      ? existingLines.join('\n').trim()
      : String(placeholders[section] || '').trim()

    if (!hasExisting) sectionsAdded += 1
    parts.push(`${section}\n${content}`.trimEnd())
  }

  return {
    body: parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trimEnd(),
    sectionsAdded,
  }
}

export async function cleanEntityFiles({ readFile, writeFile, listTree }) {
  const summary = { filesChecked: 0, filesCleaned: 0, sectionsRemoved: 0, sectionsAdded: 0 }
  const tree = await listTree()

  for (const folder of Object.keys(ALLOWED_SECTIONS)) {
    const orderedSections = ALLOWED_SECTIONS[folder]
    const allowedSet = new Set(orderedSections)
    const placeholders = SECTION_PLACEHOLDERS[folder]

    const files = normalizeTreeEntries(tree, folder).filter(
      (file) => file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.'),
    )

    for (const file of files) {
      const filePath = file.path || `${folder}/${file.name}`
      summary.filesChecked += 1

      let raw
      try {
        raw = await readFile(filePath)
      } catch {
        continue
      }

      const { fields, body } = parseFrontmatter(raw)

      const { cleanedBody, sectionsRemoved } = stripDisallowedSections(body, allowedSet)
      const { body: finalBody, sectionsAdded } = reorderAndFillSections(cleanedBody, orderedSections, placeholders)

      if (sectionsRemoved > 0 || sectionsAdded > 0 || finalBody !== body.trimEnd()) {
        await writeFile(filePath, buildFileContent(fields, finalBody))
        summary.filesCleaned += 1
        summary.sectionsRemoved += sectionsRemoved
        summary.sectionsAdded += sectionsAdded
      }
    }
  }

  return summary
}