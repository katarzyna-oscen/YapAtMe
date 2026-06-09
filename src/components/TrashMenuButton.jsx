import { useEffect, useRef, useState } from 'react'

function TrashMenuItem({ label, onClick, danger = false }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 5,
        fontSize: 13,
        cursor: 'pointer',
        color: danger
          ? (hover ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)')
          : (hover ? 'var(--text)' : 'var(--text-dim)'),
        background: hover
          ? (danger ? 'oklch(0.70 0.18 22 / 0.12)' : 'var(--panel-2)')
          : 'transparent',
      }}
    >
      {label}
    </div>
  )
}

export default function TrashMenuButton({
  label,
  onConfirmAction,
  onArchive,
  onDelete,
  showArchive = true,
  confirmArchive = true,
  confirmDelete = true,
  getArchiveConfirm,
  getDeleteConfirm,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return

    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }

    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleArchive = () => {
    setOpen(false)
    if (!confirmArchive) {
      onArchive?.()
      return
    }
    const payload = getArchiveConfirm
      ? getArchiveConfirm(label)
      : {
          title: 'Archive this note?',
          message: `"${label}" will be moved to archive/.`,
          confirmLabel: 'Archive',
          danger: false,
        }

    onConfirmAction?.({
      ...payload,
      onConfirm: onArchive,
    })
  }

  const handleDelete = () => {
    setOpen(false)
    if (!confirmDelete) {
      onDelete?.()
      return
    }
    const payload = getDeleteConfirm
      ? getDeleteConfirm(label)
      : {
          title: 'Delete this note?',
          message: 'This file will be permanently removed. This cannot be undone.',
          confirmLabel: 'Delete',
          danger: true,
        }

    onConfirmAction?.({
      ...payload,
      onConfirm: onDelete,
    })
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Archive or delete"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          background: open ? 'var(--panel-2)' : 'var(--panel)',
          color: open ? 'var(--text)' : 'var(--text-dim)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'inherit',
          transition: 'background .12s, color .12s, border-color .12s',
        }}
        onMouseEnter={(event) => {
          if (!open) {
            event.currentTarget.style.background = 'var(--panel-2)'
            event.currentTarget.style.color = 'var(--text)'
          }
        }}
        onMouseLeave={(event) => {
          if (!open) {
            event.currentTarget.style.background = 'var(--panel)'
            event.currentTarget.style.color = 'var(--text-dim)'
          }
        }}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5h10" />
          <path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
          <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
          <path d="M7 7v4M9 7v4" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            minWidth: 160,
            padding: 4,
            background: 'var(--panel-pop)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
          }}
        >
          {showArchive && <TrashMenuItem label="Archive" onClick={handleArchive} />}
          <TrashMenuItem label="Delete" onClick={handleDelete} danger />
        </div>
      )}
    </div>
  )
}
