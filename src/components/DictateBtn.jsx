import { useState } from 'react'

export default function DictateBtn({ active, disabled, onClick }) {
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: active
          ? (hover ? 'oklch(0.70 0.18 22 / 0.24)' : 'oklch(0.70 0.18 22 / 0.16)')
          : (hover ? 'var(--panel-2)' : 'var(--panel)'),
        color: active ? 'oklch(0.84 0.16 22)' : 'var(--text)',
        border: `1px solid ${active
          ? (hover ? 'oklch(0.70 0.18 22 / 0.55)' : 'oklch(0.70 0.18 22 / 0.40)')
          : (hover ? 'var(--border-strong)' : 'var(--border)')}`,
        borderRadius: 8,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          background: active ? 'oklch(0.75 0.20 22)' : 'var(--text-very-dim)',
          boxShadow: active ? '0 0 0 4px oklch(0.70 0.18 22 / 0.20)' : 'none',
          animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}
      />
      {active ? 'Recording…' : 'Dictate'}
    </button>
  )
}
