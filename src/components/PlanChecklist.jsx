import { useState } from 'react'

// ─── Parsing helpers (exported so callers can compute stats) ──────────────────

export function parsePlanSteps(sectionText) {
  return (sectionText || '').split('\n').reduce((acc, line, i) => {
    const done = line.match(/^-\s+\[x\]\s+(.+)/i)
    const open = line.match(/^-\s+\[\s\]\s+(.+)/i)
    if (done) acc.push({ id: `p${i}`, text: done[1].trim(), done: true, raw: line })
    else if (open) acc.push({ id: `p${i}`, text: open[1].trim(), done: false, raw: line })
    return acc
  }, [])
}

function applyToggle(sectionText, rawLine, nowDone) {
  return sectionText.split('\n').map((l) => {
    if (l.trim() !== rawLine.trim()) return l
    return nowDone
      ? l.replace(/^(-\s+)\[\s\]/, '$1[x]')
      : l.replace(/^(-\s+)\[x\]/i, '$1[ ]')
  }).join('\n')
}

function applyDelete(sectionText, rawLine) {
  return sectionText.split('\n')
    .filter((l) => l.trim() !== rawLine.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

function applyEdit(sectionText, rawLine, newText, wasDone) {
  const newLine = wasDone ? `- [x] ${newText.trim()}` : `- [ ] ${newText.trim()}`
  return sectionText.split('\n').map((l) =>
    l.trim() === rawLine.trim() ? newLine : l
  ).join('\n')
}

function applyAdd(sectionText, text) {
  const trimmed = (sectionText || '').trimEnd()
  const newLine = `- [ ] ${text.trim()}`
  return trimmed ? trimmed + '\n' + newLine : newLine
}

// Normalizes pasted text into an array of plain step titles.
// Handles markdown checkboxes, bullets, numbered lists, and plain lines.
function parsePastedLines(raw) {
  return raw.split('\n')
    .map((line) => line
      .replace(/^-\s+\[[ x]\]\s*/i, '')  // - [ ] or - [x]
      .replace(/^[-*•]\s+/, '')             // - or * or • bullet
      .replace(/^\d+[.)\s]\s*/, '')         // 1. or 1) or 1 
      .trim()
    )
    .filter(Boolean)
}

// ─── Step row ─────────────────────────────────────────────────────────────────

function StepRow({ step, onToggle, onDelete, onEditDone }) {
  const [hover, setHover] = useState(false)
  const [boxHov, setBoxHov] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(step.text)

  const commitEdit = () => {
    setEditing(false)
    if (editText.trim() && editText.trim() !== step.text) {
      onEditDone(editText.trim())
    }
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0 6px 12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Checkbox — styled to match TaskPanel */}
      <button
        onClick={onToggle}
        onMouseEnter={() => setBoxHov(true)}
        onMouseLeave={() => setBoxHov(false)}
        title={step.done ? 'Mark open' : 'Mark done'}
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          border: '1.5px solid',
          borderColor: step.done ? 'var(--success)' : (boxHov ? 'var(--success)' : 'var(--border-strong)'),
          borderRadius: 5,
          background: step.done ? 'var(--success)' : 'transparent',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color .12s, background .12s',
        }}
      >
        {step.done && (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="var(--bg-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
        )}
      </button>

      {/* Text (editable inline for open steps) */}
      {editing ? (
        <input
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') { setEditing(false); setEditText(step.text) }
          }}
          onBlur={commitEdit}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border-strong)',
            outline: 'none',
            fontSize: 13.5,
            color: 'var(--text)',
            fontFamily: 'inherit',
            padding: '0 0 1px',
          }}
        />
      ) : (
        <span
          onClick={() => {
            if (!step.done) {
              setEditing(true)
              setEditText(step.text)
            }
          }}
          style={{
            flex: 1,
            fontSize: 13.5,
            lineHeight: 1.4,
            color: step.done ? 'var(--text-very-dim)' : 'var(--text)',
            textDecoration: step.done ? 'line-through' : 'none',
            cursor: step.done ? 'default' : 'text',
            userSelect: step.done ? 'none' : 'auto',
          }}
        >
          {step.text}
        </span>
      )}

      {/* Delete */}
      {!editing && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Remove step"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-very-dim)',
            cursor: 'pointer',
            padding: '0 4px',
            fontSize: 16,
            lineHeight: 1,
            flexShrink: 0,
            opacity: hover ? 0.7 : 0,
            transition: 'opacity 0.1s',
            fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
//
// Props:
//   sectionText    — string: raw content of ## Current Plan section (no heading)
//   onChange       — (newSectionText: string) => void
//   onToggle       — (stepTitle: string, nowDone: boolean) => void  — tasks index sync
//   onDelete       — (stepTitle: string) => void  — tasks index sync
//   onAdd          — (stepTitle: string) => void  — tasks index sync (single)
//   onAddMultiple  — (titles: string[]) => void   — tasks index sync (batch paste)
//   onRename       — (oldTitle: string, newTitle: string, isDone: boolean) => void  — tasks index sync

export default function PlanChecklist({ sectionText, onChange, onToggle, onDelete, onAdd, onAddMultiple, onRename }) {
  const [addingStep, setAddingStep] = useState(false)
  const [newStepText, setNewStepText] = useState('')

  const steps = parsePlanSteps(sectionText)

  const handleToggle = (step) => {
    const nowDone = !step.done
    const newSection = applyToggle(sectionText, step.raw, nowDone)
    onChange(newSection)
    onToggle?.(step.text, nowDone)
  }

  const handleDelete = (step) => {
    const newSection = applyDelete(sectionText, step.raw)
    onChange(newSection)
    onDelete?.(step.text)
  }

  const handleEditDone = (step, newText) => {
    const newSection = applyEdit(sectionText, step.raw, newText, step.done)
    onChange(newSection)
    if (newText !== step.text) {
      onRename?.(step.text, newText, step.done)
    }
  }

  const handleAdd = () => {
    const text = newStepText.trim()
    if (!text) { setAddingStep(false); return }
    const newSection = applyAdd(sectionText, text)
    onChange(newSection)
    onAdd?.(text)
    setNewStepText('')
    setAddingStep(false)
  }

  const handlePaste = (e) => {
    const raw = e.clipboardData.getData('text')
    const lines = parsePastedLines(raw)
    if (lines.length < 2) return  // single line — fall through to normal paste
    e.preventDefault()
    let newSection = sectionText
    for (const line of lines) newSection = applyAdd(newSection, line)
    onChange(newSection)
    onAddMultiple ? onAddMultiple(lines) : lines.forEach((t) => onAdd?.(t))
    setNewStepText('')
    setAddingStep(false)
  }

  const doneCount = steps.filter((s) => s.done).length

  return (
    <div>
      {/* Steps */}
      {steps.length > 0 ? (
        <>
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              onToggle={() => handleToggle(step)}
              onDelete={() => handleDelete(step)}
              onEditDone={(newText) => handleEditDone(step, newText)}
            />
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--text-very-dim)', marginTop: 8, marginBottom: 10 }}>
            {doneCount} of {steps.length} done · steps feed the Plans screen
          </div>
        </>
      ) : !addingStep ? (
        <div style={{ fontSize: 13, color: 'var(--text-very-dim)', fontStyle: 'italic', marginBottom: 10 }}>
          No plan steps yet — add steps to track progress on the Plans screen.
        </div>
      ) : null}

      {/* Add step input */}
      {addingStep ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <input
            autoFocus
            value={newStepText}
            onChange={(e) => setNewStepText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAddingStep(false); setNewStepText('') }
            }}
            onPaste={handlePaste}
            onBlur={() => { if (!newStepText.trim()) { setAddingStep(false) } else handleAdd() }}
            placeholder="Add a plan step…"
            style={{
              flex: 1,
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 13,
              padding: '6px 10px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-very-dim)', whiteSpace: 'nowrap' }}>Enter · Esc</span>
        </div>
      ) : (
        <button
          onClick={() => setAddingStep(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            color: 'var(--text-very-dim)',
            fontSize: 12.5,
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: 'inherit',
          }}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add step
        </button>
      )}
    </div>
  )
}
