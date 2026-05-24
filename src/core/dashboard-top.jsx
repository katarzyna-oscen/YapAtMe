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

function ActivityHeatmap({ cells }) {
  const max = Math.max(...cells.map(c => c.count), 1)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const total  = cells.reduce((s, c) => s + c.count, 0)
  const streak = (() => {
    let s = 0
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i].count > 0) s++; else break
    }
    return s
  })()
  const colorFor = (n) => {
    if (n === 0) return 'var(--panel-2)'
    const t = n / max
    return `oklch(${0.34 + t * 0.40} ${0.05 + t * 0.10} 240)`
  }
  const CELL = 8, GAP = 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <div style={{ fontSize: 12, letterSpacing: '0.04em', color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>
        ACTIVITY · 12 WEEKS
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 11.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', paddingBottom: 2 }}>
          <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{total}</span> touches</span>
          <span><span style={{ color: 'var(--success, #4ade80)', fontWeight: 600 }}>{streak}</span>d streak</span>
          <span><span style={{ color: 'var(--success, #4ade80)', fontWeight: 600 }}>{cells[cells.length - 1]?.count ?? 0}</span> today</span>
        </div>
        <div style={{ display: 'flex', gap: GAP }}>
          {weeks.map((w, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const c = w[di]
                if (!c) return <div key={di} style={{ width: CELL, height: CELL }} />
                return (
                  <div
                    key={di}
                    title={`${c.date.toLocaleDateString()} · ${c.count} touches`}
                    style={{ width: CELL, height: CELL, borderRadius: 2, background: colorFor(c.count) }}
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

function TopBar({ stats, activityData }) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '32px 48px 28px', borderBottom: '1px solid var(--border-subtle)', gap: 24,
    }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-very-dim)', letterSpacing: '0.04em', marginBottom: 6 }}>
          {date.toUpperCase()}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
          Command center
        </h1>
        <div style={{ marginTop: 10, display: 'flex', gap: 18, fontSize: 12.5, color: 'var(--text-dim)' }}>
          <StatChip label="projects" value={stats.projects} />
          <StatChip label="stale" value={stats.stale} tone={stats.stale > 0 ? 'warn' : null} />
          <StatChip label="open tasks" value={stats.actions} />
        </div>
      </div>
      <ActivityHeatmap cells={activityData} />
    </div>
  )
}

// ─── Needs Your Call ──────────────────────────────────────────────────────────

function kindIcon(kind) {
  if (kind === 'project') return 'project'
  if (kind === 'person')  return 'person'
  if (kind === 'task')    return 'task'
  return 'idea'
}

function NeedsCallRowItem({ item, isLast, onNavigate }) {
  const kindLabel = item.kind.charAt(0).toUpperCase() + item.kind.slice(1)
  return (
    <div
      onClick={() => item.file && onNavigate('viewer', item.file)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
        cursor: item.file ? 'pointer' : 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px oklch(0.80 0.13 80 / 0.18)', flex: '0 0 6px' }} />
      <span style={{ color: 'var(--text-very-dim)', display: 'inline-flex' }}>
        <Icon name={kindIcon(item.kind)} size={14} />
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-very-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', width: 60, flex: '0 0 60px' }}>
        {kindLabel}
      </span>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)' }}>{item.title}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{item.reason}</span>
      <AgeChip days={item.age} />
    </div>
  )
}

function NeedsYourCall({ items, onNavigate }) {
  if (items.length === 0) return null
  return (
    <section style={{ padding: '28px 48px 8px' }}>
      <SectionHeader
        label="Needs Your Call"
        right={<span style={{ fontSize: 11.5, color: 'var(--accent)' }}>{items.length} flagged</span>}
      />
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <NeedsCallRowItem key={`${it.kind}-${it.id}`} item={it} isLast={i === items.length - 1} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  )
}

// ─── Week Summary ─────────────────────────────────────────────────────────────

function WeekSummary({ weekSummary, summaryLoading, hasApiKey, onGenerateSummary }) {
  const ts = weekSummary?.generated_at
    ? new Date(weekSummary.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <section style={{ padding: '28px 48px 0' }}>
      <SectionHeader
        label="Summary of the Week"
        right={
          <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)' }}>
            {ts ? `generated ${ts}` : 'not yet generated'}
          </span>
        }
      />
      <div style={{
        padding: '18px 20px',
        background: 'linear-gradient(180deg, oklch(0.72 0.13 240 / 0.06), transparent 70%), var(--panel)',
        border: '1px solid var(--border)', borderRadius: 10,
      }}>
        {weekSummary?.text && (
          <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.6, color: 'var(--text)', textWrap: 'pretty' }}>
            {weekSummary.text}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onGenerateSummary}
            disabled={!hasApiKey || summaryLoading}
            title={!hasApiKey ? 'Add API key in Settings' : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
              background: 'var(--panel-2)', color: hasApiKey ? 'var(--text)' : 'var(--text-very-dim)',
              border: '1px solid var(--border)', cursor: hasApiKey && !summaryLoading ? 'pointer' : 'not-allowed',
              opacity: !hasApiKey ? 0.5 : 1,
            }}
          >
            {summaryLoading && <Icon name="spinner" size={13} />}
            {weekSummary ? 'Regenerate' : 'Generate digest'}
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Composed export ──────────────────────────────────────────────────────────

export default function DashboardTop({ stats, activityData, needsCall, weekSummary, summaryLoading, hasApiKey, onGenerateSummary, onNavigate }) {
  return (
    <>
      <TopBar stats={stats} activityData={activityData} />
      <NeedsYourCall items={needsCall} onNavigate={onNavigate} />
      <WeekSummary
        weekSummary={weekSummary}
        summaryLoading={summaryLoading}
        hasApiKey={hasApiKey}
        onGenerateSummary={onGenerateSummary}
      />
    </>
  )
}
