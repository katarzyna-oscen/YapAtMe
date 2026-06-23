import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Priority is stored on a task as tags ('urgent' / 'important').
// 'standard' = no priority tag.
export const PRIORITY_TAGS = ['urgent', 'important', 'priority']

export const PRIORITY_OPTIONS = [
  { id: 'standard', label: 'Standard', hue: null },
  { id: 'important', label: 'Important', hue: 80 },
  { id: 'urgent', label: 'Urgent', hue: 22 },
]

export function tagsToPriority(tags) {
  const t = (Array.isArray(tags) ? tags : []).map((x) => String(x).toLowerCase())
  if (t.includes('urgent')) return 'urgent'
  if (t.includes('important') || t.includes('priority')) return 'important'
  return 'standard'
}

export function applyPriorityToTags(tags, priority) {
  const base = (Array.isArray(tags) ? tags : [])
    .map((x) => String(x).trim().toLowerCase())
    .filter((x) => x && !PRIORITY_TAGS.includes(x))
  if (priority === 'urgent' || priority === 'important') base.push(priority)
  return [...new Set(base)]
}

// Read-only pill — matches the Command Centre priority chip (red, lowercase).
// Renders nothing for 'standard'.
export function PriorityChip({ priority }) {
  const opt = PRIORITY_OPTIONS.find((o) => o.id === priority)
  if (!opt || opt.id === 'standard') return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        background: 'oklch(0.70 0.18 22 / 0.16)',
        color: 'oklch(0.84 0.16 22)',
        border: '1px solid oklch(0.70 0.18 22 / 0.40)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {opt.label.toLowerCase()}
    </span>
  )
}

// Editable dropdown chip — Standard / Important / Urgent.
export function PrioritySelect({ priority = 'standard', onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const portalRef = useRef(null)
  const current = PRIORITY_OPTIONS.find((o) => o.id === priority) || PRIORITY_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      const inAnchor = ref.current?.contains(e.target)
      const inPortal = portalRef.current?.contains(e.target)
      if (!inAnchor && !inPortal) setOpen(false)
    }
    const closeOnScroll = (e) => {
      const target = e?.target
      if (target && (ref.current?.contains(target) || portalRef.current?.contains(target))) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', closeOnScroll)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', closeOnScroll)
    }
  }, [open])

  const openMenu = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const width = 160
      setPos({ top: r.bottom + 6, left: Math.max(8, r.right - width) })
    }
    setOpen(true)
  }

  const isStandard = current.id === 'standard'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        draggable={false}
        onClick={(e) => { e.stopPropagation(); if (open) setOpen(false); else openMenu() }}
        onMouseDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        title="Set priority"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          background: isStandard ? 'transparent' : 'oklch(0.70 0.18 22 / 0.16)',
          border: `1px solid ${isStandard ? 'var(--border)' : 'oklch(0.70 0.18 22 / 0.40)'}`,
          color: isStandard ? 'var(--text-very-dim)' : 'oklch(0.84 0.16 22)',
          fontSize: 11,
          fontWeight: isStandard ? 500 : 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          transition: 'border-color .12s, background .12s',
        }}
      >
        {isStandard ? current.label : current.label.toLowerCase()}
        <svg viewBox="0 0 10 10" width="7" height="7" fill="currentColor" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && createPortal(
        <div ref={portalRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 240, width: 160, padding: 4, background: 'var(--panel-pop)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)' }}>
          {PRIORITY_OPTIONS.map((opt) => {
            const active = opt.id === current.id
            const dot = opt.id === 'standard' ? 'var(--text-very-dim)' : 'oklch(0.78 0.16 22)'
            return (
              <div
                key={opt.id}
                onClick={(e) => { e.stopPropagation(); onChange?.(opt.id); setOpen(false) }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', color: active ? 'var(--text)' : 'var(--text-dim)', fontSize: 12.5 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
                {opt.label}
                {active && <span style={{ marginLeft: 'auto', color: 'var(--text-very-dim)' }}>✓</span>}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
