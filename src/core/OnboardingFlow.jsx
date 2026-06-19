// Onboarding flow — all 7 screens + kit primitives.
// Shown on first launch (no stored vault handle) or when triggered from Settings.
// Props: openFolder, fileExists, listTree, writeFile, settings, saveSettings, onComplete

import { useState, useEffect, useCallback } from 'react'
import { callLLM, PROVIDERS, normalizeModelForProvider } from '../lib/llm'

// ─── Icon ───────────────────────────────────────────────────────────────────
function OnbIcon({ name, size = 16, stroke = 1.6 }) {
  const s = { width: size, height: size, flex: '0 0 auto', display: 'block' }
  switch (name) {
    case 'arrow':    return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
    case 'back':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
    case 'warn':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><path d="M8 5.5v3.2" /><circle cx="8" cy="11.4" r="0.55" fill="currentColor" /><path d="M7.13 1.9 1.6 11.6a1 1 0 0 0 .87 1.5h11.06a1 1 0 0 0 .87-1.5L8.87 1.9a1 1 0 0 0-1.74 0Z" /></svg>
    case 'lock':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><rect x="3.2" y="7" width="9.6" height="6.5" rx="1.5" /><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" /><circle cx="8" cy="10" r="0.7" fill="currentColor" stroke="none" /></svg>
    case 'folder':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4c.4 0 .77.16 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" /></svg>
    case 'person':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" /></svg>
    case 'project':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6h12" /></svg>
    case 'idea':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round"><path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" /><path d="M6 14h4" /></svg>
    case 'check':    return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3.5 3.5L13 5" /></svg>
    case 'x':        return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    case 'plus':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
    case 'external': return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5" /></svg>
    case 'grid':     return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
    case 'spark':    return <svg viewBox="0 0 16 16" style={s} fill="currentColor"><path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" /></svg>
    default:         return null
  }
}

function OnbSpinner({ size = 13 }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" opacity="0.9" />
    </svg>
  )
}

// ─── Buttons ────────────────────────────────────────────────────────────────
function PrimaryButton({ children, onClick, disabled, full, size = 'md', iconRight }) {
  const [hov, setHov] = useState(false)
  const pad = size === 'lg' ? '12px 22px' : '10px 18px'
  const fs  = size === 'lg' ? 14.5 : 13.5
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        width: full ? '100%' : 'auto', padding: pad,
        background: disabled ? 'oklch(0.80 0.13 80 / 0.10)' : hov ? 'oklch(0.80 0.13 80 / 0.34)' : 'oklch(0.80 0.13 80 / 0.22)',
        color: disabled ? 'oklch(0.80 0.06 80 / 0.55)' : 'oklch(0.92 0.13 80)',
        border: `1px solid ${disabled ? 'oklch(0.80 0.10 80 / 0.22)' : hov ? 'oklch(0.80 0.13 80 / 0.68)' : 'oklch(0.80 0.13 80 / 0.45)'}`,
        borderRadius: 9, fontSize: fs, fontWeight: 500, whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s, border-color .15s, color .15s',
        fontFamily: 'inherit',
      }}>
      {children}
      {iconRight && <OnbIcon name={iconRight} size={15} />}
    </button>
  )
}

function SecondaryButton({ children, onClick, danger, full, iconLeft, size = 'md' }) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: full ? '100%' : 'auto',
        padding: size === 'lg' ? '12px 22px' : '10px 18px',
        background: danger ? (hov ? 'oklch(0.70 0.18 22 / 0.16)' : 'transparent') : (hov ? 'var(--panel-2)' : 'var(--panel)'),
        color: danger ? (hov ? 'oklch(0.88 0.16 22)' : 'oklch(0.78 0.16 22)') : (hov ? 'var(--text)' : 'var(--text-dim)'),
        border: `1px solid ${danger ? (hov ? 'oklch(0.70 0.18 22 / 0.55)' : 'oklch(0.70 0.18 22 / 0.30)') : (hov ? 'var(--border-strong, var(--border))' : 'var(--border)')}`,
        borderRadius: 9, fontSize: 13.5, whiteSpace: 'nowrap',
        cursor: 'pointer', transition: 'background .15s, border-color .15s, color .15s',
        fontFamily: 'inherit',
      }}>
      {iconLeft && <OnbIcon name={iconLeft} size={15} />}
      {children}
    </button>
  )
}

