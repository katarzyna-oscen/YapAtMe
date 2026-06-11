const HASHTAG_MARKER_MAP = {
  action: { marker: 'action', section: '## Open Actions' },
  decision: { marker: 'decision', section: '## Decisions' },
  delegate: { marker: 'delegate', section: '## Delegate' },
  'follow-up': { marker: 'follow-up', section: '## Talk About' },
  important: { marker: 'important', section: '## Open Actions' },
  urgent: { marker: 'urgent', section: '## Open Actions' },
  idea: { marker: 'idea', section: '## Backlog' },
}

export function extractHashtags(noteBody) {
  const matches = String(noteBody || '').match(/#([a-z][a-z0-9_-]*)/gi) || []
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))]
}

function slugifyEntityName(entityName) {
  return String(entityName || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function dedupeHashtagChanges(changes) {
  const seen = new Set()
  const out = []
  for (const change of changes || []) {
    const key = [change.target_file, change.target_section, change.marker, change.title, change.content]
      .map((value) => String(value || '').trim().toLowerCase())
      .join('||')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(change)
  }
  return out
}

export function extractHashtagChanges(noteBody, noteFilename) {
  const lines = String(noteBody || '').split('\n')
  const changes = []
  const date = String(noteFilename || '').replace('inbox/', '').replace('.md', '')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const tagMatches = [...trimmed.matchAll(/#([a-z][a-z0-9_-]*)/gi)]
    const routingTags = tagMatches
      .map((match) => match[1].toLowerCase())
      .filter((tag) => HASHTAG_MARKER_MAP[tag])

    if (routingTags.length === 0) continue

    const tag = routingTags[0]
    const { marker, section } = HASHTAG_MARKER_MAP[tag]
    const cleanLine = trimmed
      .replace(/#[a-z][a-z0-9_-]*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    // #idea lines route directly to ideas/backlog.md — no entity wikilink required
    if (tag === 'idea') {
      changes.push({
        id: `hashtag-idea-${changes.length}`,
        title: cleanLine,
        content: `- [[${date}]] ${cleanLine}`,
        target_file: 'ideas/backlog.md',
        target_section: section,
        marker,
        fromHashtag: true,
      })
      continue
    }

    const wikilinkMatches = [...trimmed.matchAll(/\[\[([^\]]+)\]\]/g)]
    if (wikilinkMatches.length === 0) continue

    for (const wikilink of wikilinkMatches) {
      const entityName = wikilink[1]
      const slug = slugifyEntityName(entityName)
      changes.push({
        id: `hashtag-${slug}-${tag}-${changes.length}`,
        title: cleanLine,
        content: marker === 'mention'
          ? `${date} — ${cleanLine}. Source: ${noteFilename}`
          : `- [ ] ${cleanLine}`,
        target_file: null,
        target_section: section,
        marker,
        entityName,
        fromHashtag: true,
      })
    }
  }

  return dedupeHashtagChanges(changes)
}

export function resolveHashtagTargets(hashtagChanges, allowedFiles = []) {
  const files = Array.isArray(allowedFiles) ? allowedFiles : []
  const resolveEntityPath = (slug, folder) => files.find((path) => String(path).toLowerCase() === `${folder}/${slug}.md`)

  return (hashtagChanges || [])
    .map((change) => {
      // Idea changes already have target_file set — pass through without entity resolution
      if (change?.marker === 'idea' && change?.target_file === 'ideas/backlog.md') return change
      if (!change?.entityName) return null
      const slug = slugifyEntityName(change.entityName)
      const peopleFile = resolveEntityPath(slug, 'people')
      const projectFile = resolveEntityPath(slug, 'projects')
      const targetFile = peopleFile || projectFile
      if (!targetFile) return null

      return {
        ...change,
        target_file: targetFile,
        module: targetFile.split('/')[0],
        entityName: undefined,
      }
    })
    .filter(Boolean)
}

export function extractWikilinkMentionChanges(noteBody, noteFilename) {
  const lines = String(noteBody || '').split('\n')
  const changes = []
  const date = String(noteFilename || '').replace('inbox/', '').replace('.md', '')
  const sourcePath = String(noteFilename || '').replace('inbox/', 'notes/')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue

    const wikilinkMatches = [...trimmed.matchAll(/\[\[([^\]]+)\]\]/g)]
    if (wikilinkMatches.length === 0) continue

    const cleanLine = trimmed
      .replace(/#[a-z][a-z0-9_-]*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleanLine) continue

    for (const wikilink of wikilinkMatches) {
      const entityName = wikilink[1]
      const slug = slugifyEntityName(entityName)
      changes.push({
        id: `mention-${slug}-${changes.length}`,
        title: cleanLine,
        content: `${date} — ${cleanLine}. Source: [[${sourcePath}]]`,
        target_file: null,
        target_section: '## Recent Mentions',
        marker: 'mention',
        entityName,
        fromHashtag: true,
      })
    }
  }

  return dedupeHashtagChanges(changes)
}
