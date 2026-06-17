import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { deleteTaskEntry, resolveTaskEntry, unresolveTaskEntry, notifyTasksIndexChanged, archiveDoneTasks } from '../lib/tasksIndex'
import { addTaskComment } from '../lib/taskMarker'

const TASK_CATEGORIES = [
  { id: 'needs-call', label: 'Needs Your Call', hue: 25, description: 'blockers and decisions waiting on you' },
  { id: 'talk-about', label: 'Talk About', hue: 80, description: 'follow-up conversations to have' },
  { id: 'actions', label: 'Actions', hue: 150, description: 'work to do yourself' },
  { id: 'delegate', label: 'Delegate', hue: 230, description: 'to hand off to someone else' },
  { id: 'decisions', label: 'Decisions', hue: 80, description: 'calls to make, options to weigh' },
  { id: 'done', label: 'Done', hue: 260, description: 'completed tasks', isDone: true },
]

const SECTION_TO_CATEGORY = {
  '## Open Actions': 'actions',
  '## Delegations': 'delegate',
  '## Delegate': 'delegate',
  '## Decisions': 'decisions',
  '## Talk About': 'talk-about',
  '## My Actions': 'actions',
}

const CATEGORY_TO_SECTION = {
  actions: '## Open Actions',
  delegate: '## Delegate',
  decisions: '## Decisions',
  'needs-call': '## Talk About',
  'talk-about': '## Talk About',
}

const CATEGORY_IDS = new Set(TASK_CATEGORIES.map((category) => category.id))

function inferTaskModule(task) {
  const file = String(task?.file || '')
  if (file.includes('/')) {
    const folder = file.split('/')[0]
    if (folder === 'projects' || folder === 'people' || folder === 'ideas') return folder
    return null
  }
  return null
}

function normalizeTaskDisplayText(raw) {
  let text = String(raw || '').trim()
  if (!text) return ''

  text = text.replace(/^#\s*\d{2}-\d{2}-\d{4}\s+/i, '')
  text = text.replace(/\\\[\[/g, '[[').replace(/\\\]\]/g, ']]')
  text = text.replace(/\[\[\[+\s*([^\]]+?)\s*\]+\]\]/g, '[[$1]]')
  text = text.replace(/\[{4,}\s*([^\]]+?)\s*\]{4,}/g, '[[$1]]')

  return text.replace(/\s+/g, ' ').trim()
}

function indexEntryToTask(entry) {
  if (entry.status === 'archived') return null
  // Plan steps live in the Plans view, not Tasks
  if (entry.section === '## Current Plan') return null

  let inferredCategory = entry.status === 'done'
    ? 'done'
    : (CATEGORY_IDS.has(entry.category) ? entry.category : (SECTION_TO_CATEGORY[entry.section] ?? 'actions'))

  // Backward compatibility for old Talk About entries stored as needs-call.
  if (
    inferredCategory === 'needs-call'
    && entry.section === '## Talk About'
    && !Array.isArray(entry.tags)
  ) {
    inferredCategory = 'talk-about'
  }

  if (
    inferredCategory === 'needs-call'
    && entry.section === '## Talk About'
    && Array.isArray(entry.tags)
    && !entry.tags.some((tag) => ['urgent', 'important', 'priority'].includes(String(tag).toLowerCase()))
  ) {
    inferredCategory = 'talk-about'
  }

  // Promote urgent/important tasks from other categories to needs-call so they surface
  // prominently in the TasksPage view, matching the CommandPage behavior.
  if (Array.isArray(entry.tags) && entry.tags.some((tag) => ['urgent', 'important', 'priority'].includes(String(tag).toLowerCase()))) {
    if (['actions', 'talk-about'].includes(inferredCategory)) {
      inferredCategory = 'needs-call'
    }
  }

  return {
    id: entry.id,
    text: normalizeTaskDisplayText(entry.title),
    project: entry.file?.split('/').pop().replace('.md', '') ?? '—',
    file: entry.file,
    section: entry.section,
    category: inferredCategory,
    prevCategory: entry.prevCategory ?? null,
    created: new Date(entry.last_updated ?? Date.now()),
    done: entry.status === 'done',
    comments: (entry.comments || []).map((comment) => ({ ...comment, ts: new Date(comment.ts) })),
  }
}