function TextLink({ children, onClick, icon }) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none', padding: 0,
        color: hov ? 'var(--text)' : 'var(--text-dim)',
        fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
        textDecoration: hov ? 'underline' : 'none', textUnderlineOffset: 3,
        transition: 'color .12s', fontFamily: 'inherit',
      }}>
      {children}
      {icon && <OnbIcon name={icon} size={13} />}
    </button>
  )
}

// ─── Fields ────────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-dim)', marginBottom: 8 }}>
      {children}
    </label>
  )
}

function TextField({ value, onChange, type = 'text', placeholder, mono, autoFocus, onEnter, invalid }) {
  const [focus, setFocus] = useState(false)
  return (
    <input type={type} value={value} autoFocus={autoFocus}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
      placeholder={placeholder}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        width: '100%', padding: '11px 13px',
        background: 'var(--panel)', color: 'var(--text)',
        border: `1px solid ${invalid ? 'oklch(0.70 0.18 22 / 0.7)' : focus ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 9, fontSize: 14, outline: 'none',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
        transition: 'border-color .12s',
      }} />
  )
}

function SelectField({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const current = options.find(o => o.value === value) || options[0]
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '11px 13px',
          background: 'var(--panel)', color: 'var(--text)',
          border: `1px solid ${open ? 'var(--border)' : 'var(--border)'}`,
          borderRadius: 9, fontSize: 14, outline: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .12s',
        }}>
        <span>{current.label}</span>
        <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor"
          style={{ opacity: 0.55, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flex: '0 0 10px', color: 'var(--text-dim)' }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, padding: 4,
          background: 'var(--panel-pop, var(--panel))', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        }}>
          {options.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
              style={{ padding: '9px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13.5, color: o.value === value ? 'var(--text)' : 'var(--text-dim)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--panel-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Switch({ checked, onToggle }) {
  return (
    <span onClick={e => { e.stopPropagation(); onToggle() }}
      style={{
        width: 38, height: 22, borderRadius: 999, flex: '0 0 38px',
        position: 'relative', cursor: 'pointer', display: 'inline-block',
        background: checked ? 'oklch(0.80 0.13 80 / 0.85)' : 'var(--border-strong, #444)',
        transition: 'background .16s',
      }}>
      <span style={{
        position: 'absolute', top: 3, left: checked ? 19 : 3, width: 16, height: 16,
        borderRadius: '50%', background: checked ? '#1a1408' : 'var(--text-dim)',
        transition: 'left .16s, background .16s',
      }} />
    </span>
  )
}

function Notice({ tone = 'amber', icon, title, children, compact }) {
  const hue = tone === 'amber' ? 80 : tone === 'info' ? 240 : tone === 'danger' ? 22 : 80
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: compact ? '11px 13px' : '14px 16px',
      background: `oklch(0.80 0.13 ${hue} / 0.07)`,
      border: `1px solid oklch(0.80 0.13 ${hue} / 0.28)`,
      borderRadius: 10,
    }}>
      <span style={{ color: `oklch(0.84 0.13 ${hue})`, display: 'inline-flex', marginTop: 1, flex: '0 0 auto' }}>
        <OnbIcon name={icon} size={compact ? 15 : 16} />
      </span>
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontSize: 13, fontWeight: 600, color: `oklch(0.88 0.10 ${hue})`, marginBottom: children ? 4 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: 12.8, lineHeight: 1.55, color: 'var(--text-dim)' }}>{children}</div>}
      </div>
    </div>
  )
}

// ─── Shell + Progress ────────────────────────────────────────────────────────
function ProgressDots({ total, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          height: 6, borderRadius: 999,
          width: i === current ? 22 : 6,
          background: i === current ? 'var(--accent)' : i < current ? 'oklch(0.80 0.13 80 / 0.45)' : 'var(--border-strong, #444)',
          transition: 'width .25s, background .25s',
        }} />
      ))}
    </div>
  )
}

function ScreenHeading({ title, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>{title}</h1>
      {children && <p style={{ margin: '14px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-dim)', maxWidth: 520 }}>{children}</p>}
    </div>
  )
}

function OnbShell({ stepKey, total, current, showBack, onBack, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--bg-primary, var(--bg))' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, padding: '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.80 0.13 80 / 0.16)', color: 'var(--accent)', border: '1px solid oklch(0.80 0.13 80 / 0.3)' }}>
              <OnbIcon name="grid" size={13} />
            </span>
            <span style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>YapAtMe</span>
          </div>
          <ProgressDots total={total} current={current} />
        </div>

        <div style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 70px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015)',
          padding: '30px 34px 34px',
          overflow: 'hidden',
        }}>
          {showBack && (
            <button type="button" onClick={onBack} aria-label="Back"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, background: 'transparent', border: 'none', padding: 0, color: 'var(--text-very-dim)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-very-dim)'}>
              <OnbIcon name="back" size={14} /> Back
            </button>
          )}
          <div key={stepKey} style={{ animation: 'screenIn .28s ease-out' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Screens ────────────────────────────────────────────────────────────────
function WelcomeScreen({ act }) {
  const [hovNew, setHovNew] = useState(false)
  const [hovPro, setHovPro] = useState(false)

  const cardStyle = hov => ({
    flex: 1, textAlign: 'left', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: '20px 20px 18px',
    background: hov ? 'var(--panel-2)' : 'var(--panel)',
    border: `1px solid ${hov ? 'oklch(0.80 0.13 80 / 0.55)' : 'var(--border)'}`,
    borderRadius: 13, transform: hov ? 'translateY(-2px)' : 'none',
    transition: 'background .15s, border-color .15s, transform .15s',
    fontFamily: 'inherit',
  })

  return (
    <div>
      <ScreenHeading title="Less chaos. Minimal setup.">
        YapAtMe keeps track of what matters to you — context, tasks, projects, people, ideas — so you don't have to.
        Just write what's on your mind. It does the rest.
      </ScreenHeading>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <button type="button" style={cardStyle(hovNew)} onClick={() => act.choosePath('new')} onMouseEnter={() => setHovNew(true)} onMouseLeave={() => setHovNew(false)}>
          <span style={{ width: 38, height: 38, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hovNew ? 'oklch(0.80 0.13 80 / 0.18)' : 'var(--panel-2)', color: hovNew ? 'var(--accent)' : 'var(--text-dim)', border: '1px solid var(--border)', transition: 'background .15s, color .15s' }}>
            <OnbIcon name="idea" size={18} />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>New to YapAtMe</span>
              <span style={{ color: hovNew ? 'var(--accent)' : 'var(--text-very-dim)', display: 'inline-flex', transition: 'color .15s', marginTop: 3 }}><OnbIcon name="arrow" size={15} /></span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)' }}>Start with a guided setup. We'll walk you through the basics and help you add your first people and projects.</p>
          </div>
        </button>
        <button type="button" style={cardStyle(hovPro)} onClick={() => act.choosePath('pro')} onMouseEnter={() => setHovPro(true)} onMouseLeave={() => setHovPro(false)}>
          <span style={{ width: 38, height: 38, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hovPro ? 'oklch(0.80 0.13 80 / 0.18)' : 'var(--panel-2)', color: hovPro ? 'var(--accent)' : 'var(--text-dim)', border: '1px solid var(--border)', transition: 'background .15s, color .15s' }}>
            <OnbIcon name="arrow" size={18} />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>I know what I'm doing</span>
              <span style={{ color: hovPro ? 'var(--accent)' : 'var(--text-very-dim)', display: 'inline-flex', transition: 'color .15s', marginTop: 3 }}><OnbIcon name="arrow" size={15} /></span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)' }}>Skip the guidance. Blank vault, ready immediately.</p>
          </div>
        </button>
      </div>
      <Notice tone="amber" icon="warn">
        YapAtMe requires an AI API key to process notes. You'll set this up in the next steps.
      </Notice>
    </div>
  )
}

function NameScreen({ s, act }) {
  const ready = s.name.trim().length > 0
  return (
    <div>
      <ScreenHeading title="Let's start with you." />
      <FieldLabel>Your name</FieldLabel>
      <TextField value={s.name} onChange={act.setName} placeholder="e.g. Katarzyna" autoFocus onEnter={() => ready && act.next()} />
      <p style={{ margin: '10px 2px 0', fontSize: 12.5, fontStyle: 'italic', lineHeight: 1.55, color: 'var(--text-very-dim)' }}>
        This creates your personal file in the vault. Actions you take in notes route back to you.
      </p>
      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryButton onClick={act.next} disabled={!ready} iconRight="arrow" size="lg">Continue</PrimaryButton>
      </div>
    </div>
  )
}

function FolderScreen({ s, act, openFolder, fileExists, listTree }) {
  const [picking, setPicking] = useState(false)
  const folder = s.folder

  const handlePick = useCallback(async () => {
    setPicking(true)
    act.setFolder(null)
    try {
      const handle = await openFolder()
      if (!handle) { setPicking(false); return }

      // Validate: check for .memostack marker (existing YapAtMe vault)
      let state = 'A'
      try {
        const contextDir = await handle.getDirectoryHandle('context')
        try {
          await contextDir.getFileHandle('.memostack')
          state = 'B'
        } catch {
          // context/ exists (created by initVault) but no marker → new vault
          state = 'A'
        }
      } catch {
        state = 'A'
      }
      act.setFolder({ state, name: handle.name })
    } catch (err) {
      if (err?.name !== 'AbortError') console.warn('Folder pick error:', err)
    } finally {
      setPicking(false)
    }
  }, [openFolder, act])

  return (
    <div>
      <ScreenHeading title="Where should your vault live?">
        Choose an empty folder. YapAtMe will create its structure inside it.
      </ScreenHeading>
      <p style={{ margin: '-12px 0 22px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-very-dim)', maxWidth: 500 }}>
        Your notes never leave your machine — the vault lives entirely on your device.
        If you move the folder later, reconnect it from Settings.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 9, color: folder ? 'var(--text)' : 'var(--text-very-dim)' }}>
          <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}><OnbIcon name="folder" size={15} /></span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {folder ? folder.name : 'No folder selected'}
          </span>
        </div>
        <SecondaryButton iconLeft={picking ? undefined : 'folder'} onClick={handlePick}>
          {picking ? <OnbSpinner /> : folder ? 'Change' : 'Choose folder'}
        </SecondaryButton>
      </div>

      {folder?.state === 'B' && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="info" icon="folder" title="This looks like an existing YapAtMe vault.">
            Connect to it instead?
          </Notice>
          <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
            <PrimaryButton onClick={() => act.connectExisting()}>Connect existing vault</PrimaryButton>
            <SecondaryButton onClick={handlePick}>Choose different folder</SecondaryButton>
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryButton onClick={act.next} disabled={!folder || folder.state !== 'A'} iconRight="arrow" size="lg">Continue</PrimaryButton>
      </div>
    </div>
  )
}

const MODEL_OPTIONS = {
  openrouter: [
    { value: 'anthropic/claude-3.5-sonnet',          label: 'Claude 3.5 Sonnet' },
    { value: 'anthropic/claude-3-haiku',             label: 'Claude 3 Haiku (fast)' },
    { value: 'openai/gpt-4o',                        label: 'GPT-4o' },
    { value: 'openai/gpt-4o-mini',                   label: 'GPT-4o mini (fast)' },
    { value: 'meta-llama/llama-3.3-70b-instruct',    label: 'Llama 3.3 70B' },
    { value: 'google/gemini-2.0-flash-001',          label: 'Gemini 2.0 Flash' },
    { value: 'google/gemma-4-31b-it',                label: 'Gemma 4 31B' },
    { value: '__custom__',                           label: 'Other (enter model ID…)' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5 (fast)' },
    { value: 'claude-3-opus-20240229',     label: 'Claude 3 Opus' },
    { value: '__custom__',               label: 'Other (enter model ID…)' },
  ],
  openai: [
    { value: 'gpt-4o',       label: 'GPT-4o' },
    { value: 'gpt-4o-mini',  label: 'GPT-4o mini (fast)' },
    { value: 'gpt-4-turbo',  label: 'GPT-4 Turbo' },
    { value: '__custom__',   label: 'Other (enter model ID…)' },
  ],
  ollama: [
    { value: 'llama3.2',  label: 'Llama 3.2' },
    { value: 'llama3.1',  label: 'Llama 3.1' },
    { value: 'mistral',   label: 'Mistral' },
    { value: 'phi4',      label: 'Phi-4' },
    { value: '__custom__', label: 'Other (enter model ID…)' },
  ],
}

function AiScreen({ s, act }) {
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState(null)
  const key = s.apiKey.trim()
  const providerDef = PROVIDERS[s.provider] || PROVIDERS.openrouter
  const needsKey = providerDef.needsKey !== false

  const modelOptions = MODEL_OPTIONS[s.provider] || MODEL_OPTIONS.openrouter
  const isCustom = !modelOptions.some(o => o.value !== '__custom__' && o.value === s.model)
  const selectValue = isCustom ? '__custom__' : s.model
  const model = s.model || providerDef.model

  const handleSelectModel = v => {
    if (v === '__custom__') {
      act.setModel('')
    } else {
      act.setModel(normalizeModelForProvider(s.provider, v))
    }
    if (error) setError(null)
  }

  const submit = async () => {
    if (testing) return
    setError(null)
    if (needsKey && key.length < 10) {
      setError('That key looks too short. Paste the full key from your provider.')
      return
    }
    if (!model.trim()) {
      setError('Enter a model name.')
      return
    }
    if (!needsKey) { act.next(); return }
    setTesting(true)
    try {
      await callLLM([{ role: 'user', content: 'Say "ok" in one word.' }], '', { provider: s.provider, apiKey: key, model }, 5)
      act.next()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('401') || msg.includes('403') || msg.includes('key')) {
        setError('The provider rejected this key. Check it was copied in full and has credit available.')
      } else {
        setError(`Connection failed: ${msg.slice(0, 120)}`)
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <ScreenHeading title="Connect your AI key.">
        YapAtMe uses AI to read your notes and route information into the right places.
        Without a key, note processing won't work.
      </ScreenHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <FieldLabel>Provider</FieldLabel>
          <SelectField value={s.provider} onChange={v => { act.setProvider(v); setError(null) }}
            options={[
              { value: 'openrouter', label: 'OpenRouter' },
              { value: 'anthropic',  label: 'Anthropic'  },
              { value: 'openai',     label: 'OpenAI'     },
              { value: 'ollama',     label: 'Ollama (local)' },
            ]} />
        </div>
        <div>
          <FieldLabel>Model</FieldLabel>
          <SelectField value={selectValue} onChange={handleSelectModel} options={modelOptions} />
          {isCustom && (
            <div style={{ marginTop: 8 }}>
              <TextField value={s.model} onChange={v => { act.setModel(normalizeModelForProvider(s.provider, v)); if (error) setError(null) }}
                placeholder={providerDef.model || 'e.g. my-model-id'} mono autoFocus />
            </div>
          )}
        </div>
        {needsKey && (
          <div>
            <FieldLabel>API key</FieldLabel>
            <TextField type="password" value={s.apiKey} onChange={v => { act.setApiKey(v); if (error) setError(null) }}
              placeholder="Paste your key here" mono invalid={!!error} onEnter={submit} />
          </div>
        )}
        {error && <Notice tone="danger" icon="warn" compact>{error}</Notice>}
        <Notice tone="amber" icon="lock" title="Your key stays on this device.">
          Stored locally in your browser's IndexedDB. Never sent to YapAtMe servers — only to the AI provider when you process a note.
        </Notice>
      </div>
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryButton onClick={submit} disabled={testing || (needsKey && key.length === 0)} size="lg" iconRight={testing ? undefined : 'arrow'}>
          {testing && <OnbSpinner />}
          {testing ? 'Verifying…' : 'Continue'}
        </PrimaryButton>
      </div>
    </div>
  )
}

const MODULE_DEFS = [
  { id: 'people',   icon: 'person',  label: 'People',   body: 'Track conversations, follow-ups, delegations, and tasks with the people you work with.' },
  { id: 'projects', icon: 'project', label: 'Projects', body: 'Keep tabs on what\'s moving, what\'s blocked, and what decisions have been made.' },
  { id: 'ideas',    icon: 'idea',    label: 'Ideas',    body: 'Capture sparks before they disappear. Route them into a backlog and shape them into plans.' },
]

function ModuleRow({ def, checked, onToggle }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '15px 16px',
        background: hov || checked ? 'var(--panel-2)' : 'var(--panel)',
        border: `1px solid ${checked ? 'oklch(0.80 0.13 80 / 0.32)' : 'var(--border)'}`,
        borderRadius: 11, cursor: 'pointer', transition: 'background .12s, border-color .12s',
      }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, flex: '0 0 34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: checked ? 'oklch(0.80 0.13 80 / 0.16)' : 'var(--panel)', color: checked ? 'var(--accent)' : 'var(--text-dim)', border: '1px solid var(--border)', marginTop: 1 }}>
        <OnbIcon name={def.icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{def.label}</div>
        <p style={{ margin: 0, fontSize: 12.8, lineHeight: 1.5, color: 'var(--text-dim)' }}>{def.body}</p>
      </div>
      <span style={{ marginTop: 4 }}><Switch checked={checked} onToggle={onToggle} /></span>
    </div>
  )
}

function ModulesScreen({ s, act }) {
  return (
    <div>
      <ScreenHeading title="What do you want to track?">
        You can change this any time in Settings.
      </ScreenHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MODULE_DEFS.map(def => (
          <ModuleRow key={def.id} def={def} checked={!!s.modules[def.id]} onToggle={() => act.toggleModule(def.id)} />
        ))}
      </div>
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <PrimaryButton onClick={act.next} iconRight="arrow" size="lg">Continue</PrimaryButton>
      </div>
    </div>
  )
}

function SeedRowInput({ value, onChange, placeholder, flex }) {
  const [focus, setFocus] = useState(false)
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        flex: flex || 1, minWidth: 0, padding: '9px 12px',
        background: 'var(--panel)', color: 'var(--text)',
        border: `1px solid ${focus ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 9, fontSize: 13.5, outline: 'none',
        fontFamily: 'inherit', transition: 'border-color .12s',
      }} />
  )
}

