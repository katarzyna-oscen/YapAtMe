// IdeaView — single-idea file page.
//
// Layout mirrors the idea-file template:
//   Header     → UPDATED <weekday, month day> · <age> · saved <hh:mm>
//   Title + decision bar (Decision · Pursuing / Park / Kill · + Domain · N steps left)
//   ## Summary   → AI one-liner, "+ AI-generated" affordance
//   ## Origin    → what triggered the idea
//   ## Developing→ accumulating freeform notes, newest first
//   ## Outcome   → pursuing / parked / killed banner, or three choices
//   ## Plan      → bare checklist + Add step, gated to Validate-or-beyond
//   ## Related   → removable project + people chips + Add affordances
//   ## Recent Mentions → auto-populated [[DD-MM-YYYY]] — context lines
//
// Reuses globals: Tag, AgeChip, Icon, fmtAge, DictateButton, TrashMenuButton, Sparkle

// DD-MM-YYYY — the app's canonical mention/date format
function fmtDMY(d) {
  return new Date(d).toLocaleDateString("en-GB").replaceAll("/", "-");
}

function fmtIdeaAge(d) {
  const days = window.memDaysAgo(d);
  if (days <= 0) {
    const hours = Math.round((MEM_NOW - d) / 3600000);
    if (hours <= 0) return "just now";
    if (hours < 24) return `${hours}h ago`;
  }
  return fmtAge(d);
}

// "saved 16:48" — 24h clock from a Date
function fmtSavedTime(d) {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ────────────────────────────────────────────────────────────
//  Shared bits (self-contained — babel files don't share scope)
// ────────────────────────────────────────────────────────────
function IdeaSectionHeading({ label, right }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      margin: "34px 0 14px",
    }}>
      <h2 style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--text-very-dim)",
        margin: 0,
      }}>{label}</h2>
      {right}
    </div>
  );
}

function IdeaPlaceholder({ children }) {
  return (
    <p style={{ margin: 0, color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

function IdeaLink({ label, hue = 80, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        color: `oklch(0.84 0.13 ${hue})`,
        fontWeight: 600,
        textDecoration: "none",
        borderBottom: `1px solid oklch(0.80 0.13 ${hue} / ${hov ? 1 : 0.4})`,
        paddingBottom: 1,
        transition: "border-color .12s",
      }}
    >{label}</a>
  );
}

// "+ Add …" inline affordance — dim, plus glyph, used under Plan and Related
function IdeaAddLink({ label, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13.5,
        fontStyle: "italic",
        color: hov ? "var(--text-dim)" : "var(--text-very-dim)",
        transition: "color .12s",
      }}
    >
      <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 2v8M2 6h8" />
      </svg>
      {label}
    </button>
  );
}

// "+ AI-generated" — amber affordance that regenerates a section's content
function AIGenerateAction({ label = "AI-generated", onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 10.5,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--accent)",
        opacity: hov ? 1 : 0.82,
        transition: "opacity .12s",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
//  Decision bar — leading Decision label + Pursuing / Park / Kill,
//  then a domain chip and a plan-steps counter. Sits under the title.
// ────────────────────────────────────────────────────────────
const DECISION_CHOICES = [
  { key: "pursuing", label: "Pursuing", hue: 150, tinted: true },
  { key: "parked",   label: "Park",     hue: null, tinted: false },
  { key: "killed",   label: "Kill",     hue: 22,  tinted: true },
];

function DecisionButton({ choice, active, onClick }) {
  const [hov, setHov] = React.useState(false);
  const hue = choice.hue;
  let bg, color, border;
  if (active) {
    const h = hue == null ? 80 : hue;
    bg = `oklch(0.78 0.13 ${h} / 0.20)`;
    color = `oklch(0.86 0.13 ${h})`;
    border = `oklch(0.78 0.13 ${h} / 0.55)`;
  } else if (hue == null) {
    // neutral choice (Park)
    bg = hov ? "var(--panel-2)" : "transparent";
    color = "var(--text-dim)";
    border = hov ? "var(--border-strong)" : "var(--border)";
  } else {
    bg = hov ? `oklch(0.78 0.13 ${hue} / 0.14)` : `oklch(0.78 0.13 ${hue} / 0.06)`;
    color = `oklch(0.84 0.13 ${hue})`;
    border = `oklch(0.78 0.13 ${hue} / ${hov ? 0.5 : 0.3})`;
  }
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        borderRadius: 999,
        background: bg,
        color,
        border: `1px solid ${border}`,
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        transition: "background .12s, border-color .12s",
      }}
    >
      {active && (
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: `oklch(0.80 0.16 ${hue == null ? 80 : hue})`,
        }} />
      )}
      {choice.label}
    </button>
  );
}

