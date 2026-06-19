// IdeaView — single-idea file page.
//
// Mirrors the idea markdown spec:
//   Frontmatter → header date line + domain / status / tag chips + related count
//   ## Summary        → AI-generated one-liner (editable)
//   ## Origin         → what triggered the idea
//   ## Developing     → accumulating freeform notes, newest first (AI appends)
//   ## Outcome        → pursuing / parked / killed banner, or decision affordances
//   ## Plan           → checklist, gated to Validate-or-beyond
//   ## Related        → linked projects + people
//   ## Recent Mentions→ auto-populated [[DD-MM-YYYY]] — context lines
//
// Reuses globals: Tag, AgeChip, IdeaStatusPill, Icon, fmtAge (dashboard-top/sidebar)
// and DictateButton / TrashMenuButton / Sparkle (note-view).

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

// AI-touched marker — small sparkle + label, signals machine-written content
function AIBadge({ label = "AI-generated" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase",
      color: "var(--accent)",
    }}>
      <Sparkle spinning={false} />
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
//  Domain chip — single-select pill (filled when set)
// ────────────────────────────────────────────────────────────
function DomainChip({ domain }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 11px",
      fontSize: 11.5,
      fontWeight: 500,
      borderRadius: 999,
      background: "var(--panel-2)",
      color: "var(--text-dim)",
      border: "1px solid var(--border-strong)",
      whiteSpace: "nowrap",
    }}>
      <span style={{ color: "var(--text-very-dim)", fontSize: 11 }}>domain</span>
      <span style={{ color: "var(--text)", fontWeight: 600 }}>{domain}</span>
    </span>
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
//  Outcome — decision banner, or three affordances when undecided
// ────────────────────────────────────────────────────────────
const OUTCOME_META = {
  pursuing: { hue: 150, label: "Pursuing" },
  parked:   { hue: 80,  label: "Parked" },
  killed:   { hue: 22,  label: "Killed" },
};

