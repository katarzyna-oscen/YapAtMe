// Note views — there are two flavours:
//   1. InboxNoteView    : raw intake (typed/dictated). Minimal chrome.
//   2. ProcessedNoteView: structured note in the Notes folder. Rich layout.

function fmtCreated(d) {
  const days = window.memDaysAgo(d);
  if (days <= 0) {
    const hours = Math.round((MEM_NOW - d) / 3600000);
    if (hours <= 0) return "just now";
    if (hours < 24) return `${hours}h ago`;
  }
  return fmtAge(d);
}

// ────────────────────────────────────────────────────────────
//  Inbox note view (intake)
// ────────────────────────────────────────────────────────────
function InboxNoteView({ note, onAction }) {
  const [title, setTitle] = React.useState(note.title || "");
  const [body, setBody]   = React.useState(note.body || "");
  const [dictating, setDictating]   = React.useState(false);
  const [processing, setProcessing] = React.useState(false);

  // Reset state when switching notes
  React.useEffect(() => {
    setTitle(note.title || "");
    setBody(note.body || "");
    setDictating(false);
    setProcessing(false);
  }, [note.id]);

  return (
    <div data-screen-label="Inbox note" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Header — fixed date title (left) + action buttons (right) */}
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
          {note.dateTitle.toUpperCase()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DictateButton active={dictating} onClick={() => setDictating(!dictating)} />
          <ProcessButton
            processing={processing}
            onClick={() => {
              setProcessing(true);
              setTimeout(() => setProcessing(false), 1800);
            }}
          />
          <TrashMenuButton
            onAction={(action) => onAction && onAction(action, { id: note.id, label: note.dateTitle.split(" · ")[0] })}
          />
        </div>
      </header>

      {/* Editable canvas — title + body */}
      <div style={{ flex: 1, padding: "32px 48px 48px", maxWidth: 760 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled — type a subject or leave blank"
          style={{
            display: "block",
            width: "100%",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
            marginBottom: 20,
            fontFamily: "inherit",
          }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Start typing, or hit Dictate…"
          style={{
            display: "block",
            width: "100%",
            minHeight: 420,
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--text-dim)",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
            resize: "none",
            fontFamily: "inherit",
          }}
        />
      </div>
    </div>
  );
}

function DictateButton({ active, onClick }) {
  const [hov, setHov] = React.useState(false);
  const bgActive = "oklch(0.70 0.18 22 / 0.16)";
  const bgActiveHov = "oklch(0.70 0.18 22 / 0.24)";
  const bgIdle = "var(--panel)";
  const bgIdleHov = "var(--panel-2)";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: active ? (hov ? bgActiveHov : bgActive) : (hov ? bgIdleHov : bgIdle),
        color: active ? "oklch(0.84 0.16 22)" : "var(--text)",
        border: `1px solid ${
          active
            ? (hov ? "oklch(0.70 0.18 22 / 0.55)" : "oklch(0.70 0.18 22 / 0.40)")
            : (hov ? "var(--border-strong)" : "var(--border)")
        }`,
        borderRadius: 8,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s",
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: active ? "oklch(0.75 0.20 22)" : "var(--text-very-dim)",
        boxShadow: active ? "0 0 0 4px oklch(0.70 0.18 22 / 0.20)" : "none",
        animation: active ? "pulse 1.2s ease-in-out infinite" : "none",
      }} />
      {active ? "Recording…" : "Dictate"}
    </button>
  );
}

