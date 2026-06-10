import { useState, useEffect, useCallback } from 'react'
import { parseFrontmatter } from '../lib/frontmatter'
import { setPlanTaskStatus } from '../lib/tasksIndex'

// ─── Status colours (matching IdeaViewer + ProjectViewer chips) ───────────────

const STATUS_STYLE = {
  // Project statuses
  active:    { bg: 'oklch(0.74 0.14 165 / 0.10)', border: 'oklch(0.74 0.14 165 / 0.30)', color: 'var(--success)' },
  planning:  { bg: 'oklch(0.72 0.13 240 / 0.10)', border: 'oklch(0.72 0.13 240 / 0.30)', color: 'var(--info)' },
  on_hold:   { bg: 'var(--panel-2)',               border: 'var(--border)',                color: 'var(--text-very-dim)' },
  completed: { bg: 'oklch(0.74 0.14 165 / 0.10)', border: 'oklch(0.74 0.14 165 / 0.30)', color: 'var(--success)' },
  // Idea statuses
  Spark:      { bg: 'oklch(0.85 0.16 95 / 0.10)',  border: 'oklch(0.85 0.16 95 / 0.35)',  color: 'oklch(0.88 0.16 95)' },
  Developing: { bg: 'oklch(0.72 0.13 240 / 0.12)', border: 'oklch(0.72 0.13 240 / 0.35)', color: 'var(--info)' },
  Validate:   { bg: 'oklch(0.74 0.14 165 / 0.12)', border: 'oklch(0.74 0.14 165 / 0.35)', color: 'var(--success)' },
  Decision:   { bg: 'oklch(0.72 0.13 240 / 0.12)', border: 'oklch(0.72 0.13 240 / 0.35)', color: 'var(--info)' },
  Pursuing:   { bg: 'oklch(0.74 0.14 165 / 0.10)', border: 'oklch(0.74 0.14 165 / 0.35)', color: 'var(--success)' },
  Parked:     { bg: 'var(--panel-2)',               border: 'var(--border)',                color: 'var(--text-very-dim)' },
  Killed:     { bg: 'oklch(0.70 0.18 22 / 0.10)',  border: 'oklch(0.70 0.18 22 / 0.30)',  color: 'oklch(0.75 0.18 22)' },
}

function StatusChip({ status }) {
  if (!status) return null
  const label = String(status).replace(/_/g, ' ')
  const style = STATUS_STYLE[status] || { bg: 'var(--panel-2)', border: 'var(--border)', color: 'var(--text-dim)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      background: style.bg, border: `1px solid ${style.border}`,
      borderRadius: 5, fontSize: 11.5, fontWeight: 500, color: style.color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: style.color, flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ─── Filter segmented control ────────────────────────────────────────────────

function FilterPill({ label, active, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '5px 13px', borderRadius: 6, fontSize: 12.5,
        fontWeight: active ? 600 : 500, fontFamily: 'inherit',
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'background .12s, color .12s, border-color .12s',
        background: active
          ? 'oklch(0.80 0.13 80 / 0.16)'
          : (hov ? 'var(--panel-2)' : 'transparent'),
        color: active
          ? 'oklch(0.88 0.13 80)'
          : (hov ? 'var(--text)' : 'var(--text-dim)'),
        border: active
          ? '1px solid oklch(0.80 0.13 80 / 0.40)'
          : '1px solid transparent',
      }}
    >{label}</button>
  )
}

function PlansFilter({ value, onChange }) {
  const opts = [
    { id: 'all', label: 'All' },
    { id: 'projects', label: 'Projects' },
    { id: 'ideas', label: 'Ideas' },
  ]
  return (
    <div style={{
      display: 'inline-flex', gap: 3, padding: 3,
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 9,
    }}>
      {opts.map((o) => (
        <FilterPill key={o.id} label={o.label} active={value === o.id} onClick={() => onChange(o.id)} />
      ))}
    </div>
  )
}

// ─── Group header ─────────────────────────────────────────────────────────────

