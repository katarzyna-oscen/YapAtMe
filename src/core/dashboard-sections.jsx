import React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { Icon, SectionHeader, AgeChip, Tag } from './dashboard-top'
import { daysAgo } from './CommandPage'

function renderLinkedText(text) {
  const parts = String(text || '').split(/(\[\[[^\]]+\]\])/g)
  return parts.map((part, idx) => {
    const m = part.match(/^\[\[([^\]]+)\]\]$/)
    if (!m) return <span key={idx}>{part}</span>
    return (
      <span key={idx} style={{ color: 'oklch(0.88 0.16 96)', textDecoration: 'underline', textDecorationColor: 'oklch(0.88 0.16 96 / 0.45)' }}>
        {m[1]}
      </span>
    )
  })
}

// ─── Draggable list hook ──────────────────────────────────────────────────────

function useDraggableList(initial, onOrderChange) {
  const [items, setItems] = useState(initial)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  useEffect(() => { setItems(initial) }, [initial])

  const handlers = useCallback((id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', String(id)) } catch (_) {}
    },
    onDragEnter: (e) => { e.preventDefault(); if (id !== dragId) setOverId(id) },
    onDragOver:  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDragLeave: () => {},
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) return
      setItems(arr => {
        const from = arr.findIndex(x => (x.id ?? x.path) === dragId)
        const to   = arr.findIndex(x => (x.id ?? x.path) === id)
        if (from < 0 || to < 0) return arr
        const next = arr.slice()
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        onOrderChange?.(next)
        return next
      })
      setDragId(null); setOverId(null)
    },
    onDragEnd: () => { setDragId(null); setOverId(null) },
  }), [dragId, onOrderChange])

  return { items, dragId, overId, handlers }
}

// ─── Status meta ─────────────────────────────────────────────────────────────

const STATUS_META = {
  'Untriaged':      { hue: 260 },
  'Triaged':        { hue: 80  },
  'In Progress':    { hue: 150 },
  'Building':       { hue: 150 },
  'Blocked':        { hue: 22  },
  'In Review':      { hue: 230 },
  'To Be Deployed': { hue: 230 },
  'Done':           { hue: 260 },
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] ?? { hue: 260 }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.01em',
      borderRadius: 999,
      background: `oklch(0.78 0.14 ${meta.hue} / 0.14)`,
      color: `oklch(0.85 0.13 ${meta.hue})`,
      border: `1px solid oklch(0.78 0.14 ${meta.hue} / 0.28)`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: `oklch(0.78 0.16 ${meta.hue})` }} />
      {status}
    </span>
  )
}

// ─── Projects section ─────────────────────────────────────────────────────────

