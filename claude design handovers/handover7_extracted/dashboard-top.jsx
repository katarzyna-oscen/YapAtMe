// Dashboard sections — top bar, needs-your-call, heatmap, projects, actions, people, ideas

// ────────────────────────────────────────────────────────────
//  Shared helpers
// ────────────────────────────────────────────────────────────
const fmtAge = (d) => {
  const days = window.memDaysAgo(d);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};
const ageDays = (d) => window.memDaysAgo(d);

const STATUS_KEYS = Object.keys(MEM_STATUS);

const StatusPill = ({ status, onChange, small = false }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const meta = MEM_STATUS[status];
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={(e) => {e.stopPropagation();setOpen(!open);}}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: small ? "2px 8px" : "3px 10px",
          fontSize: small ? 11 : 11.5,
          fontWeight: 500,
          letterSpacing: "0.01em",
          borderRadius: 999,
          background: `oklch(0.78 0.14 ${meta.hue} / 0.14)`,
          color: `oklch(0.85 0.13 ${meta.hue})`,
          border: `1px solid oklch(0.78 0.14 ${meta.hue} / 0.28)`,
          cursor: "pointer",
          whiteSpace: "nowrap"
        }}>
        
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: `oklch(0.78 0.16 ${meta.hue})` }} />
        {meta.label}
      </button>
      {open &&
      <div
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          zIndex: 30,
          background: "var(--panel-pop)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 4,
          minWidth: 170,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)"
        }}>
        
          {STATUS_KEYS.map((k) => {
          const m = MEM_STATUS[k];
          return (
            <div
              key={k}
              onClick={(e) => {e.stopPropagation();onChange(k);setOpen(false);}}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                color: k === status ? "var(--text)" : "var(--text-dim)",
                fontSize: 12.5
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: `oklch(0.78 0.16 ${m.hue})` }} />
                {m.label}
                {k === status && <span style={{ marginLeft: "auto", color: "var(--text-very-dim)" }}>✓</span>}
              </div>);

        })}
        </div>
      }
    </div>);

};

// IdeaStatusPill — same affordance as StatusPill but cycles the idea lifecycle
// taxonomy (Spark → Developing → Validate → Decided).
const IDEA_STATUS_KEYS = Object.keys(MEM_IDEA_STATUS);

const IdeaStatusPill = ({ status, onChange, small = false }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const meta = MEM_IDEA_STATUS[status] || MEM_IDEA_STATUS.spark;
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={(e) => {e.stopPropagation();setOpen(!open);}}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: small ? "2px 8px" : "3px 10px",
          fontSize: small ? 11 : 11.5,
          fontWeight: 500,
          letterSpacing: "0.01em",
          borderRadius: 999,
          background: `oklch(0.78 0.14 ${meta.hue} / 0.14)`,
          color: `oklch(0.85 0.13 ${meta.hue})`,
          border: `1px solid oklch(0.78 0.14 ${meta.hue} / 0.28)`,
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: "inherit"
        }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: `oklch(0.78 0.16 ${meta.hue})` }} />
        {meta.label}
      </button>
      {open &&
      <div
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          zIndex: 30,
          background: "var(--panel-pop)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 4,
          minWidth: 170,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)"
        }}>
        {IDEA_STATUS_KEYS.map((k) => {
          const m = MEM_IDEA_STATUS[k];
          return (
            <div
              key={k}
              onClick={(e) => {e.stopPropagation();onChange(k);setOpen(false);}}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                color: k === status ? "var(--text)" : "var(--text-dim)",
                fontSize: 12.5
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: `oklch(0.78 0.16 ${m.hue})` }} />
              {m.label}
              {k === status && <span style={{ marginLeft: "auto", color: "var(--text-very-dim)" }}>✓</span>}
            </div>);
        })}
      </div>
      }
    </div>);
};

const Tag = ({ children }) =>
<span
  style={{
    display: "inline-block",
    padding: "2px 8px",
    fontSize: 11,
    borderRadius: 5,
    background: "var(--panel-2)",
    color: "var(--text-dim)",
    border: "1px solid var(--border-subtle)",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.01em"
  }}>
  
    {children}
  </span>;


// AgeChip — tiered freshness label
//   <  7d  → fresh   (green)
//   < 21d  → aging   (amber)
//   ≥ 21d  → stale   (red)
const AgeChip = ({ date }) => {
  const days = ageDays(date);
  let hue, label;
  if (days < 7) {hue = 150;label = "fresh";} else
  if (days < 21) {hue = 80;label = "aging";} else
  {hue = 22;label = "stale";}
  return (
    <span
      title={fmtAge(date)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 999,
        background: `oklch(0.82 0.13 ${hue} / 0.12)`,
        color: `oklch(0.84 0.13 ${hue})`,
        border: `1px solid oklch(0.82 0.13 ${hue} / 0.28)`,
        fontSize: 11,
        whiteSpace: "nowrap"
      }}>
      
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: `oklch(0.78 0.16 ${hue})`
      }} />
      {label}
    </span>);

};