function PlansGroupHeader({ label, count, hue }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 4px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.78 0.16 ${hue})`, flex: '0 0 6px' }} />
      <h2 style={{
        fontSize: 11, letterSpacing: '0.16em', fontWeight: 600,
        textTransform: 'uppercase', color: 'var(--text-dim)', margin: 0,
      }}>{label}</h2>
      <span style={{ fontSize: 11, color: 'var(--text-very-dim)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </div>
  )
}

// ─── Plan step row ────────────────────────────────────────────────────────────

function PlanStepRow({ step, onToggle }) {
  const [hov, setHov] = useState(false)
  const [boxHov, setBoxHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
        borderTop: '1px solid var(--border-subtle)',
        background: hov ? 'var(--panel-2)' : 'transparent',
        transition: 'background .12s',
      }}
    >
      <button
        onClick={onToggle}
        onMouseEnter={() => setBoxHov(true)}
        onMouseLeave={() => setBoxHov(false)}
        style={{
          width: 18, height: 18, flex: '0 0 18px', border: '1.5px solid',
          borderColor: step.done ? 'var(--success)' : (boxHov ? 'var(--success)' : 'var(--border-strong)'),
          borderRadius: 5,
          background: step.done ? 'var(--success)' : 'transparent',
          cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--bg-primary)',
          transition: 'border-color .12s, background .12s',
        }}
      >
        {step.done && (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
        )}
      </button>
      <span style={{
        flex: 1, fontSize: 13.5,
        color: step.done ? 'var(--text-very-dim)' : 'var(--text)',
        textDecoration: step.done ? 'line-through' : 'none',
        minWidth: 0,
      }}>{step.text}</span>
    </div>
  )
}

// ─── Plan block ───────────────────────────────────────────────────────────────

function PlanBlock({ name, status, subtitle, plan, onToggleStep, onOpen }) {
  const [nameHov, setNameHov] = useState(false)
  const done = plan.filter((s) => s.done).length
  const allDone = done === plan.length && plan.length > 0

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '15px 18px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span
            onClick={onOpen}
            onMouseEnter={() => setNameHov(true)}
            onMouseLeave={() => setNameHov(false)}
            style={{
              flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.005em', lineHeight: 1.3,
              color: nameHov ? 'var(--text)' : 'var(--text)',
              cursor: 'pointer',
              textDecoration: nameHov ? 'underline' : 'none',
              textDecorationColor: 'var(--border-strong)',
              textUnderlineOffset: 3,
            }}
          >{name}</span>
          <span style={{ flex: '0 0 auto', marginTop: 1 }}>
            <StatusChip status={status} />
          </span>
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: 'var(--text-very-dim)', marginTop: 6, lineHeight: 1.4 }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div>
        {plan.map((step) => (
          <PlanStepRow key={step.id} step={step} onToggle={() => onToggleStep(step.id)} />
        ))}
      </div>

      {/* All-done footer */}
      {allDone && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', borderTop: '1px solid var(--border-subtle)',
          background: 'oklch(0.74 0.14 165 / 0.06)',
          fontSize: 12, fontWeight: 500, color: 'oklch(0.80 0.13 165)',
        }}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
          All steps done
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function PlansEmpty({ children }) {
  return (
    <div style={{
      padding: '44px 24px', textAlign: 'center', color: 'var(--text-very-dim)',
      fontSize: 14, lineHeight: 1.6, border: '1px dashed var(--border)',
      borderRadius: 10, background: 'var(--panel)', maxWidth: 520, margin: '0 auto',
    }}>{children}</div>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseCurrentPlan(body) {
  // Extract ## Current Plan section content
  const match = body.match(/##\s+Current Plan\s*\n([\s\S]*?)(?=\n##\s|$)/i)
  if (!match) return []
  const lines = match[1].split('\n')
  const steps = []
  for (const line of lines) {
    const doneMatch = line.match(/^-\s+\[x\]\s+(.+)/i)
    const openMatch = line.match(/^-\s+\[\s\]\s+(.+)/i)
    if (doneMatch) {
      steps.push({ id: `step-${steps.length}`, text: doneMatch[1].trim(), done: true, raw: line })
    } else if (openMatch) {
      steps.push({ id: `step-${steps.length}`, text: openMatch[1].trim(), done: false, raw: line })
    }
  }
  return steps
}

function parseSummaryLine(body, type) {
  // For projects: core_problem from frontmatter; for ideas: Summary section first line
  if (type === 'idea') {
    const m = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##\s|$)/i)
    if (!m) return ''
    const firstLine = m[1].split('\n').find((l) => l.trim() && !l.trim().startsWith('_'))
    return firstLine?.trim() || ''
  }
  return ''
}

// Toggle a step in a markdown file: replaces `- [ ] text` ↔ `- [x] text`
async function toggleStepInFile(readFile, writeFile, filePath, stepRaw, nowDone) {
  const content = await readFile(filePath)
  const needle = stepRaw.trim()
  const replacement = nowDone
    ? needle.replace(/^-\s+\[\s\]/, '- [x]')
    : needle.replace(/^-\s+\[x\]/i, '- [ ]')
  // Replace first occurrence of the exact raw line
  const updated = content.replace(needle, replacement)
  await writeFile(filePath, updated)
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlansPage({ readFile, writeFile, listTree, settings, onNavigate }) {
  const [entities, setEntities]   = useState([])  // { id, type, filePath, name, status, subtitle, plan, lastUpdated }
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')

  const enabledModules = settings?.enabledModules || {}
  const showProjects = enabledModules.projects !== false
  const showIdeas    = enabledModules.ideas !== false

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tree = await listTree().catch(() => [])
      const results = []

      // Load projects
      if (showProjects) {
        const projDir = (tree || []).find((d) => d?.kind === 'directory' && d.name === 'projects')
        for (const file of projDir?.children || []) {
          if (!file?.name?.endsWith('.md')) continue
          const fp = file.path || `projects/${file.name}`
          try {
            const raw = await readFile(fp)
            const { fields, body } = parseFrontmatter(raw)
            const plan = parseCurrentPlan(body)
            if (plan.length === 0) continue
            const displayName = fields?.name
              || file.name.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            const subtitle = fields?.core_problem
              ? String(fields.core_problem).split('\n')[0].trim()
              : parseSummaryLine(body, 'project')
            results.push({
              id: fp,
              type: 'project',
              filePath: fp,
              name: displayName,
              status: fields?.status || '',
              subtitle: subtitle || '',
              plan,
              lastUpdated: fields?.last_updated || '',
            })
          } catch {}
        }
      }

      // Load ideas (excluding backlog.md)
      if (showIdeas) {
        const ideasDir = (tree || []).find((d) => d?.kind === 'directory' && d.name === 'ideas')
        for (const file of ideasDir?.children || []) {
          if (!file?.name?.endsWith('.md')) continue
          if (file.name === 'backlog.md') continue
          const fp = file.path || `ideas/${file.name}`
          try {
            const raw = await readFile(fp)
            const { fields, body } = parseFrontmatter(raw)
            const plan = parseCurrentPlan(body)
            if (plan.length === 0) continue
            const displayName = fields?.name
              || file.name.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            const subtitle = parseSummaryLine(body, 'idea')
            results.push({
              id: fp,
              type: 'idea',
              filePath: fp,
              name: displayName,
              status: fields?.status || 'Spark',
              subtitle: subtitle || '',
              plan,
              lastUpdated: fields?.last_updated || '',
            })
          } catch {}
        }
      }

      setEntities(results)
    } catch {}
    setLoading(false)
  }, [readFile, listTree, showProjects, showIdeas])

  useEffect(() => { load() }, [load])

  const handleToggleStep = useCallback(async (entityId, stepId) => {
    const entity = entities.find((e) => e.id === entityId)
    if (!entity) return
    const step = entity.plan.find((s) => s.id === stepId)
    if (!step) return

    // Optimistic update
    const nowDone = !step.done
    setEntities((prev) => prev.map((e) => {
      if (e.id !== entityId) return e
      return {
        ...e,
        plan: e.plan.map((s) => s.id === stepId ? { ...s, done: nowDone } : s),
      }
    }))

    // Write to file
    try {
      await toggleStepInFile(readFile, writeFile, entity.filePath, step.raw, nowDone)
      // Sync tasks index so viewers stay consistent
      await setPlanTaskStatus(readFile, writeFile, entity.filePath, '## Current Plan', step.text, nowDone)
      // Update the raw line in state so future toggles work correctly
      setEntities((prev) => prev.map((e) => {
        if (e.id !== entityId) return e
        return {
          ...e,
          plan: e.plan.map((s) => {
            if (s.id !== stepId) return s
            const newRaw = nowDone
              ? s.raw.replace(/^-\s+\[\s\]/, '- [x]')
              : s.raw.replace(/^-\s+\[x\]/i, '- [ ]')
            return { ...s, done: nowDone, raw: newRaw }
          }),
        }
      }))
    } catch {
      // Revert on error
      setEntities((prev) => prev.map((e) => {
        if (e.id !== entityId) return e
        return { ...e, plan: e.plan.map((s) => s.id === stepId ? { ...s, done: !nowDone } : s) }
      }))
    }
  }, [entities, readFile, writeFile])

  // Sort: projects first, then ideas; within each group by last_updated desc
  const projectEntities = entities
    .filter((e) => e.type === 'project')
    .sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''))
  const ideaEntities = entities
    .filter((e) => e.type === 'idea')
    .sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''))

  const visibleProjects = (filter === 'all' || filter === 'projects') ? projectEntities : []
  const visibleIdeas    = (filter === 'all' || filter === 'ideas')    ? ideaEntities    : []

  // Stats
  const allSteps = [...projectEntities, ...ideaEntities].flatMap((e) => e.plan)
  const stepsLeft = allSteps.filter((s) => !s.done).length
  const stepsDone = allSteps.length - stepsLeft

  const nothingAtAll = projectEntities.length === 0 && ideaEntities.length === 0
  const filterEmpty  = !nothingAtAll && visibleProjects.length === 0 && visibleIdeas.length === 0

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading plans…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px', borderBottom: '1px solid var(--border-subtle)', gap: 16, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--text)' }}>
            Plans
          </h1>
          {!nothingAtAll && (
            <span style={{ fontSize: 13, color: 'var(--text-very-dim)' }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{stepsLeft}</span> steps left
              <span style={{ margin: '0 8px', color: 'var(--border-strong)' }}>·</span>
              <span style={{ color: 'var(--text-dim)' }}>{stepsDone} done</span>
            </span>
          )}
        </div>
        {!nothingAtAll && showProjects && showIdeas && (
          <PlansFilter value={filter} onChange={setFilter} />
        )}
      </header>

      <div style={{ padding: '22px 48px 48px', display: 'flex', flexDirection: 'column', gap: 28, overflowY: 'auto', flex: 1 }}>
        {nothingAtAll && (
          <PlansEmpty>
            No plans yet. Open any project or idea and add steps to{' '}
            <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)' }}>## Current Plan</span>{' '}
            to see them here.
          </PlansEmpty>
        )}

        {filterEmpty && (
          <PlansEmpty>
            No {filter === 'projects' ? 'projects' : 'ideas'} with active plans.
          </PlansEmpty>
        )}

        {visibleProjects.length > 0 && (
          <section>
            <PlansGroupHeader label="Projects" count={visibleProjects.length} hue={230} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visibleProjects.map((entity) => (
                <PlanBlock
                  key={entity.id}
                  name={entity.name}
                  status={entity.status}
                  subtitle={entity.subtitle}
                  plan={entity.plan}
                  onToggleStep={(stepId) => handleToggleStep(entity.id, stepId)}
                  onOpen={() => onNavigate?.('viewer', entity.filePath)}
                />
              ))}
            </div>
          </section>
        )}

        {visibleIdeas.length > 0 && (
          <section>
            <PlansGroupHeader label="Ideas" count={visibleIdeas.length} hue={150} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visibleIdeas.map((entity) => (
                <PlanBlock
                  key={entity.id}
                  name={entity.name}
                  status={entity.status}
                  subtitle={entity.subtitle}
                  plan={entity.plan}
                  onToggleStep={(stepId) => handleToggleStep(entity.id, stepId)}
                  onOpen={() => onNavigate?.('viewer', entity.filePath)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
