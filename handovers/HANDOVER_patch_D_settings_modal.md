# Handover — Patch D: Module Disable Modal
**File to patch:** `src/core/SettingsPage.jsx`
**Dependencies (no changes needed):** `src/lib/migrateEntityTasks.js`, `src/lib/tasksIndex.js`

---

## What to build

When a user unchecks **Projects** or **People** in the Modules section, intercept the toggle and show a confirmation modal instead of saving immediately. The modal warns that task data will be hidden and offers to run the migration first.

`Ideas` has no task sections — it toggles immediately with no modal.

---

## Step 1 — Add a constant after the DEFAULT_ENABLED_MODULES declaration

```js
// Modules that own task data — disabling these triggers the migration modal.
// Mirrors FOLDER_TASK_SECTIONS keys in migrateEntityTasks.js.
const MODULES_WITH_TASKS = new Set(['projects', 'people'])
```

---

## Step 2 — Add modal state to the SettingsPage component

Add alongside the existing `useState` declarations:

```js
// Modal state: null when closed, { id: string, label: string } when open
const [pendingDisable, setPendingDisable] = useState(null)
```

---

## Step 3 — Add a commitModuleToggle helper

Replace the inline save logic in the checkbox onChange with a shared helper:

```js
const commitModuleToggle = async (moduleId, enabled) => {
  const nextEnabledModules = {
    ...(form.enabledModules || DEFAULT_ENABLED_MODULES),
    [moduleId]: enabled,
  }
  const nextForm = { ...form, enabledModules: nextEnabledModules }
  setForm(nextForm)
  await saveSettings(nextForm)
}
```

---

## Step 4 — Replace the checkbox onChange with handleModuleToggle

```js
const handleModuleToggle = (moduleId, moduleLabel, currentlyEnabled) => {
  // Enabling always proceeds immediately — no modal needed
  if (!currentlyEnabled) {
    commitModuleToggle(moduleId, true)
    return
  }
  // Disabling a task-owning module → show modal
  if (MODULES_WITH_TASKS.has(moduleId)) {
    setPendingDisable({ id: moduleId, label: moduleLabel })
    return
  }
  // Disabling ideas or any future task-free module → immediate
  commitModuleToggle(moduleId, false)
}
```

Add three modal action handlers:

```js
const handleModalCancel = () => setPendingDisable(null)

const handleModalDisable = async () => {
  await commitModuleToggle(pendingDisable.id, false)
  setPendingDisable(null)
}

// Runs migration then disables. Returns summary so modal can display it.
const handleMigrateAndDisable = async () => {
  const result = await migrateEntityTasks({ readFile, writeFile, listTree })
  await commitModuleToggle(pendingDisable.id, false)
  setTimeout(() => setPendingDisable(null), 1500) // brief pause to show result
  return result
}
```

---

## Step 5 — Update the module checkbox rows

Change the existing map over modules to pass id, label, and enabled state
into the new handler:

```jsx
{[
  { id: 'projects', label: 'Projects' },
  { id: 'people',   label: 'People'   },
  { id: 'ideas',    label: 'Ideas'    },
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
        onChange={() => handleModuleToggle(moduleDef.id, moduleDef.label, enabled)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
    </label>
  )
})}
```

Also update the helper text in the Modules section to:
```
Disable modules to hide their sections and exclude them from note routing.
Disabling Projects or People will prompt you to migrate tasks first.
```

---

## Step 6 — Add the ModuleDisableModal component

Add this as a module-level component above `export default function SettingsPage`:

```jsx
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
    // Backdrop — click outside to cancel
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
        {/* Header */}
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

        {/* Migration card */}
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
            index before disabling. Safe to run multiple times — existing tasks are not duplicated.
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
              ✓ Done — {migrateResult.migrated} task{migrateResult.migrated !== 1 ? 's' : ''} migrated,{' '}
              {migrateResult.skipped} already in index,{' '}
              {migrateResult.filesUpdated} file{migrateResult.filesUpdated !== 1 ? 's' : ''} updated
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
              ? 'Migration complete — closing…'
              : 'Migrate & Disable'}
          </button>
        </div>

        {/* Footer actions */}
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
```

---

## Step 7 — Mount the modal in the SettingsPage return

Wrap the existing return in a fragment and mount the modal above the page div:

```jsx
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
      {/* ... rest of existing page unchanged ... */}
    </div>
  </>
)
```

---

## Validation checklist

- [ ] Unchecking Projects → modal appears
- [ ] Unchecking People → modal appears  
- [ ] Unchecking Ideas → toggles immediately, no modal
- [ ] Re-checking any module → no modal, immediate
- [ ] Modal: Cancel → checkbox stays checked, no save
- [ ] Modal: Disable without migrating → module disabled, modal closes
- [ ] Modal: Migrate & Disable → migration runs, result summary shows, module disabled, modal closes after ~1.5s
- [ ] Modal: click backdrop → same as Cancel
- [ ] "tasks hidden" label appears next to disabled task-module names
- [ ] `bun run build` passes

---

## No changes needed to

- `src/lib/migrateEntityTasks.js` — already correct
- `src/lib/tasksIndex.js` — already correct
- `src/App.jsx` — already passes `listTree` to SettingsPage from Patch A
