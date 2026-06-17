import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function WikilinkCreatePopover({ name, coords, enabledModules, onSelect, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Clamp so the popover doesn't run off the right or bottom edge
  const rawX = coords?.x ?? window.innerWidth / 2
  const rawY = (coords?.y ?? 180) + 14
  const x = Math.max(8, Math.min(rawX, window.innerWidth - 240))
  const y = Math.min(rawY, window.innerHeight - 220)

  const options = []
  if (enabledModules?.people !== false)   options.push({ folder: 'people',   label: 'Create as Person' })
  if (enabledModules?.projects !== false) options.push({ folder: 'projects', label: 'Create as Project' })
  if (enabledModules?.ideas !== false)    options.push({ folder: 'ideas',    label: 'Create as Idea' })
  options.push({ folder: 'notes', label: 'Create as Note' })

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 200,
          minWidth: 210,
          padding: '4px 4px 6px',
          background: 'var(--panel-pop)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '7px 10px 8px',
          fontSize: 12,
          color: 'var(--text-very-dim)',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 4,
        }}>
          Create{' '}
          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>[[{name}]]</span>
        </div>
        {options.map(({ folder, label }) => (
          <button
            key={folder}
            type="button"
            onClick={() => onSelect(folder)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '7px 12px',
              background: 'transparent',
              color: 'var(--text-dim)',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background .1s, color .1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--panel-2)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </>,
    document.body
  )
}