function RemoveBtn({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" onClick={onClick} aria-label="Remove"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 34, height: 34, flex: '0 0 34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, cursor: 'pointer',
        background: hov ? 'oklch(0.70 0.18 22 / 0.14)' : 'transparent',
        color: hov ? 'oklch(0.84 0.16 22)' : 'var(--text-very-dim)',
        border: `1px solid ${hov ? 'oklch(0.70 0.18 22 / 0.4)' : 'var(--border)'}`,
        transition: 'background .12s, color .12s, border-color .12s',
        fontFamily: 'inherit',
      }}>
      <OnbIcon name="x" size={13} />
    </button>
  )
}

function SeedScreen({ s, act }) {
  const showPeople   = !!s.modules.people
  const showProjects = !!s.modules.projects

  return (
    <div>
      <ScreenHeading title="Give YapAtMe something to start with.">
        Add a few people and projects you're working with right now. Optional — you can skip and let notes build the vault naturally.
      </ScreenHeading>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {showPeople && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}><OnbIcon name="person" size={14} /></span>
              <span style={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 600, color: 'var(--text-very-dim)', textTransform: 'uppercase' }}>People</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.seedPeople.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <SeedRowInput value={row.name} onChange={v => act.editSeed('people', i, 'name', v)} placeholder="Name" flex={1.3} />
                  <SeedRowInput value={row.role} onChange={v => act.editSeed('people', i, 'role', v)} placeholder="Role (optional)" flex={1} />
                  <RemoveBtn onClick={() => act.removeSeed('people', i)} />
                </div>
              ))}
            </div>
            {s.seedPeople.length < 3 && (
              <div style={{ marginTop: 10 }}>
                <TextLink icon="plus" onClick={() => act.addSeed('people')}>Add another</TextLink>
              </div>
            )}
          </div>
        )}
        {showProjects && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ color: 'var(--text-dim)', display: 'inline-flex' }}><OnbIcon name="project" size={14} /></span>
              <span style={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 600, color: 'var(--text-very-dim)', textTransform: 'uppercase' }}>Projects</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.seedProjects.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <SeedRowInput value={row.name} onChange={v => act.editSeed('projects', i, 'name', v)} placeholder="Project name" />
                  <RemoveBtn onClick={() => act.removeSeed('projects', i)} />
                </div>
              ))}
            </div>
            {s.seedProjects.length < 3 && (
              <div style={{ marginTop: 10 }}>
                <TextLink icon="plus" onClick={() => act.addSeed('projects')}>Add another</TextLink>
              </div>
            )}
          </div>
        )}
        {!showPeople && !showProjects && (
          <Notice tone="info" icon="idea">
            People and Projects are switched off. Your notes will build the vault as you write.
          </Notice>
        )}
      </div>

      <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <TextLink icon="arrow" onClick={() => act.finishSetup(true)}>Skip and start with a blank vault</TextLink>
        <PrimaryButton onClick={() => act.finishSetup(false)} size="lg" iconRight="arrow">Set up my vault</PrimaryButton>
      </div>
    </div>
  )
}

