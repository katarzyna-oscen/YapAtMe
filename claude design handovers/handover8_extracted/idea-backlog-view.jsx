// IdeaBacklogView — the holding queue between inbox and a filed Idea.
//
// Flow it sits in:
//   inbox note → Process → AI detects an idea, tags the text #idea and drops a
//   one-line summary here. From this backlog the user tags a category (Ops / AI /
//   Design / Process / Research, or a new one) and promotes it to a full Idea
//   file built on the idea-view template. Items can also be killed (not an idea).
//
// Compact rows, mirroring the Tasks list. Reuses globals: AgeChip, Icon.

function fmtBacklogSource(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

// ── Category picker ────────────────────────────────────────────
// A button that shows the chosen category (amber) or "+ Category", opening a
// dropdown of preset chips plus an inline "new category" field.
function CategoryPicker({ value, categories, onSelect, onAddCategory }) {
  const [open, setOpen] = React.useState(false);
  const [hov, setHov] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setDraft(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const commitNew = () => {
    const t = draft.trim();
    if (!t) return;
    onAddCategory && onAddCategory(t);
    onSelect(t);
    setDraft("");
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 9px",
          fontSize: 11,
          fontWeight: 500,
          borderRadius: 999,
          background: value
            ? "oklch(0.78 0.13 80 / 0.12)"
            : hov ? "var(--panel-2)" : "transparent",
          color: value ? "oklch(0.86 0.12 80)" : "var(--text-very-dim)",
          border: `1px solid ${value
            ? "oklch(0.78 0.13 80 / 0.32)"
            : hov ? "var(--border-strong)" : "var(--border)"}`,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          transition: "background .12s, border-color .12s, color .12s",
        }}
      >
        {value ? (
          <React.Fragment>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.80 0.15 80)" }} />
            {value}
          </React.Fragment>
        ) : (
          <React.Fragment><span style={{ fontSize: 12, lineHeight: 1 }}>+</span> Category</React.Fragment>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40,
          background: "var(--panel-pop)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 10, width: 220,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)",
        }}>
          <div style={{
            fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--text-very-dim)", fontWeight: 600, marginBottom: 8,
          }}>File under</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {categories.map((c) => {
              const on = c === value;
              return (
                <button
                  key={c}
                  onClick={() => { onSelect(on ? null : c); setOpen(false); }}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: on ? "oklch(0.78 0.13 80 / 0.16)" : "var(--panel-2)",
                    color: on ? "oklch(0.86 0.12 80)" : "var(--text-dim)",
                    border: `1px solid ${on ? "oklch(0.78 0.13 80 / 0.4)" : "var(--border-subtle)"}`,
                    transition: "background .12s",
                  }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--border)"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "var(--panel-2)"; }}
                >{c}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitNew(); }}
              placeholder="New category…"
              style={{
                flex: 1, minWidth: 0,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: "var(--text)",
                fontSize: 12.5,
                padding: "6px 9px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={commitNew}
              style={{
                flex: "0 0 auto",
                padding: "0 11px",
                borderRadius: 7,
                border: "1px solid var(--border-strong)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontSize: 12.5,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create idea button ──────────────────────────────────────────
// (kept for reference; the action now lives in the row kebab menu)

// ── Row kebab menu (3-dot) — matches the Tasks row menu exactly ──
function BacklogRowMenu({ hovered, onPromote, onKill }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });
  const menuBtnRef = React.useRef(null);
  const menuRef = React.useRef(null);

  const openMenu = () => {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (r) {
      const width = 168;
      setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - width) });
    }
    setMenuOpen(true);
  };

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const closeOnScroll = () => setMenuOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [menuOpen]);

  return (
    <div ref={menuRef} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        ref={menuBtnRef}
        onClick={(e) => { e.stopPropagation(); openMenu(); }}
        aria-label="More actions"
        style={{
          width: 22, height: 22,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: menuOpen ? "var(--border)" : "transparent",
          color: "var(--text-dim)",
          borderRadius: 5,
          cursor: "pointer",
          padding: 0,
          opacity: (hovered || menuOpen) ? 1 : 0.3,
          transition: "opacity .12s, background .12s",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = "var(--border)"; }}
        onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = "transparent"; }}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>
      {menuOpen && ReactDOM.createPortal(
        <div
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 200,
            minWidth: 168,
            padding: 4,
            background: "var(--panel-pop)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)",
          }}
        >
          <BacklogMenuItem
            label="Create idea"
            accent
            icon={
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" />
                <path d="M6 14h4" />
              </svg>
            }
            onClick={() => { setMenuOpen(false); onPromote(); }}
          />
          <BacklogMenuItem
            label="Kill idea"
            danger
            icon={
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4.5h10" />
                <path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
                <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
                <path d="M7 7v4M9 7v4" />
              </svg>
            }
            onClick={() => { setMenuOpen(false); onKill(); }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

function BacklogMenuItem({ label, icon, onClick, danger, accent }) {
  const [hov, setHov] = React.useState(false);
  let color = hov ? "var(--text)" : "var(--text-dim)";
  let bg = hov ? "var(--panel-2)" : "transparent";
  if (danger) {
    color = hov ? "oklch(0.84 0.16 22)" : "var(--text-dim)";
    bg = hov ? "oklch(0.70 0.18 22 / 0.12)" : "transparent";
  } else if (accent) {
    color = hov ? "oklch(0.88 0.13 80)" : "var(--text-dim)";
    bg = hov ? "oklch(0.80 0.13 80 / 0.12)" : "transparent";
  }
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: 5,
        fontSize: 12.5,
        cursor: "pointer",
        color,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "inline-flex", flex: "0 0 auto" }}>{icon}</span>
      {label}
    </div>
  );
}