function ProjectCard({ project, handlers, isDragging, isOver, onNavigate }) {
  const domainTags = typeof project.domain === 'string'
    ? project.domain.split(',').map(s => s.trim()).filter(Boolean)
    : Array.isArray(project.domain) ? project.domain : []

  return (
    <div
      {...handlers}
      onClick={() => onNavigate('viewer', project.path)}
      style={{
        position: 'relative', padding: '16px 18px 14px',
        background: 'var(--panel)',
        border: `1px solid ${isOver ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10, opacity: isDragging ? 0.45 : 1,
        transform: isOver ? 'translateY(-1px)' : 'none',
        transition: 'border-color .15s, transform .15s',
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
      onMouseLeave={e => { if (!isOver) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ position: 'absolute', top: 10, right: 10, color: 'var(--text-very-dim)', opacity: 0.5, pointerEvents: 'none' }}>
        <Icon name="drag" size={14} />
      </div>
      <div>
        <h3 style={{
          fontSize: 15.5, fontWeight: 600, color: 'var(--text)', margin: '0 24px 8px 0',
          lineHeight: 1.3, letterSpacing: '-0.005em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{project.name}</h3>
        <p style={{
          fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{project.core_problem || '—'}</p>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill status={project.status} />
          <AgeChip days={daysAgo(project.last_updated)} />
          <span style={{ fontSize: 11, color: 'var(--text-very-dim)' }}>{project.openActions} actions</span>
          {domainTags.length > 0 && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 5 }}>
              {domainTags.map(t => <Tag key={t}>{t}</Tag>)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ProjectsSection({ projects, onOrderChange, onNavigate }) {
  const { items, dragId, overId, handlers } = useDraggableList(
    projects,
    (reordered) => onOrderChange('projects', reordered)
  )
  return (
    <section style={{ padding: '20px 48px 8px' }}>
      <SectionHeader
        label="Projects"
        right={
          <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', fontFamily: 'var(--font-mono)' }}>
            {items.length} total
          </span>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {items.map(p => (
          <ProjectCard
            key={p.path}
            project={p}
            handlers={handlers(p.path)}
            isDragging={dragId === p.path}
            isOver={overId === p.path}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Tasks section ────────────────────────────────────────────────────────────

const CATEGORY_HUE = { 'needs-call': 22, 'talk-about': 80, actions: 150, delegate: 230, decisions: 80 }

function taskCategory(task) {
  if (task.tags?.some(t => t === 'urgent' || t === 'important')) return 'needs-call'
  if (task.section === '## Talk About')                          return 'talk-about'
  if (task.section === '## Open Actions')                         return 'actions'
  if (task.section === '## Delegations' || task.section === '## Delegate') return 'delegate'
  if (task.section === '## Decisions')                            return 'decisions'
  return 'actions'
}

function ActionRow({ task, onResolve, handlers, isDragging, isOver, isLast }) {
  const [resolving, setResolving] = useState(false)
  const cat = taskCategory(task)
  const hue = CATEGORY_HUE[cat] ?? 150
  const fileLabel = task.file?.split('/').pop()?.replace('.md', '').replace(/-/g, ' ') ?? ''

  const handleResolve = async (e) => {
    e.stopPropagation()
    setResolving(true)
    await onResolve(task.id)
  }

  return (
    <div
      {...handlers}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
        background: isOver ? 'var(--panel-2)' : 'transparent',
        opacity: isDragging ? 0.45 : 1,
        cursor: 'grab',
      }}
    >
      {/* category dot */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${hue})`, flex: '0 0 6px' }} />
      {/* drag handle */}
      <span style={{ color: 'var(--text-very-dim)', display: 'inline-flex', cursor: 'grab' }}>
        <Icon name="drag" size={14} />
      </span>
      {/* checkbox */}
      <button
        onClick={handleResolve}
        disabled={resolving}
        style={{
          width: 18, height: 18, flex: '0 0 18px',
          border: '1.5px solid', borderColor: resolving ? 'var(--success, #4ade80)' : 'var(--border-strong)',
          borderRadius: 5,
          background: resolving ? 'var(--success, #4ade80)' : 'transparent',
          cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--bg-primary)',
        }}
      >
        {resolving && <Icon name="check" size={12} />}
      </button>
      {/* title */}
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {renderLinkedText(task.title)}
      </span>
      {/* file label */}
      <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>{fileLabel}</span>
      <AgeChip days={daysAgo(task.last_updated)} />
    </div>
  )
}

