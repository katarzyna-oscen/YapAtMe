// PersonView — single-person profile page.
//
// Layout mirrors the processed Note view:
//   Header: date (left) + Dictate + Trash buttons (right)
//   Title section: full_name + role / relationship tag chips
//   Stats strip: compact row — open delegates · open talk-about · last mentioned
//   Sections: Summary, Related Projects, Delegate (checklist), Talk About (checklist),
//             Recent Mentions (timeline), Notes (free text)

function fmtPersonAge(d) {
  const days = window.memDaysAgo(d);
  if (days <= 0) {
    const hours = Math.round((MEM_NOW - d) / 3600000);
    if (hours <= 0) return "just now";
    if (hours < 24) return `${hours}h ago`;
  }
  return fmtAge(d);
}

// ────────────────────────────────────────────────────────────
//  Section heading — matches the processed-note h2 style
// ────────────────────────────────────────────────────────────
function PersonSectionHeading({ label, right }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
      margin: "32px 0 12px",
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

// ────────────────────────────────────────────────────────────
//  Stats strip
// ────────────────────────────────────────────────────────────
function PersonStatsStrip({ openDelegate, openTalk, lastMention }) {
  const items = [
    openDelegate > 0 && { value: openDelegate, label: openDelegate === 1 ? "open delegate" : "open delegates", tone: "info" },
    openTalk > 0     && { value: openTalk,     label: openTalk     === 1 ? "to talk about"  : "to talk about",  tone: openTalk  > 2 ? "warn" : null },
    lastMention      && { value: fmtPersonAge(lastMention), label: "last mentioned", tone: null },
  ].filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div style={{
      display: "flex",
      gap: 24,
      padding: "14px 18px",
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      marginTop: 16,
      fontSize: 13,
      color: "var(--text-dim)",
    }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            color: it.tone === "warn" ? "var(--accent)" : "var(--text)",
            fontWeight: 600,
            fontSize: 15,
          }}>{it.value}</span>
          <span style={{ color: "var(--text-very-dim)" }}>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Related projects — chip row that links into project records
// ────────────────────────────────────────────────────────────
function RelatedProjectsList({ ids }) {
  if (!ids || ids.length === 0) return (
    <p style={{ margin: 0, color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 13 }}>
      No linked projects yet.
    </p>
  );
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {ids.map((id) => {
        const p = MEM_PROJECTS.find((x) => x.id === id);
        if (!p) return null;
        const hue = MEM_STATUS[p.status].hue;
        return (
          <div
            key={id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text)",
              transition: "border-color .12s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <span style={{ color: "var(--text-very-dim)" }}>↳</span>
            <span>{p.title}</span>
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: `oklch(0.78 0.16 ${hue})`,
            }} />
            <span style={{ fontSize: 11, color: "var(--text-very-dim)" }}>
              {MEM_STATUS[p.status].label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Checklist (Delegate / Talk About)
// ────────────────────────────────────────────────────────────
function ChecklistSection({ items, emptyText, onToggle }) {
  if (!items || items.length === 0) return (
    <p style={{ margin: 0, color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 13 }}>
      {emptyText}
    </p>
  );
  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {items.map((it, i) => (
        <ChecklistItem
          key={it.id}
          item={it}
          isLast={i === items.length - 1}
          onToggle={() => onToggle(it.id)}
        />
      ))}
    </div>
  );
}

function ChecklistItem({ item, isLast, onToggle }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: hov ? "var(--panel-2)" : "transparent",
        borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
        transition: "background .12s",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: 16, height: 16, flex: "0 0 16px",
          border: "1.5px solid",
          borderColor: item.done ? "var(--success)" : "var(--border-strong)",
          borderRadius: 4,
          background: item.done ? "var(--success)" : "transparent",
          cursor: "pointer", padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--bg)",
        }}
      >
        {item.done && (
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
        )}
      </button>
      <span style={{
        flex: 1, fontSize: 13.5,
        color: item.done ? "var(--text-very-dim)" : "var(--text)",
        textDecoration: item.done ? "line-through" : "none",
      }}>{item.text}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Recent Mentions — timeline list
// ────────────────────────────────────────────────────────────
function RecentMentionsList({ mentions }) {
  if (!mentions || mentions.length === 0) return (
    <p style={{ margin: 0, color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 13 }}>
      No recent mentions.
    </p>
  );
  return (
    <div style={{ position: "relative", paddingLeft: 18 }}>
      <div style={{
        position: "absolute",
        left: 6, top: 6, bottom: 6,
        width: 1,
        background: "var(--border)",
      }} />
      {mentions.map((m, i) => (
        <div key={i} style={{
          position: "relative",
          paddingBottom: i === mentions.length - 1 ? 0 : 16,
        }}>
          <span style={{
            position: "absolute",
            left: -18, top: 6,
            width: 11, height: 11,
            borderRadius: "50%",
            background: "var(--panel)",
            border: "2px solid var(--border-strong)",
          }} />
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 4,
            flexWrap: "wrap",
          }}>
            <span style={{
              fontSize: 11.5,
              color: "var(--text-very-dim)",
              letterSpacing: "0.04em",
              fontVariantNumeric: "tabular-nums",
            }}>
              {m.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
              <span style={{ margin: "0 6px", color: "var(--border-strong)" }}>·</span>
              {fmtAge(m.date)}
            </span>
            {m.source && (
              <span style={{
                fontSize: 11,
                padding: "1px 7px",
                borderRadius: 4,
                background: "var(--panel-2)",
                color: "var(--text-dim)",
                border: "1px solid var(--border-subtle)",
              }}>{m.source}</span>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5, textWrap: "pretty" }}>
            {m.context}
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  PersonView — top-level
// ────────────────────────────────────────────────────────────
function PersonView({ person, onUpdate, onAction }) {
  const [dictating, setDictating] = React.useState(false);
  React.useEffect(() => { setDictating(false); }, [person.id]);

  const openDelegate = (person.delegate || []).filter((d) => !d.done).length;
  const openTalk     = (person.talkAbout || []).filter((d) => !d.done).length;
  const lastMention  = (person.recentMentions || [])
    .map((m) => m.date)
    .sort((a, b) => b - a)[0];

  const toggleDelegate = (id) =>
    onUpdate({
      delegate: person.delegate.map((d) => d.id === id ? { ...d, done: !d.done } : d),
    });
  const toggleTalk = (id) =>
    onUpdate({
      talkAbout: person.talkAbout.map((d) => d.id === id ? { ...d, done: !d.done } : d),
    });

  return (
    <div data-screen-label="Person">
      {/* Header — date left, buttons right (matches Notes/Inbox) */}
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
          UPDATED{" "}
          {person.touched.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
          {" · "}
          {fmtPersonAge(person.touched).toUpperCase()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DictateButton active={dictating} onClick={() => setDictating(!dictating)} />
          <TrashMenuButton
            onAction={(action) => onAction && onAction(action, { id: person.id, label: person.name })}
          />
        </div>
      </header>

      {/* Title + identity metadata */}
      <section style={{ padding: "28px 48px 0" }}>
        <h1 style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: "0 0 14px",
          color: "var(--text)",
          maxWidth: 720,
          textWrap: "balance",
        }}>{person.name}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Tag>{person.role}</Tag>
          <Tag>{person.relationship}</Tag>
        </div>

        <PersonStatsStrip
          openDelegate={openDelegate}
          openTalk={openTalk}
          lastMention={lastMention}
        />
      </section>

      {/* Sections */}
      <section style={{ padding: "8px 48px 48px", maxWidth: 880 }}>
        <PersonSectionHeading label="Summary" />
        {person.summary ? (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty" }}>
            {person.summary}
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 13 }}>
            Nothing here yet.
          </p>
        )}

        <PersonSectionHeading label="Related Projects" />
        <RelatedProjectsList ids={person.relatedProjects} />

        <PersonSectionHeading
          label="Delegate"
          right={
            <span style={{ fontSize: 11.5, color: "var(--text-very-dim)" }}>
              {openDelegate} open · {(person.delegate || []).length} total
            </span>
          }
        />
        <ChecklistSection
          items={person.delegate}
          onToggle={toggleDelegate}
          emptyText="Nothing delegated to this person right now."
        />

        <PersonSectionHeading
          label="Talk About"
          right={
            <span style={{ fontSize: 11.5, color: "var(--text-very-dim)" }}>
              {openTalk} to raise
            </span>
          }
        />
        <ChecklistSection
          items={person.talkAbout}
          onToggle={toggleTalk}
          emptyText="No open items to raise."
        />

        <PersonSectionHeading label="Recent Mentions" />
        <RecentMentionsList mentions={person.recentMentions} />

        <PersonSectionHeading label="Notes" />
        {person.notes ? (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty", whiteSpace: "pre-wrap" }}>
            {person.notes}
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 13 }}>
            Scratch space — observations, context, anything manual.
          </p>
        )}
      </section>
    </div>
  );
}

Object.assign(window, { PersonView });
