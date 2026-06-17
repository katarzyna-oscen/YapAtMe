import { useState } from 'react'

export function PrimaryButton({ children, onClick, type = 'button', disabled, loading }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 16px',
        background: hov ? 'oklch(0.80 0.13 80 / 0.32)' : 'oklch(0.80 0.13 80 / 0.22)',
        color: 'oklch(0.92 0.13 80)',
        border: `1px solid ${hov ? 'oklch(0.80 0.13 80 / 0.65)' : 'oklch(0.80 0.13 80 / 0.45)'}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >{loading ? (
      <>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
          <path d="M13 8a5 5 0 1 1-1.6-3.66" /><path d="M13 2.5V5h-2.5" />
        </svg>
        <span>Loading…</span>
      </>
    ) : children}</button>
  )
}

export function SecondaryButton({ children, onClick, danger, success, disabled }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 16px',
        background: danger
          ? (hov ? 'oklch(0.70 0.18 22 / 0.16)' : 'transparent')
          : success
          ? (hov ? 'oklch(0.74 0.14 165 / 0.22)' : 'oklch(0.74 0.14 165 / 0.12)')
          : (hov ? 'var(--panel-2)' : 'var(--panel)'),
        color: danger
          ? (hov ? 'oklch(0.88 0.16 22)' : 'oklch(0.78 0.16 22)')
          : success
          ? (hov ? 'oklch(0.90 0.14 165)' : 'oklch(0.80 0.14 165)')
          : (hov ? 'var(--text)' : 'var(--text-dim)'),
        border: `1px solid ${
          danger
            ? (hov ? 'oklch(0.70 0.18 22 / 0.55)' : 'oklch(0.70 0.18 22 / 0.30)')
            : success
            ? (hov ? 'oklch(0.74 0.14 165 / 0.65)' : 'oklch(0.74 0.14 165 / 0.40)')
            : (hov ? 'var(--border-strong)' : 'var(--border)')
        }`,
        borderRadius: 8,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >{children}</button>
  )
}

export function IconButton({ children, onClick, label, title, loading }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: hov ? 'var(--panel-2)' : 'transparent',
        color: hov ? 'var(--text)' : 'var(--text-dim)',
        border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 6,
        fontSize: 11.5,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      {loading ? (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M13 8a5 5 0 1 1-1.6-3.66" /><path d="M13 2.5V5h-2.5" />
        </svg>
      ) : children}
      {label && !loading && label}
      {loading && 'Rebuilding…'}
    </button>
  )
}
