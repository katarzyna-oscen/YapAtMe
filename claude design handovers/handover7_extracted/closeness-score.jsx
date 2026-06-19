// Closeness scoring for People cards.
//
// Mirrors the production signature:
//   calculateCloseness(personFilePath, tasksIndex, mentionEntries)
//
//   personFilePath  e.g. "people/sophie.md"
//   tasksIndex      flat array of task records: { file, status, resolved_at, last_updated }
//   mentionEntries  array of mention dates (Date | ISO string) parsed from the
//                   person's "## Recent Mentions" section
//
// Score = mention recency + open/completed/aging task signal. Higher = closer.

function closenessTierForScore(score) {
  if (score >= 100) return { label: "bestie",     bars: 5, tier: "bestie", score };
  if (score >= 50)  return { label: "close",      bars: 5, tier: "active", score };
  if (score >= 30)  return { label: "regular",    bars: 4, tier: "active", score };
  if (score >= 18)  return { label: "moderate",   bars: 3, tier: "active", score };
  if (score >= 8)   return { label: "occasional", bars: 2, tier: "muted",  score };
  return              { label: "distant",         bars: 1, tier: "muted",  score };
}

function calculateCloseness(personFilePath, tasksIndex, mentionEntries) {
  const now = window.MEM_NOW || new Date();
  const daysSince = (d) => Math.floor((now - new Date(d)) / 86400000);

  let score = 0;

  // Mentions — every individual mention counts, weighted by recency.
  (mentionEntries || []).forEach((date) => {
    const daysAgo = daysSince(date);
    if (daysAgo <= 7) score += 8;
    else if (daysAgo <= 14) score += 5;
    else if (daysAgo <= 30) score += 3;
    else if (daysAgo <= 90) score += 1;
    // older than 90 days: +0
  });

  // Tasks linked to this person's file.
  const idx = tasksIndex || [];
  const personTasks = idx.filter((t) => t.file === personFilePath && t.status === "open");
  const completedRecent = idx.filter((t) =>
    t.file === personFilePath && t.status === "done" && daysSince(t.resolved_at) <= 30);
  const completedOlder = idx.filter((t) =>
    t.file === personFilePath && t.status === "done" &&
    daysSince(t.resolved_at) > 30 && daysSince(t.resolved_at) <= 90);
  const agingTasks = personTasks.filter((t) => daysSince(t.last_updated) > 14);

  score += Math.min(personTasks.length * 4, 20); // open tasks, cap 20
  score += completedRecent.length * 4;           // completed in last 30 days
  score += completedOlder.length * 2;            // completed in last 90 days
  score -= agingTasks.length * 4;                // aging tasks penalty

  return closenessTierForScore(score);
}

Object.assign(window, { calculateCloseness, closenessTierForScore });
