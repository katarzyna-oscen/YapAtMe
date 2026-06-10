import { useState, useRef, useMemo } from 'react'

/**
 * EntityPicker — chip-based entity selector with typeahead dropdown.
 *
 * Props:
 *   entities    — string[]   current selections (display names, no [[]])
 *   onChange    — (string[]) => void
 *   suggestions — { name: string, path: string, type: string }[]
 *   filterType  — 'project' | 'person' | 'idea' | null  (undefined = no filter)
 *   onNavigate  — (name: string) => void  called when chip name is clicked
 *   placeholder — string
 */
export default function EntityPicker({
  entities = [],
  onChange,
  suggestions = [],
  filterType,
  onNavigate,
  placeholder = 'Add entity',
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hovIdx, setHovIdx] = useState(-1)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return (suggestions || [])
      .filter((s) => {
        if (filterType && s.type !== filterType) return false
        if (entities.includes(s.name)) return false
        if (!q) return true
        return s.name.toLowerCase().includes(q)
      })
      .slice(0, 8)
  }, [query, suggestions, filterType, entities])

  const addEntity = (name) => {
    const trimmed = name.trim()
    if (!trimmed || entities.includes(trimmed)) return
    onChange([...entities, trimmed])
    setQuery('')
    setOpen(false)
    setHovIdx(-1)
  }

  const removeEntity = (name) => {
    onChange(entities.filter((e) => e !== name))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const max = filtered.length + (showCreate ? 1 : 0) - 1
      setHovIdx((h) => Math.min(h + 1, max))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHovIdx((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hovIdx >= 0 && hovIdx < filtered.length) {
        addEntity(filtered[hovIdx].name)
      } else if (query.trim()) {
        addEntity(query.trim())
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setHovIdx(-1)
    }
  }

  const showCreate =
    query.trim() &&
    !filtered.find((s) => s.name.toLowerCase() === query.trim().toLowerCase())
  const hasDropdownItems = filtered.length > 0 || showCreate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Chips */}
      {entities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {entities.map((name) => (
            <span
              key={name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 6px 4px 10px',
                background: 'oklch(0.85 0.16 95 / 0.10)',
                border: '1px solid oklch(0.85 0.16 95 / 0.35)',
                borderRadius: 6,
                fontSize: 13,
                color: 'oklch(0.88 0.16 95)',
              }}
            >
              <button
                onClick={() => onNavigate?.(name)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'inherit',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                {name}
              </button>
              <button
                onClick={() => removeEntity(name)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0 3px',
                  color: 'oklch(0.88 0.16 95 / 0.5)',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      {open ? (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHovIdx(-1) }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => { setOpen(false); setQuery(''); setHovIdx(-1) }, 150)
            }}
            placeholder={placeholder}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontSize: 13,
              color: 'var(--text)',
              background: 'var(--panel-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              padding: '7px 10px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {hasDropdownItems && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 40,
                marginTop: 4,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
              }}
            >
              {filtered.map((s, i) => (
                <button
                  key={s.path}
                  onMouseDown={() => addEntity(s.name)}
                  onMouseEnter={() => setHovIdx(i)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: hovIdx === i ? 'var(--panel-2)' : 'transparent',
                    color: 'var(--text)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {s.name}
                </button>
              ))}
              {showCreate && (
                <button
                  onMouseDown={() => addEntity(query.trim())}
                  onMouseEnter={() => setHovIdx(filtered.length)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: hovIdx === filtered.length ? 'var(--panel-2)' : 'transparent',
                    color: 'var(--text-dim)',
                    border: 'none',
                    cursor: 'pointer',
                    borderTop: filtered.length > 0 ? '1px solid var(--border-subtle)' : 'none',
                    fontStyle: 'italic',
                  }}
                >
                  + Add "{query.trim()}"
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--text-very-dim)',
            fontSize: 13,
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: 'inherit',
            fontStyle: 'italic',
          }}
        >
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          {placeholder}
        </button>
      )}
    </div>
  )
}
