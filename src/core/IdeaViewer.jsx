import { useState, useEffect, useRef, useCallback } from 'react'
import { toSlug } from '../lib/templates'
import { parseFrontmatter, buildFileContent } from '../lib/frontmatter'
import DictateBtn from '../components/DictateBtn'
import TrashMenuButton from '../components/TrashMenuButton'
import { retargetTasksForFile, appendTaskEntry, appendTaskEntries, setPlanTaskStatus, removePlanTask } from '../lib/tasksIndex'
import { invalidateFileIndex } from '../lib/fileIndex'
import ConfirmDialog from '../components/ConfirmDialog'
import { resolveWikilink, emitFileNotFoundToast } from '../lib/wikilinks'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import EntityPicker from '../components/EntityPicker'
import PlanChecklist, { parsePlanSteps } from '../components/PlanChecklist'

// ─── Status ───────────────────────────────────────────────────────────────────

const FORWARD_STATUSES = ['Spark', 'Developing', 'Validate', 'Decision']

const STATUS_STYLE = {
  Spark:      { bg: 'oklch(0.85 0.16 95 / 0.10)',  border: 'oklch(0.85 0.16 95 / 0.35)',  color: 'oklch(0.88 0.16 95)' },
  Developing: { bg: 'oklch(0.72 0.13 240 / 0.12)', border: 'oklch(0.72 0.13 240 / 0.35)', color: 'var(--info)' },
  Validate:   { bg: 'oklch(0.74 0.14 165 / 0.12)', border: 'oklch(0.74 0.14 165 / 0.35)', color: 'var(--success)' },
  Decision:   { bg: 'oklch(0.72 0.13 240 / 0.12)', border: 'oklch(0.72 0.13 240 / 0.35)', color: 'var(--info)' },
  Pursuing:   { bg: 'oklch(0.74 0.14 165 / 0.10)', border: 'oklch(0.74 0.14 165 / 0.35)', color: 'var(--success)' },
  Parked:     { bg: 'var(--panel-2)',               border: 'var(--border)',                color: 'var(--text-very-dim)' },
  Killed:     { bg: 'oklch(0.70 0.18 22 / 0.10)',  border: 'oklch(0.70 0.18 22 / 0.30)',  color: 'oklch(0.75 0.18 22)' },
}

function cycleStatus(current) {
  const fi = FORWARD_STATUSES.indexOf(current)
  if (fi !== -1) return FORWARD_STATUSES[(fi + 1) % FORWARD_STATUSES.length]
  return 'Spark'
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatUpdatedHeader(lastUpdated, lastSavedTime) {
  if (!lastUpdated) return ''
  const date = new Date(`${lastUpdated}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return `UPDATED ${String(lastUpdated).toUpperCase()}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
  }
  const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  const age = daysAgo === 0 ? 'TODAY' : daysAgo === 1 ? '1 DAY AGO' : `${daysAgo} DAYS AGO`
  return `UPDATED ${formatted} · ${age}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
}

function todayDMY() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${d.getFullYear()}`
}

// ─── Body section parsing / building ─────────────────────────────────────────

const SECTION_ORDER = ['Summary', 'Origin', 'Developing', 'Outcome', 'Current Plan', 'Recent Mentions']

function parseSections(body) {
  const result = {}
  SECTION_ORDER.forEach((s) => { result[s] = '' })
  const lines = (body || '').split('\n')
  let current = null
  const buf = []
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/)
    if (m) {
      if (current !== null) result[current] = buf.join('\n').trim()
      current = m[1].trim()
      buf.length = 0
    } else if (current !== null) {
      buf.push(line)
    }
  }
  if (current !== null) result[current] = buf.join('\n').trim()
  return result
}

function buildBody(sections) {
  return SECTION_ORDER.map((s) => {
    const c = sections[s] || ''
    return `## ${s}\n${c ? c + '\n' : ''}`
  }).join('\n')
}

// ─── Outcome ──────────────────────────────────────────────────────────────────

