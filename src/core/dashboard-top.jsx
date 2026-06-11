import { daysAgo } from './CommandPage'

// ─── Shared helpers ──────────────────────────────────────────────────────────

function fmtAge(days) {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ─── Exported shared atoms (used by dashboard-sections) ──────────────────────

export function Icon({ name, size = 16 }) {
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }
  if (name === 'drag') return (
    <svg style={s} viewBox="0 0 16 16" fill="currentColor">
      <rect x="4" y="4" width="2" height="2" rx="1" /><rect x="10" y="4" width="2" height="2" rx="1" />
      <rect x="4" y="7" width="2" height="2" rx="1" /><rect x="10" y="7" width="2" height="2" rx="1" />
      <rect x="4" y="10" width="2" height="2" rx="1" /><rect x="10" y="10" width="2" height="2" rx="1" />
    </svg>
  )
  if (name === 'check') return (
    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,8 6.5,12 13,4" />
    </svg>
  )
  if (name === 'project') return (
    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="12" height="10" rx="2" /><line x1="5" y1="7" x2="11" y2="7" /><line x1="5" y1="10" x2="9" y2="10" />
    </svg>
  )
  if (name === 'person') return (
    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" /><path d="M2.5 13.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
    </svg>
  )
  if (name === 'idea') return (
    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 2a4 4 0 0 1 2 7.46V11H6V9.46A4 4 0 0 1 8 2z" /><line x1="6" y1="13" x2="10" y2="13" /><line x1="7" y1="15" x2="9" y2="15" />
    </svg>
  )
  if (name === 'task') return (
    <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="5" height="5" rx="1" /><line x1="9" y1="4" x2="14" y2="4" /><line x1="9" y1="8" x2="14" y2="8" /><line x1="2" y1="11" x2="14" y2="11" /><line x1="2" y1="14" x2="10" y2="14" />
    </svg>
  )
  if (name === 'spinner') return (
    <svg style={{ ...s, animation: 'spin 1s linear infinite' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
    </svg>
  )
  return null
}

export const SectionHeader = ({ label, right }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 14px' }}>
    <div style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, color: 'var(--text-very-dim)', textTransform: 'uppercase' }}>
      {label}
    </div>
    {right}
  </div>
)

export const AgeChip = ({ days }) => {
  let hue, label
  if (days < 7)       { hue = 150; label = 'fresh' }
  else if (days < 21) { hue = 80;  label = 'aging' }
  else                { hue = 22;  label = 'stale'  }
  return (
    <span
      title={fmtAge(days)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 999,
        background: `oklch(0.82 0.13 ${hue} / 0.12)`,
        color: `oklch(0.84 0.13 ${hue})`,
        border: `1px solid oklch(0.82 0.13 ${hue} / 0.28)`,
        fontSize: 11, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </span>
  )
}

export const Tag = ({ children }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', fontSize: 11, borderRadius: 5,
    background: 'var(--panel-2)', color: 'var(--text-dim)',
    border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', letterSpacing: '0.01em',
  }}>
    {children}
  </span>
)

// ─── Top bar ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, tone }) {
  const color = tone === 'warn' ? 'var(--accent)' : 'var(--text)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ color, fontWeight: 600, fontSize: 14 }}>{value}</span>
      <span style={{ color: 'var(--text-very-dim)' }}>{label}</span>
    </span>
  )
}

