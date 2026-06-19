// Onboarding screens 1–7 + inline folder validation + API-key validation.
// Each screen is a presentational component driven by `s` (flow state) and
// `act` (action handlers) provided by onboarding-app.jsx.

// ════════════════════════════════════════════════════════════
//  Screen 1 — Welcome / Path selection
// ════════════════════════════════════════════════════════════
function PathCard({ icon, title, body, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, textAlign: "left", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 12,
        padding: "20px 20px 18px",
        background: hov ? "var(--panel-2)" : "var(--panel)",
        border: `1px solid ${hov ? "oklch(0.80 0.13 80 / 0.55)" : "var(--border)"}`,
        borderRadius: 13,
        transform: hov ? "translateY(-2px)" : "none",
        transition: "background .15s, border-color .15s, transform .15s",
      }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: hov ? "oklch(0.80 0.13 80 / 0.18)" : "var(--panel-2)", color: hov ? "var(--accent)" : "var(--text-dim)", border: "1px solid var(--border)", transition: "background .15s, color .15s" }}>
        <OnbIcon name={icon} size={18} />
      </span>
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1.25 }}>{title}</span>
          <span style={{ color: hov ? "var(--accent)" : "var(--text-very-dim)", display: "inline-flex", transition: "color .15s, transform .15s", transform: hov ? "translateX(2px)" : "none", marginTop: 3, flex: "0 0 auto" }}>
            <OnbIcon name="arrow" size={15} />
          </span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--text-dim)", textWrap: "pretty" }}>{body}</p>
      </div>
    </button>
  );
}

