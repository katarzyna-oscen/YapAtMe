import { useMemo, useState } from 'react'
import { PrimaryButton, SecondaryButton } from './ui/Buttons'

function humanizeEntityName(path) {
  const base = String(path || '').split('/').pop()?.replace(/\.md$/i, '') || ''
  const raw = base.replace(/[-_]+/g, ' ').trim()
  if (!raw) return ''
  return raw
    .split(/\s+/)
    .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

function buildOptionsByType(allowedFiles = []) {
  const people = []
  const projects = []

  for (const path of allowedFiles || []) {
    const lower = String(path || '').toLowerCase()
    if (!lower.endsWith('.md')) continue

    if (lower.startsWith('people/')) {
      people.push({ label: humanizeEntityName(path), path })
    } else if (lower.startsWith('projects/')) {
      projects.push({ label: humanizeEntityName(path), path })
    }
  }

  return { people, projects }
}

function rankOptions(options, input) {
  const needle = String(input || '').trim().toLowerCase()
  if (!needle || needle.length < 1) return []

  return options
    .filter((option) => option.label.toLowerCase().includes(needle))
    .sort((a, b) => {
      const ai = a.label.toLowerCase().indexOf(needle)
      const bi = b.label.toLowerCase().indexOf(needle)
      if (ai !== bi) return ai - bi
      return a.label.length - b.label.length
    })
    .slice(0, 5)
}

function EntityChip({ entity, options, onChange, onDismiss }) {
  const [open, setOpen] = useState(false)
  const suggestions = useMemo(() => {
    if (entity.resolution === 'dismissed') return []
    return rankOptions(options, entity.correctedName)
  }, [options, entity.correctedName, entity.resolution])

  const indicator = entity.resolution === 'dismissed'
    ? 'Dismissed'
    : (entity.resolution === 'link' && entity.targetFile
      ? `Will link to ${entity.correctedName}`
      : 'Will be created before routing')

  const indicatorColor = entity.resolution === 'dismissed'
    ? 'var(--text-very-dim)'
    : (entity.resolution === 'link' ? 'var(--info)' : 'var(--accent)')

  const normalizedType = String(entity?.type || '').trim().toLowerCase()
  const typeLabel = normalizedType || 'unknown'
  const typeStyles = normalizedType === 'person'
    ? {
        background: 'color-mix(in oklab, var(--info) 22%, transparent)',
        border: '1px solid color-mix(in oklab, var(--info) 55%, transparent)',
        color: 'var(--text)',
      }
    : normalizedType === 'project'
      ? {
          background: 'color-mix(in oklab, var(--accent) 18%, transparent)',
          border: '1px solid color-mix(in oklab, var(--accent) 45%, transparent)',
          color: 'var(--text)',
        }
      : {
          background: 'var(--text)',
          border: '1px solid var(--text)',
          color: 'var(--bg-primary)',
        }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 10,
        background: entity.resolution === 'dismissed' ? 'var(--panel-2)' : 'var(--panel)',
        opacity: entity.resolution === 'dismissed' ? 0.75 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            ...typeStyles,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            padding: '2px 8px',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700,
          }}
        >
          {typeLabel}
        </span>
        <input
          value={entity.correctedName}
          onChange={(e) => {
            const value = e.target.value
            onChange({ correctedName: value, resolution: value.trim() ? 'create' : 'create', targetFile: null })
            setOpen(value.trim().length >= 1)
          }}
          onFocus={() => setOpen(entity.correctedName.trim().length >= 1)}
          onBlur={() => setTimeout(() => setOpen(false), 80)}
          disabled={entity.resolution === 'dismissed'}
          placeholder={entity.originalName}
          style={{
            flex: 1,
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text)',
            borderRadius: 6,
            padding: '7px 9px',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onDismiss}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--panel-2)',
            color: 'var(--text-dim)',
            borderRadius: 6,
            width: 28,
            height: 28,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
          }}
          title="Dismiss"
        >
          ×
        </button>
      </div>

      {open && suggestions.length > 0 && entity.resolution !== 'dismissed' && (
        <div
          style={{
            marginTop: 6,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--panel)',
            overflow: 'hidden',
          }}
        >
          {suggestions.map((option) => (
            <button
              key={option.path}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({
                  correctedName: option.label,
                  resolution: 'link',
                  targetFile: option.path,
                })
                setOpen(false)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderTop: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text)',
                padding: '8px 10px',
                cursor: 'pointer',
                fontSize: 12.5,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: indicatorColor }}>
        {indicator}
      </div>

      {entity.type === 'person' && entity.resolution === 'create' && (
        <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <input
            value={entity.relationship || ''}
            onChange={(e) => onChange({ relationship: e.target.value })}
            placeholder="Relationship (e.g. coworker, friend)"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              borderRadius: 6,
              padding: '7px 9px',
              fontSize: 12.5,
              outline: 'none',
            }}
          />
          <input
            value={entity.role || ''}
            onChange={(e) => onChange({ role: e.target.value })}
            placeholder="Role (e.g. PM, founder)"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              borderRadius: 6,
              padding: '7px 9px',
              fontSize: 12.5,
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function CleanupModal({
  noteContent,
  noteFilename,
  unknownPeople = [],
  unknownProjects = [],
  allowedFiles = [],
  enabledModules = {},
  onConfirm,
  onCancel,
}) {
  const [text, setText] = useState(String(noteContent || ''))
  const optionsByType = useMemo(() => buildOptionsByType(allowedFiles), [allowedFiles])

  const initialEntities = useMemo(() => {
    const out = []

    if (enabledModules?.people !== false) {
      for (const name of unknownPeople || []) {
        out.push({
          id: `person:${name}`,
          type: 'person',
          originalName: name,
          correctedName: name,
          resolution: 'create',
          targetFile: null,
          relationship: '',
          role: '',
        })
      }
    }

    if (enabledModules?.projects !== false) {
      for (const name of unknownProjects || []) {
        out.push({
          id: `project:${name}`,
          type: 'project',
          originalName: name,
          correctedName: name,
          resolution: 'create',
          targetFile: null,
        })
      }
    }

    return out
  }, [unknownPeople, unknownProjects, enabledModules])

  const [entities, setEntities] = useState(initialEntities)

  const updateEntity = (id, patch) => {
    setEntities((prev) => prev.map((entity) => (
      entity.id === id
        ? {
            ...entity,
            ...patch,
            resolution: patch.resolution || entity.resolution,
            targetFile: patch.targetFile === undefined ? entity.targetFile : patch.targetFile,
          }
        : entity
    )))
  }

  const dismissEntity = (id) => {
    setEntities((prev) => prev.map((entity) => (
      entity.id === id
        ? { ...entity, resolution: 'dismissed', targetFile: null }
        : entity
    )))
  }

  const handleConfirm = () => {
    onConfirm?.({
      correctedNote: text,
      resolvedEntities: entities.map((entity) => ({
        originalName: entity.originalName,
        correctedName: entity.correctedName,
        type: entity.type,
        resolution: entity.resolution,
        targetFile: entity.resolution === 'link' ? entity.targetFile : null,
        relationship: entity.type === 'person' ? String(entity.relationship || '').trim() : '',
        role: entity.type === 'person' ? String(entity.role || '').trim() : '',
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Review before routing</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">{noteFilename}</p>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              borderRadius: 10,
              padding: 12,
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
            }}
          />

          {entities.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 8 }}>
                We found these names — correct, link, or dismiss each:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {entities.map((entity) => (
                  <EntityChip
                    key={entity.id}
                    entity={entity}
                    options={entity.type === 'person' ? optionsByType.people : optionsByType.projects}
                    onChange={(patch) => updateEntity(entity.id, patch)}
                    onDismiss={() => dismissEntity(entity.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleConfirm}>Looks good, route this</PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