function DomainControl({ domain, onSet }) {
  const [open, setOpen] = React.useState(false);
  const [hov, setHov] = React.useState(false);
  const ref = React.useRef(null);
  const opts = ["AI", "Ops", "Design", "Process", "Research", "DesignOps"];
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 12px",
          fontSize: 12.5,
          fontWeight: 500,
          borderRadius: 999,
          background: domain ? "var(--panel-2)" : hov ? "var(--panel-2)" : "transparent",
          color: domain ? "var(--text)" : "var(--text-very-dim)",
          border: `1px solid ${domain ? "var(--border-strong)" : hov ? "var(--border-strong)" : "var(--border)"}`,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          transition: "background .12s, border-color .12s, color .12s",
        }}
      >
        {domain ? (
          <React.Fragment>
            <span style={{ color: "var(--text-very-dim)", fontSize: 11.5 }}>domain</span>
            <span style={{ fontWeight: 600 }}>{domain}</span>
          </React.Fragment>
        ) : (
          <React.Fragment><span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Domain</React.Fragment>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30,
          background: "var(--panel-pop)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 4, minWidth: 150,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)",
        }}>
          {opts.map((o) => (
            <div
              key={o}
              onClick={() => { onSet(o); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                color: o === domain ? "var(--text)" : "var(--text-dim)", fontSize: 12.5,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {o}
              {o === domain && <span style={{ marginLeft: "auto", color: "var(--text-very-dim)" }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepsLeftChip({ left }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 12px",
      fontSize: 12.5,
      borderRadius: 999,
      background: "transparent",
      border: "1px solid var(--border)",
      color: "var(--text-very-dim)",
      whiteSpace: "nowrap",
    }}>
      <span style={{ color: "var(--text)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{left}</span>
      <span>{left === 1 ? "step left" : "steps left"}</span>
    </span>
  );
}

function DecisionBar({ idea, onDecide, onSetDomain }) {
  const decided = idea.outcome?.decision || null;
  const stepsLeft = (idea.plan || []).filter((s) => !s.done).length;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {/* leading Decision label pill */}
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "5px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 999,
        background: "oklch(0.72 0.13 240 / 0.16)",
        color: "oklch(0.82 0.12 240)",
        border: "1px solid oklch(0.72 0.13 240 / 0.40)",
        whiteSpace: "nowrap",
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.78 0.15 240)" }} />
        Decision
      </span>
      {DECISION_CHOICES.map((c) => (
        <DecisionButton key={c.key} choice={c} active={decided === c.key} onClick={() => onDecide(c.key)} />
      ))}
      <DomainControl domain={idea.domain} onSet={onSetDomain} />
      <StepsLeftChip left={stepsLeft} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Developing — accumulating notes timeline (newest first)
// ────────────────────────────────────────────────────────────
function DevelopingTimeline({ notes }) {
  if (!notes || notes.length === 0) return (
    <IdeaPlaceholder>Nothing developed yet. Thinking will accumulate here as the idea comes up again.</IdeaPlaceholder>
  );
  const sorted = [...notes].sort((a, b) => b.date - a.date);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {sorted.map((n, i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: "104px 1fr",
          gap: 18,
          padding: "14px 0",
          borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
        }}>
          <div style={{
            fontSize: 12,
            color: "var(--text-very-dim)",
            fontVariantNumeric: "tabular-nums",
            paddingTop: 2,
            letterSpacing: "0.02em",
          }}>{fmtDMY(n.date)}</div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty" }}>
            {n.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Outcome — decision banner, or three choices + "no outcome yet"
// ────────────────────────────────────────────────────────────
const OUTCOME_META = {
  pursuing: { hue: 150, label: "Pursuing" },
  parked:   { hue: 80,  label: "Parked" },
  killed:   { hue: 22,  label: "Killed" },
};

function OutcomeChoice({ label, hue, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        fontSize: 13,
        borderRadius: 999,
        background: hov ? `oklch(0.78 0.13 ${hue} / 0.12)` : "var(--panel)",
        color: "var(--text-dim)",
        border: `1px solid ${hov ? `oklch(0.78 0.13 ${hue} / 0.45)` : "var(--border)"}`,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .12s, border-color .12s",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </button>
  );
}

function OutcomeBlock({ outcome, onDecide }) {
  if (!outcome) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {Object.keys(OUTCOME_META).map((k) => {
          const m = OUTCOME_META[k];
          return <OutcomeChoice key={k} hue={m.hue} label={m.label} onClick={() => onDecide && onDecide(k)} />;
        })}
        <span style={{ fontSize: 13.5, fontStyle: "italic", color: "var(--text-very-dim)", marginLeft: 4 }}>
          No outcome recorded yet.
        </span>
      </div>
    );
  }
  const m = OUTCOME_META[outcome.decision] || OUTCOME_META.parked;
  return (
    <div style={{
      display: "flex",
      gap: 14,
      padding: "16px 18px",
      background: `oklch(0.78 0.13 ${m.hue} / 0.08)`,
      border: `1px solid oklch(0.78 0.13 ${m.hue} / 0.28)`,
      borderRadius: 10,
    }}>
      <span style={{
        flex: "0 0 auto", marginTop: 3,
        width: 9, height: 9, borderRadius: "50%",
        background: `oklch(0.78 0.16 ${m.hue})`,
        boxShadow: `0 0 0 4px oklch(0.78 0.16 ${m.hue} / 0.18)`,
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 5 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: `oklch(0.86 0.13 ${m.hue})` }}>{m.label}</span>
          {outcome.date && (
            <span style={{ fontSize: 11.5, color: "var(--text-very-dim)", fontVariantNumeric: "tabular-nums" }}>
              {fmtDMY(outcome.date)}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)", textWrap: "pretty" }}>
          {outcome.text}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Plan — bare checklist + Add step, gated to Validate-or-beyond
// ────────────────────────────────────────────────────────────
const IDEA_STAGE_ORDER = ["spark", "developing", "validate", "decided"];

function PlanItem({ item, onToggle }) {
  const [boxHov, setBoxHov] = React.useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <button
        onClick={onToggle}
        onMouseEnter={() => setBoxHov(true)}
        onMouseLeave={() => setBoxHov(false)}
        style={{
          width: 18, height: 18, flex: "0 0 18px",
          border: "1.5px solid",
          borderColor: item.done ? "var(--success)" : boxHov ? "var(--success)" : "var(--border-strong)",
          borderRadius: 5,
          background: item.done ? "var(--success)" : "transparent",
          cursor: "pointer", padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--bg)",
          transition: "border-color .12s",
        }}
      >
        {item.done && (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
        )}
      </button>
      <span style={{
        flex: 1, fontSize: 14.5,
        color: item.done ? "var(--text-very-dim)" : "var(--text)",
        textDecoration: item.done ? "line-through" : "none",
      }}>{item.text}</span>
    </div>
  );
}

function PlanChecklist({ plan, status, onToggle, onAddStep }) {
  const gated = IDEA_STAGE_ORDER.indexOf(status) < IDEA_STAGE_ORDER.indexOf("validate");
  const hasPlan = plan && plan.length > 0;
  const done = hasPlan ? plan.filter((s) => s.done).length : 0;
  return (
    <div>
      {hasPlan ? (
        <React.Fragment>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {plan.map((s) => (
              <PlanItem key={s.id} item={s} onToggle={() => onToggle(s.id)} />
            ))}
          </div>
          <div style={{
            borderTop: "1px solid var(--border-subtle)",
            margin: "10px 0 0",
            paddingTop: 10,
            fontSize: 12, color: "var(--text-very-dim)", fontVariantNumeric: "tabular-nums",
          }}>
            {done} of {plan.length} done · steps feed the Plans screen
          </div>
        </React.Fragment>
      ) : gated ? (
        <IdeaPlaceholder>
          A plan really pays off at the <b style={{ fontStyle: "normal", color: "var(--text-dim)" }}>Validate</b> stage — add the first step and this idea moves there.
        </IdeaPlaceholder>
      ) : (
        <IdeaPlaceholder>No steps yet. Break the idea into the main moves to validate it.</IdeaPlaceholder>
      )}
      <div style={{ marginTop: 10 }}>
        <IdeaAddLink label="Add step" onClick={onAddStep} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Related — removable project + people chips + Add affordances
// ────────────────────────────────────────────────────────────
function RelatedChip({ label, hue = 80, onRemove, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 8px 5px 12px",
      fontSize: 13,
      fontWeight: 500,
      borderRadius: 8,
      background: `oklch(0.78 0.13 ${hue} / 0.10)`,
      color: `oklch(0.86 0.12 ${hue})`,
      border: `1px solid oklch(0.78 0.13 ${hue} / 0.32)`,
      whiteSpace: "nowrap",
    }}>
      <span
        onClick={onClick}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >{label}</span>
      <button
        onClick={onRemove}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        aria-label={`Remove ${label}`}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, padding: 0, borderRadius: 4,
          border: "none", cursor: "pointer", fontFamily: "inherit",
          background: hov ? `oklch(0.78 0.13 ${hue} / 0.22)` : "transparent",
          color: `oklch(0.86 0.12 ${hue})`,
          transition: "background .12s",
        }}
      >
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </span>
  );
}

function RelatedGroup({ title, chips, addLabel, onAdd }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-very-dim)", marginBottom: 8 }}>{title}</div>
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {chips}
        </div>
      )}
      <IdeaAddLink label={addLabel} onClick={onAdd} />
    </div>
  );
}

function RelatedSection({ projectIds, peopleIds, onRemoveProject, onRemovePerson, onNavigate, onAddProject, onAddPerson }) {
  const projects = (projectIds || []).map((id) => MEM_PROJECTS.find((x) => x.id === id)).filter(Boolean);
  const people = (peopleIds || []).map((id) => MEM_PEOPLE.find((x) => x.id === id)).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <RelatedGroup
        title="Projects"
        addLabel="Add related project"
        onAdd={onAddProject}
        chips={projects.map((p) => (
          <RelatedChip key={p.id} label={p.title} hue={80} onRemove={() => onRemoveProject(p.id)} />
        ))}
      />
      <RelatedGroup
        title="People"
        addLabel="Add related person"
        onAdd={onAddPerson}
        chips={people.map((p) => (
          <RelatedChip
            key={p.id}
            label={p.name}
            hue={80}
            onRemove={() => onRemovePerson(p.id)}
            onClick={() => onNavigate && onNavigate({ type: "person", id: p.id })}
          />
        ))}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Recent Mentions — [[DD-MM-YYYY]] — context
// ────────────────────────────────────────────────────────────
function IdeaMentionsList({ mentions }) {
  if (!mentions || mentions.length === 0) return (
    <IdeaPlaceholder>No mentions yet. The routing pipeline adds a line here each time this idea comes up in an inbox note.</IdeaPlaceholder>
  );
  const sorted = [...mentions].sort((a, b) => b.date - a.date);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sorted.map((m, i) => (
        <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--text-dim)", textWrap: "pretty" }}>
          <IdeaLink label={fmtDMY(m.date)} hue={80} /> — {m.context}
        </p>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  IdeaView — top-level
// ────────────────────────────────────────────────────────────
function IdeaView({ idea, onUpdate, onAction, onNavigate }) {
  const [dictating, setDictating] = React.useState(false);
  React.useEffect(() => { setDictating(false); }, [idea.id]);

  const togglePlan = (sid) =>
    onUpdate({ plan: (idea.plan || []).map((s) => s.id === sid ? { ...s, done: !s.done } : s) });

  const addStep = () => {
    const text = window.prompt("New plan step");
    if (!text) return;
    const id = "ps-" + Date.now();
    const next = [...(idea.plan || []), { id, text, done: false }];
    const patch = { plan: next };
    // first step at Spark/Developing nudges the idea into Validate so the plan shows
    if (IDEA_STAGE_ORDER.indexOf(idea.status) < IDEA_STAGE_ORDER.indexOf("validate")) patch.status = "validate";
    onUpdate(patch);
  };

  const decide = (decision) => {
    // toggle off if the same decision is tapped again
    if (idea.outcome?.decision === decision) {
      onUpdate({ outcome: null });
      return;
    }
    const text = {
      pursuing: "Marked as pursuing — turn this into a project to start delivery.",
      parked:   "Parked for now — revisit when there's capacity.",
      killed:   "Killed — not worth pursuing.",
    }[decision];
    onUpdate({ outcome: { decision, text, date: MEM_NOW }, status: "decided" });
  };

  const setDomain = (domain) => onUpdate({ domain });
  const removeProject = (id) => onUpdate({ relatedProjects: (idea.relatedProjects || []).filter((x) => x !== id) });
  const removePerson = (id) => onUpdate({ relatedPeople: (idea.relatedPeople || []).filter((x) => x !== id) });

  const dateBasis = idea.lastUpdated || idea.origin;
  const weekdayLine = new Date(dateBasis).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div data-screen-label="Idea">
      {/* Header — updated line (left), actions (right) */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 48px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        gap: 16,
      }}>
        <div style={{
          fontSize: 13,
          color: "var(--text-very-dim)",
          letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
        }}>
          UPDATED {weekdayLine.toUpperCase()}
          {" · "}
          {fmtIdeaAge(dateBasis).toUpperCase()}
          {" · saved "}
          {fmtSavedTime(dateBasis)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DictateButton active={dictating} onClick={() => setDictating(!dictating)} />
          <TrashMenuButton
            onAction={(action) => onAction && onAction(action, { id: idea.id, label: idea.title })}
          />
        </div>
      </header>

      {/* Title + decision bar */}
      <section style={{ padding: "28px 48px 0" }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: "0 0 18px",
          color: "var(--text)",
          maxWidth: 760,
          textWrap: "balance",
        }}>{idea.title}</h1>
        <DecisionBar idea={idea} onDecide={decide} onSetDomain={setDomain} />
      </section>

      {/* Sections */}
      <section style={{ padding: "8px 48px 64px", maxWidth: 880 }}>
        <IdeaSectionHeading label="Summary" right={<AIGenerateAction />} />
        {idea.summary ? (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--text)", textWrap: "pretty" }}>
            {idea.summary}
          </p>
        ) : (
          <IdeaPlaceholder>What is this idea in one paragraph?</IdeaPlaceholder>
        )}

        <IdeaSectionHeading label="Origin" />
        {idea.originText ? (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty" }}>
            {idea.originText}
          </p>
        ) : (
          <IdeaPlaceholder>Why did this idea come up? Context from the source note.</IdeaPlaceholder>
        )}

        <IdeaSectionHeading
          label="Developing"
          right={(idea.developing || []).length > 0 ? <AIGenerateAction label="auto-appended" /> : null}
        />
        <DevelopingTimeline notes={idea.developing} />

        <IdeaSectionHeading label="Outcome" />
        <OutcomeBlock outcome={idea.outcome} onDecide={decide} />

        <IdeaSectionHeading label="Plan" />
        <PlanChecklist plan={idea.plan} status={idea.status} onToggle={togglePlan} onAddStep={addStep} />

        <IdeaSectionHeading label="Related" />
        <RelatedSection
          projectIds={idea.relatedProjects}
          peopleIds={idea.relatedPeople}
          onRemoveProject={removeProject}
          onRemovePerson={removePerson}
          onNavigate={onNavigate}
          onAddProject={() => {}}
          onAddPerson={() => {}}
        />

        <IdeaSectionHeading label="Recent Mentions" />
        <IdeaMentionsList mentions={idea.recentMentions} />
      </section>
    </div>
  );
}

Object.assign(window, { IdeaView });