function WelcomeScreen({ act }) {
  return (
    <div>
      <ScreenHeading title="Less chaos. Minimal setup.">
        YapAtMe keeps track of what matters to you — context, tasks, projects, people, ideas — so you don't have to.
        Just write or speak what's on your mind. It does the rest.
      </ScreenHeading>

      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <PathCard
          icon="idea"
          title="New to YapAtMe"
          body="Start with a guided setup. We'll walk you through the basics and help you add your first people and projects."
          onClick={() => act.choosePath("new")}
        />
        <PathCard
          icon="arrow"
          title="I know what I'm doing"
          body="Skip the guidance. Blank vault, ready immediately."
          onClick={() => act.choosePath("pro")}
        />
      </div>

      <Notice tone="amber" icon="warn">
        YapAtMe requires an AI API key to process notes. You'll set this up in the next steps.
      </Notice>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Screen 2 — Who are you?
// ════════════════════════════════════════════════════════════
function NameScreen({ s, act }) {
  const ready = s.name.trim().length > 0;
  return (
    <div>
      <ScreenHeading title="Let's start with you." />
      <FieldLabel>Your name</FieldLabel>
      <TextField
        value={s.name}
        onChange={act.setName}
        placeholder="e.g. Katarzyna"
        autoFocus
        onEnter={() => ready && act.next()}
      />
      <p style={{ margin: "10px 2px 0", fontSize: 12.5, fontStyle: "italic", lineHeight: 1.55, color: "var(--text-very-dim)", textWrap: "pretty" }}>
        This creates your personal file in the vault. Actions you take in notes route back to you.
      </p>
      <div style={{ marginTop: 26, display: "flex", justifyContent: "flex-end" }}>
        <PrimaryButton onClick={act.next} disabled={!ready} iconRight="arrow" size="lg">Continue</PrimaryButton>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Screen 3 — Choose your folder (+ inline validation A/B/C)
// ════════════════════════════════════════════════════════════
const SAMPLE_FOLDERS = [
  { name: "~/Documents/yapatme-vault", state: "A", note: "empty folder" },
  { name: "~/Notes/YapAtMe",          state: "B", note: "existing YapAtMe vault" },
  { name: "~/Desktop/Work",            state: "C", note: "23 files inside" },
];

function FolderPicker({ open, onPick, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 60, padding: 6, background: "var(--panel-pop)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)" }}>
      <div style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-very-dim)", fontWeight: 600, padding: "6px 10px 8px" }}>Choose a folder</div>
      {SAMPLE_FOLDERS.map((f) => (
        <div
          key={f.name}
          onClick={() => onPick(f)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7, cursor: "pointer", color: "var(--text-dim)" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ color: "var(--text-very-dim)", display: "inline-flex" }}><OnbIcon name="folder" size={15} /></span>
          <span style={{ flex: 1, fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{f.name}</span>
          <span style={{ fontSize: 11, color: "var(--text-very-dim)" }}>{f.note}</span>
        </div>
      ))}
    </div>
  );
}

function FolderScreen({ s, act }) {
  const [picking, setPicking] = React.useState(false);
  const folder = s.folder; // { name, state } | null

  const pick = (f) => { setPicking(false); act.setFolder(f); };

  return (
    <div>
      <ScreenHeading title="Where should your vault live?">
        Choose an empty folder. YapAtMe will create its structure inside it.
      </ScreenHeading>

      <p style={{ margin: "-12px 0 22px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-very-dim)", textWrap: "pretty", maxWidth: 500 }}>
        Your notes never leave your machine — the vault lives entirely on your device.
        If you move the folder later, reconnect it from Settings.
      </p>

      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 9, color: folder ? "var(--text)" : "var(--text-very-dim)" }}>
            <span style={{ color: "var(--text-dim)", display: "inline-flex" }}><OnbIcon name="folder" size={15} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontFamily: "var(--font-mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {folder ? folder.name : "No folder selected"}
            </span>
          </div>
          <SecondaryButton iconLeft="folder" onClick={() => setPicking((v) => !v)}>
            {folder ? "Change" : "Choose folder"}
          </SecondaryButton>
        </div>
        <FolderPicker open={picking} onPick={pick} onClose={() => setPicking(false)} />
      </div>

      {/* Inline validation states */}
      {folder && folder.state === "B" && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="info" icon="folder" title="This looks like an existing YapAtMe vault.">
            Connect to it instead?
          </Notice>
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
            <PrimaryButton onClick={() => act.connectExisting()}>Connect</PrimaryButton>
            <SecondaryButton onClick={() => setPicking(true)}>Choose different folder</SecondaryButton>
          </div>
        </div>
      )}

      {folder && folder.state === "C" && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="danger" icon="warn" title="This folder already has files in it.">
            YapAtMe needs an empty folder. Please choose an empty folder or create a new one.
          </Notice>
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
            <SecondaryButton onClick={() => setPicking(true)}>Choose different folder</SecondaryButton>
          </div>
        </div>
      )}

      {/* State A proceeds silently — just enable Continue */}
      <div style={{ marginTop: 26, display: "flex", justifyContent: "flex-end" }}>
        <PrimaryButton onClick={act.next} disabled={!folder || folder.state !== "A"} iconRight="arrow" size="lg">Continue</PrimaryButton>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Screen 4 — Connect your AI
