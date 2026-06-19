// PersonView — single-person profile page.
//
// Layout mirrors the screenshot redraw:
//   Header: "UPDATED <date> · <age> · saved <time>" (left) + Dictate + Trash (right)
//   Title:  full_name
//   Chips:  Role / Relationship (filled Tag when set, dashed "+ Add" chip when empty)
//           + amber "N to talk about" count chip
//   Sections (in order): Talk About (checklist), Summary, Related Projects (bulleted
//           links), Recent Mentions (date — context lines), Notes
//
// Empty fields render an italic placeholder prompt instead of being hidden, so the
// record reads as a fill-in-the-blanks profile.

function fmtPersonAge(d) {
  const days = window.memDaysAgo(d);
  if (days <= 0) {
    const hours = Math.round((MEM_NOW - d) / 3600000);
    if (hours <= 0) return "just now";
    if (hours < 24) return `${hours}h ago`;
  }
  return fmtAge(d);
}

// DD-MM-YYYY (matches the app's mention date format)
function fmtMentionDate(d) {
  return d.toLocaleDateString("en-GB").replaceAll("/", "-");
}

// Lowercase just the first character (chips read with a small initial letter)
function lcFirst(s) {
  return (typeof s === "string" && s.length) ? s[0].toLowerCase() + s.slice(1) : s;
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

// Italic prompt shown when a field is empty
function PersonPlaceholder({ children }) {
  return (
    <p style={{ margin: 0, color: "var(--text-very-dim)", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.6 }}>
      {children}
    </p>
  );
}

// ────────────────────────────────────────────────────────────
//  Identity chips — Role / Relationship + "to talk about" count
// ────────────────────────────────────────────────────────────
function AddChip({ label, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 11px",
        fontSize: 12.5,
        borderRadius: 7,
        background: hov ? "var(--panel-2)" : "var(--panel)",
        color: hov ? "var(--text)" : "var(--text-dim)",
        border: `1px dashed ${hov ? "var(--info)" : "var(--border-strong)"}`,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .12s, color .12s, border-color .12s",
      }}
    >
      <span style={{ color: "var(--text-very-dim)", fontWeight: 500 }}>+</span> {lcFirst(label)}
    </button>
  );
}

function TalkCountChip({ count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        fontSize: 12.5,
        borderRadius: 7,
        background: "oklch(0.80 0.13 80 / 0.10)",
        color: "var(--accent)",
        border: "1px solid oklch(0.80 0.13 80 / 0.28)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <b style={{ fontWeight: 600 }}>{count}</b> to talk about
    </button>
  );
}

// ────────────────────────────────────────────────────────────
//  Related projects — bulleted list of links into project records
// ────────────────────────────────────────────────────────────
function RelatedProjectsList({ ids }) {
  const projects = (ids || []).map((id) => MEM_PROJECTS.find((x) => x.id === id)).filter(Boolean);
  return (
    <React.Fragment>
      <PersonPlaceholder>Link projects this person is involved in.</PersonPlaceholder>
      {projects.length > 0 && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((p) => (
            <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-very-dim)", flex: "0 0 5px" }} />
              <ProjectLink title={p.title} />
            </li>
          ))}
        </ul>
      )}
    </React.Fragment>
  );
}

function ProjectLink({ title }) {
  const [hov, setHov] = React.useState(false);
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        color: "var(--accent)",
        fontWeight: 600,
        textDecoration: "none",
        borderBottom: `1px solid ${hov ? "var(--accent)" : "oklch(0.80 0.13 80 / 0.4)"}`,
        paddingBottom: 1,
        transition: "border-color .12s",
      }}
    >{title}</a>
  );
}

