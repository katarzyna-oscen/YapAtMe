// Sidebar — vault explorer
// Mirrors the structure in the screenshot: Dashboard / Settings at top,
// then collapsible sections (Inbox, Notes, Projects, People, Ideas, Archive, Context).

// Reformat an ISO-ish YYYY-MM-DD string into DD-MM-YYYY for display in the
// vault explorer. Leaves anything that isn't a plain date untouched.
function dmyDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

const sidebarStyles = {
  root: {
    width: 268,
    flex: "0 0 268px",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border-subtle)",
    color: "var(--text-dim)",
    fontSize: 13.5,
    userSelect: "none"
  },
  header: {
    padding: "18px 18px 14px"
  },
  brand: {
    fontSize: 11,
    letterSpacing: "0.14em",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 2
  },
  vault: {
    fontSize: 12.5,
    color: "var(--text-very-dim)"
  },
  nav: {
    padding: "10px 8px 6px",
    borderBottom: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  bottomNav: {
    padding: "8px 8px",
    borderTop: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 7,
    color: active ? "var(--active)" : "var(--text-dim)",
    background: active ? "var(--panel-2)" : "transparent",
    fontWeight: active ? 500 : 400,
    cursor: "pointer",
    fontSize: 13.5
  }),
  scroll: {
    flex: 1,
    overflowY: "auto",
    padding: "10px 8px 16px"
  },
  section: { marginBottom: 4 },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    fontSize: 11,
    letterSpacing: "0.12em",
    color: "var(--text-very-dim)",
    fontWeight: 600,
    cursor: "pointer",
    textTransform: "uppercase"
  },
  sectionAdd: {
    marginLeft: "auto",
    width: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text-dim)",
    fontSize: 14,
    lineHeight: 1,
    transition: "background .12s, color .12s, border-color .12s"
  },
  navItemBadge: {
    marginLeft: "auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    borderRadius: 4,
    background: "var(--panel-2)",
    color: "var(--text-dim)",
    fontSize: 11,
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums"
  },
  caret: (open) => ({
    width: 10, height: 10,
    transition: "transform .15s ease",
    transform: open ? "rotate(90deg)" : "rotate(0deg)",
    opacity: 0.7
  }),
  fileRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 6px 5px 28px",
    borderRadius: 6,
    cursor: "pointer",
    color: "var(--text-dim)",
    fontSize: 13,
    position: "relative"
  },
  fileLabel: {
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  rowMenuBtn: {
    flex: "0 0 auto",
    width: 20,
    height: 20,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    color: "var(--text-very-dim)",
    borderRadius: 4,
    cursor: "pointer",
    padding: 0,
    opacity: 0,
    transition: "opacity .12s, background .12s"
  },
  empty: {
    padding: "4px 10px 4px 28px",
    color: "var(--text-very-dim)",
    fontStyle: "italic",
    fontSize: 12.5
  },
  footer: {
    padding: "10px 14px",
    borderTop: "1px solid var(--border-subtle)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 11.5,
    color: "var(--text-very-dim)"
  }
};

function SidebarFileRow({ item, active, onClick, onAction }) {
  const [hover, setHover] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const btnRef = React.useRef(null);
  const showMenuBtn = !!onAction;
  const bg = active ? "var(--panel-2)" : hover ? "var(--panel-2)" : "transparent";
  const color = active || hover ? "var(--text)" : "var(--text-dim)";

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {if (!btnRef.current?.parentElement?.contains(e.target)) setMenuOpen(false);};
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <div
      style={{ ...sidebarStyles.fileRow, background: bg, color }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}>
      
      <span style={sidebarStyles.fileLabel}>{item.label}</span>
      {showMenuBtn &&
      <div style={{ position: "relative", flex: "0 0 auto" }}>
          <button
          ref={btnRef}
          onClick={(e) => {e.stopPropagation();setMenuOpen((v) => !v);}}
          aria-label="More actions"
          style={{
            ...sidebarStyles.rowMenuBtn,
            opacity: hover || menuOpen ? 1 : 0,
            background: menuOpen ? "var(--border)" : "transparent",
            color: "var(--text)"
          }}
          onMouseEnter={(e) => {if (!menuOpen) e.currentTarget.style.background = "var(--border)";}}
          onMouseLeave={(e) => {if (!menuOpen) e.currentTarget.style.background = "transparent";}}>
          
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <circle cx="3.5" cy="8" r="1.3" />
              <circle cx="8" cy="8" r="1.3" />
              <circle cx="12.5" cy="8" r="1.3" />
            </svg>
          </button>
          {menuOpen &&
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 50,
            minWidth: 150,
            padding: 4,
            background: "var(--panel-pop)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)"
          }}>
          
              <MenuItem
            label="Archive"
            onClick={() => {setMenuOpen(false);onAction("archive", item);}} />
          
              <MenuItem
            label="Delete"
            danger
            onClick={() => {setMenuOpen(false);onAction("delete", item);}} />
          
            </div>
        }
        </div>
      }
    </div>);

}

