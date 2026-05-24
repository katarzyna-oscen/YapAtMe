import { useState, useEffect, useCallback } from 'react'
import { parseFrontmatter } from '../lib/frontmatter'
import { readTasksIndex } from '../lib/tasksIndex'
import { callLLM } from '../lib/llm'
import DashboardTop from './dashboard-top'
import DashboardSections from './dashboard-sections'

const WEEK_SUMMARY_PATH = 'context/week-summary.json'
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      counts[date] = (counts[date] || 0) + 2
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

function computeNeedsCall(tasks, projects, people) {
  const items = []
  for (const task of tasks) {
    const isUrgent = task.tags?.some(t => t === 'urgent' || t === 'important')
    if (isUrgent) items.push({
      id: task.id, kind: 'task', title: task.title, file: task.file,
      reason: `${task.tags.find(t => t === 'urgent' || t === 'important')} — ${task.section.replace('## ', '')}`,
      age: daysAgo(task.last_updated),
    })
  }
  for (const p of projects) {
    if (p.status === 'Done') continue
    const age = daysAgo(p.last_updated)
    if (age >= STALE_PROJECT_DAYS) items.push({
      id: p.path, kind: 'project', title: p.name, file: p.path,
      reason: `${age}d since last update — revisit or drop`, age,
    })
  }
  for (const p of people) {
    const age = daysAgo(p.last_updated)
    if (age >= LAPSED_PERSON_DAYS) items.push({
      id: p.path, kind: 'person', title: p.full_name, file: p.path,
      reason: `no contact in ${age} days`, age,
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
  const [summaryLoading, setSummaryLoading] = useState(false)

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

      const projectList = rawProjects.map(({ path, fields }) => ({
        path,
        name:         fields.name || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        status:       fields.status || 'Untriaged',
        core_problem: fields.core_problem || '',
        domain:       fields.domain || '',
        last_updated: fields.last_updated || '',
        openActions:  openTasks.filter(t => t.file === path && t.section === '## Open Actions').length,
      }))

      const peopleList = rawPeople.map(({ path, fields }) => ({
        path,
        full_name:    fields.full_name || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        role:         fields.role || '',
        last_updated: fields.last_updated || '',
        cadence:      computeCadence(path, allTasks, fields.last_updated),
      }))

      const ideaList = rawIdeas.map(({ path, fields }) => ({
        path,
        name:         fields.name || fields.title || path.split('/').pop().replace('.md', '').replace(/-/g, ' '),
        status:       fields.status || 'Spark',
        last_updated: fields.last_updated || fields.origin || '',
      }))

      const order      = settings?.dashboardOrder || {}
      const tasksOrder = settings?.tasksOrder || []

      setProjects(applyOrder(projectList, order.projects, p => p.path))
      setPeople(applyOrder(peopleList,    order.people,   p => p.path))
      setIdeas(applyOrder(ideaList,       order.ideas,    i => i.path))
      setTasks(applyOrder(openTasks,      tasksOrder,     t => t.id))

      setActivity(buildActivityData(allTasks, inboxFiles))
      setNeedsCall(computeNeedsCall(openTasks, projectList, peopleList))

      let savedSummary = null
      try { savedSummary = JSON.parse(await readFile(WEEK_SUMMARY_PATH)) } catch {}
      setWeekSummary(savedSummary)
    } catch (err) {
      console.error('Dashboard load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [readFile, listTree, settings?.dashboardOrder, settings?.tasksOrder])

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
        weekSummary={weekSummary}
        summaryLoading={summaryLoading}
        hasApiKey={!!settings?.apiKey}
        onGenerateSummary={handleGenerateSummary}
        onNavigate={setPage}
      />
      <DashboardSections
        projects={projects}
        tasks={tasks}
        people={people}
        ideas={ideas}
        onResolveTask={handleResolveTask}
        onOrderChange={handleOrderChange}
        onNavigate={setPage}
      />
    </div>
  )
}