const SectionHeader = ({ label, right }) =>
<div style={{
  display: "flex", alignItems: "baseline", justifyContent: "space-between",
  margin: "0 0 14px"
}}>
    <div style={{
    fontSize: 11,
    letterSpacing: "0.16em",
    fontWeight: 600,
    color: "var(--text-very-dim)",
    textTransform: "uppercase"
  }}>{label}</div>
    {right}
  </div>;


// ────────────────────────────────────────────────────────────
//  Top bar
// ────────────────────────────────────────────────────────────
function TopBar({ stats }) {
  const date = MEM_NOW.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      padding: "32px 48px 28px",
      borderBottom: "1px solid var(--border-subtle)",
      gap: 24
    }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-very-dim)", letterSpacing: "0.04em", marginBottom: 6 }}>
          {date.toUpperCase()}
        </div>
        <h1 style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: 0,
          color: "var(--text)"
        }}>Command center

        </h1>
        <div style={{
          marginTop: 10,
          display: "flex",
          gap: 18,
          fontSize: 12.5,
          color: "var(--text-dim)"
        }}>
          <StatChip label="projects" value={stats.projects} />
          <StatChip label="stale" value={stats.stale} tone={stats.stale > 0 ? "warn" : null} />
          <StatChip label="open tasks" value={stats.actions} />
        </div>
      </div>
      <ActivityHeatmap />
    </div>);

}

function StatChip({ label, value, tone }) {
  const color = tone === "warn" ? "var(--accent)" : "var(--text)";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ color, fontWeight: 600, fontSize: 14 }}>{value}</span>
      <span style={{ color: "var(--text-very-dim)" }}>{label}</span>
    </span>);

}

// ────────────────────────────────────────────────────────────
//  Needs your call — priority cards
//  Each item is a single actionable line: check it off, see who it
//  relates to, whether it's important, and how fresh it is. No kind
//  labels or reason strings — the title carries the meaning.
// ────────────────────────────────────────────────────────────
function NeedsCallRow({ items: initial }) {
  const { items, setItems, dragId, overId, handlers } = window.useDraggableList(initial);
  const toggle = (id) =>
  setItems((arr) => arr.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const openCount = items.filter((x) => !x.done).length;

  return (
    <section style={{ padding: "28px 48px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "oklch(0.70 0.18 25)",
          boxShadow: "0 0 0 3px oklch(0.70 0.18 25 / 0.18)",
          flex: "0 0 7px"
        }} />
        <span style={{
          fontSize: 11, letterSpacing: "0.16em", fontWeight: 600,
          color: "var(--text-very-dim)", textTransform: "uppercase"
        }}>Needs Your Call</span>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
          {openCount}
        </span>
      </div>

      {items.length === 0 ?
      <div style={{ color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 13 }}>
          Nothing waiting on you.
        </div> :

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) =>
        <NeedsCallRowItem
          key={it.id}
          item={it}
          onToggle={() => toggle(it.id)}
          handlers={handlers(it.id)}
          isDragging={dragId === it.id}
          isOver={overId === it.id} />
        )}
        </div>
      }
    </section>);

}

function NeedsCallRowItem({ item, onToggle, handlers, isDragging, isOver }) {
  const done = item.done;
  return (
    <div
      {...handlers}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "15px 20px",
        background: "var(--panel)",
        border: "1px solid",
        borderColor: isOver ? "var(--accent)" : "var(--border)",
        borderRadius: 12,
        opacity: isDragging ? 0.45 : 1,
        transform: isOver ? "translateY(-1px)" : "none",
        transition: "border-color .15s, transform .15s",
        cursor: "grab"
      }}>

      <span style={{ color: "var(--text-very-dim)", display: "inline-flex" }}>
        <Icon name="drag" size={14} />
      </span>

      <button
        onClick={(e) => {e.stopPropagation();onToggle();}}
        style={{
          width: 20, height: 20, flex: "0 0 20px",
          border: "1.5px solid",
          borderColor: done ? "var(--success)" : "var(--border-strong)",
          borderRadius: 6,
          background: done ? "var(--success)" : "transparent",
          cursor: "pointer", padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--bg)"
        }}>
        {done && <Icon name="check" size={13} />}
      </button>

      <span style={{
        flex: 1,
        color: done ? "var(--text-very-dim)" : "var(--text)",
        textDecoration: done ? "line-through" : "none",
        letterSpacing: "-0.005em", fontSize: "14px"
      }}>{item.title}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
        {item.person &&
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: `oklch(0.74 0.14 ${item.person.hue})` }} />
            {item.person.name}
          </span>
        }
        {item.important && <ImportantPill />}
        <AgeChip date={new Date(MEM_NOW.getTime() - item.age * 86400000)} />
      </div>
    </div>);

}