function MenuItem({ label, onClick, danger }) {
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
        padding: "6px 10px",
        borderRadius: 5,
        fontSize: 12.5,
        cursor: "pointer",
        color: danger ?
        hov ? "oklch(0.84 0.16 22)" : "var(--text-dim)" :
        hov ? "var(--text)" : "var(--text-dim)",
        background: hov ?
        danger ? "oklch(0.70 0.18 22 / 0.12)" : "var(--panel-2)" :
        "transparent"
      }}>
      
      {label}
    </div>);

}

function SidebarSection({ title, items, defaultOpen = true, addable = false, onItemClick, onItemAction }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={sidebarStyles.section}>
      <div style={sidebarStyles.sectionHeader} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 10 10" style={sidebarStyles.caret(open)} fill="currentColor">
          <path d="M3 1 L7 5 L3 9 Z" />
        </svg>
        <span>{title}</span>
        {addable &&
        <span
          style={sidebarStyles.sectionAdd}
          onMouseEnter={(e) => {e.currentTarget.style.background = "var(--panel-2)";e.currentTarget.style.color = "var(--text)";e.currentTarget.style.borderColor = "var(--border-strong)";}}
          onMouseLeave={(e) => {e.currentTarget.style.background = "transparent";e.currentTarget.style.color = "var(--text-dim)";e.currentTarget.style.borderColor = "var(--border)";}}>
          
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 2.5v7M2.5 6h7" />
            </svg>
          </span>
        }
      </div>
      {open && (items.length === 0 ?
      <div style={sidebarStyles.empty}>empty</div> :
      items.map((it) => {
        const normalized = typeof it === "string" ?
        { id: it, label: it } :
        it;
        const active = !!normalized.active;
        return (
          <SidebarFileRow
            key={normalized.id}
            item={normalized}
            active={active}
            onClick={() => onItemClick && onItemClick(typeof it === "string" ? it : it)}
            onAction={onItemAction ? (action) => onItemAction(action, normalized) : null} />);


      }))}
    </div>);

}

