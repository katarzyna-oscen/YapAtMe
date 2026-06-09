function escapeRegex(source) {
  return String(source || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function namesFromAllowedFiles(allowedFiles = [], folders = []) {
  const folderSet = new Set((folders || []).map((folder) => String(folder).toLowerCase()))
  const seen = new Set()
  const names = []

  for (const path of allowedFiles || []) {
    const lower = String(path).toLowerCase()
    const folder = lower.split('/')[0]
    if (!folderSet.has(folder) || !lower.endsWith('.md')) continue

    const raw = String(path).split('/').pop().replace(/\.md$/i, '').trim()
    if (!raw) continue

    if (!seen.has(raw)) { seen.add(raw); names.push(raw) }

    // Also add humanized version (hyphens/underscores → spaces) for slug-named files like projects
    const humanized = raw.replace(/[-_]+/g, ' ').trim()
    if (humanized !== raw && !seen.has(humanized)) { seen.add(humanized); names.push(humanized) }
  }

  return names.sort((a, b) => b.length - a.length)
}

export function autoLinkKnownMentions(markdown, allowedFiles = [], folders = ['people']) {
  const text = String(markdown || '')
  const names = namesFromAllowedFiles(allowedFiles, folders)
  if (!text || names.length === 0) return text

  // Protect existing wikilinks to avoid relinking.
  const parts = text.split(/(\[\[[^\]]+\]\])/g)

  const linked = parts.map((part, idx) => {
    if (idx % 2 === 1) return part

    let next = part
    for (const name of names) {
      const escaped = escapeRegex(name)
      const rx = new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=$|[^A-Za-z0-9_])`, 'gi')
      next = next.replace(rx, (_m, p1, p2) => `${p1}[[${p2}]]`)
    }
    return next
  })

  return linked.join('')
}

export function autoLinkPeopleMentions(markdown, allowedFiles = []) {
  return autoLinkKnownMentions(markdown, allowedFiles, ['people'])
}

export async function resolveWikilink(name, listTree) {
  const rawName = String(name || '').trim()
  if (!rawName || typeof listTree !== 'function') return null

  const lower = rawName.toLowerCase()
  const slug = lower
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const isDate = /^\d{2}-\d{2}-\d{4}$/.test(rawName)

  const candidates = isDate
    ? [`notes/${rawName}.md`, `inbox/${rawName}.md`]
    : [
      `people/${lower}.md`,
      `people/${slug}.md`,
      `projects/${slug}.md`,
      `ideas/${slug}.md`,
      `notes/${rawName}.md`,
      `notes/${slug}.md`,
    ]

  const tree = await listTree().catch(() => [])
  const queue = Array.isArray(tree) ? [...tree] : Object.values(tree || {}).flat()
  const files = []

  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) continue
    if (node.kind === 'directory') {
      queue.push(...(node.children || []))
      continue
    }
    if (node.kind !== 'file') continue
    const path = String(node.path || '')
    if (!path.endsWith('.md')) continue
    files.push(path)
  }

  for (const candidate of candidates) {
    const found = files.find((path) => path.toLowerCase() === candidate.toLowerCase())
    if (found) return found
  }

  return null
}

export function emitFileNotFoundToast() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('memostack:toast', { detail: { message: 'File not found in vault' } }))
}