const ImportantPill = () =>
<span style={{
  display: "inline-flex", alignItems: "center",
  padding: "3px 11px",
  borderRadius: 999,
  background: "oklch(0.70 0.18 25 / 0.14)",
  color: "oklch(0.81 0.15 25)",
  border: "1px solid oklch(0.70 0.18 25 / 0.32)",
  fontSize: 11.5, fontWeight: 500, whiteSpace: "nowrap"
}}>important</span>;

// ────────────────────────────────────────────────────────────
//  Activity heatmap
// ────────────────────────────────────────────────────────────
// Compact heatmap living in the top-right corner of the dashboard.
function ActivityHeatmap() {
  const cells = MEM_ACTIVITY;
  const max = Math.max(...cells.map((c) => c.count));
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const total = cells.reduce((s, c) => s + c.count, 0);
  const streak = (() => {
    let s = 0;for (let i = cells.length - 1; i >= 0; i--) {if (cells[i].count > 0) s++;else break;}return s;
  })();
  const colorFor = (n) => {
    if (n === 0) return "var(--panel-2)";
    const t = n / max;
    return `oklch(${0.34 + t * 0.40} ${0.05 + t * 0.10} 240)`;
  };
  const CELL = 8;
  const GAP = 2;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 8
    }}>
      <div style={{
        fontSize: 12,
        letterSpacing: "0.04em",
        color: "var(--text-very-dim)",
        whiteSpace: "nowrap"
      }}>ACTIVITY · 12 WEEKS</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          fontSize: 11.5,
          color: "var(--text-dim)",
          whiteSpace: "nowrap",
          paddingBottom: 2
        }}>
          <span><span style={{ color: "var(--text)", fontWeight: 600 }}>{total}</span> touches</span>
          <span><span style={{ color: "var(--success)", fontWeight: 600 }}>{streak}</span>d streak</span>
          <span><span style={{ color: "var(--success)", fontWeight: 600 }}>{cells[cells.length - 1].count}</span> today</span>
        </div>
        <div style={{ display: "flex", gap: GAP }}>
          {weeks.map((w, wi) =>
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
              {Array.from({ length: 7 }).map((_, di) => {
              const c = w[di];
              if (!c) return <div key={di} style={{ width: CELL, height: CELL }} />;
              return (
                <div
                  key={di}
                  title={`${c.date.toLocaleDateString()} · ${c.count} touches`}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 2,
                    background: colorFor(c.count)
                  }} />);


            })}
            </div>
          )}
        </div>
      </div>
    </div>);

}

// ────────────────────────────────────────────────────────────
//  Summaries — three AI-generated cards
//
//  • Narrative thread + Current focus share a "Rebuild context" action
//    in the section header — they're regenerated together because they
//    derive from the same source synthesis.
//  • Updates is its own changelog-style card with its own "Generate"
//    button in its top-right corner and a generation-date footer.
// ────────────────────────────────────────────────────────────

const NARRATIVE_THREAD = `Most of the week's energy went into shipping Content System and pushing Memory OS through its first real working dashboard. Underneath that, the IA Framework is the slow-burn project: still triaged, but Sophie's references reframed the scope this morning toward a shared scaffold rather than per-bubble nav. The thread to watch is whether the IA work stays a shadow track or graduates into a real Q3 commit — Katarzyna's review timing forces that call within the next two weeks.`;

const CURRENT_FOCUS = `Friday's hackathon demo and the Content System deploy gate. Everything else can slip a day. Park the Ubuntu.com revamp until the IA framework draft lands — starting both in parallel will dilute both.`;

const UPDATES = [
"Drafted Memory OS dashboard spec",
"Reviewed IA framework scaffold with Elaine",
"Closed Content System deploy ticket",
"Sent Q3 review prep doc to Katarzyna",
"Cleared inbox triage backlog"];



const NARRATIVE_CONTEXT_BUILT_AT = "today, 09:12";
const UPDATES_GENERATED_AT = "today, 16:50";