function Sidebar({ view, onNavigate, onItemAction, inbox, notes, archive, tasks, people }) {
  const isDashboard = view.type === "dashboard";
  const isTasks = view.type === "tasks";
  const openTasks = (tasks || MEM_ACTIONS).filter((a) => !a.done).length;
  return (
    <aside style={sidebarStyles.root} data-screen-label="Sidebar">
      <div style={sidebarStyles.header}>
        <div style={sidebarStyles.brand}>MEMORY OS</div>
        <div style={sidebarStyles.vault}>Demo vault</div>
      </div>
      <nav style={sidebarStyles.nav}>
        <div
          style={sidebarStyles.navItem(isDashboard)}
          onClick={() => onNavigate({ type: "dashboard" })}
          onMouseEnter={(e) => {if (!isDashboard) {e.currentTarget.style.background = "var(--panel-2)";e.currentTarget.style.color = "var(--text)";}}}
          onMouseLeave={(e) => {if (!isDashboard) {e.currentTarget.style.background = "transparent";e.currentTarget.style.color = "var(--text-dim)";}}}>
          
          <Icon name="grid" />
          <span>Command center</span>
          <span
            title="Sync vault"
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: 4,
              color: "var(--text-dim)"
            }}
            onMouseEnter={(e) => {e.currentTarget.style.background = "var(--panel-2)";e.currentTarget.style.color = "var(--text)";}}
            onMouseLeave={(e) => {e.currentTarget.style.background = "transparent";e.currentTarget.style.color = "var(--text-dim)";}}>
            
            <Icon name="sync" size={14} />
          </span>
        </div>
        <div
          style={sidebarStyles.navItem(isTasks)}
          onClick={() => onNavigate({ type: "tasks" })}
          onMouseEnter={(e) => { if (!isTasks) { e.currentTarget.style.background = "var(--panel-2)"; e.currentTarget.style.color = "var(--text)"; } }}
          onMouseLeave={(e) => { if (!isTasks) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; } }}>
          
          <Icon name="check" />
          <span>Tasks</span>
          <span style={sidebarStyles.navItemBadge}>
            {openTasks}
          </span>
        </div>
      </nav>
      <div style={sidebarStyles.scroll}>
        <SidebarSection
          title="Inbox"
          defaultOpen
          items={inbox.map((n) => ({
            id: n.id,
            label: dmyDate(n.dateTitle.split(" · ")[0]),
            kind: "inbox",
            active: view.type === "inbox-note" && view.id === n.id
          }))}
          onItemClick={(it) => onNavigate({ type: "inbox-note", id: it.id })}
          onItemAction={(action, it) => onItemAction(action, "inbox", it)} />
        
        <SidebarSection
          title="Notes"
          addable
          items={notes.map((n) => ({
            id: n.id,
            label: dmyDate(n.id),
            kind: "note",
            active: view.type === "note" && view.id === n.id
          }))}
          onItemClick={(it) => onNavigate({ type: "note", id: it.id })}
          onItemAction={(action, it) => onItemAction(action, "note", it)} />
        
        <SidebarSection
          title="Projects"
          addable
          items={MEM_PROJECTS.map((p) => ({ id: p.id, label: p.title }))}
        />
        <SidebarSection
          title="People"
          addable
          items={(people || MEM_PEOPLE).map((p) => ({
            id: p.id,
            label: p.name,
            active: view.type === "person" && view.id === p.id,
          }))}
          onItemClick={(it) => onNavigate({ type: "person", id: it.id })}
          onItemAction={(action, it) => onItemAction(action, "person", it)}
        />
        <SidebarSection title="Ideas" items={MEM_IDEAS.map((i) => ({ id: i.id, label: i.title }))} addable />
        <SidebarSection
          title="Archive"
          items={archive.map((a) => ({ id: a.id, label: a.label }))}
          defaultOpen={false} />
        
        <SidebarSection title="Context" items={["_context_log", "_context", "ideas-index", "people-index", "projects-index"]} defaultOpen={false} />
      </div>
      <div style={sidebarStyles.bottomNav}>
        <div
          style={sidebarStyles.navItem(view.type === "settings")}
          onClick={() => onNavigate({ type: "settings" })}
          onMouseEnter={(e) => { if (view.type !== "settings") { e.currentTarget.style.background = "var(--panel-2)"; e.currentTarget.style.color = "var(--text)"; } }}
          onMouseLeave={(e) => { if (view.type !== "settings") { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; } }}>
          
          <Icon name="cog" />
          <span>Settings</span>
        </div>
        <div
          style={sidebarStyles.navItem(false)}
          onMouseEnter={(e) => {e.currentTarget.style.background = "var(--panel-2)";e.currentTarget.style.color = "var(--text)";}}
          onMouseLeave={(e) => {e.currentTarget.style.background = "transparent";e.currentTarget.style.color = "var(--text-dim)";}}>
          
          <Icon name="folder" />
          <span>Change vault folder</span>
        </div>
      </div>
    </aside>);

}

function Icon({ name, size = 14 }) {
  const s = { width: size, height: size, flex: "0 0 auto" };
  switch (name) {
    case "grid":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>);

    case "cog":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" />
        </svg>);

    case "search":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3 3" />
        </svg>);

    case "plus":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3v10M3 8h10" />
        </svg>);

    case "drag":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="currentColor">
          <circle cx="6" cy="4" r="1" /><circle cx="10" cy="4" r="1" />
          <circle cx="6" cy="8" r="1" /><circle cx="10" cy="8" r="1" />
          <circle cx="6" cy="12" r="1" /><circle cx="10" cy="12" r="1" />
        </svg>);

    case "check":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 8 3.5 3.5L13 5" />
        </svg>);

    case "arrow":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>);

    case "project":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <path d="M2 6h12" />
        </svg>);

    case "person":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" />
        </svg>);

    case "idea":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" />
          <path d="M6 14h4" />
        </svg>);

    case "folder":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4c.4 0 .77.16 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
        </svg>);

    case "sync":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 8a5 5 0 1 1-1.6-3.66" />
          <path d="M13 2.5V5h-2.5" />
        </svg>);

    default:
      return null;
  }
}

Object.assign(window, { Sidebar, Icon, SidebarSection });