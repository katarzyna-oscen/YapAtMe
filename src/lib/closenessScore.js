// Closeness scoring for People dashboard cards.
//
// calculateCloseness(personFilePath, tasksIndex, mentionDates)
//   personFilePath  e.g. "people/sophie.md"
//   tasksIndex      flat task record array: { file, status, resolved_at, last_updated }
//   mentionDates    array of Date objects parsed from ## Recent Mentions section

export function calculateCloseness(personFilePath, tasksIndex, mentionDates) {
  const now = new Date()
  const daysSince = (d) => {
    if (!d) return 999
    const dt = d instanceof Date ? d : new Date(d)
    if (isNaN(dt.getTime())) return 999
    return Math.floor((now - dt) / 86400000)
  }

  let score = 0

  // Mentions — every individual mention counts, weighted by recency
  for (const date of (mentionDates || [])) {
    const daysAgo = daysSince(date)
    if (daysAgo <= 7)       score += 8
    else if (daysAgo <= 14) score += 5
    else if (daysAgo <= 30) score += 3
    else if (daysAgo <= 90) score += 1
    // older than 90 days: +0
  }

  // Tasks linked to this person's file
  const idx = tasksIndex || []
  const openTasks      = idx.filter(t => t.file === personFilePath && t.status === 'open')
  const completedRecent = idx.filter(t =>
    t.file === personFilePath && t.status === 'done' && daysSince(t.resolved_at) <= 30)
  const completedOlder  = idx.filter(t =>
    t.file === personFilePath && t.status === 'done' &&
    daysSince(t.resolved_at) > 30 && daysSince(t.resolved_at) <= 90)
  const agingTasks     = openTasks.filter(t => daysSince(t.last_updated) > 14)

  score += Math.min(openTasks.length * 4, 20) // open tasks, capped at 20
  score += completedRecent.length * 4          // completed in last 30 days
  score += completedOlder.length * 2           // completed in last 90 days
  score -= agingTasks.length * 4              // aging tasks penalty

  if (score >= 100) return { label: 'bestie',     bars: 5, tier: 'bestie' }
  if (score >= 50)  return { label: 'close',      bars: 5, tier: 'active' }
  if (score >= 30)  return { label: 'regular',    bars: 4, tier: 'active' }
  if (score >= 18)  return { label: 'moderate',   bars: 3, tier: 'active' }
  if (score >= 8)   return { label: 'occasional', bars: 2, tier: 'muted'  }
  return              { label: 'distant',         bars: 1, tier: 'muted'  }
}

// Parse mention dates from person file content.
// Looks for [[DD-MM-YYYY]] patterns inside the ## Recent Mentions section.
export function parseMentionDates(fileContent) {
  if (!fileContent) return []
  const text = String(fileContent)
  // Scope to ## Recent Mentions section (stop at next ## or end of file)
  const sectionMatch = text.match(
    /##\s+Recent\s+Mentions\s*\n([\s\S]*?)(?=\n##\s+|\s*$)/i
  )
  const section = sectionMatch ? sectionMatch[1] : ''
  const dates = []
  const rx = /\[\[(\d{2})-(\d{2})-(\d{4})\]\]/g
  let m
  while ((m = rx.exec(section)) !== null) {
    const [, dd, mm, yyyy] = m
    const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
    if (!isNaN(d.getTime())) dates.push(d)
  }
  return dates
}