function OutcomeBlock({ outcome, onDecide }) {
  if (!outcome) {
    return (
      <React.Fragment>
        <IdeaPlaceholder>No decision yet. When you make the call, record it here.</IdeaPlaceholder>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          {Object.keys(OUTCOME_META).map((k) => {
            const m = OUTCOME_META[k];
            return <OutcomeChoice key={k} hue={m.hue} label={m.label} onClick={() => onDecide && onDecide(k)} />;
          })}
        </div>
      </React.Fragment>
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
        gap: 7,
        padding: "7px 14px",
        fontSize: 13,
        borderRadius: 999,
        background: `oklch(0.78 0.13 ${hue} / ${hov ? 0.18 : 0.10})`,
        color: `oklch(0.84 0.13 ${hue})`,
        border: `1px solid oklch(0.78 0.13 ${hue} / ${hov ? 0.5 : 0.3})`,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .12s, border-color .12s",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
//  Plan — checklist, gated to Validate-or-beyond
// ────────────────────────────────────────────────────────────
const IDEA_STAGE_ORDER = ["spark", "developing", "validate", "decided"];

function PlanChecklist({ plan, status, onToggle }) {
  const gated = IDEA_STAGE_ORDER.indexOf(status) < IDEA_STAGE_ORDER.indexOf("validate");
  if (gated) {
    return (
      <IdeaPlaceholder>
        A plan opens up at the <b style={{ fontStyle: "normal", color: "var(--text-dim)" }}>Validate</b> stage. Move the idea forward to start a checklist.
      </IdeaPlaceholder>
    );
  }
  if (!plan || plan.length === 0) return (
    <IdeaPlaceholder>No steps yet. Break the idea into the main moves to validate it.</IdeaPlaceholder>
  );
  const done = plan.filter((s) => s.done).length;
  return (
    <div>
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}>
        {plan.map((s, i) => (
          <PlanItem key={s.id} item={s} isLast={i === plan.length - 1} onToggle={() => onToggle(s.id)} />
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-very-dim)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
        {done} of {plan.length} done · steps feed the Plans screen
      </div>
    </div>
  );
}

function PlanItem({ item, isLast, onToggle }) {
  const [hov, setHov] = React.useState(false);
  const [boxHov, setBoxHov] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: hov ? "var(--panel-2)" : "transparent",
        borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
        transition: "background .12s",
      }}
    >
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
        flex: 1, fontSize: 14,
        color: item.done ? "var(--text-very-dim)" : "var(--text)",
        textDecoration: item.done ? "line-through" : "none",
      }}>{item.text}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Related — linked projects + people
// ────────────────────────────────────────────────────────────
function RelatedList({ projectIds, peopleIds, onNavigate }) {
  const projects = (projectIds || []).map((id) => MEM_PROJECTS.find((x) => x.id === id)).filter(Boolean);
  const people = (peopleIds || []).map((id) => MEM_PEOPLE.find((x) => x.id === id)).filter(Boolean);
  if (projects.length === 0 && people.length === 0) return (
    <IdeaPlaceholder>No links yet. Connect the projects and people this idea touches.</IdeaPlaceholder>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {projects.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--text-very-dim)", marginBottom: 8 }}>Projects</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map((p) => (
              <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-very-dim)", flex: "0 0 5px" }} />
                <IdeaLink label={p.title} hue={80} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {people.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--text-very-dim)", marginBottom: 8 }}>People</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {people.map((p) => (
              <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-very-dim)", flex: "0 0 5px" }} />
                <IdeaLink label={p.name} hue={260} onClick={() => onNavigate && onNavigate({ type: "person", id: p.id })} />
              </li>
            ))}
          </ul>
        </div>
      )}
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

  const decide = (decision) => {
    const text = {
      pursuing: "Marked as pursuing — turn this into a project to start delivery.",
      parked:   "Parked for now — revisit when there's capacity.",
      killed:   "Killed — not worth pursuing.",
    }[decision];
    onUpdate({ outcome: { decision, text, date: MEM_NOW }, status: "decided" });
  };

  const relatedCount = (idea.relatedProjects || []).length + (idea.relatedPeople || []).length;

  return (
    <div data-screen-label="Idea">
      {/* Header — capture/update date line (left), actions (right) */}
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
          CAPTURED {fmtDMY(idea.origin)}
          {" · "}
          {fmtIdeaAge(idea.origin).toUpperCase()}
          {idea.lastUpdated && (
            <React.Fragment>
              {" · UPDATED "}
              {fmtDMY(idea.lastUpdated)}
            </React.Fragment>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DictateButton active={dictating} onClick={() => setDictating(!dictating)} />
          <TrashMenuButton
            onAction={(action) => onAction && onAction(action, { id: idea.id, label: idea.title })}
          />
        </div>
      </header>

      {/* Title + frontmatter chips */}
      <section style={{ padding: "28px 48px 0" }}>
        <h1 style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: "0 0 14px",
          color: "var(--text)",
          maxWidth: 760,
          textWrap: "balance",
        }}>{idea.title}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <DomainChip domain={idea.domain} />
          <IdeaStatusPill status={idea.status} onChange={(s) => onUpdate({ status: s })} />
          {relatedCount > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-very-dim)" }}>
              {relatedCount} link{relatedCount === 1 ? "" : "s"}
            </span>
          )}
          <span style={{ display: "inline-flex", gap: 6, marginLeft: 4, flexWrap: "wrap" }}>
            {(idea.tags || []).map((t) => <Tag key={t}>{t}</Tag>)}
          </span>
        </div>
      </section>

      {/* Sections */}
      <section style={{ padding: "8px 48px 64px", maxWidth: 880 }}>
        <IdeaSectionHeading label="Summary" right={<AIBadge />} />
        {idea.summary ? (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--text)", textWrap: "pretty" }}>
            {idea.summary}
          </p>
        ) : (
          <IdeaPlaceholder>One sentence — generated on first processing, yours to edit.</IdeaPlaceholder>
        )}

        <IdeaSectionHeading label="Origin" />
        {idea.originText ? (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty" }}>
            {idea.originText}
          </p>
        ) : (
          <IdeaPlaceholder>Why did this come up? What triggered it?</IdeaPlaceholder>
        )}

        <IdeaSectionHeading
          label="Developing"
          right={(idea.developing || []).length > 0 ? <AIBadge label="auto-appended" /> : null}
        />
        <DevelopingTimeline notes={idea.developing} />

        <IdeaSectionHeading label="Outcome" />
        <OutcomeBlock outcome={idea.outcome} onDecide={decide} />

        <IdeaSectionHeading label="Plan" />
        <PlanChecklist plan={idea.plan} status={idea.status} onToggle={togglePlan} />

        <IdeaSectionHeading label="Related" />
        <RelatedList projectIds={idea.relatedProjects} peopleIds={idea.relatedPeople} onNavigate={onNavigate} />

        <IdeaSectionHeading label="Recent Mentions" />
        <IdeaMentionsList mentions={idea.recentMentions} />
      </section>
    </div>
  );
}

Object.assign(window, { IdeaView });
