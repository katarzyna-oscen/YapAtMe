// IdeaBacklogPage — displays ideas detected by the AI in notes.
//
// Data source: ideas/backlog.md  §## Backlog
// Each non-empty line in that section is one backlog item.
//
// Supported line formats written by the note processor:
//   - [[DD-MM-YYYY]] Summary text        (with source date)
//   - Summary text                        (no date)
//
// Category is stored inline at the end of the line as  [cat:X]
// so the file remains the single source of truth.

import { useState, useEffect, useCallback } from 'react'
import { toSlug, todayISO } from '../lib/templates'

// ─── Parsing ──────────────────────────────────────────────────────────────────

const BACKLOG_FILE = 'ideas/backlog.md'
const BACKLOG_HEADING = '## Backlog'
const CAT_RE = /\[cat:([^\]]+)\]$/
const SOURCE_RE = /^\[\[([^\]]+)\]\]\s*/
const BULLET_RE = /^-\s+/

/** Parse the ## Backlog section of backlog.md into item objects. */
function parseBacklog(raw) {
  const match = raw.match(/##\s+Backlog\s*\n([\s\S]*?)(?=\n##\s|$)/i)
  if (!match) return []
  return match[1]
    .split('\n')
    .map((line, idx) => {
      const trimmed = line.trimStart()
      if (!trimmed || !BULLET_RE.test(trimmed)) return null
      let rest = trimmed.replace(BULLET_RE, '')

      // Extract inline category
      const catMatch = rest.match(CAT_RE)
      const category = catMatch ? catMatch[1].trim() : null
      if (catMatch) rest = rest.slice(0, catMatch.index).trim()

      // Extract source date wikilink
      const srcMatch = rest.match(SOURCE_RE)
      const source = srcMatch ? srcMatch[1].trim() : null
      const summary = srcMatch ? rest.slice(srcMatch[0].length).trim() : rest.trim()

      if (!summary) return null
      return { id: `item-${idx}`, line, summary, source, category }
    })
    .filter(Boolean)
}

/** Rebuild the ## Backlog section replacing or updating a specific line. */
function serializeItem(item) {
  const srcPart = item.source ? `[[${item.source}]] ` : ''
  const catPart = item.category ? ` [cat:${item.category}]` : ''
  return `- ${srcPart}${item.summary}${catPart}`
}

function rewriteBacklog(raw, items) {
  // Rebuild the full file with the updated ## Backlog section
  const before = raw.match(/^([\s\S]*?)(?=##\s+Backlog)/i)?.[1] ?? ''
  const after   = raw.match(/##\s+Backlog[\s\S]*?\n(##\s[\s\S]*)$/i)?.[1] ?? ''

  const bodyLines = items.length
    ? items.map(serializeItem).join('\n')
    : ''

  const backlogSection = `${BACKLOG_HEADING}\n${bodyLines}${bodyLines ? '\n' : ''}`
  return `${before}${backlogSection}${after ? `\n${after}` : ''}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ['AI', 'Design', 'Ops', 'Process', 'Research', 'Product']

function CategoryPicker({ value, categories, onSelect, onAddCategory }) {
  const [open, setOpen] = useState(false)
  const [hov, setHov] = useState(false)
  const [draft, setDraft] = useState('')
  const [btnHov, setBtnHov] = useState({})

  const commitNew = () => {
    const t = draft.trim()
    if (!t) return
    onAddCategory?.(t)
    onSelect(t)
    setDraft('')
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!e.target.closest('[data-catpicker]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div data-catpicker style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 9px', fontSize: 11, fontWeight: 500, borderRadius: 999,
          background: value
            ? 'oklch(0.78 0.13 80 / 0.12)'
            : hov ? 'var(--panel-2)' : 'transparent',
          color: value ? 'oklch(0.86 0.12 80)' : 'var(--text-very-dim)',
          border: `1px solid ${value
            ? 'oklch(0.78 0.13 80 / 0.32)'
            : hov ? 'var(--border-strong)' : 'var(--border)'}`,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          transition: 'background .12s, border-color .12s, color .12s',
        }}
      >
        {value ? (
          <>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'oklch(0.80 0.15 80)' }} />
            {value}
          </>
        ) : (
          <><span style={{ fontSize: 12, lineHeight: 1 }}>+</span> Category</>
        )}
      </button>

      {open && (
        <div data-catpicker style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
          background: 'var(--panel-pop, var(--panel))', border: '1px solid var(--border)',
          borderRadius: 10, padding: 10, width: 220,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        }}>
          <div style={{
            fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-very-dim)', fontWeight: 600, marginBottom: 8,
          }}>File under</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {categories.map((c) => {
              const on = c === value
              return (
                <button
                  key={c}
                  onClick={() => { onSelect(on ? null : c); setOpen(false) }}
                  onMouseEnter={() => setBtnHov((p) => ({ ...p, [c]: true }))}
                  onMouseLeave={() => setBtnHov((p) => ({ ...p, [c]: false }))}
                  style={{
                    padding: '4px 10px', fontSize: 12, borderRadius: 999,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: on ? 'oklch(0.78 0.13 80 / 0.16)' : btnHov[c] ? 'var(--border)' : 'var(--panel-2)',
                    color: on ? 'oklch(0.86 0.12 80)' : 'var(--text-dim)',
                    border: `1px solid ${on ? 'oklch(0.78 0.13 80 / 0.4)' : 'var(--border-subtle)'}`,
                    transition: 'background .12s',
                  }}
                >{c}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitNew() }}
              placeholder="New category…"
              style={{
                flex: 1, minWidth: 0, background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 7, color: 'var(--text)', fontSize: 12.5, padding: '6px 9px',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={commitNew}
              style={{
                flex: '0 0 auto', padding: '0 11px', borderRadius: 7,
                border: '1px solid var(--border-strong)', background: 'var(--panel-2)',
                color: 'var(--text)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

function BacklogStatusChip({ category }) {
  const ready = !!category
  const hue = ready ? 150 : 240
  const label = ready ? 'Ready' : 'New'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999,
      background: `oklch(0.80 0.13 ${hue} / 0.12)`,
      color: `oklch(0.85 0.12 ${hue})`,
      border: `1px solid oklch(0.80 0.13 ${hue} / 0.28)`,
      fontSize: 11, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </span>
  )
}

function AgeChip({ source }) {
  if (!source) return null
  // source is "DD-MM-YYYY"
  const [d, m, y] = source.split('-')
  if (!d || !m || !y) return <span style={{ fontSize: 11, color: 'var(--text-very-dim)' }}>{source}</span>
  const date = new Date(`${y}-${m}-${d}`)
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  let label
  if (days === 0) label = 'today'
  else if (days === 1) label = '1d'
  else if (days < 7) label = `${days}d`
  else if (days < 30) label = `${Math.floor(days / 7)}w`
  else label = `${Math.floor(days / 30)}mo`

  return (
    <span style={{
      fontSize: 11, color: 'var(--text-very-dim)',
      background: 'var(--panel-2)', border: '1px solid var(--border-subtle)',
      borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function RowMenu({ hovered, onPromote, onKill }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 168) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!e.target.closest('[data-rowmenu]')) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div data-rowmenu style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); openMenu() }}
        style={{
          width: 22, height: 22, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', border: 'none',
          background: open ? 'var(--border)' : 'transparent',
          color: 'var(--text-dim)', borderRadius: 5, cursor: 'pointer',
          padding: 0, opacity: (hovered || open) ? 1 : 0.3,
          transition: 'opacity .12s, background .12s', fontFamily: 'inherit',
        }}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>
      {open && (
        <div data-rowmenu style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 200,
          minWidth: 168, padding: 4,
          background: 'var(--panel-pop, var(--panel))', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        }}>
          <MenuItem label="Create idea" accent icon={
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" /><path d="M6 14h4" />
            </svg>
          } onClick={() => { setOpen(false); onPromote() }} />
          <MenuItem label="Kill idea" danger icon={
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5h10" /><path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
              <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
              <path d="M7 7v4M9 7v4" />
            </svg>
          } onClick={() => { setOpen(false); onKill() }} />
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, icon, onClick, danger, accent }) {
  const [hov, setHov] = useState(false)
  const color = danger
    ? (hov ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)')
    : accent
      ? (hov ? 'oklch(0.88 0.13 80)' : 'var(--text-dim)')
      : (hov ? 'var(--text)' : 'var(--text-dim)')
  const bg = danger
    ? (hov ? 'oklch(0.70 0.18 22 / 0.12)' : 'transparent')
    : accent
      ? (hov ? 'oklch(0.80 0.13 80 / 0.12)' : 'transparent')
      : (hov ? 'var(--panel-2)' : 'transparent')
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
        borderRadius: 5, fontSize: 12.5, cursor: 'pointer', color, background: bg, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', flex: '0 0 auto' }}>{icon}</span>
      {label}
    </div>
  )
}

function BacklogRow({ item, categories, isFirst, onSetCategory, onAddCategory, onPromote, onKill }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderTop: isFirst ? 'none' : '1px solid var(--border-subtle)',
        background: hov ? 'var(--panel-2)' : 'transparent',
        transition: 'background .12s',
      }}
    >
      {/* Idea icon */}
      <span style={{ color: 'var(--text-very-dim)', display: 'inline-flex', flex: '0 0 auto' }}>
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" /><path d="M6 14h4" />
        </svg>
      </span>

      {/* Summary */}
      <span title={item.summary} style={{
        flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--text)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{item.summary}</span>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        <CategoryPicker
          value={item.category}
          categories={categories}
          onSelect={(c) => onSetCategory(item.id, c)}
          onAddCategory={onAddCategory}
        />
        <AgeChip source={item.source} />
        <BacklogStatusChip category={item.category} />
      </div>

      <RowMenu hovered={hov} onPromote={() => onPromote(item)} onKill={() => onKill(item)} />
    </div>
  )
}

// ─── RowMenu needs useRef — import it ────────────────────────────────────────
import { useRef } from 'react'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IdeaBacklogPage({ readFile, writeFile, fileExists, onNavigate, onFileCreated }) {
  const [items, setItems]           = useState([])
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [loading, setLoading]       = useState(true)
  const [rawFile, setRawFile]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await readFile(BACKLOG_FILE)
      setRawFile(raw)
      const parsed = parseBacklog(raw)
      setItems(parsed)
      // Collect any categories already in use
      const usedCats = parsed.map((i) => i.category).filter(Boolean)
      setCategories((prev) => {
        const all = new Set([...prev, ...usedCats])
        return [...all]
      })
    } catch {
      setItems([])
    }
    setLoading(false)
  }, [readFile])

  useEffect(() => { load() }, [load])

  /** Persist items back to disk. */
  const persist = useCallback(async (newItems) => {
    const updated = rewriteBacklog(rawFile, newItems)
    setRawFile(updated)
    await writeFile(BACKLOG_FILE, updated)
  }, [rawFile, writeFile])

  const handleSetCategory = useCallback(async (id, category) => {
    const newItems = items.map((it) => it.id === id ? { ...it, category } : it)
    setItems(newItems)
    await persist(newItems)
  }, [items, persist])

  const handleAddCategory = useCallback((cat) => {
    setCategories((prev) => prev.includes(cat) ? prev : [...prev, cat])
  }, [])

  const handleKill = useCallback(async (item) => {
    const newItems = items.filter((it) => it.id !== item.id)
    setItems(newItems)
    await persist(newItems)
  }, [items, persist])

  const [promoteError, setPromoteError] = useState(null)

  const handlePromote = useCallback(async (item) => {
    setPromoteError(null)
    try {
      // Build slug from summary
      const slug = (() => {
        const base = item.summary
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 60)
        return base.charAt(0).toUpperCase() + base.slice(1) || 'Untitled'
      })()

      const today = todayISO()
      // Derive origin date from source "DD-MM-YYYY" → "YYYY-MM-DD"
      let origin = today
      if (item.source) {
        const [d, m, y] = item.source.split('-')
        if (d && m && y) origin = `${y}-${m}-${d}`
      }

      const domain = item.category ? item.category.toLowerCase() : ''
      const filePath = `ideas/${slug}.md`

      // Avoid overwriting existing file
      let finalPath = filePath
      try {
        const exists = await fileExists(filePath)
        if (exists) {
          finalPath = `ideas/${slug}-${Date.now()}.md`
        }
      } catch {}

      const content = `---
type: idea
name: ${item.summary}
domain: ${domain}
status: Spark
origin: ${origin}
related_projects: []
related_people: []
tags: []
last_updated: ${today}
---

## Summary
${item.summary}

## Origin
${item.source ? `Spotted in note [[${item.source}]].` : 'From ideas backlog.'}

## Developing


## Outcome


## Current Plan


## Recent Mentions
`
      await writeFile(finalPath, content)
      await onFileCreated?.()

      // Remove from backlog and persist before navigating
      const newItems = items.filter((it) => it.id !== item.id)
      setItems(newItems)
      await persist(newItems)

      // Navigate to new idea
      onNavigate?.('viewer', finalPath)
    } catch (err) {
      console.error('[IdeaBacklog] promote failed:', err)
      setPromoteError(err?.message || String(err))
    }
  }, [items, persist, fileExists, writeFile, onNavigate, onFileCreated])

  const count = items.length

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading backlog…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 48px 20px', borderBottom: '1px solid var(--border-subtle)', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--text)' }}>
            Ideas backlog
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-very-dim)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{count}</span> waiting
          </span>
        </div>
      </header>

      <div style={{ padding: '22px 48px 48px', overflowY: 'auto', flex: 1 }}>
        <p style={{
          margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.6,
          color: 'var(--text-dim)', maxWidth: 720,
        }}>
          Ideas the AI spotted in your notes land here. Pick a category and promote
          to a full idea, or kill items that aren't ideas.{' '}
          <span style={{ fontFamily: 'monospace', color: 'var(--accent, oklch(0.85 0.16 95))' }}>#idea</span>
          {' '}tags in notes route here automatically.
        </p>

        {promoteError && (
          <div style={{
            margin: '0 0 16px', padding: '10px 14px', borderRadius: 8,
            background: 'oklch(0.70 0.18 22 / 0.12)', border: '1px solid oklch(0.70 0.18 22 / 0.35)',
            color: 'oklch(0.84 0.16 22)', fontSize: 13,
          }}>
            Failed to create idea: {promoteError}
          </div>
        )}

        {count === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '64px 24px', border: '1px dashed var(--border)', borderRadius: 12,
            color: 'var(--text-very-dim)', textAlign: 'center',
          }}>
            <svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" /><path d="M6 14h4" />
            </svg>
            <div style={{ fontSize: 14.5, color: 'var(--text-dim)' }}>Backlog clear</div>
            <div style={{ fontSize: 13 }}>
              Nothing waiting to be filed. New{' '}
              <span style={{ fontFamily: 'monospace' }}>#idea</span>{' '}
              notes will show up here.
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {items.map((item, i) => (
              <BacklogRow
                key={item.id}
                item={item}
                categories={categories}
                isFirst={i === 0}
                onSetCategory={handleSetCategory}
                onAddCategory={handleAddCategory}
                onPromote={handlePromote}
                onKill={handleKill}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