function Summaries() {
  return (
    <section style={{ padding: "28px 48px 0" }}>
      <SectionHeader
        label="Summaries"
        right={
        <GenerateButton
          label="Generate"
          title="Regenerate Narrative thread and Current focus from current vault state" />

        } />
      
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 14,
        alignItems: "stretch"
      }}>
        <SummaryCard
          title="Narrative thread"
          tone={240}>
          
          <p style={{ ...summaryParagraphStyle, color: "rgb(148, 160, 201)" }}><span style={{ color: "" }}>{NARRATIVE_THREAD}</span></p>
          <SummaryFooter text={`Context built ${NARRATIVE_CONTEXT_BUILT_AT}`} />
        </SummaryCard>

        <SummaryCard
          title="Current focus"
          tone={150}>
          
          <p style={summaryParagraphStyle}><span style={{ color: "#94a0c9" }}>{CURRENT_FOCUS}</span></p>
          <SummaryFooter text={`Context built ${NARRATIVE_CONTEXT_BUILT_AT}`} />
        </SummaryCard>

        <SummaryCard
          title="Updates"
          tone={80}>
          
          <div style={{
            fontSize: 11.5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-very-dim)",
            marginBottom: 8
          }}>Resolved yesterday</div>
          <ul style={updatesListStyle}>
            {UPDATES.map((u, i) =>
            <li key={i} style={updatesItemStyle}>
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="oklch(0.74 0.14 165)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 11px", marginTop: 4 }}>
                  <path d="m3 8 3.5 3.5L13 5" />
                </svg>
                <span style={updatesTextStyle}>{u}</span>
              </li>
            )}
          </ul>
          <SummaryFooter text={`Generated ${UPDATES_GENERATED_AT}`} />
        </SummaryCard>
      </div>
    </section>);

}

// ── card primitive ──
function SummaryCard({ title, tone, action, children }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      padding: "16px 18px",
      background: `linear-gradient(180deg, oklch(0.72 0.13 ${tone} / 0.05), transparent 65%), var(--panel)`,
      border: "1px solid var(--border)",
      borderRadius: 10,
      minHeight: 220
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 10
      }}>
        <h3 style={{
          margin: 0,

          fontWeight: 600,
          letterSpacing: "-0.005em",
          color: "var(--text)", fontSize: "16px"
        }}>{title}</h3>
        {action}
      </div>
      <div style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0
      }}>
        {children}
      </div>
    </div>);

}

// ── footer pinned to bottom of every card ──
function SummaryFooter({ text }) {
  return (
    <div style={{
      marginTop: "auto",
      paddingTop: 12,
      fontSize: 11,
      letterSpacing: "0.04em",
      color: "var(--text-very-dim)",
      fontVariantNumeric: "tabular-nums"
    }}>
      {text}
    </div>);

}

// ── action buttons ──
function RebuildContextButton({ label, title }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        background: hov ? "var(--panel-2)" : "transparent",
        color: hov ? "var(--text)" : "var(--text-dim)",
        border: `1px solid ${hov ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: 6,
        fontSize: 11.5,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s, color .15s"
      }}>
      
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 8a5 5 0 1 1-1.6-3.66" />
        <path d="M13 2.5V5h-2.5" />
      </svg>
      {label}
    </button>);

}

function GenerateButton({ label, title }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        background: hov ? "oklch(0.80 0.13 80 / 0.22)" : "oklch(0.80 0.13 80 / 0.12)",
        color: "oklch(0.88 0.13 80)",
        border: `1px solid ${hov ? "oklch(0.80 0.13 80 / 0.55)" : "oklch(0.80 0.13 80 / 0.36)"}`,
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s"
      }}>
      
      <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
        <path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" />
      </svg>
      {label}
    </button>);

}

// ── shared styles ──
const summaryParagraphStyle = {
  margin: 0,
  fontSize: 13.5,
  lineHeight: 1.55,
  color: "var(--text)",
  textWrap: "pretty"
};
const updatesListStyle = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 8
};
const updatesItemStyle = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 13,
  lineHeight: 1.45
};
const updatesTsStyle = {
  flex: "0 0 86px",
  color: "var(--text-very-dim)",
  fontVariantNumeric: "tabular-nums",
  fontSize: 11,
  letterSpacing: "0.02em"
};
const updatesTextStyle = {
  color: "var(--text-dim)",
  textWrap: "pretty"
};

// Legacy export name kept so app.jsx imports keep working until they're updated.
const WeekSummary = Summaries;

Object.assign(window, {
  fmtAge, ageDays, StatusPill, IdeaStatusPill, Tag, AgeChip, SectionHeader,
  TopBar, NeedsCallRow, ActivityHeatmap, Summaries, WeekSummary
});