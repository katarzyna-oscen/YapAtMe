function escapeRegex(source) {
  return String(source || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function namesFromAllowedFiles(allowedFiles = [], folders = []) {
  const folderSet = new Set((folders || []).map((folder) => String(folder).toLowerCase()))
  const names = (allowedFiles || [])
    .filter((path) => {
      const lower = String(path).toLowerCase()
      const folder = lower.split('/')[0]
      return folderSet.has(folder) && lower.endsWith('.md')
    })
    .map((path) => String(path).split('/').pop().replace(/\.md$/i, '').trim())
    .filter(Boolean)

  return [...new Set(names)].sort((a, b) => b.length - a.length)
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
      const rx = new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=$|[^A-Za-z0-9_])`, 'g')
      next = next.replace(rx, (_m, p1, p2) => `${p1}[[${p2}]]`)
    }
    return next
  })

  return linked.join('')
}

export function autoLinkPeopleMentions(markdown, allowedFiles = []) {
  return autoLinkKnownMentions(markdown, allowedFiles, ['people'])
}