// ════════════════════════════════════════════════════════════
function AiScreen({ s, act }) {
  const [testing, setTesting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const key = s.apiKey.trim();

  const submit = () => {
    if (testing) return;
    setError(null);
    if (key.length < 12) {
      setError("That key looks too short. Paste the full key from your provider.");
      return;
    }
    // Lightweight test call simulation.
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      // Demo rule: keys containing "bad" fail validation.
      if (/bad/i.test(key)) {
        setError("The provider rejected this key (401). Check it was copied in full and has credit available.");
        return;
      }
      act.next();
    }, 1400);
  };

  return (
    <div>
      <ScreenHeading title="Connect your AI key.">
        YapAtMe uses AI to read your notes and route information into the right places.
        Without a key, note processing won't work.
      </ScreenHeading>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <FieldLabel>Provider</FieldLabel>
          <SelectField
            value={s.provider}
            onChange={act.setProvider}
            options={[
              { value: "openrouter", label: "OpenRouter" },
              { value: "anthropic", label: "Anthropic" },
              { value: "openai", label: "OpenAI" },
              { value: "ollama", label: "Ollama (local)" },
            ]}
          />
        </div>
        <div>
          <FieldLabel>API key</FieldLabel>
          <TextField
            type="password"
            value={s.apiKey}
            onChange={(v) => { act.setApiKey(v); if (error) setError(null); }}
            placeholder="Paste your key here"
            mono
            invalid={!!error}
            onEnter={submit}
          />
          <div style={{ marginTop: 10 }}>
            <TextLink icon="external" onClick={() => {}}>Where do I get a key?</TextLink>
          </div>
        </div>

        {error && (
          <Notice tone="danger" icon="warn" compact>{error}</Notice>
        )}

        <Notice tone="amber" icon="lock" title="Your key stays on this device.">
          Your API key is stored locally in your browser's IndexedDB — the same storage your browser uses
          for offline apps. It never leaves your device. It is never sent to YapAtMe servers (there are none).
          The only outbound connection is directly from your browser to the AI provider when you process a note.
        </Notice>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <PrimaryButton onClick={submit} disabled={testing || key.length === 0} size="lg" iconRight={testing ? undefined : "arrow"}>
          {testing && <OnbSpinner />}
          {testing ? "Verifying key…" : "Continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Screen 5 — Choose your modules
// ════════════════════════════════════════════════════════════
const MODULE_DEFS = [
  { id: "people", icon: "person", label: "People", body: "Track conversations, follow-ups, delegations, and tasks with the people you work with." },
  { id: "projects", icon: "project", label: "Projects", body: "Keep tabs on what's moving, what's blocked, and what decisions have been made." },
  { id: "ideas", icon: "idea", label: "Ideas", body: "Capture sparks before they disappear. Route them into a backlog and shape them into plans." },
];

function ModuleRow({ def, checked, onToggle }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "15px 16px",
        background: hov || checked ? "var(--panel-2)" : "var(--panel)",
        border: `1px solid ${checked ? "oklch(0.80 0.13 80 / 0.32)" : "var(--border)"}`,
        borderRadius: 11, cursor: "pointer",
        transition: "background .12s, border-color .12s",
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 9, flex: "0 0 34px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: checked ? "oklch(0.80 0.13 80 / 0.16)" : "var(--panel)", color: checked ? "var(--accent)" : "var(--text-dim)", border: "1px solid var(--border)", marginTop: 1 }}>
        <OnbIcon name={def.icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{def.label}</div>
        <p style={{ margin: 0, fontSize: 12.8, lineHeight: 1.5, color: "var(--text-dim)", textWrap: "pretty" }}>{def.body}</p>
      </div>
      <span style={{ marginTop: 4 }}><Switch checked={checked} onToggle={onToggle} /></span>
    </div>
  );
}

function ModulesScreen({ s, act }) {
  return (
    <div>
      <ScreenHeading title="What do you want to track?">
        You can change this any time in Settings.
      </ScreenHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MODULE_DEFS.map((def) => (
          <ModuleRow key={def.id} def={def} checked={!!s.modules[def.id]} onToggle={() => act.toggleModule(def.id)} />
        ))}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <PrimaryButton onClick={act.next} iconRight="arrow" size="lg">Continue</PrimaryButton>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Screen 6A — Seed your vault (new-user path only)
// ════════════════════════════════════════════════════════════
function SeedRowInput({ value, onChange, placeholder, mono, flex }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{ ...fieldBase(), flex: flex || 1, minWidth: 0, padding: "9px 12px", fontSize: 13.5, borderColor: focus ? "var(--accent)" : "var(--border)", fontFamily: mono ? "var(--font-mono)" : "inherit" }}
    />
  );
}

function RemoveBtn({ onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove row"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ width: 34, height: 34, flex: "0 0 34px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", background: hov ? "oklch(0.70 0.18 22 / 0.14)" : "transparent", color: hov ? "oklch(0.84 0.16 22)" : "var(--text-very-dim)", border: `1px solid ${hov ? "oklch(0.70 0.18 22 / 0.4)" : "var(--border)"}`, transition: "background .12s, color .12s, border-color .12s" }}
    >
      <OnbIcon name="x" size={13} />
    </button>
  );
}

function SeedGroup({ title, icon, rows, onChange, onAdd, onRemove, render }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <span style={{ color: "var(--text-dim)", display: "inline-flex" }}><OnbIcon name={icon} size={14} /></span>
        <span style={{ fontSize: 11, letterSpacing: "0.14em", fontWeight: 600, color: "var(--text-very-dim)", textTransform: "uppercase" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {render(row, i)}
            <RemoveBtn onClick={() => onRemove(i)} />
          </div>
        ))}
      </div>
      {rows.length < 3 && (
        <div style={{ marginTop: 10 }}>
          <TextLink icon="plus" onClick={onAdd}>Add another</TextLink>
        </div>
      )}
    </div>
  );
}

