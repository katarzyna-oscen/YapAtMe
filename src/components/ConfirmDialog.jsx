import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PrimaryButton, SecondaryButton } from './ui/Buttons'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return

    const onKey = (event) => {
      if (event.key === 'Escape') onCancel?.()
      if (event.key === 'Enter') onConfirm?.()
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  const hue = danger ? 22 : 230

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'modalFadeIn .12s ease-out',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)',
          padding: 24,
          color: 'var(--text)',
          animation: 'modalPopIn .15s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `oklch(0.70 0.18 ${hue} / 0.16)`,
              color: `oklch(0.84 0.16 ${hue})`,
            }}
          >
            <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 3.5v5" />
              <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
              <path d="M7.13 1.7 1.4 12a1 1 0 0 0 .87 1.5h11.46a1 1 0 0 0 .87-1.5L8.87 1.7a1 1 0 0 0-1.74 0Z" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {title}
          </h2>
        </div>

        <p style={{ margin: '0 0 22px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-dim)' }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <SecondaryButton onClick={onCancel}>
            {cancelLabel}
          </SecondaryButton>
          <PrimaryButton onClick={onConfirm}>
            {confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
