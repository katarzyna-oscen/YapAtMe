import { useState, useRef, useEffect } from 'react'
import { PrioritySelect, PriorityChip, tagsToPriority, applyPriorityToTags } from './PrioritySelect'

function renderLinkedText(text, onWikilinkClick) {
  const parts = String(text || '').split(/(\[\[[^\]]+\]\])/g)
  return parts.map((part, idx) => {
    const m = part.match(/^\[\[([^\]]+)\]\]$/)
    if (!m) return <span key={idx}>{part}</span>
    return (
      <button
        key={idx}
        type="button"
        onClick={() => onWikilinkClick?.(m[1])}
        style={{
          color: 'oklch(0.88 0.16 96)',
          textDecoration: 'underline',
          textDecorationColor: 'oklch(0.88 0.16 96 / 0.45)',
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
  })
}

function EditableTitle({ value, onCommit, onWikilinkClick }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== value) onCommit?.(next)
    else setDraft(value || '')
  }

  if (!onCommit) {
    return <span style={{ minWidth: 0, flex: 1 }}>{renderLinkedText(value, onWikilinkClick)}</span>
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) }
        }}
        style={{
          minWidth: 0,
          flex: 1,
          background: 'var(--panel-2)',
          border: '1px solid var(--accent)',
          borderRadius: 5,
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: 'inherit',
          padding: '2px 6px',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => { setDraft(value || ''); setEditing(true) }}
      style={{ minWidth: 0, flex: 1, cursor: 'text' }}
      title="Click to edit"
    >
      {renderLinkedText(value, onWikilinkClick)}
    </span>
  )
}

export default function TaskPanel({ tasks = [], sections = [], onResolve, onWikilinkClick, onUpdateTask }) {
  const groupedSections = sections
    .map((section) => ({
      section,
      tasks: tasks.filter((task) => task?.section === section),
    }))
    .filter((group) => group.tasks.length > 0)

  if (groupedSections.length === 0) return null

  return (
    <div style={{ marginBottom: 28 }}>
      {groupedSections.map(({ section, tasks: sectionTasks }) => (
        <section key={section} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-very-dim)',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            {section.replace(/^##\s*/, '')} · {sectionTasks.length}
          </div>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--panel)',
            }}
          >
            {sectionTasks.map((task, index) => {
              const priority = tagsToPriority(task.tags)
              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                  }}
                >
                  <button
                    onClick={() => onResolve?.(task.id)}
                    title="Resolve task"
                    style={{
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      border: '1.5px solid var(--border-strong)',
                      borderRadius: 5,
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                  <div style={{ fontSize: 13, color: 'var(--text)', minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <EditableTitle
                      value={task.title}
                      onCommit={onUpdateTask ? (title) => onUpdateTask(task.id, { title }) : null}
                      onWikilinkClick={onWikilinkClick}
                    />
                    {onUpdateTask ? (
                      <PrioritySelect
                        priority={priority}
                        onChange={(p) => onUpdateTask(task.id, { tags: applyPriorityToTags(task.tags, p) })}
                      />
                    ) : (
                      <PriorityChip priority={priority} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}