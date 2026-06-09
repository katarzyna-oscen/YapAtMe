# Handover — Settings: Left Nav Layout

**File:** `src/core/SettingsPage.jsx`
**Scope:** Replace the `return` statement of `SettingsPage` only.
All state, hooks, handlers, and helper components (ModuleDisableModal,
DashboardSectionConfig, etc.) stay completely unchanged.

---

## What changes

The current single-column `max-w-xl mx-auto` layout becomes a two-column layout:
left nav (180px) + scrollable content area. A new `activeSection` state drives
which content panel is shown.

---

## Step 1 — Add `activeSection` state

Add one line alongside the existing `useState` declarations inside `SettingsPage`:

```js
const [activeSection, setActiveSection] = useState('ai')
```

---

## Step 2 — Replace the entire `return` statement

Find the `return (` at the start of the SettingsPage return and replace everything
from there to the closing `</>` with the following.

All section content (the JSX for AI Provider, Vault, Working Memory, Modules,
Dashboard, Vault Maintenance) is unchanged — it's just reorganised into four
conditional panels. Cut each section's JSX from its current location and paste it
into the matching panel below.

```jsx
  return (
    <>
      {/* Module disable modal — unchanged */}
      {pendingDisable && (
        <ModuleDisableModal
          moduleLabel={pendingDisable.label}
          onCancel={handleModalCancel}
          onDisable={handleModalDisable}
          onMigrateAndDisable={handleMigrateAndDisable}
        />
      )}

      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── Left nav ───────────────────────────────────────────────── */}
        <nav style={{
          width: 200,
          flexShrink: 0,
          padding: '32px 0 32px',
          borderRight: '1px solid var(--border-subtle)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{ padding: '0 20px 16px', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-very-dim)' }}>
            Settings
          </div>
          {[
            { id: 'ai',          label: 'AI Setup'          },
            { id: 'vault',       label: 'Vault Maintenance'  },
            { id: 'modules',     label: 'Modules'            },
            { id: 'dashboard',   label: 'Dashboard'          },
          ].map(({ id, label }) => {
            const active = activeSection === id
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 20px',
                  background: active ? 'var(--panel-2)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background .12s, color .12s',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--panel)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Active indicator bar */}
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 2, borderRadius: 1,
                    background: 'var(--accent)',
                  }} />
                )}
                {label}
              </button>
            )
          })}
        </nav>

        {/* ── Content area ───────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 64px' }}>

          {/* ── AI Setup ─────────────────────────────────────────────── */}
          {activeSection === 'ai' && (
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                AI Setup
              </h1>

              {/* PASTE the existing "AI Provider" section content here.
                  That is: the provider <select>, API key <input>,
                  model <input>, Save button, and test connection button.
                  Remove the outer <section> and <h2> wrapper — the h1 above replaces them. */}
            </div>
          )}

          {/* ── Vault Maintenance ────────────────────────────────────── */}
          {activeSection === 'vault' && (
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                Vault Maintenance
              </h1>

              {/* PASTE the existing "Vault" section content here (Reconnect Vault button + description).
                  Remove the outer <section> and <h2> wrapper. */}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 0 }} />

              {/* PASTE the existing "Working Memory" section content here (Rebuild Context button).
                  Remove the outer <section> and <h2> wrapper. */}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 0 }} />

              {/* PASTE the existing "Vault maintenance" section content here
                  (Migrate entity tasks card + Clean entity files card).
                  Remove the outer <section> and <h2> wrapper. */}
            </div>
          )}

          {/* ── Modules ──────────────────────────────────────────────── */}
          {activeSection === 'modules' && (
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                Modules
              </h1>

              {/* PASTE the existing "Modules" section content here
                  (description text + Projects/People/Ideas checkboxes + restore notice).
                  Remove the outer <section> and <h2> wrapper. */}
            </div>
          )}

          {/* ── Dashboard ────────────────────────────────────────────── */}
          {activeSection === 'dashboard' && (
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                Dashboard
              </h1>

              {/* PASTE the existing "Dashboard" section content here
                  (description text + DashboardSectionConfig component).
                  Remove the outer <section> and <h2> wrapper. */}
            </div>
          )}

        </div>
      </div>
    </>
  )
```

---

## Section content mapping

Tell Copilot exactly which existing sections go into which panel:

| Panel | Existing sections to move in |
|---|---|
| `ai` | "AI Provider" (provider select, API key, model, save, test connection) |
| `vault` | "Vault" + "Working Memory" + "Vault maintenance" |
| `modules` | "Modules" |
| `dashboard` | "Dashboard" |

Remove each existing section's `<section>` wrapper and `<h2>` heading when moving —
the panel `<h1>` replaces them. Keep all inner JSX (inputs, buttons, labels) intact.

---

## Do NOT touch

- Any `useState`, `useEffect`, `useCallback` declarations
- `ModuleDisableModal` component
- `DashboardSectionConfig` component
- All handler functions (handleSave, handleRebuildContext, handleModuleToggle, etc.)
- All other imports at the top of the file

---

## Validation checklist

- [ ] Settings opens showing "AI Setup" panel by default
- [ ] Clicking each nav item switches the content area — no page reload
- [ ] Active nav item has accent bar on left edge and bold label
- [ ] AI Setup: provider, API key, model, save all work
- [ ] Vault Maintenance: reconnect, rebuild context, migrate, clean all work
- [ ] Modules: Projects/People/Ideas toggles work; migration modal still triggers on disable
- [ ] Dashboard: section config drag/toggle works
- [ ] Layout left-aligns like other screens (no centered max-width card)
- [ ] `bun run build` passes