// ── One backlog row ─────────────────────────────────────────────
// ── Triage status chip ──────────────────────────────────────────
// A backlog item's status reflects where it sits in triage, not the idea
// lifecycle (it isn't a filed idea yet):
//   no category  → New   (needs a category before it can be filed)
//   categorized  → Ready (ready to promote into an Idea)
function BacklogStatusChip({ category }) {
  const ready = !!category;
  const hue = ready ? 150 : 240;
  const label = ready ? "Ready" : "New";
  return (
    <span
      title={ready ? "Categorized — ready to file as an idea" : "Just landed — pick a category to file it"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 999,
        background: `oklch(0.80 0.13 ${hue} / 0.12)`,
        color: `oklch(0.85 0.12 ${hue})`,
        border: `1px solid oklch(0.80 0.13 ${hue} / 0.28)`,
        fontSize: 11,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: `oklch(0.78 0.16 ${hue})` }} />
      {label}
    </span>
  );
}

function BacklogRow({ item, categories, isLast, onSetCategory, onAddCategory, onPromote, onKill, onNavigate }) {
  const [hov, setHov] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderTop: isLast === "first" ? "none" : "1px solid var(--border-subtle)",
        background: hov ? "var(--panel-2)" : "transparent",
        transition: "background .12s",
      }}
    >
      <span style={{ color: "var(--text-very-dim)", display: "inline-flex", flex: "0 0 auto" }}>
        <Icon name="idea" size={15} />
      </span>

      {/* Summary — flexes and truncates to one line, leaving room for chips */}
      <span
        title={item.summary}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          color: "var(--text)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >{item.summary}</span>

      {/* Chip cluster — category picker + freshness + triage status */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
        <CategoryPicker
          value={item.category}
          categories={categories}
          onSelect={(c) => onSetCategory(item.id, c)}
          onAddCategory={onAddCategory}
        />
        <AgeChip date={item.captured} />
        <BacklogStatusChip category={item.category} />
      </div>

      <BacklogRowMenu hovered={hov} onPromote={() => onPromote(item)} onKill={() => onKill(item)} />
    </div>
  );
}

// ── View ────────────────────────────────────────────────────────
function IdeaBacklogView({ backlog, categories, onSetCategory, onAddCategory, onPromote, onKill, onNavigate }) {
  const count = backlog.length;
  return (
    <div data-screen-label="Ideas backlog" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 48px 20px",
        borderBottom: "1px solid var(--border-subtle)",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
            color: "var(--text)",
          }}>Ideas backlog</h1>
          <span style={{ fontSize: 13, color: "var(--text-very-dim)" }}>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{count}</span> waiting
          </span>
        </div>
      </header>

      <div style={{ padding: "22px 48px 48px" }}>
        <p style={{
          margin: "0 0 20px",
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--text-dim)",
          maxWidth: 720,
          textWrap: "pretty",
        }}>
          Ideas the AI spotted in your notes and tagged <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>#idea</span> land here.
          File one under a category to promote it into a full idea, or kill it if it isn’t one.
        </p>

        {count === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            padding: "64px 24px",
            border: "1px dashed var(--border)",
            borderRadius: 12,
            color: "var(--text-very-dim)",
            textAlign: "center",
          }}>
            <Icon name="idea" size={22} />
            <div style={{ fontSize: 14.5, color: "var(--text-dim)" }}>Backlog clear</div>
            <div style={{ fontSize: 13 }}>Nothing waiting to be filed. New <span style={{ fontFamily: "var(--font-mono)" }}>#idea</span> notes will show up here.</div>
          </div>
        ) : (
          <div style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {backlog.map((item, i) => (
              <BacklogRow
                key={item.id}
                item={item}
                categories={categories}
                isLast={i === 0 ? "first" : false}
                onSetCategory={onSetCategory}
                onAddCategory={onAddCategory}
                onPromote={onPromote}
                onKill={onKill}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { IdeaBacklogView });
