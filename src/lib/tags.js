const TAGS_PATH = 'context/tags.md'

export function normalizeTag(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned
}

export function extractTagsFromMarkdown(markdown) {
  const text = String(markdown || '')
  const regex = /(^|[^\w])#([a-zA-Z0-9][a-zA-Z0-9:_-]{0,63})/g
  const found = new Set()
  let match

  while ((match = regex.exec(text)) !== null) {
    const tag = normalizeTag(match[2])
    if (tag) found.add(tag)
  }

  return [...found].sort((a, b) => a.localeCompare(b))
}

export function parseTagsFromContent(raw) {
  const lines = String(raw || '').split('\n')
  const tags = new Set()

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('>')) return

    const listStripped = trimmed.replace(/^[-*]\s+/, '')

    // Support one-tag-per-line and legacy bundled lines (comma or whitespace separated).
    listStripped.split(/[\s,]+/).forEach((piece) => {
      const tag = normalizeTag(piece)
      if (tag) tags.add(tag)
    })
  })

  return [...tags].sort((a, b) => a.localeCompare(b))
}

function buildTagsFile(tags) {
  const body = [...new Set(tags.map(normalizeTag).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => `- ${tag}`)
    .join('\n')

  return `# Tags\n> One tag per line. Auto-updated from note hashtags.\n\n${body}${body ? '\n' : ''}`
}

export async function mergeTagsIntoIndex(readFile, writeFile, incomingTags = []) {
  let existing = []
  try {
    const raw = await readFile(TAGS_PATH)
    existing = parseTagsFromContent(raw)
  } catch {}

  const merged = [...new Set([...existing, ...incomingTags.map(normalizeTag).filter(Boolean)])]
  await writeFile(TAGS_PATH, buildTagsFile(merged))

  return merged
}