function ActivityHeatmap({ cells = [] }) {
  if (!cells.length) return null

  const max    = Math.max(...cells.map(c => c.count), 1)
  const total  = cells.reduce((s, c) => s + c.count, 0)
  const today  = cells[cells.length - 1]?.count ?? 0

  // Streak = consecutive days with activity counting back from today
  let streak = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) streak++
    else break
  }

  const colorFor = (n) => {
    if (n === 0) return 'var(--panel-2)'
    const t = n / max
    return `oklch(${0.34 + t * 0.40} ${0.05 + t * 0.10} 240)`
  }

  // Split flat 84-cell array into 12 columns of 7 days
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const CELL = 8
  const GAP  = 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      {/* Label */}
      <div style={{
        fontSize: 12,
        letterSpacing: '0.04em',
        color: 'var(--text-very-dim)',
        whiteSpace: 'nowrap',
      }}>
        ACTIVITY · 12 WEEKS
      </div>

      {/* Stats column + grid */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        {/* Numeric summary */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
          fontSize: 11.5,
          color: 'var(--text-dim)',
          whiteSpace: 'nowrap',
          paddingBottom: 2,
        }}>
          <span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{total}</span> touches
          </span>
          <span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{streak}</span>d streak
          </span>
          <span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{today}</span> today
          </span>
        </div>

        {/* Heatmap grid — 12 columns × 7 rows */}
        <div style={{ display: 'flex', gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const c = week[di]
                if (!c) return <div key={di} style={{ width: CELL, height: CELL }} />
                return (
                  <div
                    key={di}
                    title={`${c.date instanceof Date
                      ? c.date.toLocaleDateString()
                      : c.date} · ${c.count} touches`}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 2,
                      background: colorFor(c.count),
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TopBar({ stats, activityData, contextLastRebuild }) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).toUpperCase()

  const rebuildLabel = contextLastRebuild
    ? (() => {
        const d = new Date(contextLastRebuild)
        if (isNaN(d.getTime())) return null
        const day  = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d)
        const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
        return `${day} ${time}`
      })()
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '32px 48px 28px',
      borderBottom: '1px solid var(--border-subtle)',
      gap: 24,
      flexShrink: 0,
    }}>
      {/* Left — date, title, stats */}
      <div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-very-dim)',
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}>
          {date}
        </div>
        <h1 style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
          color: 'var(--text)',
        }}>
          Command center
        </h1>
        <div style={{
          marginTop: 10,
          display: 'flex',
          gap: 18,
          fontSize: 12.5,
          color: 'var(--text-dim)',
        }}>
          <StatChip label="projects" value={stats.projects} />
          <StatChip label="stale" value={stats.stale} tone={stats.stale > 0 ? 'warn' : null} />
          <StatChip label="open tasks" value={stats.actions} />
          {rebuildLabel && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-very-dim)', fontSize: 12.5 }}>
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style={{ opacity: 0.6 }}>
                <path d="M8 1a7 7 0 1 0 7 7A7 7 0 0 0 8 1zm.5 10h-1v-5h1zm0-6h-1V4h1z"/>
              </svg>
              Context rebuilt {rebuildLabel}
            </span>
          )}
        </div>
      </div>

      {/* Right — activity heatmap */}
      <ActivityHeatmap cells={activityData} />
    </div>
  )
}

// ─── Needs Your Call ──────────────────────────────────────────────────────────

