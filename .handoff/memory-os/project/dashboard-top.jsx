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
//  Needs your call — list view
// ────────────────────────────────────────────────────────────
function NeedsCallRow({ items }) {
  return (
    <section style={{ padding: "28px 48px 8px" }}>
      <SectionHeader
        label="Needs Your Call"
        right={<span style={{ fontSize: 11.5, color: "var(--accent)" }}>
          {items.length} flagged
        </span>} />
      
      {items.length === 0 ?
      <div style={{ color: "var(--text-very-dim)", fontStyle: "italic" }}>Nothing here</div> :

      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden"
      }}>
          {items.map((it, i) => <NeedsCallRowItem key={it.kind + it.id} item={it} isLast={i === items.length - 1} />)}
        </div>
      }
    </section>);

}

function NeedsCallRowItem({ item, isLast }) {
  let title, kindLabel, icon;
  if (item.kind === "project") {
    const p = MEM_PROJECTS.find((x) => x.id === item.id);
    title = p.title;kindLabel = "Project";icon = "project";
  } else if (item.kind === "person") {
    const p = MEM_PEOPLE.find((x) => x.id === item.id);
    title = p.name;kindLabel = "Person";icon = "person";
  } else {
    const p = MEM_IDEAS.find((x) => x.id === item.id);
    title = p.title;kindLabel = "Idea";icon = "idea";
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px",
      borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
      cursor: "pointer"
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "var(--accent)",
        boxShadow: "0 0 0 3px oklch(0.80 0.13 80 / 0.18)",
        flex: "0 0 6px"
      }} />
      <span style={{ color: "var(--text-very-dim)", display: "inline-flex" }}>
        <Icon name={icon} size={14} />
      </span>
      <span style={{
        fontSize: 11,
        color: "var(--text-very-dim)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        width: 60,
        flex: "0 0 60px"
      }}>{kindLabel}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: "var(--text)" }}>{title}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{item.reason}</span>
      <AgeChip date={new Date(MEM_NOW.getTime() - item.age * 86400000)} />
    </div>);

}

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
//  Summary of the week — short AI-generated digest
// ────────────────────────────────────────────────────────────
const WEEK_SUMMARY = `This week leaned heavily into Memory OS and Design Tokens v2 — both moved meaningfully forward, with six new touches across the dashboard alone. Content System is ready to deploy pending one decision, and the hackathon demo on Friday still needs a call on which two flows to show. Three threads are aging: Tomáš (4 weeks no contact), the Ubuntu.com revamp (triaged for 23 days), and the smart-inbox idea sitting cold in the backlog.`;

function WeekSummary() {
  return (
    <section style={{ padding: "28px 48px 0" }}>
      <SectionHeader
        label="Summary of the Week"
        right={<span style={{ fontSize: 11.5, color: "var(--text-very-dim)" }}>
          past 5 days · auto-generated
        </span>} />
      
      <div style={{
        padding: "18px 20px",
        background: "linear-gradient(180deg, oklch(0.72 0.13 240 / 0.06), transparent 70%), var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10
      }}>
        <p style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text)",
          textWrap: "pretty",
          maxWidth: 880
        }}>
          {WEEK_SUMMARY}
        </p>
      </div>
    </section>);

}

Object.assign(window, {
  fmtAge, ageDays, StatusPill, Tag, AgeChip, SectionHeader,
  TopBar, NeedsCallRow, ActivityHeatmap, WeekSummary
});