function SeedScreen({ s, act }) {
  const showPeople = !!s.modules.people;
  const showProjects = !!s.modules.projects;
  return (
    <div>
      <ScreenHeading title="Give YapAtMe something to start with.">
        Add a few people and projects you're working with right now. This is optional —
        you can skip and let your notes build the vault naturally.
      </ScreenHeading>

      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {showPeople && (
          <SeedGroup
            title="People" icon="person"
            rows={s.seedPeople}
            onAdd={() => act.addSeed("people")}
            onRemove={(i) => act.removeSeed("people", i)}
            render={(row, i) => (
              <React.Fragment>
                <SeedRowInput value={row.name} onChange={(v) => act.editSeed("people", i, "name", v)} placeholder="Name" flex={1.3} />
                <SeedRowInput value={row.role} onChange={(v) => act.editSeed("people", i, "role", v)} placeholder="Role (optional)" flex={1} />
              </React.Fragment>
            )}
          />
        )}
        {showProjects && (
          <SeedGroup
            title="Projects" icon="project"
            rows={s.seedProjects}
            onAdd={() => act.addSeed("projects")}
            onRemove={(i) => act.removeSeed("projects", i)}
            render={(row, i) => (
              <SeedRowInput value={row.name} onChange={(v) => act.editSeed("projects", i, "name", v)} placeholder="Project name" />
            )}
          />
        )}
        {!showPeople && !showProjects && (
          <Notice tone="info" icon="idea">
            People and Projects are switched off, so there's nothing to seed. Your notes will build the vault as you write.
          </Notice>
        )}
      </div>

      <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <TextLink icon="arrow" onClick={() => act.finishSetup(true)}>Skip and start with a blank vault</TextLink>
        <PrimaryButton onClick={() => act.finishSetup(false)} size="lg" iconRight="arrow">Set up my vault</PrimaryButton>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Screen 7 — Ready
// ════════════════════════════════════════════════════════════
function ReadyScreen({ s, act }) {
  let subtext;
  if (s.path === "pro") {
    subtext = "Your vault is ready. Open the inbox and write what's on your mind.";
  } else if (s.seeded) {
    subtext = "We've set up your structure and added your first people and projects. There's a demo note in your inbox — process it to see YapAtMe in action.";
  } else {
    subtext = "Your vault is ready. There's a demo note in your inbox — process it to see YapAtMe in action.";
  }

  return (
    <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
        <span style={{ width: 64, height: 64, borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "oklch(0.74 0.14 165 / 0.14)", color: "var(--success)", border: "1px solid oklch(0.74 0.14 165 / 0.32)", boxShadow: "0 0 0 8px oklch(0.74 0.14 165 / 0.06)" }}>
          <OnbIcon name="check" size={30} />
        </span>
      </div>
      <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: "var(--text)" }}>
        You're all set{s.name.trim() ? `, ${s.name.trim().split(/\s+/)[0]}` : ""}.
      </h1>
      <p style={{ margin: "14px auto 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-dim)", textWrap: "pretty", maxWidth: 440 }}>
        {subtext}
      </p>
      <div style={{ marginTop: 30, display: "flex", justifyContent: "center" }}>
        <PrimaryButton onClick={act.openApp} size="lg" iconRight="arrow">Open YapAtMe</PrimaryButton>
      </div>
    </div>
  );
}

Object.assign(window, {
  WelcomeScreen, NameScreen, FolderScreen, AiScreen,
  ModulesScreen, SeedScreen, ReadyScreen, MODULE_DEFS,
});
