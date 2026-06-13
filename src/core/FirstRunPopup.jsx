// First-run popup — shown once to Path A users after onboarding completes.
// 3-panel modal explaining how YapAtMe works.
// Dismissed state stored in IndexedDB by caller (App.jsx).

import { useState, useEffect } from 'react'

function Icon({ name, size = 16 }) {
  const s = { width: size, height: size, flex: '0 0 auto', display: 'block' }
  switch (name) {
    case 'arrow':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
    case 'back':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
    case 'inbox':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M2 9.5 4 3h8l2 6.5" /><path d="M2 9.5V13h12V9.5h-3.2a2.3 2.3 0 0 1-4.6 0H2Z" /></svg>
    case 'spark':  return <svg viewBox="0 0 16 16" style={s} fill="currentColor"><path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" /></svg>
    case 'check':  return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3.5 3.5L13 5" /></svg>
    case 'folder': return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4c.4 0 .77.16 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" /></svg>
    case 'grid':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
    case 'warn':   return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 5.5v3.2" /><circle cx="8" cy="11.4" r="0.55" fill="currentColor" /><path d="M7.13 1.9 1.6 11.6a1 1 0 0 0 .87 1.5h11.06a1 1 0 0 0 .87-1.5L8.87 1.9a1 1 0 0 0-1.74 0Z" /></svg>
    default:       return null
  }
}

function LoopDiagram() {
  const steps = [
    { label: 'Inbox',   icon: 'inbox'  },
    { label: 'Process', icon: 'spark'  },
    { label: 'Review',  icon: 'check'  },
    { label: 'File',    icon: 'folder' },
    { label: 'Vault',   icon: 'grid'   },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, padding: '16px 14px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 11, marginBottom: 16, flexWrap: 'wrap' }}>
      {steps.map((st, i) => (
        <div key={st.label} style={{ display: 'contents' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flex: '1 1 auto', minWidth: 54 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: i === steps.length - 1 ? 'oklch(0.80 0.13 80 / 0.16)' : 'var(--panel)', color: i === steps.length - 1 ? 'var(--accent)' : 'var(--text-dim)', border: '1px solid var(--border)' }}>
              <Icon name={st.icon} size={15} />
            </span>
            <span style={{ fontSize: 10.5, lineHeight: 1.2, color: 'var(--text-dim)', textAlign: 'center', fontWeight: 500 }}>{st.label}</span>
          </div>
          {i < steps.length - 1 && (
            <span style={{ alignSelf: 'flex-start', marginTop: 10, color: 'var(--text-very-dim)', display: 'inline-flex' }}><Icon name="arrow" size={13} /></span>
          )}
        </div>
      ))}
    </div>
  )
}

const PANELS = [
  {
    heading: 'How YapAtMe works',
    render: () => (
      <div>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-dim)' }}>
          Write what's on your mind in the inbox. Process it. Review and approve the changes. File it. That's it.
        </p>
        <LoopDiagram />
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', background: 'oklch(0.80 0.13 80 / 0.07)', border: '1px solid oklch(0.80 0.13 80 / 0.28)', borderRadius: 10 }}>
          <span style={{ color: 'oklch(0.84 0.13 80)', display: 'inline-flex', marginTop: 1, flex: '0 0 auto' }}><Icon name="warn" size={16} /></span>
          <div style={{ fontSize: 12.8, lineHeight: 1.55, color: 'var(--text-dim)' }}>
            When you process a note, YapAtMe detects new people and projects and asks you to confirm creating them.
            Then it proposes changes — tasks, mentions, ideas. You decide what gets saved.
            Accept everything on the demo note to see the full loop.
          </div>
        </div>
      </div>
    ),
  },
  {
    heading: 'You stay in control',
    render: () => (
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text-dim)' }}>
        YapAtMe reads your note and finds tasks, people, projects, and ideas. It prepares updates — you
        approve each one before anything is saved to your vault. Nothing happens without your say-so.
      </p>
    ),
  },
  {
    heading: 'Your demo note is ready',
    render: () => (
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text-dim)' }}>
        There's a demo note in your inbox with one task, one person, one project, and one idea. Process it to
        experience the full loop. When you're done, one button removes all demo content cleanly.
      </p>
    ),
  },
]

export default function FirstRunPopup({ onDismiss }) {
  const [panel, setPanel] = useState(0)
  const last = panel === PANELS.length - 1
  const p = PANELS[panel]

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight' && !last) setPanel(v => v + 1)
      if (e.key === 'ArrowLeft' && panel > 0) setPanel(v => v - 1)
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panel, last, onDismiss])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div role="dialog" aria-modal="true" style={{
        width: 580, maxWidth: 'calc(100vw - 32px)',
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: '0 28px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)',
        padding: '28px 30px', color: 'var(--text)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.80 0.13 80 / 0.16)', color: 'var(--accent)', border: '1px solid oklch(0.80 0.13 80 / 0.3)', flex: '0 0 auto' }}>
            <Icon name="spark" size={14} />
          </span>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>{p.heading}</h2>
        </div>

        <div key={panel} style={{ minHeight: 240, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {p.render()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 7 }}>
            {PANELS.map((_, i) => (
              <span key={i} style={{ width: i === panel ? 18 : 6, height: 6, borderRadius: 999, background: i === panel ? 'var(--accent)' : 'var(--border-strong, #444)', transition: 'width .2s, background .2s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {panel > 0 && (
              <button type="button" onClick={() => setPanel(v => v - 1)}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 18px', background: 'var(--panel)', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                Back
              </button>
            )}
            {!last && (
              <button type="button" onClick={() => setPanel(v => v + 1)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 18px', background: 'oklch(0.80 0.13 80 / 0.22)', color: 'oklch(0.92 0.13 80)', border: '1px solid oklch(0.80 0.13 80 / 0.45)', borderRadius: 9, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Next <Icon name="arrow" size={15} />
              </button>
            )}
            {last && (
              <button type="button" onClick={onDismiss}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 18px', background: 'oklch(0.80 0.13 80 / 0.22)', color: 'oklch(0.92 0.13 80)', border: '1px solid oklch(0.80 0.13 80 / 0.45)', borderRadius: 9, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