function TaskAgeChip({ date }) {
  const when = date instanceof Date ? date : new Date(date)
  const days = Math.max(0, Math.floor((Date.now() - when.getTime()) / 86_400_000))
  let hue = 150
  let label = 'fresh'
  if (days >= 45) { hue = 8; label = 'rotting' }
  else if (days >= 21) { hue = 22; label = 'stale' }
  else if (days >= 7) { hue = 80; label = 'aging' }
  return (
    <span
      title={`${days}d old`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 999,
        background: `oklch(0.82 0.13 ${hue} / 0.12)`,
        color: `oklch(0.84 0.13 ${hue})`,
        border: `1px solid oklch(0.82 0.13 ${hue} / 0.28)`,
        fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </span>
  )
}

function NeedsCallTypeDot({ kind, file }) {
  let color = 'var(--text-very-dim)'
  const folder = file?.split('/')[0]
  if (kind === 'project' || folder === 'projects') color = 'var(--success)'
  else if (kind === 'person' || folder === 'people') color = 'var(--info)'
  else if (kind === 'idea' || folder === 'ideas') color = 'var(--accent)'
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function NeedsCallItemRow({ item, isLast, onResolve, onDismiss, dragHandlers, isDragging, isOver }) {
  const handleCheck = async (e) => {
    e.stopPropagation()
    if (item.kind === 'task') await onResolve(item.id)
    else await onDismiss(item.id)
  }

  const sourceLabel = item.kind === 'task'
    ? item.file?.split('/').pop()?.replace('.md', '') ?? ''
    : ''

  const dateForChip = new Date(Date.now() - item.age * 86_400_000)

  return (
    <div
      {...(dragHandlers || {})}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderTop: isLast === false ? '1px solid var(--border-subtle)' : 'none',
        background: isOver ? 'oklch(0.78 0.14 25 / 0.10)' : 'transparent',
        opacity: isDragging ? 0.4 : 1,
        cursor: dragHandlers ? 'grab' : 'default',
        transition: 'background .12s, opacity .15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--panel-2)'
        const h = e.currentTarget.querySelector('[data-drag-handle]')
        if (h) h.style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isOver ? 'oklch(0.78 0.14 25 / 0.10)' : 'transparent'
        const h = e.currentTarget.querySelector('[data-drag-handle]')
        if (h) h.style.opacity = '0.3'
      }}
    >
      <span
        data-drag-handle
        style={{
          color: 'var(--text-very-dim)',
          display: 'inline-flex',
          opacity: 0.3,
          transition: 'opacity .12s',
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
          <circle cx="4.5" cy="4"  r="1.1" /><circle cx="4.5" cy="7"  r="1.1" /><circle cx="4.5" cy="10" r="1.1" />
          <circle cx="9.5" cy="4"  r="1.1" /><circle cx="9.5" cy="7"  r="1.1" /><circle cx="9.5" cy="10" r="1.1" />
        </svg>
      </span>

      <button
        onClick={handleCheck}
        style={{
          width: 18, height: 18, flexShrink: 0,
          border: '1.5px solid var(--border-strong)',
          borderRadius: 5,
          background: 'transparent',
          cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--bg)',
        }}
      />

      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.4, minWidth: 0 }}>
        {item.title}
      </span>

      {sourceLabel && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: 'var(--text-very-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <NeedsCallTypeDot kind={item.kind} file={item.file} />
          {sourceLabel}
        </span>
      )}

      {(() => {
        const tag = item.tags?.find(t => ['urgent','important','priority'].includes(String(t).toLowerCase()))
          ?? (item.reason?.split(' ')[0]?.toLowerCase())
        if (!tag) return null
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: 'oklch(0.70 0.18 22 / 0.16)',
            color: 'oklch(0.84 0.16 22)',
            border: '1px solid oklch(0.70 0.18 22 / 0.40)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {tag}
          </span>
        )
      })()}

      <TaskAgeChip date={dateForChip} />
    </div>
  )
}

function NeedsCallSection({ needsCall, onResolveTask, onDismissNeedsCall, onNeedsCallOrderChange }) {
  const items = needsCall || []
  if (!items.length) return null

  let dragId = null
  let overId = null

  const dragHandlersFor = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      dragId = id
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', id) } catch {}
    },
    onDragEnter: (e) => { e.preventDefault(); if (id !== dragId) overId = id },
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) { dragId = null; overId = null; return }
      const from = items.findIndex((x) => x.id === dragId)
      const to = items.findIndex((x) => x.id === id)
      if (from >= 0 && to >= 0) {
        const next = items.slice()
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        onNeedsCallOrderChange?.(next)
      }
      dragId = null
      overId = null
    },
    onDragEnd: () => { dragId = null; overId = null },
  })

  return (
    <section style={{ padding: '28px 48px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '0 4px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'oklch(0.78 0.16 25)', flex: '0 0 6px' }} />
        <h2 style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)', margin: 0 }}>
          Needs Your Call
        </h2>
        <span style={{ fontSize: 11, color: 'var(--text-very-dim)' }}>{items.length}</span>
      </div>

      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <NeedsCallItemRow
            key={item.id}
            item={item}
            isLast={i === 0}
            onResolve={onResolveTask}
            onDismiss={onDismissNeedsCall}
            dragHandlers={dragHandlersFor(item.id)}
            isDragging={dragId === item.id}
            isOver={overId === item.id}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Summary + Updates ───────────────────────────────────────────────────────

