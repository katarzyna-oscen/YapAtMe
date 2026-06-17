import { useEffect, useRef, useState } from 'react'
import { rebuildIndexFiles, rebuildContext } from '../lib/rebuildContext'
import { migrateEntityTasks } from '../lib/migrateEntityTasks'
import { cleanEntityFiles } from '../lib/cleanEntityFiles'
import { callLLM, PROVIDERS } from '../lib/llm'
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons'
import {
  readTasksIndex,
  countActiveTasksForModule,
  countArchivedTasksForModule,
  archiveTasksForModule,
  unattachTasksForModule,
  restoreArchivedTasksForModule,
} from '../lib/tasksIndex'

const DEFAULT_ENABLED_MODULES = {
  projects: true,
  people: true,
  ideas: true,
}

// Modules that own task data - disabling these triggers the migration modal.
// Mirrors FOLDER_TASK_SECTIONS keys in migrateEntityTasks.js.
const MODULES_WITH_TASKS = new Set(['projects', 'people'])

function restoreNoticeForModule(moduleId, moduleLabel) {
  if (moduleId === 'people') return 'People restored - delegate and follow-up tasks are visible again.'
  if (moduleId === 'projects') return 'Projects restored - project tasks are visible again.'
  return `${moduleLabel} restored - tasks are visible again.`
}

function ModuleDisableModal({ moduleLabel, taskCount, onCancel, onArchive, onUnattach }) {
  const [busy, setBusy] = useState(false)

  const handle = async (action) => {
    setBusy(true)
    try { await action() } finally { setBusy(false) }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          width: 440,
          background: 'var(--panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          padding: '28px 28px 24px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          Disable {moduleLabel} module
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: 20 }}>
          This module has <strong style={{ color: 'var(--text-secondary)' }}>{taskCount} active task{taskCount !== 1 ? 's' : ''}</strong>.
          {' '}What should happen to them?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            {
              label: 'Archive tasks',
              detail: 'Hide tasks from all views. You can restore them when you re-enable this module.',
              action: onArchive,
            },
            {
              label: 'Keep as unattached',
              detail: 'Detach tasks from this module. They will remain visible in the Tasks page.',
              action: onUnattach,
            },
          ].map(({ label, detail, action }) => (
            <button
              key={label}
              onClick={() => handle(action)}
              disabled={busy}
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                background: 'var(--panel-2)',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '11px 12px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.4 }}>{detail}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SecondaryButton onClick={onCancel} disabled={busy}>Cancel</SecondaryButton>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-dim)', marginBottom: 8 }}>
      {children}
    </label>
  )
}