// ────────────────────────────────────────────────────────────
//  Checklist (Talk About)
// ────────────────────────────────────────────────────────────
function ChecklistSection({ items, emptyText, onToggle }) {
  if (!items || items.length === 0) return (
    <PersonPlaceholder>{emptyText}</PersonPlaceholder>
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
//  Recent Mentions — "DD-MM-YYYY — context" lines
// ────────────────────────────────────────────────────────────
function RecentMentionsList({ mentions }) {
  if (!mentions || mentions.length === 0) return (
    <PersonPlaceholder>No recent mentions yet.</PersonPlaceholder>
  );
  const sorted = [...mentions].sort((a, b) => b.date - a.date);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sorted.map((m, i) => (
        <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--text-dim)", textWrap: "pretty" }}>
          <MentionDate date={m.date} /> — {m.context}
        </p>
      ))}
    </div>
  );
}

function MentionDate({ date }) {
  const [hov, setHov] = React.useState(false);
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        color: "var(--accent)",
        fontWeight: 600,
        textDecoration: "none",
        borderBottom: `1px solid ${hov ? "var(--accent)" : "oklch(0.80 0.13 80 / 0.4)"}`,
        fontVariantNumeric: "tabular-nums",
      }}
    >{fmtMentionDate(date)}</a>
  );
}

// Small link icon shown to the right of the Summary heading
function CopyLinkIcon() {
  const [hov, setHov] = React.useState(false);
  return (
    <span
      title="Copy link"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ color: hov ? "var(--text-dim)" : "var(--text-very-dim)", display: "inline-flex", cursor: "pointer", transition: "color .12s" }}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 9.5a2.5 2.5 0 0 0 3.6.1l2-2a2.5 2.5 0 0 0-3.5-3.6l-1.1 1.1" />
        <path d="M9.5 6.5a2.5 2.5 0 0 0-3.6-.1l-2 2a2.5 2.5 0 0 0 3.5 3.6l1.1-1.1" />
      </svg>
    </span>
  );
}

// ────────────────────────────────────────────────────────────
//  PersonView — top-level
// ────────────────────────────────────────────────────────────
function PersonView({ person, onUpdate, onAction }) {
  const [dictating, setDictating] = React.useState(false);
  React.useEffect(() => { setDictating(false); }, [person.id]);

  const openTalk = (person.talkAbout || []).filter((d) => !d.done).length;

  const toggleTalk = (id) =>
    onUpdate({
      talkAbout: person.talkAbout.map((d) => d.id === id ? { ...d, done: !d.done } : d),
    });

  const savedTime = person.touched.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

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
          {" · SAVED "}
          {savedTime}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DictateButton active={dictating} onClick={() => setDictating(!dictating)} />
          <TrashMenuButton
            onAction={(action) => onAction && onAction(action, { id: person.id, label: person.name })}
          />
        </div>
      </header>

      {/* Title + identity chips */}
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
          {person.role ? <Tag>{lcFirst(person.role)}</Tag> : <AddChip label="Role" />}
          {person.relationship ? <Tag>{lcFirst(person.relationship)}</Tag> : <AddChip label="Relationship" />}
          {openTalk > 0 && <TalkCountChip count={openTalk} />}
        </div>
      </section>

      {/* Sections */}
      <section style={{ padding: "8px 48px 56px", maxWidth: 880 }}>
        <PersonSectionHeading label={`Talk About · ${(person.talkAbout || []).length}`} />
        <ChecklistSection
          items={person.talkAbout}
          onToggle={toggleTalk}
          emptyText="No open items to raise."
        />

        <PersonSectionHeading label="Summary" right={<CopyLinkIcon />} />
        {person.summary ? (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty" }}>
            {person.summary}
          </p>
        ) : (
          <PersonPlaceholder>Who is this person and why do they matter to you?</PersonPlaceholder>
        )}

        <PersonSectionHeading label="Related Projects" />
        <RelatedProjectsList ids={person.relatedProjects} />

        <PersonSectionHeading label="Recent Mentions" />
        <RecentMentionsList mentions={person.recentMentions} />

        <PersonSectionHeading label="Notes" />
        {person.notes ? (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)", textWrap: "pretty", whiteSpace: "pre-wrap" }}>
            {person.notes}
          </p>
        ) : (
          <PersonPlaceholder>Observations, context, anything worth remembering about this person.</PersonPlaceholder>
        )}
      </section>
    </div>
  );
}

Object.assign(window, { PersonView });