function renderContextContent(text) {
  if (!text) return null
  const lines = text.split('\n')
  const out = []
  let bulletGroup = []
  const flushBullets = () => {
    if (bulletGroup.length === 0) return
    out.push(
      <ul key={`ul-${out.length}`} style={{ margin: '2px 0 6px', paddingLeft: 14, listStyleType: 'disc' }}>
        {bulletGroup.map((item, i) => (
          <li key={i} style={{ marginBottom: 3 }}>{item}</li>
        ))}
      </ul>
    )
    bulletGroup = []
  }
  for (const line of lines) {
    const bulletMatch = line.match(/^[*\-]\s+(.*)$/)
    if (bulletMatch) {
      bulletGroup.push(bulletMatch[1])
    } else {
      flushBullets()
      const trimmed = line.trim()
      if (trimmed) out.push(<p key={`p-${out.length}`} style={{ margin: '0 0 6px' }}>{trimmed}</p>)
    }
  }
  flushBullets()
  return out
}

function fmtGeneratedAt(isoStr) {
  if (!isoStr) return null
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return null
  const day  = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `Generated ${day}, ${time}`
}

function renderUpdatesText(text) {
  if (!text) return null
  const lines = String(text).split('\n').filter(l => l.trim())
  return lines.map((line, i) => {
    const bullet = line.match(/^[-*]\s+(.+)$/)
    const content = bullet ? bullet[1] : line
    return (
      <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="oklch(0.74 0.14 165)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 11px', marginTop: 3 }}>
          <path d="m3 8 3.5 3.5L13 5" />
        </svg>
        <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{content}</span>
      </li>
    )
  })
}

