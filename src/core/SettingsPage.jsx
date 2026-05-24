import { useEffect, useState } from 'react'
import { rebuildContext } from '../lib/rebuildContext'
import { migrateEntityTasks } from '../lib/migrateEntityTasks'
import { cleanEntityFiles } from '../lib/cleanEntityFiles'
import { callLLM, PROVIDERS } from '../lib/llm'

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

function ModuleDisableModal({ moduleLabel, onCancel, onDisable, onMigrateAndDisable }) {
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState(null)
  const [migrateError, setMigrateError] = useState(false)

  const handleMigrateAndDisable = async () => {
    setMigrating(true)
    setMigrateResult(null)
    setMigrateError(false)
    try {
      const result = await onMigrateAndDisable()
      setMigrateResult(result)
    } catch {
      setMigrateError(true)
      setMigrating(false)
      return
    }
    setMigrating(false)
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Disable {moduleLabel}?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            The <strong style={{ color: 'var(--text-secondary)' }}>{moduleLabel}</strong> module
            contains task checkboxes (actions, delegations, decisions). Disabling it will hide
            those sections from the dashboard. The data stays on disk, but tasks won't appear
            until the module is re-enabled.
          </div>
        </div>

        <div
          style={{
            padding: '14px 16px',
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Migrate entity tasks to index
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 12 }}>
            Moves task checkboxes from {moduleLabel.toLowerCase()} files into the central task
            index before disabling. Safe to run multiple times - existing tasks are not duplicated.
          </div>

          {migrateResult && !migrateError && (
            <div
              style={{
                padding: '8px 12px',
                marginBottom: 10,
                background: 'oklch(0.74 0.14 165 / 0.10)',
                border: '1px solid oklch(0.74 0.14 165 / 0.30)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--text-dim)',
                lineHeight: 1.6,
              }}
            >
              ✓ Done - {migrateResult.migrated} task{migrateResult.migrated !== 1 ? 's' : ''} migrated,{' '}
              {migrateResult.skipped} already in index,{' '}
              {migrateResult.filesUpdated} file{migrateResult.filesUpdated !== 1 ? 's' : ''} updated,
              {' '}index: {migrateResult.indexCountBefore ?? 0}{' -> '}{migrateResult.indexCountAfter ?? 0}
            </div>
          )}

          {migrateError && (
            <div
              style={{
                padding: '8px 12px',
                marginBottom: 10,
                background: 'oklch(0.65 0.2 25 / 0.10)',
                border: '1px solid oklch(0.65 0.2 25 / 0.30)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--danger)',
              }}
            >
              Migration failed. Check the console for details.
            </div>
          )}

          <button
            onClick={handleMigrateAndDisable}
            disabled={migrating || !!migrateResult}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: migrateResult ? 'oklch(0.74 0.14 165 / 0.12)' : 'var(--accent)',
              color: migrateResult ? 'oklch(0.74 0.14 165)' : '#fff',
              border: 'none',
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: migrating || !!migrateResult ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: migrating ? 0.6 : 1,
              transition: 'opacity .12s',
            }}
          >
            {migrating
              ? 'Migrating…'
              : migrateResult
                ? 'Migration complete - closing…'
                : 'Migrate & Disable'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={migrating}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              opacity: migrating ? 0.4 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDisable}
            disabled={migrating}
            style={{
              padding: '8px 16px',
              background: 'var(--panel-2)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 13,
              cursor: migrating ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: migrating ? 0.4 : 1,
            }}
          >
            Disable without migrating
          </button>
        </div>
      </div>
    </div>
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
            <input
              type="checkbox"
              checked={visible}
              onChange={() => toggleVisible(id)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
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

  useEffect(() => {
    setForm({
      apiKey: settings.apiKey || '',
      model: settings.model || 'meta-llama/llama-3.3-70b-instruct',
      provider: settings.provider || 'openrouter',
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
      await rebuildContext(readFile, writeFile, settings)
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
      await commitModuleToggle(moduleId, true)
      if (MODULES_WITH_TASKS.has(moduleId)) {
        setModuleRestoreNotice(restoreNoticeForModule(moduleId, moduleLabel))
        setTimeout(() => setModuleRestoreNotice(''), 2400)
      }
      return
    }
    if (MODULES_WITH_TASKS.has(moduleId)) {
      setPendingDisable({ id: moduleId, label: moduleLabel })
      return
    }
    await commitModuleToggle(moduleId, false)
  }

  const handleModalCancel = () => setPendingDisable(null)

  const handleModalDisable = async () => {
    await commitModuleToggle(pendingDisable.id, false)
    setPendingDisable(null)
  }

  const handleMigrateAndDisable = async () => {
    const result = await migrateEntityTasks({ readFile, writeFile, listTree })
    await commitModuleToggle(pendingDisable.id, false)
    setMigrateResult(result)
    setTimeout(() => setPendingDisable(null), 1500)
    return result
  }

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <>
      {pendingDisable && (
        <ModuleDisableModal
          moduleLabel={pendingDisable.label}
          onCancel={handleModalCancel}
          onDisable={handleModalDisable}
          onMigrateAndDisable={handleMigrateAndDisable}
        />
      )}

      <div className="max-w-xl mx-auto p-8 space-y-8">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Settings
      </h1>

      {/* AI Provider */}
      <section className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          AI Provider
        </h2>

        <div className="space-y-2">
          <label className="text-sm block" style={{ color: 'var(--text-secondary)' }}>
            Provider
          </label>
          <select
            value={form.provider}
            onChange={e => updateAiField({ provider: e.target.value })}
            className="w-full px-3 py-2 rounded text-sm"
            style={inputStyle}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm block" style={{ color: 'var(--text-secondary)' }}>
            API Key
          </label>
          <input
            type="password"
            value={form.apiKey}
            onChange={e => updateAiField({ apiKey: e.target.value })}
            placeholder="sk-or-…"
            className="w-full px-3 py-2 rounded text-sm font-mono"
            style={inputStyle}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm block" style={{ color: 'var(--text-secondary)' }}>
            Model
          </label>
          <input
            type="text"
            value={form.model}
            onChange={e => updateAiField({ model: e.target.value })}
            placeholder="meta-llama/llama-3.3-70b-instruct"
            className="w-full px-3 py-2 rounded text-sm font-mono"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            {saved ? 'Saved ✓' : 'Save Settings'}
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="px-4 py-2 rounded text-sm transition-colors"
            style={{
              border: '1px solid var(--border)',
              color: testingConnection ? 'var(--text-muted)' : 'var(--text-secondary)',
            }}
          >
            {testingConnection ? 'Testing…' : 'Test API Connection'}
          </button>
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
      </section>

      {/* Vault */}
      <section className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Vault
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          If the app loses access to your vault folder after a page reload,
          reload the page to reconnect.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded text-sm transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          Reconnect Vault
        </button>
      </section>

      <section className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Working Memory
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Rebuilds <span className="font-mono">context/_context.md</span> from the current vault state.
          Run this if the context looks stale or after making manual edits to vault files.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRebuildContext}
            disabled={rebuilding || !settings?.apiKey}
            className="px-4 py-2 bg-[var(--panel-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
          >
            {rebuilding ? 'Rebuilding…' : 'Rebuild Context'}
          </button>
          {rebuildStatus === 'ok' && <span className="text-xs text-[var(--success)]">Context updated</span>}
          {rebuildStatus === 'error' && <span className="text-xs text-[var(--danger)]">Failed - check API key</span>}
        </div>
      </section>

      <section className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Modules
        </h2>
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
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => {
                    void handleModuleToggle(moduleDef.id, moduleDef.label, enabled)
                  }}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </label>
            )
          })}
        </div>
      </section>

      {/* ── Dashboard ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Dashboard
        </h2>
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
      </section>

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-very-dim)',
            margin: '0 0 12px',
          }}
        >
          Vault maintenance
        </h2>

        <div
          style={{
            padding: '16px 18px',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
            Migrate entity tasks to index
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5 }}>
            Moves task checkboxes from project and people files into the central task index.
            Safe to run multiple times - existing tasks are not duplicated.
          </div>

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

          <button
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'var(--panel-2)',
              color: migrating ? 'var(--text-very-dim)' : 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 13,
              cursor: migrating ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={(e) => {
              if (!migrating) {
                e.currentTarget.style.background = 'var(--panel-pop)'
                e.currentTarget.style.color = 'var(--text)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--panel-2)'
              e.currentTarget.style.color = migrating ? 'var(--text-very-dim)' : 'var(--text-dim)'
            }}
          >
            {migrating ? 'Migrating…' : 'Run migration'}
          </button>
        </div>

        <div
          style={{
            padding: '16px 18px',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
            Clean entity files
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.5 }}>
            Removes legacy task and other non-schema sections from project and people files while keeping approved sections intact.
          </div>

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

          <button
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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'var(--panel-2)',
              color: cleaning ? 'var(--text-very-dim)' : 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 13,
              cursor: cleaning ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={(e) => {
              if (!cleaning) {
                e.currentTarget.style.background = 'var(--panel-pop)'
                e.currentTarget.style.color = 'var(--text)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--panel-2)'
              e.currentTarget.style.color = cleaning ? 'var(--text-very-dim)' : 'var(--text-dim)'
            }}
          >
            {cleaning ? 'Cleaning…' : 'Clean entity files'}
          </button>
        </div>
      </section>
      </div>
    </>
  )
}