function parseOutcome(text) {
  if (!text?.trim()) return null
  const t = text.trim()
  const m = t.match(/^(Pursuing|Parked|Killed)\s*(?:(\d{2}-\d{2}-\d{4})\s*)?[—\-]\s*(.+)$/is)
  if (m) return { status: m[1], date: m[2] || null, reason: m[3].trim() }
  return { status: 'custom', date: null, reason: t }
}

const OUTCOME_STYLE = {
  Pursuing: { dot: 'var(--success)',        border: 'oklch(0.74 0.14 165 / 0.35)', bg: 'oklch(0.74 0.14 165 / 0.06)', color: 'var(--success)' },
  Parked:   { dot: 'oklch(0.88 0.16 95)',   border: 'oklch(0.85 0.16 95 / 0.35)',  bg: 'oklch(0.85 0.16 95 / 0.06)',  color: 'oklch(0.88 0.16 95)' },
  Killed:   { dot: 'oklch(0.75 0.18 22)',   border: 'oklch(0.70 0.18 22 / 0.35)', bg: 'oklch(0.70 0.18 22 / 0.06)', color: 'oklch(0.75 0.18 22)' },
  custom:   { dot: 'var(--text-very-dim)',  border: 'var(--border)',               bg: 'var(--panel-2)',              color: 'var(--text-dim)' },
}

// ─── Wikilink rendering ───────────────────────────────────────────────────────

function renderWikilinks(text, onWikilinkClick) {
  if (!text) return null
  return String(text).split(/(\[\[[^\]]+\]\])/g).map((part, i) => {
    const m = part.match(/^\[\[([^\]]+)\]\]$/)
    if (m) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onWikilinkClick?.(m[1])}
          style={{
            color: 'oklch(0.90 0.12 80)',
            textDecoration: 'underline',
            textDecorationColor: 'oklch(0.90 0.12 80 / 0.5)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {m[1]}
        </button>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ text, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{
        fontSize: 11, letterSpacing: '0.16em', fontWeight: 600,
        textTransform: 'uppercase', color: 'var(--text-very-dim)',
      }}>
        {text}
      </span>
      {badge && (
        <span style={{
          fontSize: 10.5, color: 'oklch(0.85 0.14 80)', letterSpacing: '0.06em',
          fontWeight: 500, opacity: 0.7,
        }}>
          + {badge}
        </span>
      )}
    </div>
  )
}

// ─── Domain input with suggestions (Fix 2) ───────────────────────────────────

