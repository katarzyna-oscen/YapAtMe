// First-run experience: the 3-panel popup, the demo-note inbox landing,
// and the post-filing cleanup banner. Shown after "Open YapAtMe".

// ────────────────────────────────────────────────────────────
//  Inline markdown for the demo note ([[wikilinks]] + #tags)
// ────────────────────────────────────────────────────────────
function WikiLink({ children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", margin: "0 1px", borderRadius: 5, background: "oklch(0.72 0.13 240 / 0.13)", color: "oklch(0.82 0.12 240)", border: "1px solid oklch(0.72 0.13 240 / 0.30)", fontSize: "0.92em", fontWeight: 500, verticalAlign: "baseline", cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
function HashTag({ children }) {
  const idea = /idea/i.test(children);
  const hue = idea ? 80 : 230;
  return (
    <span style={{ padding: "1px 7px", margin: "0 1px", borderRadius: 5, background: `oklch(0.78 0.13 ${hue} / 0.13)`, color: `oklch(0.84 0.13 ${hue})`, border: `1px solid oklch(0.78 0.13 ${hue} / 0.30)`, fontSize: "0.9em", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
      {children}
    </span>
  );
}
function renderInline(text, keyPrefix) {
  const parts = [];
  const re = /(\[\[[^\]]+\]\])|(#[A-Za-z0-9_]+)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={`${keyPrefix}-t${i++}`}>{text.slice(last, m.index)}</span>);
    if (m[1]) parts.push(<WikiLink key={`${keyPrefix}-w${i++}`}>{m[1].slice(2, -2)}</WikiLink>);
    else if (m[2]) parts.push(<HashTag key={`${keyPrefix}-h${i++}`}>{m[2]}</HashTag>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(<span key={`${keyPrefix}-t${i++}`}>{text.slice(last)}</span>);
  return parts;
}

// ────────────────────────────────────────────────────────────
//  First-run popup — lightweight 3-panel modal
// ────────────────────────────────────────────────────────────
function LoopDiagram() {
  const steps = [
    { label: "Inbox", icon: "inbox" },
    { label: "Process", icon: "spark" },
    { label: "Review & Approve", icon: "check" },
    { label: "File", icon: "folder" },
    { label: "Vault", icon: "grid" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6, padding: "16px 14px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 11, marginBottom: 16, flexWrap: "wrap" }}>
      {steps.map((st, i) => (
        <React.Fragment key={st.label}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: "1 1 auto", minWidth: 54 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", background: i === steps.length - 1 ? "oklch(0.80 0.13 80 / 0.16)" : "var(--panel-2)", color: i === steps.length - 1 ? "var(--accent)" : "var(--text-dim)", border: "1px solid var(--border)" }}>
              <OnbIcon name={st.icon} size={15} />
            </span>
            <span style={{ fontSize: 10.5, lineHeight: 1.2, color: "var(--text-dim)", textAlign: "center", fontWeight: 500 }}>{st.label}</span>
          </div>
          {i < steps.length - 1 && (
            <span style={{ alignSelf: "flex-start", marginTop: 10, color: "var(--text-very-dim)", display: "inline-flex" }}><OnbIcon name="arrow" size={13} /></span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const FIRST_RUN_PANELS = [
  {
    heading: "How YapAtMe works",
    render: () => (
      <div>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)", textWrap: "pretty" }}>
          Write what's on your mind in the inbox. Process it. Review and approve the changes. File it. That's it.
        </p>
        <LoopDiagram />
        <Notice tone="amber" icon="warn">
          When you process a note, YapAtMe will detect new people and projects and ask you to confirm creating them.
          Then it will propose changes — tasks, mentions, ideas. You decide what gets saved.
          Accept everything on the demo note to see the full loop in action.
        </Notice>
      </div>
    ),
  },
  {
    heading: "You stay in control",
    render: () => (
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty" }}>
        YapAtMe reads your note and finds tasks, people, projects, and ideas. It prepares updates — you
        approve each one before anything is saved to your vault. Nothing happens without your say-so.
      </p>
    ),
  },
  {
    heading: "Your demo note is ready",
    render: () => (
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty" }}>
        There's a demo note in your inbox with one task, one person, one project, and one idea. Process it to
        experience the full loop. When you're done, one button removes all demo content cleanly.
      </p>
    ),
  },
];

function FirstRunPopup({ onDismiss }) {
  const [panel, setPanel] = React.useState(0);
  const last = panel === FIRST_RUN_PANELS.length - 1;
  const p = FIRST_RUN_PANELS[panel];

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" && !last) setPanel((v) => v + 1);
      if (e.key === "ArrowLeft" && panel > 0) setPanel((v) => v - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, last]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "modalFadeIn .14s ease-out", padding: 24 }}>
      <div role="dialog" aria-modal="true" style={{ width: 580, maxWidth: "calc(100vw - 32px)", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 28px 70px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)", padding: "28px 30px", color: "var(--text)", animation: "modalPopIn .18s ease-out" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "oklch(0.80 0.13 80 / 0.16)", color: "var(--accent)", border: "1px solid oklch(0.80 0.13 80 / 0.3)", flex: "0 0 auto" }}>
            <OnbIcon name="spark" size={14} />
          </span>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)" }}>{p.heading}</h2>
        </div>

        <div key={panel} style={{ animation: "screenIn .22s ease-out", minHeight: 256, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {p.render()}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
          {/* progress dots */}
          <div style={{ display: "flex", gap: 7 }}>
            {FIRST_RUN_PANELS.map((_, i) => (
              <span key={i} style={{ width: i === panel ? 18 : 6, height: 6, borderRadius: 999, background: i === panel ? "var(--accent)" : "var(--border-strong)", transition: "width .2s, background .2s" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {panel > 0 && <SecondaryButton onClick={() => setPanel((v) => v - 1)}>Back</SecondaryButton>}
            {!last && <PrimaryButton onClick={() => setPanel((v) => v + 1)} iconRight="arrow">Next</PrimaryButton>}
            {last && <PrimaryButton onClick={onDismiss}>Got it</PrimaryButton>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Demo-note inbox landing (lightweight app chrome)
// ────────────────────────────────────────────────────────────
function todayDMY() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

const DEMO_BODY = [
  "Met with [[Alex Chen]] today to discuss the [[Website Redesign]] project. We need to finalise the colour palette by end of week — I'll send her the options tomorrow.",
  "Also had a thought: what if we built a browser extension that lets you capture highlights directly into the vault? Could be huge for research workflows. #idea",
  "#action Review colour palette options",
];

function MiniSidebar({ name, demoCleaned }) {
  const first = (name || "").trim().split(/\s+/)[0] || "You";
  const fileName = `${todayDMY()}.md`;
  return (
    <aside style={{ width: 240, flex: "0 0 240px", height: "100vh", background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", color: "var(--text-dim)", userSelect: "none" }}>
      <div style={{ padding: "18px 18px 14px" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", fontWeight: 600, color: "var(--text)" }}>YapAtMe</div>
        <div style={{ fontSize: 12.5, color: "var(--text-very-dim)", marginTop: 2 }}>Your vault</div>
      </div>
      <div style={{ padding: "10px 8px", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7, color: "var(--text-dim)" }}>
          <OnbIcon name="grid" size={14} /><span>Command center</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7, color: "var(--text-dim)" }}>
          <OnbIcon name="check" size={14} /><span>Tasks</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 11, letterSpacing: "0.12em", color: "var(--text-very-dim)", fontWeight: 600, textTransform: "uppercase" }}>Inbox</div>
        {demoCleaned ? (
          <div style={{ padding: "4px 10px 4px 28px", color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 12.5 }}>empty</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 22px", borderRadius: 6, background: "var(--panel-2)", color: "var(--text)", fontSize: 13 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "0 0 5px" }} />
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 10px 6px", fontSize: 11, letterSpacing: "0.12em", color: "var(--text-very-dim)", fontWeight: 600, textTransform: "uppercase" }}>People</div>
        <div style={{ padding: "5px 10px 5px 28px", fontSize: 13, color: demoCleaned ? "var(--text-very-dim)" : "var(--text-dim)", fontStyle: demoCleaned ? "italic" : "normal" }}>{demoCleaned ? "empty" : first}</div>
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-very-dim)" }}>
        <OnbIcon name="grid" size={13} /> Settings
      </div>
    </aside>
  );
}

function CleanupBanner({ onCleanup, onKeep }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", margin: "0 0 22px", background: "oklch(0.80 0.13 80 / 0.08)", border: "1px solid oklch(0.80 0.13 80 / 0.3)", borderRadius: 11, animation: "screenIn .3s ease-out" }}>
      <span style={{ color: "var(--accent)", display: "inline-flex", flex: "0 0 auto" }}><OnbIcon name="spark" size={16} /></span>
      <span style={{ flex: 1, fontSize: 13.5, color: "var(--text)" }}>Demo complete. Remove all demo content?</span>
      <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
        <PrimaryButton onClick={onCleanup}>Clean up</PrimaryButton>
        <SecondaryButton onClick={onKeep}>Keep it</SecondaryButton>
      </div>
    </div>
  );
}

function DemoInbox({ s, onRestart }) {
  // stage: "open" → demo note open · "filed" → cleanup banner showing · "done" → cleaned/kept
  const [stage, setStage] = React.useState("open");
  const [processing, setProcessing] = React.useState(false);
  const [cleaned, setCleaned] = React.useState(false);
  const fileName = `${todayDMY()}.md`;

  const processAndFile = () => {
    if (processing) return;
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setStage("filed"); }, 1700);
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      <MiniSidebar name={s.name} demoCleaned={cleaned} />
      <main style={{ flex: 1, overflowY: "auto", color: "var(--text)" }} data-screen-label="Inbox (demo note)">
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 44px 20px", borderBottom: "1px solid var(--border-subtle)", gap: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-very-dim)", letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>
            {fileName.toUpperCase()} · INBOX
          </div>
          {!cleaned && stage !== "filed" && (
            <PrimaryButton onClick={processAndFile} disabled={processing}>
              {processing && <OnbSpinner />}
              {processing ? "Processing…" : "Process & file demo note"}
            </PrimaryButton>
          )}
          {(cleaned || stage === "filed") && (
            <SecondaryButton iconLeft="back" onClick={onRestart}>Restart onboarding</SecondaryButton>
          )}
        </header>

        <div style={{ maxWidth: 720, padding: "26px 44px 60px" }}>
          {stage === "filed" && !cleaned && (
            <CleanupBanner
              onCleanup={() => { setCleaned(true); setStage("done"); }}
              onKeep={() => setStage("done")}
            />
          )}

          {cleaned ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-dim)" }}>
              <span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "oklch(0.74 0.14 165 / 0.14)", color: "var(--success)", border: "1px solid oklch(0.74 0.14 165 / 0.3)", marginBottom: 18 }}>
                <OnbIcon name="check" size={24} />
              </span>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", margin: "0 0 8px", letterSpacing: "-0.01em" }}>Demo content removed.</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, maxWidth: 380, marginLeft: "auto", marginRight: "auto", textWrap: "pretty" }}>
                Your inbox is clean. Write or dictate a note and process it — YapAtMe takes it from there.
              </p>
            </div>
          ) : (
            <article>
              {/* Demo callout */}
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "13px 15px", marginBottom: 24, background: "oklch(0.80 0.13 80 / 0.07)", borderLeft: "3px solid oklch(0.80 0.13 80 / 0.55)", borderRadius: "0 9px 9px 0" }}>
                <span style={{ color: "var(--accent)", display: "inline-flex", marginTop: 1, flex: "0 0 auto" }}><OnbIcon name="spark" size={15} /></span>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-dim)" }}>
                  <strong style={{ color: "oklch(0.88 0.10 80)", fontWeight: 600 }}>Demo note</strong> — process this to see YapAtMe in action.
                  Delete it afterwards using the button that appears after filing.
                </div>
              </div>

              {/* Note body */}
              <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text)" }}>
                {DEMO_BODY.map((para, i) => (
                  <p key={i} style={{ margin: i === DEMO_BODY.length - 1 ? "20px 0 0" : "0 0 18px", color: "var(--text)", textWrap: "pretty" }}>
                    {renderInline(para, `p${i}`)}
                  </p>
                ))}
              </div>

              {/* Detected entities preview */}
              <div style={{ marginTop: 30 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 600, color: "var(--text-very-dim)", textTransform: "uppercase", marginBottom: 12 }}>YapAtMe will propose</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                  {[
                    { icon: "person", label: "Alex Chen", hue: 240, kind: "person" },
                    { icon: "project", label: "Website Redesign", hue: 150, kind: "project" },
                    { icon: "check", label: "Review colour palette options", hue: 230, kind: "task" },
                    { icon: "idea", label: "Browser extension for highlights", hue: 80, kind: "idea" },
                  ].map((e) => (
                    <span key={e.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: `oklch(0.78 0.13 ${e.hue} / 0.10)`, color: `oklch(0.85 0.12 ${e.hue})`, border: `1px solid oklch(0.78 0.13 ${e.hue} / 0.28)`, fontSize: 12.5 }}>
                      <OnbIcon name={e.icon} size={13} />{e.label}
                    </span>
                  ))}
                </div>
                <p style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--text-very-dim)", fontStyle: "italic" }}>
                  Each is created with <span style={{ fontFamily: "var(--font-mono)" }}>demo: true</span> in frontmatter, so cleanup can remove them in one step.
                </p>
              </div>
            </article>
          )}
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { FirstRunPopup, DemoInbox, CleanupBanner, renderInline });
