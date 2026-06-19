// Settings view — secondary nav on the left, panel content on the right.
//
// Subcategories: ai-setup · vault-maintenance · modules · dashboard
//
// Visual chrome mirrors the rest of the app: h1 title, light intro paragraph,
// then card blocks with a small section heading + body.

const SETTINGS_NAV = [
  { id: "personalize",       label: "Personalize" },
  { id: "ai-setup",          label: "AI Setup" },
  { id: "vault-maintenance", label: "Vault Maintenance" },
  { id: "modules",           label: "Modules" },
  { id: "dashboard",         label: "Dashboard" },
];

function SettingsView({ view, onNavigate, settings, setSettings }) {
  const sub = view.sub || "personalize";

  return (
    <div data-screen-label="Settings" style={{ display: "flex", minHeight: "100%" }}>
      {/* Secondary nav */}
      <aside style={{
        flex: "0 0 220px",
        width: 220,
        borderRight: "1px solid var(--border-subtle)",
        padding: "28px 14px",
      }}>
        <div style={{
          fontSize: 11,
          letterSpacing: "0.16em",
          fontWeight: 600,
          color: "var(--text-very-dim)",
          textTransform: "uppercase",
          padding: "0 10px",
          marginBottom: 14,
        }}>Settings</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SETTINGS_NAV.map((it) => {
            const active = sub === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onNavigate({ type: "settings", sub: it.id })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  textAlign: "left",
                  color: active ? "var(--active)" : "var(--text-dim)",
                  background: active ? "var(--panel-2)" : "transparent",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 13.5,
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background .12s, color .12s",
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--panel-2)"; e.currentTarget.style.color = "var(--text)"; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; } }}
              >
                {it.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Panel content */}
      <main style={{ flex: 1, minWidth: 0, padding: "32px 48px 64px", maxWidth: 880 }}>
        {sub === "personalize"       && <PersonalizePanel       settings={settings} setSettings={setSettings} />}
        {sub === "ai-setup"          && <AiSetupPanel          settings={settings} setSettings={setSettings} />}
        {sub === "vault-maintenance" && <VaultMaintenancePanel />}
        {sub === "modules"           && <ModulesPanel           settings={settings} setSettings={setSettings} />}
        {sub === "dashboard"         && <DashboardSettingsPanel settings={settings} setSettings={setSettings} />}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Reusable chrome
// ────────────────────────────────────────────────────────────
function SettingsTitle({ children }) {
  return (
    <h1 style={{
      fontSize: 26,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      margin: "0 0 12px",
      color: "var(--text)",
    }}>{children}</h1>
  );
}

function SettingsIntro({ children }) {
  return (
    <p style={{
      margin: "0 0 28px",
      fontSize: 14,
      lineHeight: 1.55,
      color: "var(--text-dim)",
      textWrap: "pretty",
      maxWidth: 640,
    }}>{children}</p>
  );
}

function FieldLabel({ children }) {
  return (
    <label style={{
      display: "block",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.04em",
      color: "var(--text-dim)",
      marginBottom: 8,
    }}>{children}</label>
  );
}

function fieldInputBase() {
  return {
    width: "100%",
    padding: "10px 12px",
    background: "var(--panel)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13.5,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color .12s",
  };
}

function TextField({ value, onChange, type = "text", placeholder, mono }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        ...fieldInputBase(),
        borderColor: focus ? "var(--accent)" : "var(--border)",
        fontVariantNumeric: mono ? "tabular-nums" : "normal",
      }}
    />
  );
}

