import { useState, useEffect, useCallback } from 'react'
import { parseFrontmatter } from '../lib/frontmatter'
import { readTasksIndex } from '../lib/tasksIndex'
import { callLLM } from '../lib/llm'
import { rebuildContext } from '../lib/rebuildContext'
import DashboardTop from './dashboard-top'
import DashboardSections from './dashboard-sections'

const WEEK_SUMMARY_PATH = 'context/week-summary.json'
const DAILY_UPDATES_PATH = 'context/daily-updates.json'
const CONTEXT_PATH = 'context/_context.md'
const ACTIVITY_LOG_PATH = 'context/activity-log.json'
const STALE_PROJECT_DAYS = 21
const LAPSED_PERSON_DAYS = 28
const CADENCE_WINDOW_DAYS = 30

export function daysAgo(dateStr) {
  if (!dateStr) return 999
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d)) return 999
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function normalizeFiles(tree, folder) {
  if (Array.isArray(tree)) {
    const dir = tree.find(e => e?.kind === 'directory' && e.name === folder)
    return (dir?.children || []).filter(e => e?.kind === 'file' && e.name.endsWith('.md') && !e.name.startsWith('_'))
  }
  return (tree?.[folder] || []).filter(e => e.name?.endsWith('.md') && !e.name.startsWith('_'))
}

async function readFrontmatters(readFile, files, folder) {
  return Promise.all(
    files.map(async (file) => {
      const path = file.path || `${folder}/${file.name}`
      try {
        const raw = await readFile(path)
        const { fields } = parseFrontmatter(raw)
        return { path, fields }
      } catch {
        return { path, fields: {} }
      }
    })
  )
}

function extractContextSection(markdown, heading) {
  const text = String(markdown || '')
  // NOTE: do NOT use the `m` flag here — it makes `$` match end-of-line, causing
  // the lazy [\s\S]*? to stop after the first line and return only one bullet.
  const match = text.match(new RegExp(`(?:^|\\n)##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|\\s*$)`, 'i'))
  const section = match?.[1]?.trim() || ''
  console.log(`[extractContextSection] "${heading}":`, JSON.stringify(section.slice(0, 300)))
  return section || null
}

export function applyOrder(items, storedIds, getKey) {
  if (!storedIds?.length) return items
  const orderMap = new Map(storedIds.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const ai = orderMap.has(getKey(a)) ? orderMap.get(getKey(a)) : Infinity
    const bi = orderMap.has(getKey(b)) ? orderMap.get(getKey(b)) : Infinity
    return ai - bi
  })
}

function computeCadence(personPath, tasks, lastUpdated) {
  const cutoff = Date.now() - CADENCE_WINDOW_DAYS * 86_400_000
  const recentMentions = tasks.filter(t =>
    t.file === personPath &&
    new Date(`${t.last_updated}T00:00:00`).getTime() > cutoff
  ).length
  const age = daysAgo(lastUpdated)
  if (recentMentions >= 3 || age <= 7)  return 5
  if (recentMentions >= 2 || age <= 14) return 4
  if (recentMentions >= 1 || age <= 21) return 3
  if (age <= 30)                         return 2
  return 1
}

function buildActivityData(tasks, inboxFiles) {
  const counts = {}
  for (const task of tasks) {
    if (task.last_updated) counts[task.last_updated] = (counts[task.last_updated] || 0) + 1
  }
  for (const file of inboxFiles) {
    const date = file.name.replace('.md', '')
    const ddmmyyyyMatch = date.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (ddmmyyyyMatch) {
      const [, dd, mm, yyyy] = ddmmyyyyMatch
      const isoDate = `${yyyy}-${mm}-${dd}`
      counts[isoDate] = (counts[isoDate] || 0) + 2
    }
  }
  const cells = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: d, count: counts[key] || 0 })
  }
  return cells
}

function computeNeedsCall(tasks, enabledModules = {}) {
  const items = []
  for (const task of tasks) {
    const folder = String(task.file || '').split('/')[0]
    if ((folder === 'projects' || folder === 'people' || folder === 'ideas') && enabledModules?.[folder] === false) {
      continue
    }
    const isUrgent = task.tags?.some(t => {
      const tag = String(t || '').toLowerCase()
      return tag === 'urgent' || tag === 'important' || tag === 'priority'
    })
    if (isUrgent) items.push({
      id: task.id, kind: 'task', title: task.title, file: task.file,
      reason: `${task.tags.find(t => t === 'urgent' || t === 'important')} — ${task.section.replace('## ', '')}`,
      age: daysAgo(task.last_updated),
    })
  }
  return items.sort((a, b) => b.age - a.age)
}