function TasksSection({ tasks, onResolveTask, onOrderChange }) {
  const { items, dragId, overId, handlers } = useDraggableList(
    tasks,
    (reordered) => onOrderChange('tasks', reordered)
  )
  return (
    <section style={{ padding: '20px 48px 8px' }}>
      <SectionHeader
        label="Tasks"
        right={<span style={{ fontSize: 11.5, color: 'var(--text-very-dim)' }}>{items.length} open</span>}
      />
      {items.length === 0 ? (
        <div style={{ padding: '20px 0', fontSize: 13, color: 'var(--text-very-dim)', fontStyle: 'italic' }}>No open tasks.</div>
      ) : (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {items.map((task, i) => (
            <ActionRow
              key={task.id}
              task={task}
              onResolve={onResolveTask}
              handlers={handlers(task.id)}
              isDragging={dragId === task.id}
              isOver={overId === task.id}
              isLast={i === items.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── People section ───────────────────────────────────────────────────────────

const CADENCE_LABELS = ['distant', 'occasional', 'moderate', 'regular', 'close']

function CadenceMeter({ cadence }) {
  const hue = cadence >= 4 ? 150 : cadence === 3 ? 80 : 22
  const label = CADENCE_LABELS[Math.max(0, cadence - 1)] ?? '—'
  return (
    <div title={`${label} contact`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: '0 0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
        {[1, 2, 3, 4, 5].map(i => {
          const on = i <= cadence
          return (
            <div key={i} style={{
              width: 3, height: 3 + i * 2, borderRadius: 1,
              background: on ? `oklch(0.78 0.14 ${hue})` : 'var(--panel-2)',
              border: on ? 'none' : '1px solid var(--border-subtle)',
            }} />
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-very-dim)', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

function PersonCard({ person, handlers, isDragging, isOver, onNavigate }) {
  return (
    <div
      {...handlers}
      onClick={() => onNavigate('viewer', person.path)}
      style={{
        padding: '14px 16px', background: 'var(--panel)',
        border: `1px solid ${isOver ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10, cursor: 'pointer', opacity: isDragging ? 0.45 : 1,
        transition: 'border-color .15s, transform .12s',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isOver ? 'var(--accent)' : 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.25 }}>{person.full_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-very-dim)', marginTop: 3 }}>{person.role}</div>
      </div>
      <CadenceMeter cadence={person.cadence} />
    </div>
  )
}

function PeopleSection({ people, onOrderChange, onNavigate }) {
  const { items, dragId, overId, handlers } = useDraggableList(
    people,
    (reordered) => onOrderChange('people', reordered)
  )
  return (
    <section style={{ padding: '20px 48px 8px' }}>
      <SectionHeader label="People" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {items.map(p => (
          <PersonCard
            key={p.path}
            person={p}
            handlers={handlers(p.path)}
            isDragging={dragId === p.path}
            isOver={overId === p.path}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Ideas section ────────────────────────────────────────────────────────────

function IdeasSection({ ideas, onOrderChange, onNavigate }) {
  const { items, dragId, overId, handlers } = useDraggableList(
    ideas,
    (reordered) => onOrderChange('ideas', reordered)
  )
  return (
    <section style={{ padding: '20px 48px 56px' }}>
      <SectionHeader
        label="Ideas"
        right={<span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', fontFamily: 'var(--font-mono)' }}>{items.length} captured</span>}
      />
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {items.map((idea, i) => (
          <div
            key={idea.path}
            {...handlers(idea.path)}
            onClick={() => onNavigate('viewer', idea.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 16px',
              borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              background: overId === idea.path ? 'var(--panel-2)' : 'transparent',
              opacity: dragId === idea.path ? 0.45 : 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
            onMouseLeave={e => { if (overId !== idea.path) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ color: 'var(--text-very-dim)', display: 'inline-flex' }}><Icon name="idea" size={14} /></span>
            <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)' }}>{idea.name}</span>
            <AgeChip days={daysAgo(idea.last_updated)} />
            <StatusPill status={idea.status} />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Composed export ──────────────────────────────────────────────────────────

export default function DashboardSections({
  projects,
  tasks,
  people,
  ideas,
  onResolveTask,
  onOrderChange,
  onNavigate,
  enabledModules,
  sectionConfig,
}) {
  const DEFAULT_ORDER = ['projects', 'tasks', 'people', 'ideas']

  // Stored order or default
  const order = sectionConfig?.order?.length ? sectionConfig.order : DEFAULT_ORDER

  // A section is visible if:
  //   1. sectionConfig.visibility doesn't explicitly hide it, AND
  //   2. its parent module isn't disabled
  const isVisible = (id) => {
    if (sectionConfig?.visibility?.[id] === false) return false
    if (id === 'projects' && enabledModules?.projects === false) return false
    if (id === 'people'   && enabledModules?.people   === false) return false
    if (id === 'ideas'    && enabledModules?.ideas    === false) return false
    return true
  }

  const sections = {
    projects: () => (
      <ProjectsSection
        projects={projects}
        onOrderChange={onOrderChange}
        onNavigate={onNavigate}
      />
    ),
    tasks: () => (
      <TasksSection
        tasks={tasks}
        onResolveTask={onResolveTask}
        onOrderChange={onOrderChange}
      />
    ),
    people: () => (
      <PeopleSection
        people={people}
        onOrderChange={onOrderChange}
        onNavigate={onNavigate}
      />
    ),
    ideas: () => (
      <IdeasSection
        ideas={ideas}
        onOrderChange={onOrderChange}
        onNavigate={onNavigate}
      />
    ),
  }

  return (
    <>
      {order.map(id => {
        if (!isVisible(id) || !sections[id]) return null
        return <React.Fragment key={id}>{sections[id]()}</React.Fragment>
      })}
    </>
  )
}