function DomainInput({ value, onChange, suggestions }) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  const filtered = focused
    ? suggestions.filter((s) => !value || s.toLowerCase().includes(value.toLowerCase())).filter((s) => s !== value).slice(0, 8)
    : []

  const handleBlur = () => setTimeout(() => setFocused(false), 150)

  if (!value && !focused) {
    return (
      <button
        onClick={() => { setFocused(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        style={{
          display: 'inline-flex', alignItems: 'center', padding: '3px 8px',
          background: 'transparent', border: '1px dashed var(--border-subtle)',
          borderRadius: 5, fontSize: 12, color: 'var(--text-very-dim)', cursor: 'text', fontFamily: 'inherit',
        }}
      >
        + Domain
      </button>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={focused && !value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder="Domain"
        style={{
          padding: '3px 8px', background: 'transparent',
          border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 5, fontSize: 12, color: 'var(--text-dim)', outline: 'none',
          fontFamily: 'inherit', minWidth: 70, transition: 'border-color .12s',
        }}
      />
      {filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          minWidth: 130, padding: 4, background: 'var(--panel-pop)',
          border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {filtered.map((s) => (
            <div
              key={s}
              onMouseDown={() => { onChange(s); setFocused(false) }}
              style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-dim)', borderRadius: 5, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Wikilink text field for Related (Fix 1) ─────────────────────────────────

function WikilinkTextField({ value, onChange, onWikilinkClick, placeholder }) {
  const [editing, setEditing] = useState(false)
  const taRef = useRef(null)

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.style.height = 'auto'
      taRef.current.style.height = taRef.current.scrollHeight + 'px'
    }
  }, [editing])

  const lines = (value || '').split('\n').map((l) => l.trim()).filter(Boolean)

  if (editing) {
    return (
      <textarea
        ref={taRef}
        autoFocus
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onBlur={() => setEditing(false)}
        placeholder={placeholder}
        rows={2}
        style={{
          display: 'block', width: '100%', fontSize: 13.5, color: 'var(--text)',
          background: 'var(--panel-2)', border: '1px solid var(--border-strong)',
          borderRadius: 6, padding: '8px 10px', outline: 'none', fontFamily: 'inherit',
          resize: 'none', overflow: 'hidden', lineHeight: 1.5,
        }}
      />
    )
  }

  if (!lines.length) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', padding: '4px 0',
          background: 'transparent', border: 'none',
          fontSize: 13, color: 'var(--text-very-dim)', cursor: 'text', fontFamily: 'inherit', fontStyle: 'italic',
        }}
      >
        + {placeholder}
      </button>
    )
  }

  return (
    <div onClick={() => setEditing(true)} style={{ cursor: 'text', lineHeight: 1.6 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />
          <span style={{ fontSize: 13.5, color: 'var(--text)' }}>
            {renderWikilinks(line, onWikilinkClick)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Section textarea ─────────────────────────────────────────────────────────

function SectionTextarea({ value, onChange, placeholder }) {
  const taRef = useRef(null)

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <textarea
      ref={taRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = e.target.scrollHeight + 'px'
      }}
      placeholder={placeholder}
      rows={2}
      style={{
        display: 'block', width: '100%', fontSize: 13.5, lineHeight: 1.6,
        color: 'var(--text)', background: 'transparent', border: 'none', outline: 'none',
        padding: 0, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', minHeight: '2.4em',
      }}
    />
  )
}

// ─── Outcome widget (Fix 4) ───────────────────────────────────────────────────

function OutcomeWidget({ outcomeText, onSave, triggerRef }) {
  const [pending, setPending] = useState('')
  const [input, setInput]     = useState('')
  const inputRef = useRef(null)

  // Allow parent to trigger a pending state (e.g. Pursuing from status row)
  useEffect(() => {
    if (triggerRef) triggerRef.current = (val) => { setPending(val); setInput('') }
    return () => { if (triggerRef) triggerRef.current = null }
  })

  useEffect(() => {
    if (pending && inputRef.current) inputRef.current.focus()
  }, [pending])

  const parsed = parseOutcome(outcomeText)

  const confirmOutcome = () => {
    if (!input.trim()) { setPending(''); return }
    const date = todayDMY()
    let text = ''
    let newStatus = null
    if (pending === 'Pursuing')     { text = `Pursuing — ${input.trim()}`; newStatus = 'Pursuing' }
    else if (pending === 'Parked')  { text = `Parked ${date} — ${input.trim()}`; newStatus = 'Parked' }
    else if (pending === 'Killed')  { text = `Killed ${date} — ${input.trim()}`; newStatus = 'Killed' }
    onSave(text, newStatus)
    setPending(''); setInput('')
  }

  // Recorded outcome → styled card
  if (parsed) {
    const st = OUTCOME_STYLE[parsed.status] || OUTCOME_STYLE.custom
    return (
      <div style={{ padding: '14px 16px', borderRadius: 8, background: st.bg, border: `1px solid ${st.border}`, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: st.color }}>{parsed.status}</span>
          {parsed.date && <span style={{ fontSize: 12, color: 'var(--text-very-dim)' }}>{parsed.date}</span>}
          <button
            onClick={() => onSave('', 'Decision')}
            title="Clear outcome"
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-very-dim)', cursor: 'pointer', padding: '0 4px', fontSize: 14 }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {parsed.reason}
        </div>
      </div>
    )
  }

  // Pending — waiting for reason
  if (pending) {
    const dotColor = pending === 'Pursuing' ? 'var(--success)' : pending === 'Parked' ? 'oklch(0.88 0.16 95)' : 'oklch(0.75 0.18 22)'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>{pending} —</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmOutcome()
            if (e.key === 'Escape') { setPending(''); setInput('') }
          }}
          placeholder="One-line reason…"
          style={{
            flex: 1, background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--border-strong)',
            outline: 'none', padding: '2px 0', fontSize: 13.5, color: 'var(--text)', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={confirmOutcome}
          style={{ padding: '3px 10px', background: 'var(--accent)', color: '#1a1208', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
        >
          Save
        </button>
        <button
          onClick={() => { setPending(''); setInput('') }}
          style={{ padding: '3px 8px', background: 'transparent', border: 'none', color: 'var(--text-very-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
      </div>
    )
  }

  // No outcome — action buttons
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {[
        { label: 'Pursuing', dot: 'var(--success)' },
        { label: 'Parked',   dot: 'oklch(0.88 0.16 95)' },
        { label: 'Killed',   dot: 'oklch(0.75 0.18 22)' },
      ].map(({ label, dot }) => (
        <button
          key={label}
          onClick={() => setPending(label)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 6,
            fontSize: 12.5, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'border-color .12s, color .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
          {label}
        </button>
      ))}
      <span style={{ fontSize: 12, color: 'var(--text-very-dim)', fontStyle: 'italic' }}>
        No outcome recorded yet.
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IdeaViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  fileExists,
  listTree,
  tasksVersion,
  wikilinkSuggestions,
  onNavigate,
  onTasksChanged,
  onFileRenamed,
  onConfirmAction,
  onFileDeleted,
  onDisplayNameChanged,
}) {
  const [name,             setName]             = useState('')
  const [status,           setStatus]           = useState('Spark')
  const [domain,           setDomain]           = useState('')
  const [origin,           setOrigin]           = useState('')
  const [relatedProjects,  setRelatedProjects]  = useState('')
  const [relatedPeople,    setRelatedPeople]    = useState('')
  const [lastUpdated,      setLastUpdated]      = useState('')

  const [sectionSummary,        setSectionSummary]        = useState('')
  const [sectionOrigin,         setSectionOrigin]         = useState('')
  const [sectionDeveloping,     setSectionDeveloping]     = useState('')
  const [sectionOutcome,        setSectionOutcome]        = useState('')
  const [sectionCurrentPlan,    setSectionCurrentPlan]    = useState('')
  const [sectionRecentMentions, setSectionRecentMentions] = useState('')



  const [loading,           setLoading]           = useState(true)
  const [saveStatus,        setSaveStatus]        = useState('idle')
  const [lastSavedTime,     setLastSavedTime]     = useState('')
  const [renameDialog,      setRenameDialog]      = useState(null)
  const [domainSuggestions, setDomainSuggestions] = useState([])

  const saveTimer      = useRef(null)
  const prevTranscript = useRef('')
  const outcomeWidgetRef = useRef(null)

  const { isListening, isSupported, start, stop, transcript, reset: resetTranscript } = useVoiceDictation()

  useEffect(() => {
    if (!filePath) return
    loadFile(filePath)
    loadDomainSuggestions()
  }, [filePath])

  useEffect(() => {
    if (!transcript) return
    const newPart = transcript.slice(prevTranscript.current.length).replace(/^[\s.]+/, '')
    if (newPart) setSectionDeveloping((prev) => prev + (prev ? '\n' : '') + newPart.trim())
    prevTranscript.current = transcript
  }, [transcript])

  const loadFile = async (path) => {
    setLoading(true); setSaveStatus('idle'); setLastSavedTime('')
    try {
      const raw = await readFile(path)
      const { fields, body } = parseFrontmatter(raw)
      const fallback = path.split('/').pop().replace('.md', '').replace(/-/g, ' ')
      setName(fields?.name || fallback)
      setStatus(fields?.status || 'Spark')
      setDomain(fields?.domain || '')
      setOrigin(fields?.origin || '')
      setLastUpdated(fields?.last_updated || '')

      const toRelText = (v) =>
        Array.isArray(v)
          ? v.filter(Boolean).map((s) => (s.startsWith('[[') ? s : `[[${s}]]`)).join('\n')
          : (typeof v === 'string' ? v : '')
      setRelatedProjects(toRelText(fields?.related_projects))
      setRelatedPeople(toRelText(fields?.related_people))

      const secs = parseSections(body)
      setSectionSummary(secs['Summary'] || '')
      setSectionOrigin(secs['Origin'] || '')
      setSectionDeveloping(secs['Developing'] || '')
      setSectionOutcome(secs['Outcome'] || '')
      setSectionCurrentPlan(secs['Current Plan'] || '')
      setSectionRecentMentions(secs['Recent Mentions'] || '')
    } catch {
      setName(''); setStatus('Spark'); setDomain(''); setOrigin('')
      setRelatedProjects(''); setRelatedPeople(''); setLastUpdated('')
      setSectionSummary(''); setSectionOrigin(''); setSectionDeveloping('')
      setSectionOutcome(''); setSectionCurrentPlan(''); setSectionRecentMentions('')
    }
    setLoading(false)
  }

  const loadDomainSuggestions = async () => {
    try {
      const tree = await listTree().catch(() => [])
      const seen = new Set()
      for (const folder of ['ideas', 'projects']) {
        const dir = (tree || []).find((d) => d?.kind === 'directory' && d.name === folder)
        for (const file of dir?.children || []) {
          if (!file?.name?.endsWith('.md')) continue
          const fp = file.path || `${folder}/${file.name}`
          if (fp === filePath) continue
          try {
            const { fields } = parseFrontmatter(await readFile(fp))
            if (fields?.domain) String(fields.domain).split(',').forEach((d) => { const v = d.trim(); if (v) seen.add(v) })
          } catch {}
        }
      }
      setDomainSuggestions([...seen].sort())
    } catch {}
  }

  const save = useCallback(async (overrides = {}) => {
    if (!filePath) return
    setSaveStatus('saving')
    const today = new Date().toISOString().slice(0, 10)
    const currentStatus  = overrides.status  ?? status
    const currentOutcome = overrides.sectionOutcome ?? sectionOutcome
    const currentPlan    = overrides.sectionCurrentPlan ?? sectionCurrentPlan

    const fields = {
      type: 'idea',
      name: name.trim() || 'Untitled',
      status: currentStatus,
      domain: domain || null,
      origin: origin || null,
      related_projects: relatedProjects || null,
      related_people:   relatedPeople   || null,
      last_updated: today,
    }

    const body = buildBody({
      'Summary':         sectionSummary,
      'Origin':          sectionOrigin,
      'Developing':      sectionDeveloping,
      'Outcome':         currentOutcome,
      'Current Plan':    currentPlan,
      'Recent Mentions': sectionRecentMentions,
    })

    try {
      await writeFile(filePath, buildFileContent(fields, body))
      onDisplayNameChanged?.(filePath, name.trim() || 'Untitled')
      const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      setLastSavedTime(t); setLastUpdated(today); setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch { setSaveStatus('error') }
  }, [
    filePath, writeFile, name, status, domain, origin, relatedProjects, relatedPeople,
    sectionSummary, sectionOrigin, sectionDeveloping, sectionOutcome, sectionCurrentPlan, sectionRecentMentions,
  ])

  const queueSave = useCallback((overrides = {}) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(overrides), 800)
  }, [save])

  useEffect(() => {
    if (!filePath || loading) return
    queueSave()
  }, [status, domain, relatedProjects, relatedPeople]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOutcomeConfirm = (text, newStatus) => {
    setSectionOutcome(text)
    if (newStatus) setStatus(newStatus)
    clearTimeout(saveTimer.current)
    setTimeout(() => save({ sectionOutcome: text, ...(newStatus ? { status: newStatus } : {}) }), 50)
  }

  const handleNameBlur = () => {
    if (!filePath || !name.trim()) return
    const folder = filePath.split('/')[0]
    const currentSlug = filePath.split('/').pop().replace('.md', '')
    const newSlug = toSlug(name.trim())
    if (!newSlug) return
    if (newSlug.toLowerCase() === currentSlug.toLowerCase()) { clearTimeout(saveTimer.current); save(); return }
    clearTimeout(saveTimer.current)
    setRenameDialog({ oldPath: filePath, newPath: `${folder}/${newSlug}.md`, oldSlug: currentSlug, newSlug })
  }

  const executeRename = async () => {
    if (!renameDialog) return
    const { oldPath, newPath, oldSlug, newSlug } = renameDialog
    setRenameDialog(null)
    try {
      if (oldSlug.toLowerCase() !== newSlug.toLowerCase()) {
        try { const exists = await fileExists(newPath); if (exists) { setName(oldSlug.replace(/-/g, ' ')); return } } catch {}
      }
      const today = new Date().toISOString().slice(0, 10)
      const fields = { type: 'idea', name: name.trim() || 'Untitled', status, domain: domain || null, origin: origin || null, related_projects: relatedProjects || null, related_people: relatedPeople || null, last_updated: today }
      const body = buildBody({ Summary: sectionSummary, Origin: sectionOrigin, Developing: sectionDeveloping, Outcome: sectionOutcome, 'Current Plan': sectionCurrentPlan, 'Recent Mentions': sectionRecentMentions })
      await writeFile(newPath, buildFileContent(fields, body))
      if (oldPath.toLowerCase() !== newPath.toLowerCase()) await deleteFile(oldPath)
      await retargetTasksForFile(readFile, writeFile, oldPath, newPath)
      for (const ctx of ['context/_context.md', 'context/_context_log.md', 'context/projects-index.md', 'context/people-index.md', 'context/ideas-index.md']) {
        try { const t = await readFile(ctx); if (t.includes(oldPath)) await writeFile(ctx, t.split(oldPath).join(newPath)) } catch {}
      }
      await invalidateFileIndex()
      onFileRenamed?.(newPath)
    } catch (err) { console.error('Rename failed:', err.message) }
  }

  const cancelRename = () => {
    if (!renameDialog) return
    setName(renameDialog.oldSlug.replace(/-/g, ' '))
    setRenameDialog(null)
  }

  const handleDictate = () => {
    if (isListening) { stop(); return }
    resetTranscript(); prevTranscript.current = ''; start()
  }

  const handleWikilinkClick = async (linkName) => {
    const path = await resolveWikilink(linkName, listTree)
    if (!path) { emitFileNotFoundToast(); return }
    onNavigate?.(path.startsWith('inbox/') ? 'inbox' : 'viewer', path)
  }

  const handlePlanToggle = async (stepTitle, nowDone) => {
    await setPlanTaskStatus(readFile, writeFile, filePath, '## Current Plan', stepTitle, nowDone)
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanDelete = async (stepTitle) => {
    await removePlanTask(readFile, writeFile, filePath, '## Current Plan', stepTitle)
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanAdd = async (stepTitle) => {
    await appendTaskEntry(readFile, writeFile, {
      file: filePath, module: 'ideas', section: '## Current Plan', title: stepTitle, tags: ['action'],
    })
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanAddMultiple = async (titles) => {
    await appendTaskEntries(readFile, writeFile, titles.map((title) => ({
      file: filePath, module: 'ideas', section: '## Current Plan', title, tags: ['action'],
    })))
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handlePlanRename = async (oldTitle, newTitle, isDone) => {
    await removePlanTask(readFile, writeFile, filePath, '## Current Plan', oldTitle)
    await appendTaskEntry(readFile, writeFile, {
      file: filePath, module: 'ideas', section: '## Current Plan', title: newTitle,
      tags: ['action'], status: isDone ? 'done' : 'open',
    })
    onTasksChanged?.()
    window.dispatchEvent(new Event('memostack:tasks-index-changed'))
  }

  const handleArchive = async () => {
    if (!filePath) return
    const content = await readFile(filePath)
    await writeFile(`archive/${filePath.split('/').pop()}`, content)
    await deleteFile(filePath)
    await invalidateFileIndex()
    onFileDeleted?.()
  }

  const handleDelete = async () => {
    if (!filePath) return
    await deleteFile(filePath)
    await invalidateFileIndex()
    onFileDeleted?.()
  }

  const planActive    = ['Spark', 'Validate', 'Decision', 'Pursuing', 'Parked', 'Killed'].includes(status)
  const isTerminal     = ['Pursuing', 'Parked', 'Killed'].includes(status)
  const planSteps      = parsePlanSteps(sectionCurrentPlan)
  const openPlanCount  = planSteps.filter((s) => !s.done).length
  const ideaLabel      = name || filePath?.replace('ideas/', '').replace('.md', '') || 'this idea'
  const statusStyle    = STATUS_STYLE[status] || STATUS_STYLE.Spark

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px', borderBottom: '1px solid var(--border-subtle)', gap: 16, flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-very-dim)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {formatUpdatedHeader(lastUpdated, lastSavedTime)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DictateBtn active={isListening} disabled={!isSupported} onClick={handleDictate} />
          <TrashMenuButton
            label={ideaLabel}
            onConfirmAction={onConfirmAction}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 64px', maxWidth: 760 }}>

          {/* Title */}
          <textarea
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={handleNameBlur}
            placeholder="Idea title"
            rows={1}
            style={{
              display: 'block', width: '100%', fontSize: 30, fontWeight: 600,
              letterSpacing: '-0.02em', color: 'var(--text)', background: 'transparent',
              border: 'none', outline: 'none', padding: 0, marginBottom: 16,
              fontFamily: 'inherit', resize: 'none', overflow: 'hidden', lineHeight: 1.25, minHeight: '1.25em',
            }}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
          />

          {/* Metadata row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 36, flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Status pill — cycles forward on click; read-only when terminal */}
            <button
              onClick={() => { if (!isTerminal) setStatus(cycleStatus(status)) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
                borderRadius: 5, fontSize: 12, fontWeight: 500, color: statusStyle.color,
                cursor: isTerminal ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'background .12s',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusStyle.color, flexShrink: 0 }} />
              {status}
            </button>

            {/* Change decision link — shown only for terminal statuses */}
            {isTerminal && (
              <button
                onClick={() => handleOutcomeConfirm('', 'Decision')}
                style={{ padding: '3px 6px', background: 'transparent', border: 'none', fontSize: 11.5, color: 'var(--text-very-dim)', cursor: 'pointer', fontFamily: 'inherit', opacity: 0.7, letterSpacing: '0.02em' }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--text-dim)' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--text-very-dim)' }}
              >
                ← Change
              </button>
            )}

            {/* Pursuing / Park / Kill quick actions at Decision — all go through OutcomeWidget for reason capture */}
            {status === 'Decision' && (
              <>
                <button
                  onClick={() => outcomeWidgetRef.current?.('Pursuing')}
                  style={{ padding: '3px 8px', background: 'transparent', border: '1px dashed oklch(0.74 0.14 165 / 0.4)', borderRadius: 5, fontSize: 12, color: 'var(--success)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Pursuing
                </button>
                <button
                  onClick={() => outcomeWidgetRef.current?.('Parked')}
                  style={{ padding: '3px 8px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text-very-dim)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Park
                </button>
                <button
                  onClick={() => outcomeWidgetRef.current?.('Killed')}
                  style={{ padding: '3px 8px', background: 'transparent', border: '1px dashed oklch(0.70 0.18 22 / 0.4)', borderRadius: 5, fontSize: 12, color: 'oklch(0.75 0.18 22)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Kill
                </button>
              </>
            )}

            {/* Domain — Fix 2: free text with suggestions */}
            <DomainInput value={domain} onChange={setDomain} suggestions={domainSuggestions} />

            {/* Plan step count */}
            {planActive && planSteps.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{openPlanCount}</span>
                {openPlanCount === 1 ? 'step left' : 'steps left'}
              </span>
            )}
          </div>

          {/* ─── SUMMARY — Fix 3: AI-GENERATED badge ─── */}
          <div style={{ marginBottom: 32 }}>
            <SectionLabel text="Summary" badge="AI-GENERATED" />
            <SectionTextarea
              value={sectionSummary}
              onChange={(v) => { setSectionSummary(v); queueSave() }}
              placeholder="One sentence describing this idea and why it matters."
            />
          </div>

          {/* ─── ORIGIN ─── */}
          <div style={{ marginBottom: 32 }}>
            <SectionLabel text="Origin" />
            <SectionTextarea
              value={sectionOrigin}
              onChange={(v) => { setSectionOrigin(v); queueSave() }}
              placeholder="Why did this idea come up? Context from the source note."
            />
          </div>

          {/* ─── DEVELOPING ─── */}
          <div style={{ marginBottom: 32 }}>
            <SectionLabel text="Developing" />
            <SectionTextarea
              value={sectionDeveloping}
              onChange={(v) => { setSectionDeveloping(v); queueSave() }}
              placeholder="Freeform notes as this idea develops."
            />
          </div>

          {/* ─── OUTCOME — Fix 4: action buttons or card ─── */}
          <div style={{ marginBottom: 32 }}>
            <SectionLabel text="Outcome" />
            <OutcomeWidget outcomeText={sectionOutcome} onSave={handleOutcomeConfirm} triggerRef={outcomeWidgetRef} />
          </div>

          {/* ─── PLAN ─── */}
          <div style={{ marginBottom: 32 }}>
            <SectionLabel text="Plan" />
            {planActive ? (
              <PlanChecklist
                sectionText={sectionCurrentPlan}
                onChange={(newText) => { setSectionCurrentPlan(newText); queueSave({ sectionCurrentPlan: newText }) }}
                onToggle={handlePlanToggle}
                onDelete={handlePlanDelete}
                onAdd={handlePlanAdd}
                onAddMultiple={handlePlanAddMultiple}
                onRename={handlePlanRename}
              />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-very-dim)', fontStyle: 'italic' }}>
                Move the idea to Validate to start building a plan.
              </div>
            )}
          </div>

          {/* ─── RELATED — Fix 1: wikilink text fields ─── */}
          <div style={{ marginBottom: 32 }}>
            <SectionLabel text="Related" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-very-dim)', marginBottom: 6, letterSpacing: '0.04em' }}>Projects</div>
                <EntityPicker
                  entities={(relatedProjects.match(/\[\[([^\]]+)\]\]/g) || []).map((m) => m.slice(2, -2))}
                  onChange={(arr) => { setRelatedProjects(arr.map((n) => `[[${n}]]`).join('\n')); queueSave() }}
                  suggestions={wikilinkSuggestions}
                  filterType="project"
                  onNavigate={(name) => handleWikilinkClick(name)}
                  placeholder="Add related project"
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-very-dim)', marginBottom: 6, letterSpacing: '0.04em' }}>People</div>
                <EntityPicker
                  entities={(relatedPeople.match(/\[\[([^\]]+)\]\]/g) || []).map((m) => m.slice(2, -2))}
                  onChange={(arr) => { setRelatedPeople(arr.map((n) => `[[${n}]]`).join('\n')); queueSave() }}
                  suggestions={wikilinkSuggestions}
                  filterType="person"
                  onNavigate={(name) => handleWikilinkClick(name)}
                  placeholder="Add related person"
                />
              </div>
            </div>
          </div>

          {/* ─── RECENT MENTIONS (read-only) ─── */}
          <div>
            <SectionLabel text="Recent Mentions" />
            {sectionRecentMentions ? (
              <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                {sectionRecentMentions.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i}>{renderWikilinks(line, handleWikilinkClick)}</div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-very-dim)', fontStyle: 'italic' }}>
                No mentions yet — will be auto-populated when inbox notes reference this idea.
              </div>
            )}
          </div>

        </div>
      </div>

      <ConfirmDialog
        open={!!renameDialog}
        danger={false}
        title="Rename idea"
        message={renameDialog ? `Renaming "${renameDialog.oldSlug.replace(/-/g, ' ')}" to "${name}" will rename ${renameDialog.oldSlug}.md → ${renameDialog.newSlug}.md and update all vault references.` : ''}
        confirmLabel="Rename"
        cancelLabel="Cancel"
        onConfirm={executeRename}
        onCancel={cancelRename}
      />
    </div>
  )
}
