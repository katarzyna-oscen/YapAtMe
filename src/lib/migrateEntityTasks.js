import { parseFrontmatter, buildFileContent } from './frontmatter'

const INDEX_PATH = 'context/tasks-index.json'

const FOLDER_TASK_SECTIONS = {
  projects: ['## Open Actions', '## Delegations', '## Decisions'],
  people: ['## Delegate', '## Talk About'],
}

const SECTION_PLACEHOLDER = {
  '## Open Actions': '_Add tasks directly or let AI route actions from your inbox._',
  '## Delegations': '_Track what you\'ve delegated. AI will add items from your inbox._',
  '## Decisions': '_Record decisions here. AI will capture them from your notes._',
  '## Delegate': '_Tasks you\'ve delegated to this person. AI will add from your inbox._',
  '## Talk About': '_Topics to raise next time you speak. AI will add from your inbox._',
}

const SECTION_TO_MODULE = {
  '## Open Actions': 'projects',
  '## Delegations': 'projects',
  '## Decisions': 'projects',
  '## Delegate': 'people',
  '## Talk About': 'people',
}

function parseCheckboxes(body, sectionHeader) {
  const lines = String(body || '').split('\n')
  const results = []
  let inSection = false

  for (const line of lines) {
    if (line.trim() === sectionHeader) {
      inSection = true
      continue
    }
    if (inSection) {
      if (line.startsWith('## ')) break
      const match = line.match(/^- \[([ xX])\] (.+)/)
      if (match) results.push({ text: match[2].trim(), done: match[1].toLowerCase() === 'x' })
    }
  }

  return results
}

function removeCheckboxLines(body, sectionHeader) {
  const lines = String(body || '').split('\n')
  const result = []
  let inSection = false
  let addedHolder = false

  for (const line of lines) {
    if (line.trim() === sectionHeader) {
      inSection = true
      addedHolder = false
      result.push(line)
      continue
    }

    if (inSection) {
      if (line.startsWith('## ')) {
        inSection = false
        result.push(line)
        continue
      }

      const isCheckbox = /^- \[([ xX])\] /.test(line)
      const isExistingPlaceholder = /^_.*_$/.test(line.trim())

      if (isCheckbox) {
        if (!addedHolder) {
          result.push(SECTION_PLACEHOLDER[sectionHeader] || '')
          addedHolder = true
        }
        continue
      }

      if (isExistingPlaceholder) {
        if (!addedHolder) {
          result.push(line)
          addedHolder = true
        }
        continue
      }
    }

    result.push(line)
  }

  return result.join('\n')
}

function normalizeTreeEntries(tree, folder) {
  if (Array.isArray(tree)) {
    const dir = tree.find((entry) => entry?.kind === 'directory' && entry.name === folder)
    return (dir?.children || []).filter((entry) => entry?.kind === 'file')
  }
  return tree?.[folder] || []
}

export async function migrateEntityTasks({ readFile, writeFile, listTree }) {
  const today = new Date().toISOString().slice(0, 10)
  const summary = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    filesUpdated: 0,
    indexCountBefore: 0,
    indexCountAfter: 0,
  }

  let index = []
  try {
    index = JSON.parse(await readFile(INDEX_PATH))
  } catch {}

  summary.indexCountBefore = Array.isArray(index) ? index.length : 0

  const existingTitles = new Set(index.map((entry) => `${entry.file}::${entry.title}`))
  const tree = await listTree()

  for (const [folder, taskSections] of Object.entries(FOLDER_TASK_SECTIONS)) {
    const files = normalizeTreeEntries(tree, folder).filter((file) =>
      file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.'),
    )

    for (const file of files) {
      const filePath = file.path || `${folder}/${file.name}`
      summary.scanned += 1

      let raw
      try {
        raw = await readFile(filePath)
      } catch {
        continue
      }

      const { fields, body } = parseFrontmatter(raw)
      let updatedBody = body
      let fileModified = false

      for (const section of taskSections) {
        const tasks = parseCheckboxes(updatedBody, section)
        if (tasks.length === 0) continue

        for (const task of tasks) {
          const key = `${filePath}::${task.text}`
          if (existingTitles.has(key)) {
            summary.skipped += 1
            continue
          }

          index.push({
            id: crypto.randomUUID(),
            file: filePath,
            module: SECTION_TO_MODULE[section] ?? folder,
            title: task.text,
            section,
            status: task.done ? 'done' : 'open',
            tags: [],
            last_updated: today,
            comments: [],
          })
          existingTitles.add(key)
          summary.migrated += 1
        }

        updatedBody = removeCheckboxLines(updatedBody, section)
        fileModified = true
      }

      if (fileModified) {
        await writeFile(filePath, buildFileContent(fields, updatedBody))
        summary.filesUpdated += 1
      }
    }
  }

  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2))
  summary.indexCountAfter = Array.isArray(index) ? index.length : 0
  return summary
}