function ReadyScreen({ s, act }) {
  let subtext
  if (s.path === 'pro') {
    subtext = 'Your vault is ready. Open the inbox and write what\'s on your mind.'
  } else if (s.seeded) {
    subtext = 'Your vault is set up with your people and projects. There\'s a demo note in your inbox — process it to see YapAtMe in action.'
  } else {
    subtext = 'Your vault is ready. There\'s a demo note in your inbox — process it to see YapAtMe in action.'
  }

  return (
    <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
        <span style={{ width: 64, height: 64, borderRadius: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.74 0.14 165 / 0.14)', color: 'var(--success)', border: '1px solid oklch(0.74 0.14 165 / 0.32)', boxShadow: '0 0 0 8px oklch(0.74 0.14 165 / 0.06)' }}>
          <OnbIcon name="check" size={30} />
        </span>
      </div>
      <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
        You're all set{s.name.trim() ? `, ${s.name.trim().split(/\s+/)[0]}` : ''}.
      </h1>
      <p style={{ margin: '14px auto 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-dim)', maxWidth: 440 }}>
        {subtext}
      </p>
      <div style={{ marginTop: 30 }}>
        <PrimaryButton onClick={act.openApp} size="lg" iconRight="arrow">Open YapAtMe</PrimaryButton>
      </div>
    </div>
  )
}

// ─── Orchestrator ────────────────────────────────────────────────────────────
export default function OnboardingFlow({ openFolder, fileExists, listTree, initialFolder, onComplete }) {
  const [step, setStep] = useState(initialFolder ? 'name' : 'welcome')
  const [s, setS] = useState({
    path: initialFolder ? 'pro' : null, name: '',
    folder: initialFolder ? { state: 'A', name: initialFolder.name } : null,
    provider: 'openrouter', apiKey: '', model: PROVIDERS.openrouter.model,
    modules: { people: true, projects: true, ideas: true },
    seedPeople:   [{ name: '', role: '' }, { name: '', role: '' }],
    seedProjects: [{ name: '' }, { name: '' }],
    seeded: false,
  })
  const patch = p => setS(prev => ({ ...prev, ...p }))

  const STEP_BASE = initialFolder
    ? ['name', 'ai', 'modules']
    : ['welcome', 'name', 'folder', 'ai', 'modules']
  const stepsFor = path => {
    if (path === 'pro') return [...STEP_BASE, 'ready']
    return [...STEP_BASE, 'seed', 'ready']
  }

  const order = stepsFor(s.path)
  const idx   = Math.max(0, order.indexOf(step))
  const total = order.length
  const showBack = step !== 'welcome'

  const goNext = () => {
    const i = order.indexOf(step)
    if (i >= 0 && i < order.length - 1) setStep(order[i + 1])
  }
  const goBack = () => {
    const i = order.indexOf(step)
    if (i > 0) setStep(order[i - 1])
  }

  const act = {
    next: goNext,
    back: goBack,
    choosePath: path => { patch({ path }); setStep('name') },
    setName: name => patch({ name }),
    setFolder: folder => patch({ folder }),
    connectExisting: () => { patch({ folder: { ...s.folder, state: 'A' } }); setStep('ai') },
    setProvider: provider => patch({ provider, model: normalizeModelForProvider(provider, PROVIDERS[provider]?.model || '') }),
    setApiKey: apiKey => patch({ apiKey }),
    setModel: model => patch({ model: normalizeModelForProvider(s.provider, model) }),
    toggleModule: id => setS(prev => ({ ...prev, modules: { ...prev.modules, [id]: !prev.modules[id] } })),
    addSeed: kind => setS(prev => {
      const key = kind === 'people' ? 'seedPeople' : 'seedProjects'
      if (prev[key].length >= 3) return prev
      const blank = kind === 'people' ? { name: '', role: '' } : { name: '' }
      return { ...prev, [key]: [...prev[key], blank] }
    }),
    removeSeed: (kind, i) => setS(prev => {
      const key = kind === 'people' ? 'seedPeople' : 'seedProjects'
      const arr = prev[key].slice()
      arr.splice(i, 1)
      return { ...prev, [key]: arr.length ? arr : [kind === 'people' ? { name: '', role: '' } : { name: '' }] }
    }),
    editSeed: (kind, i, field, val) => setS(prev => {
      const key = kind === 'people' ? 'seedPeople' : 'seedProjects'
      const arr = prev[key].map((row, j) => j === i ? { ...row, [field]: val } : row)
      return { ...prev, [key]: arr }
    }),
    finishSetup: skip => { patch({ seeded: !skip }); setStep('ready') },
    openApp: () => onComplete(s),
  }

  const renderStep = () => {
    switch (step) {
      case 'welcome': return <WelcomeScreen act={act} />
      case 'name':    return <NameScreen s={s} act={act} />
      case 'folder':  return <FolderScreen s={s} act={act} openFolder={openFolder} fileExists={fileExists} listTree={listTree} />
      case 'ai':      return <AiScreen s={s} act={act} />
      case 'modules': return <ModulesScreen s={s} act={act} />
      case 'seed':    return <SeedScreen s={s} act={act} />
      case 'ready':   return <ReadyScreen s={s} act={act} />
      default:        return null
    }
  }

  return (
    <OnbShell stepKey={step} total={total} current={idx} showBack={showBack} onBack={goBack}>
      {renderStep()}
    </OnbShell>
  )
}