function StyledInput({ type = 'text', value, onChange, placeholder, mono }) {
  const [focus, setFocus] = useState(false)
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: '100%', padding: '10px 12px',
        background: 'var(--panel)', color: 'var(--text)',
        border: `1px solid ${focus ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8, fontSize: 13.5, fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        outline: 'none', transition: 'border-color .12s',
      }}
    />
  )
}

function StyledSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = options.find((o) => o.value === value) || options[0]

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--panel)', color: 'var(--text)',
          border: `1px solid ${open ? 'var(--border-strong)' : 'var(--border)'}`,
          borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit',
          outline: 'none', transition: 'border-color .12s', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          textAlign: 'left',
        }}
      >
        <span>{current?.label ?? ''}</span>
        <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor" style={{
          opacity: 0.55, color: 'var(--text-dim)', flex: '0 0 10px',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform .15s',
        }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
          padding: 4, background: 'var(--panel-pop)',
          border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
        }}>
          {options.map((o) => {
            const active = o.value === value
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, color: active ? 'var(--text)' : 'var(--text-dim)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--panel-2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ flex: 1 }}>{o.label}</span>
                {active && <span style={{ color: 'var(--text-very-dim)' }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActionCard({ title, description, footnote, children }) {
  return (
    <div style={{ padding: '18px 20px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 14 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.005em' }}>{title}</h3>
      {description && <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)', textWrap: 'pretty' }}>{description}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
      {footnote && <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-very-dim)' }}>{footnote}</div>}
    </div>
  )
}

function SettingsCheckbox({ checked }) {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 4,
      border: '1.5px solid', borderColor: checked ? 'var(--accent)' : 'var(--border-strong)',
      background: checked ? 'var(--accent)' : 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: '#1a1408', flexShrink: 0,
    }}>
      {checked && (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="m3 8 3.5 3.5L13 5" />
        </svg>
      )}
    </span>
  )
}

const DASHBOARD_SECTION_DEFS = [
  { id: 'needs-call', label: 'Needs Your Call' },
  { id: 'summaries',  label: 'Summaries' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks',    label: 'Tasks'    },
  { id: 'people',   label: 'People'   },
  { id: 'ideas',    label: 'Ideas'    },
]

function DashboardSectionConfig({ value, onChange }) {
  const storedOrder = value?.order || []
  const defaultOrder = DASHBOARD_SECTION_DEFS.map(d => d.id)
  // Merge stored order with any missing defaults appended at end
  const fullOrder = [
    ...storedOrder.filter(id => defaultOrder.includes(id)),
    ...defaultOrder.filter(id => !storedOrder.includes(id)),
  ]

  const [order, setOrder] = useState(fullOrder)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  useEffect(() => {
    setOrder(fullOrder)
  }, [value])

  const isVisible = (id) => value?.visibility?.[id] !== false

  const toggleVisible = (id) => {
    const next = {
      ...value,
      visibility: { ...(value?.visibility || {}), [id]: !isVisible(id) },
      order,
    }
    onChange(next)
  }

  const dragHandlers = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnter: (e) => { e.preventDefault(); if (id !== dragId) setOverId(id) },
    onDragOver:  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' },
    onDrop: (e) => {
      e.preventDefault()
      if (!dragId || dragId === id) return
      const next = [...order]
      const from = next.indexOf(dragId)
      const to   = next.indexOf(id)
      if (from < 0 || to < 0) return
      next.splice(from, 1)
      next.splice(to, 0, dragId)
      setOrder(next)
      onChange({ ...value, order: next })
      setDragId(null); setOverId(null)
    },
    onDragEnd: () => { setDragId(null); setOverId(null) },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {order.map(id => {
        const def     = DASHBOARD_SECTION_DEFS.find(d => d.id === id)
        const visible = isVisible(id)
        const over    = overId === id
        const dragging = dragId === id
        if (!def) return null
        return (
          <div
            key={id}
            {...dragHandlers(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: over ? 'var(--panel-pop)' : 'var(--bg-input)',
              border: `1px solid ${over ? 'var(--border-strong)' : 'var(--border)'}`,
              borderRadius: 8,
              opacity: dragging ? 0.4 : 1,
              cursor: 'grab',
              transition: 'border-color .12s, background .12s',
            }}
          >
            {/* Drag handle */}
            <svg viewBox="0 0 14 14" width="14" height="14" fill="var(--text-very-dim)"
              style={{ flexShrink: 0, cursor: 'grab' }}>
              <circle cx="4.5" cy="4"  r="1.1" /><circle cx="4.5" cy="7"  r="1.1" /><circle cx="4.5" cy="10" r="1.1" />
              <circle cx="9.5" cy="4"  r="1.1" /><circle cx="9.5" cy="7"  r="1.1" /><circle cx="9.5" cy="10" r="1.1" />
            </svg>
            {/* Label */}
            <span style={{ flex: 1, fontSize: 13, color: visible ? 'var(--text-secondary)' : 'var(--text-very-dim)' }}>
              {def.label}
            </span>
            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => toggleVisible(id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <SettingsCheckbox checked={visible} />
            </button>
          </div>
        )
      })}
      <p style={{ fontSize: 11.5, color: 'var(--text-very-dim)', margin: '4px 0 0', lineHeight: 1.5 }}>
        Drag to reorder · uncheck to hide
      </p>
    </div>
  )
}

export default function SettingsPage({ writeFile, readFile, listTree, settings, saveSettings }) {
  const [form, setForm] = useState({
    apiKey:   settings.apiKey   || '',
    model:    settings.model    || 'meta-llama/llama-3.3-70b-instruct',
    provider: settings.provider || 'openrouter',
    writerFile: settings.writerFile || '',
    enabledModules: settings.enabledModules || DEFAULT_ENABLED_MODULES,
    dashboardSections: settings.dashboardSections || {},
  })
  const [saved, setSaved] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildStatus, setRebuildStatus] = useState(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [connectionMessage, setConnectionMessage] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState(null)
  // Modal state: null when closed, { id: string, label: string } when open
  const [pendingDisable, setPendingDisable] = useState(null)
  const [moduleRestoreNotice, setModuleRestoreNotice] = useState('')
  const [activeSection, setActiveSection] = useState('ai')

  useEffect(() => {
    setForm({
      apiKey: settings.apiKey || '',
      model: settings.model || 'meta-llama/llama-3.3-70b-instruct',
      provider: settings.provider || 'openrouter',
      writerFile: settings.writerFile || '',
      enabledModules: settings.enabledModules || DEFAULT_ENABLED_MODULES,
      dashboardSections: settings.dashboardSections || {},
    })
  }, [settings])

  const handleSave = async () => {
    await saveSettings(form)
    setSaved(true)
  }

  const updateAiField = (patch) => {
    setSaved(false)
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleRebuildContext = async () => {
    setRebuilding(true)
    setRebuildStatus(null)
    try {
      const { entityNameMap } = await rebuildIndexFiles(readFile, writeFile, listTree)
      await rebuildContext(readFile, writeFile, settings, entityNameMap)
      setRebuildStatus('ok')
    } catch {
      setRebuildStatus('error')
    } finally {
      setRebuilding(false)
      setTimeout(() => setRebuildStatus(null), 3000)
    }
  }

  const handleTestConnection = async () => {
    if (testingConnection) return

    setTestingConnection(true)
    setConnectionStatus(null)
    setConnectionMessage('')

    try {
      const providerDef = PROVIDERS[form.provider] || PROVIDERS.openrouter
      if (providerDef.needsKey && !String(form.apiKey || '').trim()) {
        throw new Error('API key is required for this provider')
      }

      const response = await callLLM(
        [{ role: 'user', content: 'Reply with: pong' }],
        'You are a connection test. Reply with only the word pong.',
        form,
        16
      )

      const preview = String(response || '').trim()
      if (!preview) {
        throw new Error('Model returned an empty response')
      }

      setConnectionStatus('ok')
      setConnectionMessage(preview.slice(0, 120))
    } catch (err) {
      setConnectionStatus('error')
      setConnectionMessage(err?.message || 'Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const commitModuleToggle = async (moduleId, enabled) => {
    const nextEnabledModules = {
      ...(form.enabledModules || DEFAULT_ENABLED_MODULES),
      [moduleId]: enabled,
    }
    const nextForm = { ...form, enabledModules: nextEnabledModules }
    setForm(nextForm)
    await saveSettings(nextForm)
  }

  const handleModuleToggle = async (moduleId, moduleLabel, currentlyEnabled) => {
    if (!currentlyEnabled) {
      // Re-enabling: restore archived tasks if any, then enable
      await commitModuleToggle(moduleId, true)
      if (MODULES_WITH_TASKS.has(moduleId)) {
        try {
          const entries = await readTasksIndex(readFile)
          const archivedCount = countArchivedTasksForModule(entries, moduleId)
          if (archivedCount > 0) {
            await restoreArchivedTasksForModule(readFile, writeFile, moduleId)
            setModuleRestoreNotice(`Restored ${archivedCount} archived task${archivedCount !== 1 ? 's' : ''} for ${moduleLabel}.`)
          } else {
            setModuleRestoreNotice(restoreNoticeForModule(moduleId, moduleLabel))
          }
        } catch {
          setModuleRestoreNotice(restoreNoticeForModule(moduleId, moduleLabel))
        }
        setTimeout(() => setModuleRestoreNotice(''), 3500)
      }
      return
    }
    if (MODULES_WITH_TASKS.has(moduleId)) {
      // Count active tasks — show dialog only if there are tasks to handle
      try {
        const entries = await readTasksIndex(readFile)
        const activeCount = countActiveTasksForModule(entries, moduleId)
        if (activeCount === 0) {
          await commitModuleToggle(moduleId, false)
          return
        }
        setPendingDisable({ id: moduleId, label: moduleLabel, taskCount: activeCount })
      } catch {
        setPendingDisable({ id: moduleId, label: moduleLabel, taskCount: 0 })
      }
      return
    }
    await commitModuleToggle(moduleId, false)
  }

  const handleModalCancel = () => setPendingDisable(null)

  const handleArchiveAndDisable = async () => {
    await archiveTasksForModule(readFile, writeFile, pendingDisable.id)
    await commitModuleToggle(pendingDisable.id, false)
    setPendingDisable(null)
  }

  const handleUnattachAndDisable = async () => {
    await unattachTasksForModule(readFile, writeFile, pendingDisable.id)
    await commitModuleToggle(pendingDisable.id, false)
    setPendingDisable(null)
  }

  return (
    <>
      {/* Module disable modal */}
      {pendingDisable && (
        <ModuleDisableModal
          moduleLabel={pendingDisable.label}
          taskCount={pendingDisable.taskCount ?? 0}
          onCancel={handleModalCancel}
          onArchive={handleArchiveAndDisable}
          onUnattach={handleUnattachAndDisable}
        />
      )}

      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── Left nav ───────────────────────────────────────────────── */}
        <nav style={{
          width: 220,
          flexShrink: 0,
          padding: '28px 14px',
          borderRight: '1px solid var(--border-subtle)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{ padding: '0 10px', marginBottom: 14, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-very-dim)' }}>
            Settings
          </div>
          {[
            { id: 'you',         label: 'You' },
            { id: 'ai',          label: 'AI Setup' },
            { id: 'vault',       label: 'Vault Maintenance' },
            { id: 'modules',     label: 'Modules' },
            { id: 'dashboard',   label: 'Dashboard' },
          ].map(({ id, label }) => {
            const active = activeSection === id
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: active ? 'var(--panel-2)' : 'transparent',
                  color: active ? 'var(--active)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 7,
                  fontSize: 13.5,
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background .12s, color .12s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--text)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; } }}
              >
                {label}
              </button>
            )
          })}
        </nav>

        {/* ── Content area ───────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 64px' }}>
          {/* ── You ───────────────────────────────────────────────── */}
          {activeSection === 'you' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
                You
              </h1>

              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text-dim)', maxWidth: 640 }}>
                Your identity is set during onboarding. YapAtMe uses it to route first-person actions to your file.
              </p>

              {form.writerFile ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  background: 'var(--panel-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'oklch(0.70 0.18 22 / 0.16)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17, fontWeight: 600, color: 'oklch(0.84 0.16 22)',
                  }}>
                    {form.writerFile.replace('people/', '').replace('.md', '').replace(/-/g, ' ').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {form.writerFile.replace('people/', '').replace('.md', '').replace(/-/g, ' ')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-very-dim)', marginTop: 1 }}>
                      {form.writerFile}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '14px 16px',
                  background: 'oklch(0.90 0.12 80 / 0.06)',
                  border: '1px solid oklch(0.90 0.12 80 / 0.20)',
                  borderRadius: 10,
                  fontSize: 13.5,
                  color: 'var(--text-dim)',
                  lineHeight: 1.5,
                }}>
                  No vault owner set. Re-run onboarding to set your identity.
                </div>
              )}
            </div>
          )}
          {/* ── AI Setup ─────────────────────────────────────────────── */}
          {activeSection === 'ai' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
                AI Setup
              </h1>

              <p style={{ margin: '0 0 28px', fontSize: 14, lineHeight: 1.55, color: 'var(--text-dim)', maxWidth: 640, textWrap: 'pretty' }}>
                Choose the model provider and credentials YapAtMe uses to process inbox notes, generate summaries, and route tasks.
              </p>

              <div className="space-y-2">
                <FieldLabel>Provider</FieldLabel>
                <StyledSelect
                  value={form.provider}
                  onChange={value => updateAiField({ provider: value })}
                  options={[
                    { value: 'openrouter', label: 'OpenRouter' },
                    { value: 'anthropic', label: 'Anthropic' },
                    { value: 'openai', label: 'OpenAI' },
                    { value: 'ollama', label: 'Ollama (local)' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>API Key</FieldLabel>
                <StyledInput
                  type="password"
                  value={form.apiKey}
                  onChange={value => updateAiField({ apiKey: value })}
                  placeholder="sk-or-…"
                  mono
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Model</FieldLabel>
                <StyledInput
                  type="text"
                  value={form.model}
                  onChange={value => updateAiField({ model: value })}
                  placeholder="meta-llama/llama-3.3-70b-instruct"
                  mono
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <PrimaryButton onClick={handleSave}>
                  {saved ? 'Saved ✓' : 'Save Settings'}
                </PrimaryButton>
                <SecondaryButton
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                >
                  {testingConnection ? 'Testing…' : 'Test API Connection'}
                </SecondaryButton>
                {connectionStatus === 'ok' && (
                  <span className="text-xs" style={{ color: 'var(--success)' }}>
                    Connected: {connectionMessage}
                  </span>
                )}
                {connectionStatus === 'error' && (
                  <span className="text-xs" style={{ color: 'var(--danger)' }}>
                    Failed: {connectionMessage}
                  </span>
                )}
              </div>

            </div>
          )}

          {/* ── Vault Maintenance ────────────────────────────────────── */}
          {activeSection === 'vault' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
                Vault Maintenance
              </h1>

              <ActionCard
                title="Reconnect vault"
                description="If the app loses access to your vault folder after a page reload, reload the page to reconnect."
              >
                <PrimaryButton onClick={() => window.location.reload()}>
                  Reconnect vault
                </PrimaryButton>
              </ActionCard>

              <ActionCard
                title="Rebuild context"
                description="Rebuilds context/_context.md from the current vault state. Run this if the context looks stale or after making manual edits to vault files."
              >
                <PrimaryButton
                  onClick={handleRebuildContext}
                  disabled={!settings?.apiKey}
                  loading={rebuilding}
                >
                  Rebuild context
                </PrimaryButton>
                {rebuildStatus === 'ok' && <span className="text-xs text-[var(--success)]">Context updated</span>}
                {rebuildStatus === 'error' && <span className="text-xs text-[var(--danger)]">Failed - check API key</span>}
              </ActionCard>

              <ActionCard
                title="Migrate entity tasks"
                description="Moves task checkboxes from project and people files into the central task index. Safe to run multiple times - existing tasks are not duplicated."
              >
                {migrateResult && (
                  <div
                    style={{
                      padding: '10px 14px',
                      marginBottom: 12,
                      background: 'oklch(0.74 0.14 165 / 0.10)',
                      border: '1px solid oklch(0.74 0.14 165 / 0.30)',
                      borderRadius: 6,
                      fontSize: 12.5,
                      color: 'var(--text-dim)',
                      lineHeight: 1.6,
                    }}
                  >
                    ✓ Done - {migrateResult.migrated} task{migrateResult.migrated !== 1 ? 's' : ''} migrated,
                    {' '}{migrateResult.skipped} already in index,
                    {' '}{migrateResult.filesUpdated} file{migrateResult.filesUpdated !== 1 ? 's' : ''} updated,
                    {' '}index: {migrateResult.indexCountBefore ?? 0}{' -> '}{migrateResult.indexCountAfter ?? 0}
                  </div>
                )}

                <SecondaryButton
                  onClick={async () => {
                    if (migrating) return
                    setMigrating(true)
                    setMigrateResult(null)
                    try {
                      const result = await migrateEntityTasks({ readFile, writeFile, listTree })
                      setMigrateResult(result)
                    } catch (err) {
                      console.error('Migration failed:', err.message)
                    } finally {
                      setMigrating(false)
                    }
                  }}
                  disabled={migrating}
                >
                  {migrating ? 'Migrating…' : 'Run migration'}
                </SecondaryButton>
              </ActionCard>

              <ActionCard
                title="Clean entity files"
                description="Removes legacy task and other non-schema sections from project and people files while keeping approved sections intact."
              >
                {cleanResult && (
                  <div
                    style={{
                      padding: '10px 14px',
                      marginBottom: 12,
                      background: 'oklch(0.74 0.14 165 / 0.10)',
                      border: '1px solid oklch(0.74 0.14 165 / 0.30)',
                      borderRadius: 6,
                      fontSize: 12.5,
                      color: 'var(--text-dim)',
                      lineHeight: 1.6,
                    }}
                  >
                    ✓ Done - {cleanResult.sectionsRemoved} section{cleanResult.sectionsRemoved !== 1 ? 's' : ''} removed,
                    {' '}{cleanResult.sectionsAdded} added,
                    {' '}{cleanResult.filesCleaned} file{cleanResult.filesCleaned !== 1 ? 's' : ''} updated
                  </div>
                )}

                <SecondaryButton
                  onClick={async () => {
                    if (cleaning) return
                    setCleaning(true)
                    setCleanResult(null)
                    try {
                      const result = await cleanEntityFiles({ readFile, writeFile, listTree })
                      setCleanResult(result)
                    } catch (err) {
                      console.error('Entity cleanup failed:', err.message)
                    } finally {
                      setCleaning(false)
                    }
                  }}
                  disabled={cleaning}
                  danger
                >
                  {cleaning ? 'Cleaning…' : 'Clean entity files'}
                </SecondaryButton>
              </ActionCard>

              <ActionCard
                title="Set up a new vault"
                description="Opens the onboarding flow so you can connect a different folder or start fresh. Your current vault files are not deleted."
              >
                <SecondaryButton
                  success
                  onClick={async () => {
                    await import('../lib/db').then(({ dbPut }) =>
                      dbPut('settings', 'onboardingComplete', false)
                    ).catch(() => {})
                    window.location.reload()
                  }}
                >
                  Start onboarding
                </SecondaryButton>
              </ActionCard>
            </div>
          )}

          {/* ── Modules ──────────────────────────────────────────────── */}
          {activeSection === 'modules' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
                Modules
              </h1>

              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Disable modules to hide their sections and exclude them from note routing.
                {' '}Disabling Projects or People will prompt you to migrate tasks first.
              </p>

              {moduleRestoreNotice && (
                <div
                  style={{
                    padding: '9px 12px',
                    background: 'oklch(0.74 0.14 165 / 0.10)',
                    border: '1px solid oklch(0.74 0.14 165 / 0.30)',
                    borderRadius: 7,
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    lineHeight: 1.5,
                  }}
                >
                  ✓ {moduleRestoreNotice}
                </div>
              )}

              <div className="space-y-2">
                {[
                  { id: 'projects', label: 'Projects' },
                  { id: 'people', label: 'People' },
                  { id: 'ideas', label: 'Ideas' },
                ].map((moduleDef) => {
                  const enabled = form.enabledModules?.[moduleDef.id] !== false
                  return (
                    <label
                      key={moduleDef.id}
                      className="flex items-center justify-between px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg-input)] cursor-pointer"
                      onClick={() => {
                        void handleModuleToggle(moduleDef.id, moduleDef.label, enabled)
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {moduleDef.label}
                        </span>
                        {MODULES_WITH_TASKS.has(moduleDef.id) && !enabled && (
                          <span style={{ fontSize: 11, color: 'var(--text-very-dim)' }}>
                            tasks hidden
                          </span>
                        )}
                      </div>
                      <SettingsCheckbox checked={enabled} />
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Dashboard ────────────────────────────────────────────── */}
          {activeSection === 'dashboard' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
                Dashboard
              </h1>

              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Choose which sections appear on your dashboard and in what order.
                Needs Your Call and Summary are always shown.
              </p>
              <DashboardSectionConfig
                value={form.dashboardSections}
                onChange={(next) => {
                  const nextForm = { ...form, dashboardSections: next }
                  setForm(nextForm)
                  saveSettings(nextForm)
                }}
              />
            </div>
          )}

        </div>
      </div>
    </>
  )
}