function SelectField({ value, onChange, options }) {
  // Custom dropdown to match the StatusPill / CategorySelect chrome.
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const current = options.find((o) => o.value === value) || options[0];

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...fieldInputBase(),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: "pointer",
          borderColor: open ? "var(--border-strong)" : "var(--border)",
          textAlign: "left",
        }}
      >
        <span>{current.label}</span>
        <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor" style={{
          opacity: 0.55,
          color: "var(--text-dim)",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform .15s",
          flex: "0 0 10px",
        }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          zIndex: 50,
          padding: 4,
          background: "var(--panel-pop)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)",
        }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  color: active ? "var(--text)" : "var(--text-dim)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ flex: 1 }}>{o.label}</span>
                {active && <span style={{ color: "var(--text-very-dim)" }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, type = "button" }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "9px 16px",
        background: hov ? "oklch(0.80 0.13 80 / 0.32)" : "oklch(0.80 0.13 80 / 0.22)",
        color: "oklch(0.92 0.13 80)",
        border: `1px solid ${hov ? "oklch(0.80 0.13 80 / 0.65)" : "oklch(0.80 0.13 80 / 0.45)"}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s",
      }}
    >{children}</button>
  );
}

function SecondaryButton({ children, onClick, danger }) {
  const [hov, setHov] = React.useState(false);
  const hue = danger ? 22 : null;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "9px 16px",
        background: danger
          ? (hov ? "oklch(0.70 0.18 22 / 0.16)" : "transparent")
          : (hov ? "var(--panel-2)" : "var(--panel)"),
        color: danger
          ? (hov ? "oklch(0.88 0.16 22)" : "oklch(0.78 0.16 22)")
          : (hov ? "var(--text)" : "var(--text-dim)"),
        border: `1px solid ${
          danger
            ? (hov ? "oklch(0.70 0.18 22 / 0.55)" : "oklch(0.70 0.18 22 / 0.30)")
            : (hov ? "var(--border-strong)" : "var(--border)")
        }`,
        borderRadius: 8,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s, color .15s",
      }}
    >{children}</button>
  );
}

// Card with a heading, optional explanation, and an action button(s).
function ActionCard({ title, description, children, footnote }) {
  return (
    <div style={{
      padding: "18px 20px",
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      marginBottom: 14,
    }}>
      <h3 style={{
        margin: "0 0 6px",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text)",
        letterSpacing: "-0.005em",
      }}>{title}</h3>
      {description && (
        <p style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-dim)",
          textWrap: "pretty",
        }}>{description}</p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {children}
      </div>
      {footnote && (
        <div style={{
          marginTop: 12,
          fontSize: 11.5,
          color: "var(--text-very-dim)",
        }}>{footnote}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Personalize — who Memory OS treats as "you"
// ────────────────────────────────────────────────────────────
function PersonalizePanel({ settings, setSettings }) {
  const currentId = settings.identity || "katarzyna";
  const person = MEM_PEOPLE.find((p) => p.id === currentId) || MEM_PEOPLE[0];
  const firstName = (person.name || "").split(" ")[0];
  const options = MEM_PEOPLE.map((p) => ({ value: p.id, label: (p.name || "").split(" ")[0] }));

  return (
    <div>
      <SettingsTitle>You</SettingsTitle>
      <SettingsIntro>
        Tell Memory OS who you are so it can route first-person actions to your file
        and personalise note processing.
      </SettingsIntro>

      {/* Identity card */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "20px 22px",
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        maxWidth: 640,
        marginBottom: 28,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {firstName}
          </div>
          <div style={{
            fontSize: 13,
            color: "var(--text-very-dim)",
            marginTop: 5,
            fontFamily: "var(--font-mono)",
          }}>people/{firstName}.md</div>
        </div>
      </div>

      {/* Change identity */}
      <div style={{ maxWidth: 640 }}>
        <div style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 10,
        }}>Change identity</div>
        <SelectField
          value={currentId}
          onChange={(v) => setSettings({ ...settings, identity: v })}
          options={options}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  AI Setup
// ────────────────────────────────────────────────────────────
function AiSetupPanel({ settings, setSettings }) {
  const [toast, setToast] = React.useState(null);
  const update = (patch) => setSettings({ ...settings, ai: { ...settings.ai, ...patch } });
  const saveSettings = () => {
    setToast("Settings saved");
    setTimeout(() => setToast(null), 2000);
  };
  const testConnection = () => {
    setToast("Connection OK · 142ms");
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div>
      <SettingsTitle>AI Setup</SettingsTitle>
      <SettingsIntro>
        Choose the model provider and credentials Memory OS uses to process inbox notes,
        generate summaries, and route tasks.
      </SettingsIntro>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 560 }}>
        <div>
          <FieldLabel>Provider</FieldLabel>
          <SelectField
            value={settings.ai.provider}
            onChange={(v) => update({ provider: v })}
            options={[
              { value: "openrouter", label: "OpenRouter" },
              { value: "anthropic",  label: "Anthropic" },
              { value: "openai",     label: "OpenAI" },
              { value: "ollama",     label: "Ollama (local)" },
            ]}
          />
        </div>
        <div>
          <FieldLabel>API Key</FieldLabel>
          <TextField
            type="password"
            value={settings.ai.apiKey}
            onChange={(v) => update({ apiKey: v })}
            placeholder="sk-or-•••"
          />
        </div>
        <div>
          <FieldLabel>Model</FieldLabel>
          <TextField
            value={settings.ai.model}
            onChange={(v) => update({ model: v })}
            placeholder="anthropic/claude-haiku-4.5"
            mono
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <PrimaryButton onClick={saveSettings}>Save Settings</PrimaryButton>
          <SecondaryButton onClick={testConnection}>Test API Connection</SecondaryButton>
          {toast && (
            <span style={{
              alignSelf: "center",
              fontSize: 12.5,
              color: "var(--success)",
              marginLeft: 8,
            }}>{toast}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Vault Maintenance
// ────────────────────────────────────────────────────────────
function VaultMaintenancePanel() {
  return (
    <div>
      <SettingsTitle>Vault Maintenance</SettingsTitle>
      <SettingsIntro>
        Diagnostic and one-off operations for keeping your vault in good shape.
        Most of these are safe to run repeatedly.
      </SettingsIntro>

      <ActionCard
        title="Reconnect vault"
        description="If the app loses access to your vault folder after a page reload, reconnect to grant permission again."
      >
        <PrimaryButton>Reconnect vault</PrimaryButton>
      </ActionCard>

      <ActionCard
        title="Rebuild context"
        description="Rebuilds context/_context.md from the current vault state. Run this if the context looks stale or after making manual edits to vault files."
        footnote="Last rebuilt today at 09:12"
      >
        <PrimaryButton>Rebuild context</PrimaryButton>
      </ActionCard>

      <ActionCard
        title="Migrate entity tasks to index"
        description="Moves task checkboxes from project and people files into the central task index. Safe to run multiple times — existing tasks are not duplicated."
      >
        <SecondaryButton>Run migration</SecondaryButton>
      </ActionCard>

      <ActionCard
        title="Clean entity files"
        description="Removes legacy task and other non-schema sections from project and people files while keeping approved sections intact."
      >
        <SecondaryButton danger>Clean entity files</SecondaryButton>
      </ActionCard>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Modules
// ────────────────────────────────────────────────────────────
const MODULES = [
  { id: "projects", label: "Projects" },
  { id: "people",   label: "People" },
  { id: "ideas",    label: "Ideas" },
];

function ModulesPanel({ settings, setSettings }) {
  const toggle = (id) => setSettings({
    ...settings,
    modules: { ...settings.modules, [id]: !settings.modules[id] },
  });

  return (
    <div>
      <SettingsTitle>Modules</SettingsTitle>
      <SettingsIntro>
        Disable modules to hide their sections and exclude them from note routing.
        Disabling Projects or People will prompt you to migrate tasks first.
      </SettingsIntro>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
        {MODULES.map((m) => (
          <ToggleRow
            key={m.id}
            label={m.label}
            checked={!!settings.modules[m.id]}
            onToggle={() => toggle(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onToggle, dragHandlers, dragging }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      {...(dragHandlers || {})}
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: hov ? "var(--panel-2)" : "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: dragHandlers ? "grab" : "pointer",
        opacity: dragging ? 0.4 : 1,
        transition: "background .12s",
        userSelect: "none",
      }}
    >
      {dragHandlers && (
        <span style={{ color: "var(--text-very-dim)", display: "inline-flex" }}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <circle cx="6" cy="4" r="1" /><circle cx="10" cy="4" r="1" />
            <circle cx="6" cy="8" r="1" /><circle cx="10" cy="8" r="1" />
            <circle cx="6" cy="12" r="1" /><circle cx="10" cy="12" r="1" />
          </svg>
        </span>
      )}
      <span style={{ flex: 1, fontSize: 13.5, color: "var(--text)" }}>{label}</span>
      <SettingsCheckbox checked={checked} />
    </div>
  );
}

function SettingsCheckbox({ checked }) {
  return (
    <span style={{
      width: 18, height: 18,
      borderRadius: 4,
      border: "1.5px solid",
      borderColor: checked ? "var(--accent)" : "var(--border-strong)",
      background: checked ? "var(--accent)" : "transparent",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#1a1408",
    }}>
      {checked && (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="m3 8 3.5 3.5L13 5" />
        </svg>
      )}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
//  Dashboard layout settings — drag-reorder + visibility toggles
// ────────────────────────────────────────────────────────────
function DashboardSettingsPanel({ settings, setSettings }) {
  const items = settings.dashboard.sections;
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);

  const setItems = (next) => setSettings({
    ...settings,
    dashboard: { ...settings.dashboard, sections: next },
  });

  const handlers = (id) => ({
    draggable: true,
    onDragStart: (e) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", id); } catch (_) {} },
    onDragEnter: (e) => { e.preventDefault(); if (id !== dragId) setOverId(id); },
    onDragOver:  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
    onDrop: (e) => {
      e.preventDefault();
      if (!dragId || dragId === id) return;
      const from = items.findIndex((x) => x.id === dragId);
      const to   = items.findIndex((x) => x.id === id);
      if (from < 0 || to < 0) return;
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setItems(next);
      setDragId(null); setOverId(null);
    },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  });

  const toggle = (id) => {
    const next = items.map((x) => x.id === id ? { ...x, visible: !x.visible } : x);
    setItems(next);
  };

  return (
    <div>
      <SettingsTitle>Dashboard</SettingsTitle>
      <SettingsIntro>
        Choose which sections appear on your dashboard and in what order.
        Needs Your Call and Summaries are always shown.
      </SettingsIntro>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
        {items.map((it) => {
          const isOver = overId === it.id;
          const lockedRow = it.locked;
          return (
            <div
              key={it.id}
              style={{
                borderTop: isOver ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              <ToggleRow
                label={it.label}
                checked={!!it.visible}
                onToggle={lockedRow ? () => {} : () => toggle(it.id)}
                dragHandlers={handlers(it.id)}
                dragging={dragId === it.id}
              />
            </div>
          );
        })}
      </div>
      <p style={{
        margin: "16px 2px 0",
        fontSize: 12,
        color: "var(--text-very-dim)",
      }}>Drag to reorder · uncheck to hide</p>
    </div>
  );
}

// Default settings shape — mirrors the screenshot's content.
const DEFAULT_SETTINGS = {
  identity: "katarzyna",
  ai: {
    provider: "openrouter",
    apiKey:   "sk-or-vBYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    model:    "anthropic/claude-haiku-4.5",
  },
  modules: {
    projects: true,
    people:   true,
    ideas:    false,
  },
  dashboard: {
    sections: [
      { id: "needs-call", label: "Needs Your Call", visible: true, locked: true },
      { id: "summaries",  label: "Summaries",       visible: true, locked: true },
      { id: "projects",   label: "Projects",        visible: true },
      { id: "people",     label: "People",          visible: true },
      { id: "ideas",      label: "Ideas",           visible: true },
      { id: "tasks",      label: "Tasks",           visible: false },
    ],
  },
};

Object.assign(window, { SettingsView, DEFAULT_SETTINGS });