export default function CommandPage({ readFile, writeFile, listTree, settings, saveSettings, setPage }) {
  const [loading, setLoading]               = useState(true)
  const [projects, setProjects]             = useState([])
  const [people, setPeople]                 = useState([])
  const [ideas, setIdeas]                   = useState([])
  const [tasks, setTasks]                   = useState([])
  const [activityData, setActivity]         = useState([])
  const [needsCall, setNeedsCall]           = useState([])
  const [weekSummary, setWeekSummary]       = useState(null)
  const [dailyUpdates, setDailyUpdates]     = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [updatesLoading, setUpdatesLoading] = useState(false)
  const [contextNarrative, setContextNarrative] = useState(null)
  const [contextFocus, setContextFocus] = useState(null)
  const [contextLastRebuild, setContextLastRebuild] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)

  const loadContextSnapshot = useCallback(async () => {
    let contextMarkdown = ''
    let lastRebuild = null

    try { contextMarkdown = await readFile(CONTEXT_PATH) } catch {}
    try {
      const raw = await readFile(ACTIVITY_LOG_PATH)
      const parsed = JSON.parse(raw)
      lastRebuild = parsed?.last_rebuild || null
    } catch {}

    setContextNarrative(extractContextSection(contextMarkdown, 'Narrative thread'))
    setContextFocus(extractContextSection(contextMarkdown, 'Current focus'))
    setContextLastRebuild(lastRebuild)
  }, [readFile])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tree, allTasks] = await Promise.all([listTree(), readTasksIndex(readFile)])
      const openTasks = allTasks.filter(t => t.status !== 'done')

      const projectFiles = normalizeFiles(tree, 'projects')
      const peopleFiles  = normalizeFiles(tree, 'people')
      const ideaFiles    = normalizeFiles(tree, 'ideas')
      const inboxFiles   = normalizeFiles(tree, 'inbox')

      const [rawProjects, rawPeople, rawIdeas] = await Promise.all([
        readFrontmatters(readFile, projectFiles, 'projects'),
        readFrontmatters(readFile, peopleFiles,  'people'),
        readFrontmatters(readFile, ideaFiles,    'ideas'),
      ])

      const projectList = rawProjects.map(({ path, fields }) => {
        const safeFields = fields || {}
        return ({
        path,
        name:         safeFields.name || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        status:       safeFields.status || 'Untriaged',
        core_problem: safeFields.core_problem || '',
        domain:       safeFields.domain || '',
        last_updated: safeFields.last_updated || '',
        openActions:  openTasks.filter(t => t.file === path && t.section === '## Open Actions').length,
      })
      })

      const peopleList = rawPeople.map(({ path, fields }) => {
        const safeFields = fields || {}
        return ({
        path,
        full_name:    safeFields.full_name || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        role:         safeFields.role || '',
        last_updated: safeFields.last_updated || '',
        cadence:      computeCadence(path, allTasks, safeFields.last_updated),
      })
      })

      const ideaList = rawIdeas.map(({ path, fields }) => {
        const safeFields = fields || {}
        return ({
        path,
        name:         safeFields.name || safeFields.title || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        status:       safeFields.status || 'Spark',
        last_updated: safeFields.last_updated || safeFields.origin || '',
      })
      })

      const order      = settings?.dashboardOrder || {}
      const tasksOrder = settings?.tasksOrder || []

      setProjects(applyOrder(projectList, order.projects, p => p.path))
      setPeople(applyOrder(peopleList,    order.people,   p => p.path))
      setIdeas(applyOrder(ideaList,       order.ideas,    i => i.path))
      setTasks(applyOrder(openTasks,      tasksOrder,     t => t.id))

      setActivity(buildActivityData(allTasks, inboxFiles))
      setNeedsCall(computeNeedsCall(openTasks, settings?.enabledModules || {}))

      const [savedSummary, savedUpdates] = await Promise.all([
        (async () => {
          try { return JSON.parse(await readFile(WEEK_SUMMARY_PATH)) } catch { return null }
        })(),
        (async () => {
          try { return JSON.parse(await readFile(DAILY_UPDATES_PATH)) } catch { return null }
        })(),
      ])

      setWeekSummary(savedSummary)
      setDailyUpdates(savedUpdates)
      await loadContextSnapshot()
    } catch (err) {
      console.error('Dashboard load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [readFile, listTree, settings?.dashboardOrder, settings?.tasksOrder, loadContextSnapshot])

  useEffect(() => { loadData() }, [loadData])

  const handleOrderChange = useCallback(async (section, orderedItems) => {
    if (section === 'tasks') {
      const newOrder = orderedItems.map(t => t.id)
      await saveSettings({ ...settings, tasksOrder: newOrder })
    } else {
      const newOrder = orderedItems.map(i => i.path)
      const next = { ...(settings?.dashboardOrder || {}), [section]: newOrder }
      await saveSettings({ ...settings, dashboardOrder: next })
    }
  }, [settings, saveSettings])

  const handleGenerateSummary = async () => {
    if (!settings?.apiKey) return
    setSummaryLoading(true)
    try {
      let ctx = ''
      try { ctx = await readFile('context/_context.md') } catch {}
      const projectSummary = projects
        .filter(p => p.status !== 'Done')
        .map(p => `- ${p.name} [${p.status}] — ${p.core_problem || 'no summary'} (updated ${p.last_updated || 'unknown'})`)
        .join('\n')
      const prompt = `You are summarising a personal knowledge vault for a weekly digest.\n\nCurrent working memory:\n${ctx}\n\nActive projects:\n${projectSummary}\n\nOpen tasks: ${tasks.length} total\n\nWrite a 3–4 sentence plain prose summary of the week: what's moving, what's stale, what needs attention. Be specific — use project and person names. No bullet points. No preamble.`
      const raw = await callLLM(
        [{ role: 'user', content: prompt }],
        'You generate concise weekly digests from knowledge vault context.',
        settings
      )
      const result = { text: raw.trim(), generated_at: new Date().toISOString() }
      await writeFile(WEEK_SUMMARY_PATH, JSON.stringify(result, null, 2))
      setWeekSummary(result)
    } catch (err) {
      console.error('Week summary generation failed:', err)
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleRebuildContext = useCallback(async () => {
    if (!settings?.apiKey) return
    setContextLoading(true)
    try {
      await rebuildContext(readFile, writeFile, settings, listTree)
      await loadContextSnapshot()
    } catch (err) {
      console.error('Context rebuild failed:', err)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('memostack:toast', {
          detail: { message: `Context rebuild failed: ${err?.message || 'Unknown error'}` },
        }))
      }
    } finally {
      setContextLoading(false)
    }
  }, [readFile, writeFile, settings, listTree, loadContextSnapshot])

  const handleGenerateUpdates = async () => {
    if (!settings?.apiKey) return
    setUpdatesLoading(true)
    try {
      const allTasks = await readTasksIndex(readFile)
      const y = new Date(Date.now() - 86_400_000)
      const yesterday = y.toISOString().slice(0, 10)

      const doneYesterday = allTasks
        .filter((t) => t.status === 'done' && t.resolved_at === yesterday)
        .slice(0, 20)

      const doneLines = doneYesterday
        .map((t) => `- ${t.title} (${t.file?.split('/').pop()?.replace('.md', '') || 'unknown'})`)
        .join('\n')

      // Show source tasks as a reference comment
      const sourceComment = doneYesterday.length > 0 
        ? `[Source: ${doneYesterday.length} completed task(s) from ${yesterday}]`
        : '[Source: No completed tasks]'

      const prompt = `Generate a concise bullet-point summary of these completed tasks. Convert all task titles to PAST TENSE. DO NOT REPHRASE, COMBINE, OR ADD TASKS. Use the exact task titles provided, but convert to past tense.

Completed yesterday (${yesterday}):
${doneLines || '(none)'}

Instructions:
- Output ONLY bullets matching the list above
- Convert each task title to PAST TENSE (e.g., "Discuss X" → "Discussed X", "Review Y" → "Reviewed Y")
- Do NOT rephrase or reword task titles beyond tense conversion
- Do NOT combine multiple tasks into one bullet
- Do NOT include tasks not in the list above
- Output 1-6 bullets exactly
- If no tasks, output: "No completed tasks yesterday."`

      const raw = await callLLM(
        [{ role: 'user', content: prompt }],
        'You generate updates by directly using completed task titles with no rephrasing.',
        settings
      )

      const result = { 
        text: raw.trim(),
        sourceComment: sourceComment,
        generated_at: new Date().toISOString(),
        sourceCount: doneYesterday.length 
      }
      await writeFile(DAILY_UPDATES_PATH, JSON.stringify(result, null, 2))
      setDailyUpdates(result)
    } catch (err) {
      console.error('Daily updates generation failed:', err)
    } finally {
      setUpdatesLoading(false)
    }
  }

  const handleResolveTask = async (taskId) => {
    const { resolveTaskEntry } = await import('../lib/tasksIndex')
    await resolveTaskEntry(readFile, writeFile, taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const stats = {
    projects: projects.length,
    stale:    projects.filter(p => p.status !== 'Done' && daysAgo(p.last_updated) >= STALE_PROJECT_DAYS).length,
    actions:  tasks.length,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <DashboardTop
        stats={stats}
        activityData={activityData}
        needsCall={needsCall}
        narrativeThread={contextNarrative}
        currentFocus={contextFocus}
        contextLastRebuild={contextLastRebuild}
        contextLoading={contextLoading}
        weekSummary={weekSummary}
        dailyUpdates={dailyUpdates}
        summaryLoading={summaryLoading}
        updatesLoading={updatesLoading}
        hasApiKey={!!settings?.apiKey}
        onGenerateSummary={handleGenerateSummary}
        onGenerateUpdates={handleGenerateUpdates}
        onRebuildContext={handleRebuildContext}
        onResolveTask={handleResolveTask}
        onNavigate={setPage}
        sectionConfig={settings?.dashboardSections || {}}
      />
      <DashboardSections
        projects={projects}
        tasks={tasks}
        people={people}
        ideas={ideas}
        onResolveTask={handleResolveTask}
        onOrderChange={handleOrderChange}
        onNavigate={setPage}
        enabledModules={settings?.enabledModules || { projects: true, people: true, ideas: true }}
        sectionConfig={settings?.dashboardSections || {}}
      />
    </div>
  )
}