function SummaryRow({
  narrativeThread,
  currentFocus,
  contextLastRebuild,
  dailyUpdates,
  summariesLoading,
  hasApiKey,
  onGenerateSummaries,
}) {
  const canGenerate = hasApiKey && !summariesLoading
  const cardStyle = (tone) => ({
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: `linear-gradient(180deg, oklch(0.72 0.13 ${tone} / 0.05), transparent 65%), var(--panel)`,
    padding: '16px 18px 14px',
    minHeight: 180,
    display: 'flex',
    flexDirection: 'column',
    opacity: summariesLoading ? 0.5 : 1,
    transition: 'opacity 0.3s ease',
    animation: summariesLoading ? 'ms-pulse 1.4s ease-in-out infinite' : 'none',
  })
  const footerTs = contextLastRebuild
    ? (() => {
        const d = new Date(contextLastRebuild)
        if (isNaN(d.getTime())) return null
        const day  = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d)
        const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
        return `Generated ${day}, ${time}`
      })()
    : null

  return (
    <section style={{ padding: '20px 48px 0' }}>
      <SectionHeader
        label="Summaries"
        right={(
          <button
            type="button"
            onClick={onGenerateSummaries}
            disabled={!canGenerate}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px',
              background: !hasApiKey ? 'transparent' : 'oklch(0.80 0.13 80 / 0.12)',
              color: !hasApiKey ? 'var(--text-very-dim)' : 'oklch(0.88 0.13 80)',
              border: `1px solid ${!hasApiKey ? 'var(--border)' : 'oklch(0.80 0.13 80 / 0.36)'}`,
              borderRadius: 6, fontSize: 11.5, fontWeight: 500,
              cursor: canGenerate ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'background .15s, border-color .15s',
              opacity: !hasApiKey ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (canGenerate) { e.currentTarget.style.background = 'oklch(0.80 0.13 80 / 0.22)'; e.currentTarget.style.borderColor = 'oklch(0.80 0.13 80 / 0.55)' }}}
            onMouseLeave={e => { e.currentTarget.style.background = !hasApiKey ? 'transparent' : 'oklch(0.80 0.13 80 / 0.12)'; e.currentTarget.style.borderColor = !hasApiKey ? 'var(--border)' : 'oklch(0.80 0.13 80 / 0.36)' }}
          >
            {summariesLoading
              ? <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid oklch(0.88 0.13 80)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              : (
                <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
                  <path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" />
                </svg>
              )
            }
            {summariesLoading ? 'Generating…' : 'Generate summaries'}
          </button>
        )}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {/* Narrative thread */}
        <div style={cardStyle(240)}>
          <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.3, letterSpacing: '-0.005em' }}>
            Narrative thread
          </h3>
          <div style={{ flex: 1, color: summariesLoading ? 'var(--text-very-dim)' : 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
            {summariesLoading
              ? 'Rebuilding context…'
              : narrativeThread
                ? renderContextContent(narrativeThread)
                : <span style={{ color: 'var(--text-very-dim)' }}>Context not yet built — click Generate summaries to create.</span>
            }
          </div>
          {footerTs && (
            <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-very-dim)' }}>
              {footerTs}
            </div>
          )}
        </div>

        {/* Current focus */}
        <div style={cardStyle(150)}>
          <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.3, letterSpacing: '-0.005em' }}>
            Current focus
          </h3>
          <div style={{ flex: 1, color: summariesLoading ? 'var(--text-very-dim)' : 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
            {summariesLoading
              ? 'Rebuilding context…'
              : currentFocus
                ? renderContextContent(currentFocus)
                : <span style={{ color: 'var(--text-very-dim)' }}>No focus data yet.</span>
            }
          </div>
        </div>

        {/* Updates */}
        <div style={cardStyle(80)}>
          <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.3, letterSpacing: '-0.005em' }}>
            Updates
          </h3>
          <div style={{ flex: 1 }}>
            {summariesLoading
              ? <span style={{ color: 'var(--text-very-dim)', fontSize: 13 }}>Generating updates…</span>
              : dailyUpdates?.text
                ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {renderUpdatesText(dailyUpdates.text)}
                  </ul>
                )
                : <span style={{ color: 'var(--text-very-dim)', fontSize: 13 }}>No updates yet.</span>
            }
          </div>
          {(dailyUpdates?.generated_at || dailyUpdates?.sourceComment) && (
            <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-very-dim)' }}>
              <span>{fmtGeneratedAt(dailyUpdates.generated_at)}</span>
              {dailyUpdates.sourceComment && <span style={{ marginLeft: 8, opacity: 0.7 }}>{dailyUpdates.sourceComment}</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Composed export ──────────────────────────────────────────────────────────

export default function DashboardTop({
  stats,
  activityData,
  needsCall,
  narrativeThread,
  currentFocus,
  contextLastRebuild,
  summariesLoading,
  dailyUpdates,
  hasApiKey,
  onGenerateSummaries,
  onResolveTask = async () => {},
  onDismissNeedsCall = async (id) => { console.log('dismiss', id) },
  onNeedsCallOrderChange = (items) => { console.log('reorder', items) },
  sectionConfig,
}) {
  const isVisible = (id) => sectionConfig?.visibility?.[id] !== false
  const defaultTopOrder = ['needs-call', 'summaries']
  const topOrder = sectionConfig?.order?.length
    ? sectionConfig.order.filter((id) => id === 'needs-call' || id === 'summaries')
    : defaultTopOrder

  const topSections = {
    'needs-call': () => (
      <NeedsCallSection
        needsCall={needsCall}
        onResolveTask={onResolveTask}
        onDismissNeedsCall={onDismissNeedsCall}
        onNeedsCallOrderChange={onNeedsCallOrderChange}
      />
    ),
    summaries: () => (
      <div style={{ paddingBottom: 8 }}>
        <SummaryRow
          narrativeThread={narrativeThread}
          currentFocus={currentFocus}
          contextLastRebuild={contextLastRebuild}
          dailyUpdates={dailyUpdates}
          summariesLoading={summariesLoading}
          hasApiKey={hasApiKey}
          onGenerateSummaries={onGenerateSummaries}
        />
      </div>
    ),
  }

  return (
    <>
      <TopBar stats={stats} activityData={activityData} contextLastRebuild={contextLastRebuild} />
      {topOrder.map((id) => {
        if (!isVisible(id) || !topSections[id]) return null
        return <div key={id}>{topSections[id]()}</div>
      })}
    </>
  )
}