function ProcessButton({ processing, onClick }) {
  const [hov, setHov] = React.useState(false);
  const baseBg = "oklch(0.80 0.13 80 / 0.12)";
  const hovBg  = "oklch(0.80 0.13 80 / 0.22)";
  return (
    <button
      onClick={onClick}
      disabled={processing}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: processing ? "oklch(0.80 0.13 80 / 0.18)" : (hov ? hovBg : baseBg),
        color: "oklch(0.88 0.13 80)",
        border: `1px solid ${hov ? "oklch(0.80 0.13 80 / 0.55)" : "oklch(0.80 0.13 80 / 0.36)"}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: processing ? "wait" : "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s",
      }}
    >
      <Sparkle spinning={processing} />
      {processing ? "Processing…" : "Process note"}
    </button>
  );
}

function Sparkle({ spinning }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13" height="13"
      fill="currentColor"
      style={{
        animation: spinning ? "sparkleSpin 1.2s linear infinite" : "none",
      }}
    >
      <path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" />
    </svg>
  );
}

// TrashMenuButton — icon-only button that opens an Archive/Delete dropdown.
// Routes both actions through the same parent handler that opens the confirm modal.
function TrashMenuButton({ onAction }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Archive or delete"
        title="Archive or delete"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          background: open ? "var(--panel-2)" : "var(--panel)",
          color: open ? "var(--text)" : "var(--text-dim)",
          border: `1px solid ${open ? "var(--border-strong)" : "var(--border)"}`,
          borderRadius: 8,
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
          transition: "background .12s, color .12s, border-color .12s",
        }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = "var(--panel-2)"; e.currentTarget.style.color = "var(--text)"; } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = "var(--panel)"; e.currentTarget.style.color = "var(--text-dim)"; } }}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5h10" />
          <path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
          <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
          <path d="M7 7v4M9 7v4" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            minWidth: 160,
            padding: 4,
            background: "var(--panel-pop)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)",
          }}
        >
          <TrashMenuItem
            label="Archive"
            onClick={() => { setOpen(false); onAction && onAction("archive"); }}
          />
          <TrashMenuItem
            label="Delete"
            danger
            onClick={() => { setOpen(false); onAction && onAction("delete"); }}
          />
        </div>
      )}
    </div>
  );
}

function TrashMenuItem({ label, onClick, danger }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        borderRadius: 5,
        fontSize: 13,
        cursor: "pointer",
        color: danger
          ? (hov ? "oklch(0.84 0.16 22)" : "var(--text-dim)")
          : (hov ? "var(--text)" : "var(--text-dim)"),
        background: hov
          ? (danger ? "oklch(0.70 0.18 22 / 0.12)" : "var(--panel-2)")
          : "transparent",
      }}
    >
      {label}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Processed note view (Notes folder)
// ────────────────────────────────────────────────────────────
function NoteBody({ blocks }) {
  return (
    <div style={{ maxWidth: 720, fontSize: 14.5, lineHeight: 1.65, color: "var(--text)" }}>
      {blocks.map((b, i) => {
        if (b.type === "p")  return <p key={i} style={{ margin: "0 0 16px", color: "var(--text-dim)", textWrap: "pretty" }}>{b.text}</p>;
        if (b.type === "h")  return (
          <h2 key={i} style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-very-dim)",
            margin: "26px 0 12px",
          }}>{b.text}</h2>
        );
        if (b.type === "ul") return (
          <ul key={i} style={{ margin: "0 0 16px", paddingLeft: 0, listStyle: "none" }}>
            {b.items.map((it, j) => (
              <li key={j} style={{
                position: "relative",
                paddingLeft: 22,
                color: "var(--text-dim)",
                margin: "0 0 6px",
              }}>
                <span style={{
                  position: "absolute", left: 6, top: "0.7em",
                  width: 4, height: 4, borderRadius: "50%",
                  background: "var(--text-very-dim)",
                }} />
                {it}
              </li>
            ))}
          </ul>
        );
        if (b.type === "ol") return (
          <ol key={i} style={{ margin: "0 0 16px", paddingLeft: 22, color: "var(--text-dim)" }}>
            {b.items.map((it, j) => (
              <li key={j} style={{ margin: "0 0 6px" }}>{it}</li>
            ))}
          </ol>
        );
        return null;
      })}
    </div>
  );
}

function NoteAction({ label, hue, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: `oklch(0.78 0.13 ${hue} / 0.10)`,
        color: `oklch(0.84 0.13 ${hue})`,
        border: `1px solid oklch(0.78 0.13 ${hue} / 0.30)`,
        borderRadius: 999,
        fontSize: 12.5,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = `oklch(0.78 0.13 ${hue} / 0.18)`}
      onMouseLeave={(e) => e.currentTarget.style.background = `oklch(0.78 0.13 ${hue} / 0.10)`}
    >
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: `oklch(0.78 0.16 ${hue})`,
      }} />
      {label}
    </button>
  );
}

function BacklinkChip({ id }) {
  let label = id;
  const p = MEM_PROJECTS.find((x) => x.id === id);
  if (p) label = p.title;
  const person = MEM_PEOPLE.find((x) => x.id === id);
  if (person) label = person.name;
  const idea = MEM_IDEAS.find((x) => x.id === id);
  if (idea) label = idea.title;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 6,
      background: "var(--panel-2)",
      border: "1px solid var(--border-subtle)",
      color: "var(--text-dim)",
      fontSize: 12,
      cursor: "pointer",
    }}>
      <span style={{ color: "var(--text-very-dim)" }}>↳</span>
      {label}
    </span>
  );
}

function ProcessedNoteView({ note, onAction }) {
  const [dictating, setDictating] = React.useState(false);
  React.useEffect(() => { setDictating(false); }, [note.id]);
  return (
    <div data-screen-label="Note">
      {/* Header — same layout as Inbox note: date (left), buttons (right) */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 48px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        gap: 16,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: 13,
            color: "var(--text-very-dim)",
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
          }}>
            {note.created.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
            {" · "}
            {fmtCreated(note.created).toUpperCase()}
          </span>
          <AgeChip date={note.created} />
          {note.tags.map((t) => <Tag key={t}>#{t}</Tag>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DictateButton active={dictating} onClick={() => setDictating(!dictating)} />
          <TrashMenuButton
            onAction={(action) => onAction && onAction(action, { id: note.id, label: note.id })}
          />
        </div>
      </header>

      {/* Title */}
      <section style={{ padding: "28px 48px 12px" }}>
        <h1 style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: 0,
          color: "var(--text)",
          maxWidth: 720,
          textWrap: "balance",
        }}>{note.title}</h1>
      </section>

      <section style={{ padding: "20px 48px 12px" }}>
        <NoteBody blocks={note.body} />
      </section>

      {note.backlinks?.length > 0 && (
        <section style={{ padding: "8px 48px 4px" }}>
          <SectionHeader label="Linked" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {note.backlinks.map((id) => <BacklinkChip key={id} id={id} />)}
          </div>
        </section>
      )}

      <section style={{ padding: "24px 48px 48px", marginTop: 12 }}>
        <SectionHeader label="Process" />
        <div style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          padding: "16px 18px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}>
          <NoteAction label="Convert to task"    hue={230} />
          <NoteAction label="Convert to idea"    hue={80}  />
          <NoteAction label="Attach to project"  hue={150} />
          <NoteAction label="Add to person"      hue={260} />
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 10 }}>
            <NoteAction label="Archive"          hue={22}  />
          </span>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { InboxNoteView, ProcessedNoteView });
