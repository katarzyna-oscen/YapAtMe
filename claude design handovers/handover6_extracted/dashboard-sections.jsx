// Dashboard sections — projects, open actions, people, ideas
// All draggable lists use a shared useDraggableList hook.

// ────────────────────────────────────────────────────────────
//  Draggable list hook
// ────────────────────────────────────────────────────────────
function useDraggableList(initial) {
  const [items, setItems] = React.useState(initial);
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);

  const handlers = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
    },
    onDragEnter: (e) => { e.preventDefault(); if (id !== dragId) setOverId(id); },
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
    onDragLeave: (e) => { /* keep overId until enter elsewhere */ },
    onDrop: (e) => {
      e.preventDefault();
      if (!dragId || dragId === id) return;
      setItems((arr) => {
        const from = arr.findIndex((x) => x.id === dragId);
        const to = arr.findIndex((x) => x.id === id);
        if (from < 0 || to < 0) return arr;
        const next = arr.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      setDragId(null); setOverId(null);
    },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  });

  return { items, setItems, dragId, overId, handlers };
}

// ────────────────────────────────────────────────────────────
//  Projects
// ────────────────────────────────────────────────────────────
function ProjectsSection() {
  const { items, setItems, dragId, overId, handlers } = useDraggableList(MEM_PROJECTS);
  const updateStatus = (id, status) => setItems((arr) => arr.map((p) => p.id === id ? { ...p, status } : p));

  return (
    <section style={{ padding: "20px 48px 8px" }}>
      <SectionHeader
        label="Projects"
        right={
          <span style={{ display: "inline-flex", gap: 14, fontSize: 11.5, color: "var(--text-very-dim)", fontFamily: "var(--font-mono)" }}>
            <span>{items.length} total</span>
            <span style={{ color: "var(--text-dim)", cursor: "pointer" }}>+ new</span>
          </span>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {items.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            onStatusChange={(s) => updateStatus(p.id, s)}
            handlers={handlers(p.id)}
            isDragging={dragId === p.id}
            isOver={overId === p.id}
          />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({ project, onStatusChange, handlers, isDragging, isOver }) {
  return (
    <div
      {...handlers}
      style={{
        position: "relative",
        padding: "16px 18px 14px",
        background: "var(--panel)",
        border: "1px solid",
        borderColor: isOver ? "var(--accent)" : "var(--border)",
        borderRadius: 10,
        opacity: isDragging ? 0.45 : 1,
        transform: isOver ? "translateY(-1px)" : "none",
        transition: "border-color .15s, transform .15s",
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Drag handle (corner) */}
      <div style={{
        position: "absolute", top: 10, right: 10,
        color: "var(--text-very-dim)", opacity: 0.5,
        pointerEvents: "none",
      }}>
        <Icon name="drag" size={14} />
      </div>

      {/* TOP: title + summary */}
      <div>
        <h3 style={{
          fontSize: 15.5,
          fontWeight: 600,
          color: "var(--text)",
          margin: "0 24px 8px 0",
          lineHeight: 1.3,
          letterSpacing: "-0.005em",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{project.title}</h3>

        <p style={{
          fontSize: 13,
          color: "var(--text-dim)",
          margin: 0,
          lineHeight: 1.5,
          textWrap: "pretty",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {project.summary}
        </p>
      </div>

      {/* BOTTOM: chips pinned to card foot */}
      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StatusPill status={project.status} onChange={onStatusChange} small />
          <span style={{ fontSize: 11, color: "var(--text-very-dim)" }}>
            {project.openActions} actions
          </span>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 5 }}>
            {project.tags.map((t) => <Tag key={t}>{t}</Tag>)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Tasks
// ────────────────────────────────────────────────────────────
function ActionsSection() {
  const { items, setItems, dragId, overId, handlers } = useDraggableList(MEM_ACTIONS);
  const toggle = (id) => setItems((arr) => arr.map((a) => a.id === id ? { ...a, done: !a.done } : a));
  const remaining = items.filter((a) => !a.done).length;

  return (
    <section style={{ padding: "20px 48px 8px" }}>
      <SectionHeader
        label="Tasks"
        right={
          <span style={{ fontSize: 11.5, color: "var(--text-very-dim)" }}>
            {remaining} of {items.length} open
          </span>
        }
      />
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}>
        {items.map((a, i) => (
          <ActionRow
            key={a.id}
            action={a}
            onToggle={() => toggle(a.id)}
            handlers={handlers(a.id)}
            isDragging={dragId === a.id}
            isOver={overId === a.id}
            isLast={i === items.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function ActionRow({ action, onToggle, handlers, isDragging, isOver, isLast }) {
  return (
    <div
      {...handlers}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
        background: isOver ? "var(--panel-2)" : "transparent",
        opacity: isDragging ? 0.45 : 1,
        cursor: "grab",
      }}
    >
      <span style={{ color: "var(--text-very-dim)", display: "inline-flex" }}>
        <Icon name="drag" size={14} />
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          width: 18, height: 18, flex: "0 0 18px",
          border: "1.5px solid",
          borderColor: action.done ? "var(--success)" : "var(--border-strong)",
          borderRadius: 5,
          background: action.done ? "var(--success)" : "transparent",
          cursor: "pointer", padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--bg)",
        }}
      >
        {action.done && <Icon name="check" size={12} />}
      </button>
      <span style={{
        flex: 1, fontSize: 13.5,
        color: action.done ? "var(--text-very-dim)" : "var(--text)",
        textDecoration: action.done ? "line-through" : "none",
      }}>{action.text}</span>
      <span style={{ fontSize: 11.5, color: "var(--text-very-dim)" }}>
        {action.project}
      </span>
      <AgeChip date={action.created} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  People
// ────────────────────────────────────────────────────────────
function PeopleSection() {
  const { items, dragId, overId, handlers } = useDraggableList(MEM_PEOPLE);

  // Compute closeness once per person and cache it — not on every render.
  // (Recompute only if the people set changes; tasks/mentions are static here.)
  const closenessById = React.useMemo(() => {
    const map = {};
    MEM_PEOPLE.forEach((p) => {
      const file = `people/${p.id}.md`;
      const mentionEntries = (p.recentMentions || []).map((m) => m.date);
      const tasksIndex = personTasksIndex(p);
      map[p.id] = calculateCloseness(file, tasksIndex, mentionEntries);
    });
    return map;
  }, []);

  return (
    <section style={{ padding: "20px 48px 8px" }}>
      <SectionHeader label="People" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {items.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            closeness={closenessById[p.id]}
            handlers={handlers(p.id)}
            isDragging={dragId === p.id}
            isOver={overId === p.id}
          />
        ))}
      </div>
    </section>
  );
}

// Build a tasks-index-shaped array for one person from their delegate + talk-about
// items. The prototype has no per-item timestamps, so contact recency (person.touched)
// stands in for resolved_at / last_updated.
function personTasksIndex(person) {
  const file = `people/${person.id}.md`;
  const items = [...(person.delegate || []), ...(person.talkAbout || [])];
  return items.map((it) => ({
    file,
    status: it.done ? "done" : "open",
    resolved_at: it.done ? person.touched : null,
    last_updated: person.touched,
  }));
}

function PersonCard({ person, closeness, handlers, isDragging, isOver }) {
  const mentions = person.recentMentions || [];
  const lastDate = mentions.length
    ? mentions.map((m) => m.date).sort((a, b) => b - a)[0]
    : null;
  const meta = [person.role, person.relationship].filter(Boolean).join(" · ");
  const openTasks = [...(person.delegate || []), ...(person.talkAbout || [])].filter((t) => !t.done).length;
  const lastMentionText = lastDate ? `last mention: ${fmtLastMention(lastDate)}` : null;
  const metaLine = [lastMentionText, `${openTasks} ${openTasks === 1 ? "task" : "tasks"}`].filter(Boolean).join("  ·  ");
  return (
    <div
      {...handlers}
      style={{
        padding: "14px 16px",
        background: "var(--panel)",
        border: "1px solid",
        borderColor: isOver ? "var(--accent)" : "var(--border)",
        borderRadius: 10,
        cursor: "grab",
        opacity: isDragging ? 0.45 : 1,
        transition: "border-color .15s, transform .12s",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
      onMouseEnter={(e) => { if (!isOver) e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { if (!isOver) e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Line 1 — name + closeness meter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "var(--text)", lineHeight: 1.25,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
        }}>
          {person.name}
        </div>
        <ClosenessMeter closeness={closeness} />
      </div>

      {/* Line 2 — role · relationship (ellipsis on its own line) */}
      {meta && (
        <div style={{
          fontSize: 12, color: "var(--text-very-dim)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {meta}
        </div>
      )}

      {/* Line 3 — last mention + open task count */}
      <div style={{ fontSize: 11, color: "var(--text-very-dim)", fontVariantNumeric: "tabular-nums" }}>
        {metaLine}
      </div>
    </div>
  );
}

// Visual treatment per tier returned by calculateCloseness:
//   bestie → amber bars + soft glow + amber label
//   active → green bars (close/regular/moderate)
//   muted  → dimmed slate bars (occasional/distant)
const CLOSENESS_VISUAL = {
  bestie: { active: "oklch(0.80 0.13 80)",  glow: true,  labelColor: "var(--accent)" },
  active: { active: "oklch(0.78 0.14 150)", glow: false, labelColor: "var(--text-very-dim)" },
  muted:  { active: "oklch(0.58 0.02 255)", glow: false, labelColor: "var(--text-very-dim)" },
};

// ClosenessMeter — five rising bars + a lowercase tier label on the same line.
function ClosenessMeter({ closeness }) {
  const v = CLOSENESS_VISUAL[closeness.tier] || CLOSENESS_VISUAL.muted;
  return (
    <div
      title={`${closeness.label} contact`}
      style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const on = i <= closeness.bars;
          return (
            <div
              key={i}
              style={{
                width: 3,
                height: 3 + i * 2,
                borderRadius: 1,
                background: on ? v.active : "var(--panel-2)",
                border: on ? "none" : "1px solid var(--border-subtle)",
                boxShadow: on && v.glow ? "0 0 5px oklch(0.80 0.13 80 / 0.55)" : "none",
              }}
            />
          );
        })}
      </div>
      <span style={{
        fontSize: 10.5,
        letterSpacing: "0.04em",
        color: v.labelColor,
      }}>{closeness.label}</span>
    </div>
  );
}

// "last mention: today / yesterday / 8 May" — D Mon, with year only if not this year.
function fmtLastMention(date) {
  const now = window.MEM_NOW || new Date();
  const hours = (now - new Date(date)) / 3600000;
  if (hours < 24) return "today";
  if (hours < 48) return "yesterday";
  const opts = { day: "numeric", month: "short" };
  if (new Date(date).getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return new Date(date).toLocaleDateString("en-GB", opts);
}

// ────────────────────────────────────────────────────────────
//  Ideas
// ────────────────────────────────────────────────────────────
function IdeasSection() {
  const [items, setItems] = React.useState(MEM_IDEAS);
  const updateStatus = (id, status) => setItems((arr) => arr.map((p) => p.id === id ? { ...p, status } : p));

  return (
    <section style={{ padding: "20px 48px 56px" }}>
      <SectionHeader
        label="Ideas"
        right={<span style={{ fontSize: 11.5, color: "var(--text-very-dim)", fontFamily: "var(--font-mono)" }}>
          {items.length} captured
        </span>}
      />
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}>
        {items.map((idea, i) => {
          return (
            <div key={idea.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 16px",
              borderBottom: i === items.length - 1 ? "none" : "1px solid var(--border-subtle)",
              cursor: "pointer",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: "var(--text-very-dim)" }}><Icon name="idea" size={14} /></span>
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--text)" }}>{idea.title}</span>
              <AgeChip date={idea.touched} />
              <StatusPill status={idea.status} onChange={(s) => updateStatus(idea.id, s)} small />
            </div>
          );
        })}
      </div>
    </section>
  );
}

Object.assign(window, {
  useDraggableList,
  ProjectsSection, ProjectCard,
  ActionsSection, ActionRow,
  PeopleSection, PersonCard,
  IdeasSection,
});