export default function TasksPage({ readFile, writeFile, fileExists, listTree, settings }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftEntityPath, setDraftEntityPath] = useState(null)
  const [draftCategory, setDraftCategory] = useState('actions')

  const [expandedComments, setExpandedComments] = useState(() => new Set())
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [overEmptyCat, setOverEmptyCat] = useState(null)

  const inputRef = useRef(null)

  useEffect(() => { loadTasks() }, [])
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const raw = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw)
      const loaded = entries.map(indexEntryToTask).filter(Boolean)
      setTasks(loaded)
      setExpandedComments(new Set())
    } catch {
      setTasks([])
    }
    setLoading(false)
  }

  const setCommentsExpanded = useCallback((id, open) =>
    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    }),
  [])

  const visibleTasks = useMemo(() => {
    const enabledModules = settings?.enabledModules || {}
    return tasks.filter((task) => {
      const moduleId = inferTaskModule(task)
      if (!moduleId) return true
      return enabledModules[moduleId] !== false
    })
  }, [tasks, settings?.enabledModules])

  const tasksWithComments = useMemo(
    () => visibleTasks.filter((task) => task.comments.length > 0),
    [visibleTasks]
  )
  const anyExpanded = tasksWithComments.some((task) => expandedComments.has(task.id))

  const removeTaskFromIndex = useCallback(async (taskId) => {
    try {
      const raw = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw)
      const next = Array.isArray(entries) ? entries.filter((entry) => entry.id !== taskId) : []
      await writeFile('context/tasks-index.json', JSON.stringify(next, null, 2))
      notifyTasksIndexChanged()
    } catch {}
  }, [readFile, writeFile])

  const handleAddComment = useCallback(async (taskId, text) => {
    const comment = { id: `c-${Date.now()}`, text, ts: new Date() }
    setTasks((prev) => prev.map((task) =>
      task.id === taskId ? { ...task, comments: [...task.comments, comment] } : task,
    ))
    setCommentsExpanded(taskId, true)
    try {
      await addTaskComment(readFile, writeFile, taskId, text)
    } catch {}
  }, [readFile, writeFile, setCommentsExpanded])

  const handleUpdateComment = useCallback(async (taskId, commentId, text) => {
    const nextText = text.trim()
    if (!nextText) return
    const editedAt = new Date()

    setTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task
      return {
        ...task,
        comments: task.comments.map((comment) =>
          comment.id === commentId ? { ...comment, text: nextText, ts: editedAt } : comment,
        ),
      }
    }))

    try {
      const raw = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw)
      const next = (Array.isArray(entries) ? entries : []).map((entry) => {
        if (entry.id !== taskId) return entry
        return {
          ...entry,
          comments: (entry.comments || []).map((comment) =>
            comment.id === commentId ? { ...comment, text: nextText, ts: editedAt.toISOString() } : comment,
          ),
          last_updated: new Date().toISOString().slice(0, 10),
        }
      })
      await writeFile('context/tasks-index.json', JSON.stringify(next, null, 2))
      notifyTasksIndexChanged()
    } catch (err) {
      console.error('Update comment failed:', err?.message || err)
    }
  }, [readFile, writeFile])

  const persistTaskMeta = useCallback(async (taskId, patch) => {
    try {
      const raw = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw)
      const today = new Date().toISOString().slice(0, 10)
      const next = (Array.isArray(entries) ? entries : []).map((entry) => {
        if (entry.id !== taskId) return entry

        const updated = { ...entry, last_updated: today }

        if (typeof patch.status === 'string') updated.status = patch.status
        if (typeof patch.category === 'string' && CATEGORY_IDS.has(patch.category)) {
          updated.category = patch.category
          if (patch.category !== 'done') {
            updated.section = CATEGORY_TO_SECTION[patch.category] ?? updated.section
          }
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'prevCategory')) {
          updated.prevCategory = patch.prevCategory ?? null
        }

        return updated
      })
      await writeFile('context/tasks-index.json', JSON.stringify(next, null, 2))
      notifyTasksIndexChanged()
    } catch (err) {
      console.error('Persist task meta failed:', err?.message || err)
    }
  }, [readFile, writeFile])

  const updateTask = useCallback(async (taskId, patch) => {
    setTasks((prev) => prev.map((item) => {
      if (item.id !== taskId) return item

      const nextFile = Object.prototype.hasOwnProperty.call(patch, 'file')
        ? (patch.file || 'context/tasks-index.json')
        : item.file
      const nextProject = nextFile === 'context/tasks-index.json'
        ? '—'
        : (nextFile?.split('/').pop()?.replace('.md', '') || '—')

      return {
        ...item,
        ...patch,
        file: nextFile,
        project: nextProject,
      }
    }))

    try {
      const raw = await readFile('context/tasks-index.json')
      const entries = JSON.parse(raw)
      const today = new Date().toISOString().slice(0, 10)
      const next = (Array.isArray(entries) ? entries : []).map((entry) => {
        if (entry.id !== taskId) return entry

        const updated = { ...entry, last_updated: today }

        if (typeof patch.text === 'string') updated.title = patch.text
        if (Object.prototype.hasOwnProperty.call(patch, 'file')) {
          const linkedFile = patch.file || 'context/tasks-index.json'
          updated.file = linkedFile
          updated.module = linkedFile === 'context/tasks-index.json' ? 'projects' : linkedFile.split('/')[0]
        }
        if (typeof patch.category === 'string' && CATEGORY_IDS.has(patch.category)) {
          updated.category = patch.category
          if (patch.category !== 'done' && updated.status !== 'done') updated.section = CATEGORY_TO_SECTION[patch.category]
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'prevCategory')) {
          updated.prevCategory = patch.prevCategory ?? null
        }
        if (typeof patch.status === 'string') {
          updated.status = patch.status
        }

        return updated
      })
      await writeFile('context/tasks-index.json', JSON.stringify(next, null, 2))
      notifyTasksIndexChanged()
    } catch (err) {
      console.error('Update task failed:', err?.message || err)
    }
  }, [readFile, writeFile])

  const toggle = useCallback(async (id) => {
    const task = tasks.find((item) => item.id === id)
    if (!task) return

    const nowDone = !task.done
    const previousCategory = task.category === 'done'
      ? (task.prevCategory || 'actions')
      : task.category
    const restoreCategory = task.prevCategory && task.prevCategory !== 'done'
      ? task.prevCategory
      : (SECTION_TO_CATEGORY[task.section ?? ''] ?? 'actions')

    setTasks((prev) => prev.map((item) =>
      item.id === id
        ? {
          ...item,
          done: nowDone,
          category: nowDone ? 'done' : restoreCategory,
          prevCategory: nowDone ? previousCategory : null,
        }
        : item,
    ))

    try {
      if (nowDone) {
        await resolveTaskEntry(readFile, writeFile, id)
      } else {
        await unresolveTaskEntry(readFile, writeFile, id)
      }

      await persistTaskMeta(id, {
        category: nowDone ? 'done' : restoreCategory,
        prevCategory: nowDone ? previousCategory : null,
      })
    } catch (err) {
      console.error('Toggle failed:', err.message)
      setTasks((prev) => prev.map((item) =>
        item.id === id ? { ...item, done: task.done, category: task.category, prevCategory: task.prevCategory ?? null } : item,
      ))
    }
  }, [tasks, persistTaskMeta, readFile, writeFile])

  const addTask = useCallback(async () => {
    const text = draft.trim()
    if (!text) {
      setAdding(false)
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const newId = crypto.randomUUID()
    const section = CATEGORY_TO_SECTION[draftCategory] ?? '## Open Actions'
    const projFile = draftEntityPath ?? null

    const newEntry = {
      id: newId,
      file: projFile ?? 'context/tasks-index.json',
      module: projFile ? projFile.split('/')[0] : 'projects',
      title: text,
      category: draftCategory,
      section,
      status: 'open',
      tags: [],
      last_updated: today,
      comments: [],
    }

    setTasks((prev) => [indexEntryToTask(newEntry), ...prev])
    setDraft('')
    setDraftEntityPath(null)
    setAdding(false)

    try {
      let entries = []
      try {
        entries = JSON.parse(await readFile('context/tasks-index.json'))
      } catch {}

      entries.unshift(newEntry)
      await writeFile('context/tasks-index.json', JSON.stringify(entries, null, 2))
      notifyTasksIndexChanged()
    } catch (err) {
      console.error('Add task failed:', err.message)
    }
  }, [draft, draftEntityPath, draftCategory, readFile, writeFile])

  const removeAllDone = useCallback(async () => {
    const count = await archiveDoneTasks(readFile, writeFile)
    console.log(`[TasksPage] archiveDoneTasks: archived ${count} tasks`)
    setTasks((prev) => prev.filter((task) => !task.done))
  }, [readFile, writeFile])

  const moveTask = useCallback((fromId, toCategory, toBeforeId) => {
    const fromTask = tasks.find((task) => task.id === fromId)
    setTasks((arr) => {
      const fromIdx = arr.findIndex((task) => task.id === fromId)
      if (fromIdx < 0) return arr

      const source = arr[fromIdx]
      const movedToDone = toCategory === 'done'
      const sourcePrev = source.prevCategory || 'actions'
      const moved = {
        ...source,
        category: toCategory,
        done: movedToDone ? true : source.done,
        prevCategory: movedToDone
          ? (source.category === 'done' ? sourcePrev : source.category)
          : (source.category === 'done' ? null : source.prevCategory),
      }
      const without = arr.filter((task) => task.id !== fromId)

      if (toBeforeId == null) {
        let insertAt = without.length
        for (let i = without.length - 1; i >= 0; i -= 1) {
          if (without[i].category === toCategory) {
            insertAt = i + 1
            break
          }
        }
        without.splice(insertAt, 0, moved)
      } else {
        const toIdx = without.findIndex((task) => task.id === toBeforeId)
        without.splice(toIdx < 0 ? without.length : toIdx, 0, moved)
      }

      return without
    })

    if (fromTask && fromTask.category !== toCategory) {
      const movedToDone = toCategory === 'done'
      const nextPrevCategory = movedToDone
        ? (fromTask.category === 'done' ? (fromTask.prevCategory || 'actions') : fromTask.category)
        : (fromTask.category === 'done' ? null : fromTask.prevCategory)
      const nextStatus = movedToDone ? 'done' : (fromTask.done ? 'open' : undefined)

      persistTaskMeta(fromId, {
        category: toCategory,
        prevCategory: nextPrevCategory,
        ...(nextStatus ? { status: nextStatus } : {}),
      })
    }
  }, [tasks, persistTaskMeta])

  const dragHandlersFor = useCallback((id, catId) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', id) } catch {}
    },
    onDragEnter: (e) => {
      e.preventDefault()
      if (id !== dragId) {
        setOverId(id)
        setOverEmptyCat(null)
      }
    },
    onDragOver: (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) {
        setDragId(null)
        setOverId(null)
        return
      }
      moveTask(dragId, catId, id)
      setDragId(null)
      setOverId(null)
      setOverEmptyCat(null)
    },
    onDragEnd: () => {
      setDragId(null)
      setOverId(null)
      setOverEmptyCat(null)
    },
  }), [dragId, moveTask])

  const byCategory = useMemo(() => {
    const map = new Map(TASK_CATEGORIES.map((category) => [category.id, []]))
    visibleTasks.forEach((task) => {
      const cat = map.has(task.category) ? task.category : 'actions'
      map.get(cat).push(task)
    })
    return map
  }, [visibleTasks])

  const remaining = visibleTasks.filter((task) => !task.done).length
  const completed = visibleTasks.filter((task) => task.done).length

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 48px 20px', borderBottom: '1px solid var(--border-subtle)', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--text)' }}>
            Tasks
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-very-dim)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{remaining}</span> open
            <span style={{ margin: '0 8px', color: 'var(--border-strong)' }}>·</span>
            <span style={{ color: 'var(--text-dim)' }}>{completed} done</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tasksWithComments.length > 0 && (
            <ToggleCommentsButton
              anyOpen={anyExpanded}
              count={tasksWithComments.length}
              onClick={anyExpanded
                ? () => setExpandedComments(new Set())
                : () => setExpandedComments(new Set(tasksWithComments.map((task) => task.id)))}
            />
          )}
          <AddTaskButton onClick={() => setAdding(true)} />
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 48px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {adding && (
          <DraftRow
            draft={draft}
            setDraft={setDraft}
            entityPath={draftEntityPath}
            setEntityPath={setDraftEntityPath}
            category={draftCategory}
            setCategory={setDraftCategory}
            inputRef={inputRef}
            onCommit={addTask}
            onCancel={() => {
              setDraft('')
              setDraftEntityPath(null)
              setAdding(false)
            }}
            listTree={listTree}
            enabledModules={settings?.enabledModules}
          />
        )}

        {TASK_CATEGORIES.map((cat) => {
          const peopleModuleEnabled = settings?.enabledModules?.people !== false
          if (!peopleModuleEnabled && (cat.id === 'talk-about' || cat.id === 'delegate')) return null
          const items = byCategory.get(cat.id) || []
          const showDropZone = overEmptyCat === cat.id && items.every((task) => task.id !== dragId)
          if (cat.isDone && items.length === 0) return null

          return (
            <CategorySection
              key={cat.id}
              category={cat}
              count={items.length}
              right={cat.isDone && items.length > 0
                ? <RemoveAllDoneButton onClick={removeAllDone} />
                : null}
              onDragEnter={(e) => { e.preventDefault(); setOverEmptyCat(cat.id); setOverId(null) }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => {
                e.preventDefault()
                if (!dragId) return
                moveTask(dragId, cat.id, null)
                setDragId(null)
                setOverId(null)
                setOverEmptyCat(null)
              }}
            >
              {items.length === 0 && !showDropZone && !cat.isDone && (
                <EmptyHint hue={cat.hue} text={`Drag tasks here · ${cat.description}`} />
              )}
              {showDropZone && <DropPlaceholder hue={cat.hue} />}
              {items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  category={cat}
                  onToggle={() => toggle(task.id)}
                  onUpdate={(patch) => updateTask(task.id, patch)}
                  onAddComment={(text) => handleAddComment(task.id, text)}
                  onUpdateComment={(commentId, text) => handleUpdateComment(task.id, commentId, text)}
                  commentsOpen={expandedComments.has(task.id)}
                  onSetCommentsOpen={(open) => setCommentsExpanded(task.id, open)}
                  onDelete={() => {
                    setTasks((prev) => prev.filter((item) => item.id !== task.id))
                    deleteTaskEntry(readFile, writeFile, task.id).catch(async (err) => {
                      console.error('Remove failed, fallback index removal:', err?.message || err)
                      await removeTaskFromIndex(task.id)
                    })
                  }}
                  isDragging={dragId === task.id}
                  isOver={overId === task.id}
                  dragHandlers={dragHandlersFor(task.id, cat.id)}
                  listTree={listTree}
                  enabledModules={settings?.enabledModules}
                />
              ))}
            </CategorySection>
          )
        })}

        {visibleTasks.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-very-dim)', fontSize: 13 }}>
            No tasks yet — process an inbox note or click Add task above.
          </div>
        )}
      </div>
    </div>
  )
}

function AddTaskButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: hov ? 'oklch(0.80 0.13 80 / 0.22)' : 'oklch(0.80 0.13 80 / 0.12)',
        color: 'oklch(0.88 0.13 80)',
        border: `1px solid ${hov ? 'oklch(0.80 0.13 80 / 0.55)' : 'oklch(0.80 0.13 80 / 0.36)'}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      Add task
    </button>
  )
}

function ClearDoneButton({ count, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Move all done tasks into the Done section"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: hov ? 'var(--panel-2)' : 'var(--panel)',
        color: hov ? 'var(--text)' : 'var(--text-dim)',
        border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 8,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 8 3.5 3.5L13 5" />
      </svg>
      Clear done
      <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 4, background: 'var(--panel-2)', color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {count}
      </span>
    </button>
  )
}

function RemoveAllDoneButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 9px',
        background: hov ? 'oklch(0.70 0.18 22 / 0.16)' : 'transparent',
        color: hov ? 'oklch(0.84 0.16 22)' : 'var(--text-very-dim)',
        border: `1px solid ${hov ? 'oklch(0.70 0.18 22 / 0.40)' : 'var(--border-subtle)'}`,
        borderRadius: 6,
        fontSize: 11.5,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4.5h10" />
        <path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
        <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
      </svg>
      Remove all
    </button>
  )
}

function ToggleCommentsButton({ anyOpen, count, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={anyOpen ? 'Collapse all comments' : 'Expand all comments'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: hov ? 'var(--panel-2)' : 'var(--panel)',
        color: hov ? 'var(--text)' : 'var(--text-dim)',
        border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 8,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H6L3 13v-2.5h-.5z" />
        {anyOpen ? <path d="M5.5 7h5" /> : <><path d="M8 5v4" /><path d="M5.5 7h5" /></>}
      </svg>
      {anyOpen ? 'Collapse comments' : 'Expand comments'}
      <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 4, background: 'var(--panel-2)', color: 'var(--text-dim)', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {count}
      </span>
    </button>
  )
}

function DraftRow({ draft, setDraft, entityPath, setEntityPath, category, setCategory, inputRef, onCommit, onCancel, listTree, enabledModules }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--panel-2)', border: '1px solid var(--accent)', borderRadius: 10 }}>
      <span style={{ width: 18, height: 18, border: '1.5px dashed var(--border-strong)', borderRadius: 5, flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        placeholder="What needs doing?"
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit' }}
      />
      <CategorySelect value={category} onChange={setCategory} />
      <EntitySelector value={entityPath} onChange={setEntityPath} listTree={listTree} enabledModules={enabledModules} />
      <button onClick={onCommit} style={{ padding: '5px 12px', background: 'var(--accent)', color: '#1a1408', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Add
      </button>
      <button onClick={onCancel} style={{ padding: '5px 10px', background: 'transparent', color: 'var(--text-very-dim)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        Cancel
      </button>
    </div>
  )
}

function CategorySelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = TASK_CATEGORIES.find((category) => category.id === value) || TASK_CATEGORIES[0]

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'var(--panel)', color: 'var(--text)', border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .12s' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${current.hue})` }} />
        {current.label}
        <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s' }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, minWidth: 180, padding: 4, background: 'var(--panel-pop)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)' }}>
          {TASK_CATEGORIES.filter((category) => !category.isDone).map((category) => {
            const active = category.id === value
            return (
              <div
                key={category.id}
                onClick={(e) => { e.stopPropagation(); onChange(category.id); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', color: active ? 'var(--text)' : 'var(--text-dim)', fontSize: 12.5 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${category.hue})` }} />
                {category.label}
                {active && <span style={{ marginLeft: 'auto', color: 'var(--text-very-dim)' }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EntitySelector({ value, onChange, listTree, enabledModules }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [entities, setEntities] = useState([])
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const portalRef = useRef(null)

  useEffect(() => {
    if (!open || !listTree) return

    const load = async () => {
      try {
        const tree = await listTree()
        const enabled = enabledModules ?? { projects: true, people: true, ideas: true }
        const result = []
        const folders = [{ key: 'projects' }, { key: 'people' }, { key: 'ideas' }]
        for (const { key } of folders) {
          if (enabled[key] === false) continue
          const files = (tree || []).find((entry) => entry?.name === key)?.children || []
          for (const file of files) {
            if (!file.name.endsWith('.md') || file.name.startsWith('_') || file.name.startsWith('.')) continue
            result.push({ name: file.name.replace('.md', ''), path: `${key}/${file.name}`, type: key })
          }
        }
        setEntities(result)
      } catch {}
    }

    load()
  }, [open, listTree, enabledModules])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      const inAnchor = ref.current?.contains(e.target)
      const inPortal = portalRef.current?.contains(e.target)
      if (!inAnchor && !inPortal) setOpen(false)
    }
    const closeOnScrollOrResize = () => setOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeOnScrollOrResize, true)
    window.addEventListener('resize', closeOnScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeOnScrollOrResize, true)
      window.removeEventListener('resize', closeOnScrollOrResize)
    }
  }, [open])

  const filtered = entities.filter((entity) => !search || entity.name.toLowerCase().includes(search.toLowerCase()))
  const grouped = ['projects', 'people', 'ideas']
    .map((type) => ({ type, label: type.charAt(0).toUpperCase() + type.slice(1), items: filtered.filter((entity) => entity.type === type) }))
    .filter((group) => group.items.length > 0)

  const current = value ? entities.find((entity) => entity.path === value) : null
  const displayName = current?.name ?? (value ? value.split('/').pop().replace('.md', '') : null)
  const displayType = current?.type ?? (value ? value.split('/')[0] : null)
  const anyModules = Object.values(enabledModules ?? {}).some(Boolean)

  if (!anyModules) return null

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const width = 220
      setMenuPos({
        top: r.bottom + 6,
        left: Math.max(8, r.right - width),
      })
    }
    setOpen(true)
    setSearch('')
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (open) setOpen(false)
          else openMenu()
        }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 180, background: 'transparent', border: 'none', outline: 'none', color: displayName ? 'var(--text-dim)' : 'var(--text-very-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px', borderRadius: 4, transition: 'color .12s' }}
      >
        {displayType && <TypeDot type={displayType} />}
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName || 'link entity…'}
        </span>
      </button>

      {open && createPortal(
        <div ref={portalRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 220, width: 220, padding: 4, background: 'var(--panel-pop)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)' }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
            placeholder="Search…"
            style={{ width: '100%', padding: '7px 10px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 4 }}
          />
          {value && (
            <div
              onClick={() => { onChange(null); setOpen(false) }}
              style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-very-dim)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              ✕  Clear link
            </div>
          )}
          {grouped.length === 0 && (
            <div style={{ padding: 10, textAlign: 'center', color: 'var(--text-very-dim)', fontSize: 12 }}>
              {entities.length === 0 ? 'No entities yet' : 'No match'}
            </div>
          )}
          {grouped.map((group) => (
            <div key={group.type}>
              <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-very-dim)' }}>
                {group.label}
              </div>
              {group.items.map((item) => (
                <div
                  key={item.path}
                  onClick={() => { onChange(item.path); setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: item.path === value ? 'var(--text)' : 'var(--text-dim)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)' }}
                  onMouseLeave={(e) => { if (item.path !== value) e.currentTarget.style.background = 'transparent' }}
                >
                  <TypeDot type={item.type} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {item.name}
                  </span>
                  {item.path === value && <span style={{ marginLeft: 'auto', color: 'var(--text-very-dim)' }}>✓</span>}
                </div>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

function TypeDot({ type }) {
  const color = type === 'projects'
    ? 'var(--success)'
    : type === 'people'
      ? 'var(--info)'
      : type === 'ideas'
        ? 'var(--accent)'
        : 'var(--text-very-dim)'
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function CategorySection({ category, count, children, right, onDragEnter, onDragOver, onDrop }) {
  return (
    <section onDragEnter={onDragEnter} onDragOver={onDragOver} onDrop={onDrop}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '0 4px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${category.hue})`, flex: '0 0 6px' }} />
        <h2 style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)', margin: 0 }}>{category.label}</h2>
        <span style={{ fontSize: 11, color: 'var(--text-very-dim)' }}>{count}</span>
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>{children}</div>
    </section>
  )
}

function EmptyHint({ text }) {
  return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-very-dim)', fontStyle: 'italic', fontSize: 12.5 }}>{text}</div>
}

function DropPlaceholder({ hue }) {
  return <div style={{ margin: 10, padding: 14, border: `1.5px dashed oklch(0.78 0.16 ${hue} / 0.6)`, background: `oklch(0.78 0.16 ${hue} / 0.07)`, borderRadius: 8, textAlign: 'center', fontSize: 12, color: `oklch(0.84 0.14 ${hue})` }}>Drop here</div>
}

function AgeChip({ date }) {
  const when = date instanceof Date ? date : new Date(date)
  const days = Math.max(0, Math.floor((Date.now() - when.getTime()) / 86_400_000))

  let hue = 150
  let label = 'fresh'
  if (days >= 45) {
    hue = 8
    label = 'rotting'
  } else if (days >= 21) {
    hue = 22
    label = 'stale'
  } else if (days >= 7) {
    hue = 80
    label = 'aging'
  }

  return (
    <span
      title={`${days}d old`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: `oklch(0.82 0.13 ${hue} / 0.12)`, color: `oklch(0.84 0.13 ${hue})`, border: `1px solid oklch(0.82 0.13 ${hue} / 0.28)`, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'lowercase' }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </span>
  )
}

function TaskRow({ task, category, onToggle, onUpdate, onAddComment, onUpdateComment, commentsOpen, onSetCommentsOpen, onDelete, isDragging, isOver, dragHandlers, listTree, enabledModules }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [hov, setHov] = useState(false)
  const [draft, setDraft] = useState('')
  const menuBtnRef = useRef(null)
  const menuRef = useRef(null)
  const menuPortalRef = useRef(null)
  const commentInputRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      const inAnchor = menuRef.current?.contains(e.target)
      const inPortal = menuPortalRef.current?.contains(e.target)
      if (!inAnchor && !inPortal) setMenuOpen(false)
    }
    const closeOnScroll = () => setMenuOpen(false)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', closeOnScroll)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', closeOnScroll)
    }
  }, [menuOpen])

  const openMenu = () => {
    const r = menuBtnRef.current?.getBoundingClientRect()
    if (r) setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 150) })
    setMenuOpen(true)
  }

  const openComments = () => {
    onSetCommentsOpen(true)
    setMenuOpen(false)
    setTimeout(() => commentInputRef.current?.focus(), 50)
  }

  const submitComment = () => {
    const text = draft.trim()
    if (!text) return
    onAddComment(text)
    setDraft('')
  }

  const linkedEntity = task.file && task.file !== 'context/tasks-index.json' ? task.file : null

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <div
        {...dragHandlers}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: isOver ? `oklch(0.78 0.14 ${category.hue} / 0.10)` : (hov ? 'var(--panel-2)' : 'transparent'),
          opacity: isDragging ? 0.4 : 1,
          borderTop: isOver ? `2px solid oklch(0.78 0.16 ${category.hue})` : '2px solid transparent',
          cursor: 'grab',
          transition: 'background .12s',
        }}
      >
        <span style={{ color: 'var(--text-very-dim)', display: 'inline-flex', opacity: hov ? 1 : 0.3, transition: 'opacity .12s', flexShrink: 0 }}>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
            <circle cx="4.5" cy="4" r="1.1" /><circle cx="4.5" cy="7" r="1.1" /><circle cx="4.5" cy="10" r="1.1" />
            <circle cx="9.5" cy="4" r="1.1" /><circle cx="9.5" cy="7" r="1.1" /><circle cx="9.5" cy="10" r="1.1" />
          </svg>
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          style={{ width: 18, height: 18, flexShrink: 0, border: `1.5px solid ${task.done ? 'var(--success)' : 'var(--border-strong)'}`, borderRadius: 5, background: task.done ? 'var(--success)' : 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)' }}
        >
          {task.done && (
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 8 3.5 3.5L13 5" />
            </svg>
          )}
        </button>

        <span style={{ flex: 1, fontSize: 13.5, minWidth: 0, color: task.done ? 'var(--text-very-dim)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>
          <EditableField value={task.text} onCommit={(v) => onUpdate({ text: v })} placeholder="Untitled task" inputStyle={{ fontSize: 13.5, width: '100%' }} />
        </span>

        {task.comments.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onSetCommentsOpen(!commentsOpen) }}
            title={`${task.comments.length} comment${task.comments.length === 1 ? '' : 's'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: commentsOpen ? 'var(--panel-2)' : 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 999, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H6L3 13v-2.5h-.5z" />
            </svg>
            {task.comments.length}
          </button>
        )}

        {(listTree && Object.values(enabledModules ?? {}).some(Boolean)) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 220, minWidth: 0, flexShrink: 0 }}>
            <EntitySelector
              value={linkedEntity}
              onChange={(path) => onUpdate({ file: path || 'context/tasks-index.json' })}
              listTree={listTree}
              enabledModules={enabledModules}
            />
          </span>
        )}

        <AgeChip date={task.created} />

        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={menuBtnRef}
            onClick={(e) => { e.stopPropagation(); openMenu() }}
            style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: menuOpen ? 'var(--border)' : 'transparent', color: 'var(--text-dim)', borderRadius: 5, cursor: 'pointer', padding: 0, opacity: (hov || menuOpen) ? 1 : 0.3, transition: 'opacity .12s, background .12s', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = 'var(--border)' }}
            onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <circle cx="3.5" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12.5" cy="8" r="1.3" />
            </svg>
          </button>
          {menuOpen && createPortal(
            <div ref={menuPortalRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 200, minWidth: 150, padding: 4, background: 'var(--panel-pop)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)' }}>
              <TaskMenuItem label="Comment" onClick={openComments} />
              <TaskMenuItem label="Remove" danger onClick={() => { setMenuOpen(false); onDelete() }} />
            </div>,
            document.body,
          )}
        </div>
      </div>

      {commentsOpen && (
        <div style={{ padding: '4px 16px 14px 48px', background: 'var(--bg-sidebar)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 4px' }}>
            <span style={{ fontSize: 10.5, letterSpacing: '0.14em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-very-dim)' }}>
              Comments{task.comments.length > 0 && ` · ${task.comments.length}`}
            </span>
            <button
              onClick={() => onSetCommentsOpen(false)}
              style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-very-dim)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, fontFamily: 'inherit', transition: 'background .12s, color .12s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-very-dim)' }}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          {task.comments.map((comment) => (
            <div key={comment.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <EditableCommentText value={comment.text} onCommit={(v) => onUpdateComment(comment.id, v)} />
              <div style={{ fontSize: 11, color: 'var(--text-very-dim)', marginTop: 2 }}>
                {(comment.ts instanceof Date ? comment.ts : new Date(comment.ts)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: task.comments.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
            <input
              ref={commentInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment()
                if (e.key === 'Escape') {
                  setDraft('')
                  onSetCommentsOpen(false)
                }
              }}
              placeholder="Write a comment…"
              style={{ flex: 1, padding: '7px 10px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={() => { setDraft(''); onSetCommentsOpen(false) }}
              style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-very-dim)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text-dim)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-very-dim)' }}
            >
              Cancel
            </button>
            <button
              onClick={submitComment}
              disabled={!draft.trim()}
              style={{ padding: '6px 12px', background: draft.trim() ? 'var(--accent)' : 'var(--panel-2)', color: draft.trim() ? '#1a1408' : 'var(--text-very-dim)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: draft.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LinkifiedText({ text }) {
  const URL_RE = /(https?:\/\/[^\s]+)/gi
  const parts = String(text || '').split(URL_RE)

  return (
    <>
      {parts.map((part, idx) => {
        if (/^https?:\/\//i.test(part)) {
          return (
            <a
              key={`link-${idx}`}
              href={part}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ color: 'var(--info)', textDecoration: 'underline', textDecorationColor: 'color-mix(in oklab, var(--info), transparent 35%)' }}
            >
              {part}
            </a>
          )
        }
        return <span key={`txt-${idx}`}>{part}</span>
      })}
    </>
  )
}

function EditableCommentText({ value, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (!editing) return
    ref.current?.focus()
    ref.current?.select()
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', margin: '-4px -6px', background: 'var(--panel)', border: '1px solid var(--accent)', borderRadius: 4, outline: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.45 }}
      />
    )
  }

  return (
    <div
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
      title="Double-click to edit"
      style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, cursor: 'text', wordBreak: 'break-word' }}
    >
      <LinkifiedText text={value} />
    </div>
  )
}

function TaskMenuItem({ label, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, fontSize: 12.5, cursor: 'pointer', color: danger ? (hov ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)') : (hov ? 'var(--text)' : 'var(--text-dim)'), background: danger ? (hov ? 'oklch(0.70 0.18 22 / 0.12)' : 'transparent') : (hov ? 'var(--panel-2)' : 'transparent') }}
    >
      {label}
    </div>
  )
}

function EditableField({ value, onCommit, placeholder, textStyle, inputStyle, width }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)

  useEffect(() => {
    if (editing) {
      ref.current?.focus()
      ref.current?.select()
    }
  }, [editing])

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = () => {
    const t = draft.trim()
    if (t && t !== value) onCommit(t)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        style={{ width: width || 'auto', padding: '2px 6px', margin: '-3px -7px', background: 'var(--panel)', border: '1px solid var(--accent)', borderRadius: 4, outline: 'none', color: 'var(--text)', fontFamily: 'inherit', ...(inputStyle || {}) }}
      />
    )
  }

  const renderValue = () => {
    const raw = String(value || '')
    if (!raw) return <span style={{ color: 'var(--text-very-dim)' }}>{placeholder}</span>

    // Display cleanup only: preserve source text, but render escaped wikilinks cleanly.
    const normalized = raw
      .replace(/\\+\[\[/g, '[[')
      .replace(/\\+\]\]/g, ']]')

    const parts = normalized.split(/(\[\[[^\]\n]+\]\])/g)
    return parts.map((part, idx) => {
      const m = part.match(/^\[\[([^\]\n]+)\]\]$/)
      if (!m) return <span key={`txt-${idx}`}>{part}</span>

      return (
        <span
          key={`wl-${idx}`}
          style={{
            color: 'oklch(0.90 0.12 80)',
            fontWeight: 600,
            textDecoration: 'underline',
            textDecorationColor: 'oklch(0.90 0.12 80 / 0.55)',
            textUnderlineOffset: '0.12em',
          }}
        >
          {m[1]}
        </span>
      )
    })
  }

  return (
    <span
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
      title="Double-click to edit"
      style={{ cursor: 'text', borderRadius: 3, ...(textStyle || {}) }}
    >
      {renderValue()}
    </span>
  )
}
