// Tasks view — full checklist for the user's tasks.
//
// Layout: header (title + Add task), then ordered sections, one per category.
//   • Tasks sit in MEM_TASK_CATEGORIES order
//   • Drag a task to reorder within a section, or drop it on another section
//     header / row to change its category.
//   • Double-click the task text or project to edit inline.
//   • 3-dot menu: Comment / Remove (routes through confirm modal).

function TasksView({ tasks, setTasks, onAction, onRemoveAllDone }) {
  const remaining = tasks.filter((t) => !t.done).length;
  const completed = tasks.length - remaining;
  const doneOutsideBucket = tasks.filter((t) => t.done && t.category !== "done").length;

  // Which tasks have their comment thread visible. Default: those with comments.
  const [expandedComments, setExpandedComments] = React.useState(() =>
    new Set(tasks.filter((t) => (t.comments || []).length > 0).map((t) => t.id))
  );
  const setCommentsExpanded = (id, open) =>
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (open) next.add(id); else next.delete(id);
      return next;
    });
  const tasksWithComments = tasks.filter((t) => (t.comments || []).length > 0);
  const anyExpanded = tasksWithComments.some((t) => expandedComments.has(t.id));
  const expandAll = () => setExpandedComments(new Set(tasksWithComments.map((t) => t.id)));
  const collapseAll = () => setExpandedComments(new Set());

  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft]   = React.useState("");
  const [draftProject, setDraftProject] = React.useState("");
  const [draftCategory, setDraftCategory] = React.useState("actions");
  const inputRef = React.useRef(null);

  // Drag state lifted here so it works across categories.
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);            // hovered task id
  const [overEmptyCat, setOverEmptyCat] = React.useState(null);// dropped on empty category

  React.useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  // ── mutators ──
  const updateTask = (id, patch) =>
    setTasks((arr) => arr.map((t) => t.id === id ? { ...t, ...patch } : t));

  const toggle = (id) =>
    setTasks((arr) => {
      const idx = arr.findIndex((t) => t.id === id);
      if (idx < 0) return arr;
      const t = arr[idx];
      const nowDone = !t.done;
      // Unchecking inside the Done bucket → restore to previous category at
      // its previous position (right after the sibling it used to follow).
      if (!nowDone && t.category === "done" && t.prevCategory) {
        const without = arr.filter((x) => x.id !== id);
        const restored = { ...t, done: false, category: t.prevCategory };
        delete restored.prevCategory;
        delete restored.prevPrecedingId;
        let insertAt;
        if (t.prevPrecedingId) {
          const sibIdx = without.findIndex((x) => x.id === t.prevPrecedingId);
          insertAt = sibIdx >= 0 ? sibIdx + 1 : without.length;
        } else {
          // Was first in its prev category — insert before any existing items of that category.
          insertAt = without.findIndex((x) => x.category === restored.category);
          if (insertAt < 0) insertAt = without.length;
        }
        without.splice(insertAt, 0, restored);
        return without;
      }
      return arr.map((x) => x.id === id ? { ...x, done: nowDone } : x);
    });

  const addComment = (id, text) =>
    setTasks((arr) => arr.map((t) =>
      t.id === id
        ? { ...t, comments: [...(t.comments || []), { id: "c-" + Date.now(), text, ts: new Date() }] }
        : t
    ));

  const addDraft = () => {
    const text = draft.trim();
    if (!text) { setAdding(false); return; }
    const newTask = {
      id: "a-" + Date.now(),
      text,
      project: draftProject.trim() || "—",
      category: draftCategory,
      created: new Date(),
      done: false,
      comments: [],
    };
    setTasks((arr) => [newTask, ...arr]);
    setDraft("");
    setDraftProject("");
    setAdding(false);
  };

  const clearDone = () => {
    setTasks((arr) => {
      // Capture each sweep candidate's previous category + preceding sibling id
      // so unchecking later can restore its slot.
      const rest = [];
      const swept = [];
      // Track the last seen task id per category to record the preceding sibling.
      const lastIdInCat = {};
      arr.forEach((t) => {
        if (t.done && t.category !== "done") {
          swept.push({
            ...t,
            category: "done",
            prevCategory: t.category,
            prevPrecedingId: lastIdInCat[t.category] || null,
          });
        } else {
          rest.push(t);
          lastIdInCat[t.category] = t.id;
        }
      });
      return [...rest, ...swept];
    });
  };
  const moveTask = (fromId, toCategory, toBeforeId /* optional */) => {
    setTasks((arr) => {
      const fromIdx = arr.findIndex((t) => t.id === fromId);
      if (fromIdx < 0) return arr;
      const moved = { ...arr[fromIdx], category: toCategory };
      const without = arr.filter((t) => t.id !== fromId);
      if (toBeforeId == null) {
        // append at end of its category (after last item of that category)
        let insertAt = without.length;
        for (let i = without.length - 1; i >= 0; i--) {
          if (without[i].category === toCategory) { insertAt = i + 1; break; }
        }
        without.splice(insertAt, 0, moved);
      } else {
        const toIdx = without.findIndex((t) => t.id === toBeforeId);
        without.splice(toIdx < 0 ? without.length : toIdx, 0, moved);
      }
      return without;
    });
  };

  const onRowDragStart = (id) => (e) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
  };
  const onRowDragEnter = (id) => (e) => { e.preventDefault(); if (id !== dragId) { setOverId(id); setOverEmptyCat(null); } };
  const onRowDragOver  = (e)  => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onRowDrop      = (id, category) => (e) => {
    e.preventDefault();
    if (!dragId || dragId === id) { setDragId(null); setOverId(null); return; }
    moveTask(dragId, category, id);
    setDragId(null); setOverId(null); setOverEmptyCat(null);
  };

  const onSectionDragEnter = (catId) => (e) => { e.preventDefault(); setOverEmptyCat(catId); setOverId(null); };
  const onSectionDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onSectionDrop      = (catId) => (e) => {
    e.preventDefault();
    if (!dragId) return;
    moveTask(dragId, catId, null);
    setDragId(null); setOverId(null); setOverEmptyCat(null);
  };
  const onDragEnd = () => { setDragId(null); setOverId(null); setOverEmptyCat(null); };

  // ── group tasks by category, in category order ──
  const byCategory = React.useMemo(() => {
    const map = new Map(MEM_TASK_CATEGORIES.map((c) => [c.id, []]));
    tasks.forEach((t) => {
      const cat = map.has(t.category) ? t.category : "actions";
      map.get(cat).push(t);
    });
    return map;
  }, [tasks]);

  return (
    <div data-screen-label="Tasks" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
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
          }}>Tasks</h1>
          <span style={{ fontSize: 13, color: "var(--text-very-dim)" }}>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{remaining}</span> open
            <span style={{ margin: "0 8px", color: "var(--border-strong)" }}>·</span>
            <span style={{ color: "var(--text-dim)" }}>{completed} done</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {tasksWithComments.length > 0 && (
            <ToggleCommentsButton
              anyOpen={anyExpanded}
              count={tasksWithComments.length}
              onClick={anyExpanded ? collapseAll : expandAll}
            />
          )}
          {doneOutsideBucket > 0 && (
            <ClearDoneButton count={doneOutsideBucket} onClick={clearDone} />
          )}
          <AddTaskButton onClick={() => setAdding(true)} />
        </div>
      </header>

      <div style={{ padding: "20px 48px 48px", display: "flex", flexDirection: "column", gap: 24 }}>
        {adding && (
          <DraftRow
            draft={draft}            setDraft={setDraft}
            project={draftProject}   setProject={setDraftProject}
            category={draftCategory} setCategory={setDraftCategory}
            inputRef={inputRef}
            onCommit={addDraft}
            onCancel={() => { setDraft(""); setDraftProject(""); setAdding(false); }}
          />
        )}

        {MEM_TASK_CATEGORIES.map((cat) => {
          const items = byCategory.get(cat.id) || [];
          const showDropZone = overEmptyCat === cat.id && items.every((t) => t.id !== dragId);
          // Hide the Done section entirely when it's empty.
          if (cat.isDone && items.length === 0) return null;
          return (
            <CategorySection
              key={cat.id}
              category={cat}
              count={items.length}
              right={cat.isDone && items.length > 0 ? (
                <RemoveAllDoneButton onClick={() => onRemoveAllDone(items.map((t) => t.id))} />
              ) : null}
              onDragEnter={onSectionDragEnter(cat.id)}
              onDragOver={onSectionDragOver}
              onDrop={onSectionDrop(cat.id)}
            >
              {items.length === 0 && !showDropZone && !cat.isDone && (
                <EmptyCategoryHint
                  hue={cat.hue}
                  text={`Drag tasks here · ${cat.description.toLowerCase()}`}
                />
              )}
              {showDropZone && <DropPlaceholder hue={cat.hue} />}
              {items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  category={cat}
                  onToggle={() => toggle(t.id)}
                  onUpdate={(patch) => updateTask(t.id, patch)}
                  onAddComment={(text) => addComment(t.id, text)}
                  commentsOpen={expandedComments.has(t.id)}
                  onSetCommentsOpen={(open) => setCommentsExpanded(t.id, open)}
                  onAction={(action) => onAction(action, { id: t.id, label: t.text })}
                  isDragging={dragId === t.id}
                  isOver={overId === t.id}
                  dragHandlers={{
                    draggable: true,
                    onDragStart: onRowDragStart(t.id),
                    onDragEnter: onRowDragEnter(t.id),
                    onDragOver: onRowDragOver,
                    onDrop: onRowDrop(t.id, cat.id),
                    onDragEnd: onDragEnd,
                  }}
                />
              ))}
            </CategorySection>
          );
        })}
      </div>
    </div>
  );
}

function AddTaskButton({ onClick }) {
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
        padding: "8px 14px",
        background: hov ? "oklch(0.80 0.13 80 / 0.22)" : "oklch(0.80 0.13 80 / 0.12)",
        color: "oklch(0.88 0.13 80)",
        border: `1px solid ${hov ? "oklch(0.80 0.13 80 / 0.55)" : "oklch(0.80 0.13 80 / 0.36)"}`,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s",
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      Add task
    </button>
  );
}

function ClearDoneButton({ count, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Move all done tasks into the Done bucket"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: hov ? "var(--panel-2)" : "var(--panel)",
        color: hov ? "var(--text)" : "var(--text-dim)",
        border: `1px solid ${hov ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: 8,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s, color .15s",
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 8 3.5 3.5L13 5" />
      </svg>
      Clear done
      <span style={{
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
      }}>{count}</span>
    </button>
  );
}

function RemoveAllDoneButton({ onClick }) {
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
        padding: "4px 9px",
        background: hov ? "oklch(0.70 0.18 22 / 0.16)" : "transparent",
        color: hov ? "oklch(0.84 0.16 22)" : "var(--text-very-dim)",
        border: `1px solid ${hov ? "oklch(0.70 0.18 22 / 0.40)" : "var(--border-subtle)"}`,
        borderRadius: 6,
        fontSize: 11.5,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s, color .15s",
      }}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4.5h10" />
        <path d="M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4.5" />
        <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
      </svg>
      Remove all
    </button>
  );
}

function ToggleCommentsButton({ anyOpen, count, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={anyOpen ? "Collapse all comments" : "Expand all comments"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: hov ? "var(--panel-2)" : "var(--panel)",
        color: hov ? "var(--text)" : "var(--text-dim)",
        border: `1px solid ${hov ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: 8,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background .15s, border-color .15s, color .15s",
      }}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H6L3 13v-2.5h-.5z" />
        {anyOpen
          ? <path d="M5.5 7h5" />
          : <React.Fragment><path d="M8 5v4" /><path d="M5.5 7h5" /></React.Fragment>
        }
      </svg>
      {anyOpen ? "Collapse comments" : "Expand comments"}
      <span style={{
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
      }}>{count}</span>
    </button>
  );
}
function CategorySection({ category, count, children, right, onDragEnter, onDragOver, onDrop }) {
  return (
    <section
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 8,
        padding: "0 4px",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: `oklch(0.78 0.16 ${category.hue})`,
          flex: "0 0 6px",
        }} />
        <h2 style={{
          fontSize: 11,
          letterSpacing: "0.16em",
          fontWeight: 600,
          textTransform: "uppercase",
          color: "var(--text-dim)",
          margin: 0,
        }}>{category.label}</h2>
        <span style={{ fontSize: 11, color: "var(--text-very-dim)" }}>{count}</span>
        {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
      </div>
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}>
        {children}
      </div>
    </section>
  );
}

function EmptyCategoryHint({ hue, text }) {
  return (
    <div style={{
      padding: "16px",
      textAlign: "center",
      color: "var(--text-very-dim)",
      fontStyle: "italic",
      fontSize: 12.5,
    }}>{text}</div>
  );
}

function DropPlaceholder({ hue }) {
  return (
    <div style={{
      margin: 10,
      padding: 14,
      border: `1.5px dashed oklch(0.78 0.16 ${hue} / 0.6)`,
      background: `oklch(0.78 0.16 ${hue} / 0.07)`,
      borderRadius: 8,
      textAlign: "center",
      fontSize: 12,
      color: `oklch(0.84 0.14 ${hue})`,
    }}>Drop here</div>
  );
}

// ────────────────────────────────────────────────────────────
//  Draft row (Add task)
// ────────────────────────────────────────────────────────────
function DraftRow({ draft, setDraft, project, setProject, category, setCategory, inputRef, onCommit, onCancel }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 16px",
      background: "var(--panel-2)",
      border: "1px solid var(--accent)",
      borderRadius: 10,
    }}>
      <span style={{
        width: 18, height: 18,
        border: "1.5px dashed var(--border-strong)",
        borderRadius: 5,
      }} />
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="What needs doing?"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--text)",
          fontSize: 13.5,
          fontFamily: "inherit",
        }}
      />
      <CategorySelect value={category} onChange={setCategory} />
      <input
        value={project}
        onChange={(e) => setProject(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="project (optional)"
        style={{
          width: 160,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--text-dim)",
          fontSize: 12,
          fontFamily: "inherit",
          textAlign: "right",
        }}
      />
      <button
        onClick={onCommit}
        style={{
          padding: "5px 12px",
          background: "var(--accent)",
          color: "#1a1408",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >Add</button>
      <button
        onClick={onCancel}
        style={{
          padding: "5px 10px",
          background: "transparent",
          color: "var(--text-very-dim)",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >Cancel</button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Category select — custom dropdown styled to match the rest of the UI
// ────────────────────────────────────────────────────────────
function CategorySelect({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const current = MEM_TASK_CATEGORIES.find((c) => c.id === value) || MEM_TASK_CATEGORIES[0];

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 10px",
          background: "var(--panel)",
          color: "var(--text)",
          border: `1px solid ${open ? "var(--border-strong)" : "var(--border)"}`,
          borderRadius: 6,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "border-color .12s",
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: `oklch(0.78 0.16 ${current.hue})`,
        }} />
        {current.label}
        <svg viewBox="0 0 10 10" width="8" height="8" fill="currentColor" style={{
          opacity: 0.6,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform .15s",
        }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 60,
            minWidth: 180,
            padding: 4,
            background: "var(--panel-pop)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)",
          }}
        >
          {MEM_TASK_CATEGORIES.filter((c) => !c.isDone).map((c) => {
            const active = c.id === value;
            return (
              <div
                key={c.id}
                onClick={(e) => { e.stopPropagation(); onChange(c.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                  color: active ? "var(--text)" : "var(--text-dim)",
                  fontSize: 12.5,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: `oklch(0.78 0.16 ${c.hue})`,
                }} />
                {c.label}
                {active && <span style={{ marginLeft: "auto", color: "var(--text-very-dim)" }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Inline-editable field — double-click to edit
// ────────────────────────────────────────────────────────────
function EditableField({ value, onCommit, placeholder, textStyle, inputStyle, width }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const ref = React.useRef(null);
  React.useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  React.useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== value) onCommit(t);
    setEditing(false);
  };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        style={{
          width: width || "auto",
          padding: "2px 6px",
          margin: "-3px -7px",
          background: "var(--panel)",
          border: "1px solid var(--accent)",
          borderRadius: 4,
          outline: "none",
          color: "var(--text)",
          fontFamily: "inherit",
          ...(inputStyle || {}),
        }}
      />
    );
  }
  return (
    <span
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Double-click to edit"
      style={{
        cursor: "text",
        borderRadius: 3,
        ...(textStyle || {}),
      }}
    >
      {value || <span style={{ color: "var(--text-very-dim)" }}>{placeholder}</span>}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
//  Task row + 3-dot menu + inline comments
// ────────────────────────────────────────────────────────────
function TaskRow({ task, category, onToggle, onUpdate, onAddComment, commentsOpen, onSetCommentsOpen, onAction, isDragging, isOver, dragHandlers }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });
  const menuBtnRef = React.useRef(null);
  const openMenu = () => {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (r) {
      // Anchor menu just below the button, right-aligned to it.
      const width = 150;
      setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - width) });
    }
    setMenuOpen(true);
  };
  const [hov, setHov] = React.useState(false);
  const showComments = commentsOpen;
  const setShowComments = onSetCommentsOpen;
  const [draft, setDraft] = React.useState("");
  const commentInputRef = React.useRef(null);
  const menuRef = React.useRef(null);

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

  const openComments = () => {
    setShowComments(true);
    setMenuOpen(false);
    setTimeout(() => commentInputRef.current?.focus(), 50);
  };
  const submitComment = () => {
    const text = draft.trim();
    if (!text) return;
    onAddComment(text);
    setDraft("");
  };

  const cancelComment = () => {
    setDraft("");
    setShowComments(false);
  };

  return (
    <div style={{
      borderTop: "1px solid var(--border-subtle)",
      // Hide top divider on the first row of a section (it gets a thicker border from the section wrapper border)
      borderTopStyle: "solid",
    }}>
      <div
        {...dragHandlers}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: isOver ? `oklch(0.78 0.14 ${category.hue} / 0.10)` : (hov ? "var(--panel-2)" : "transparent"),
          opacity: isDragging ? 0.4 : 1,
          borderTop: isOver ? `2px solid oklch(0.78 0.16 ${category.hue})` : "2px solid transparent",
          cursor: "grab",
          transition: "background .12s",
        }}
      >
        <span style={{
          color: "var(--text-very-dim)",
          display: "inline-flex",
          opacity: hov ? 1 : 0.4,
          transition: "opacity .12s",
        }}>
          <Icon name="drag" size={14} />
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 18, height: 18, flex: "0 0 18px",
            border: "1.5px solid",
            borderColor: task.done ? "var(--success)" : "var(--border-strong)",
            borderRadius: 5,
            background: task.done ? "var(--success)" : "transparent",
            cursor: "pointer", padding: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "var(--bg)",
          }}
        >
          {task.done && <Icon name="check" size={12} />}
        </button>

        <span style={{
          flex: 1, fontSize: 13.5,
          color: task.done ? "var(--text-very-dim)" : "var(--text)",
          textDecoration: task.done ? "line-through" : "none",
          minWidth: 0,
        }}>
          <EditableField
            value={task.text}
            onCommit={(v) => onUpdate({ text: v })}
            placeholder="Untitled task"
            inputStyle={{
              fontSize: 13.5,
              width: "100%",
              color: "var(--text)",
            }}
          />
        </span>

        {task.comments && task.comments.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowComments((v) => !v); }}
            title={`${task.comments.length} comment${task.comments.length === 1 ? "" : "s"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 7px",
              background: showComments ? "var(--panel-2)" : "transparent",
              color: "var(--text-dim)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 999,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H6L3 13v-2.5h-.5z" />
            </svg>
            {task.comments.length}
          </button>
        )}

        <span style={{
          fontSize: 11.5,
          color: "var(--text-very-dim)",
          maxWidth: 180,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          <EditableField
            value={task.project}
            onCommit={(v) => onUpdate({ project: v })}
            placeholder="—"
            width={140}
            inputStyle={{
              fontSize: 11.5,
              color: "var(--text-dim)",
              textAlign: "right",
            }}
            textStyle={{ display: "inline-block" }}
          />
        </span>
        <AgeChip date={task.created} />

        <div ref={menuRef} style={{ position: "relative", flex: "0 0 auto" }}>
          <button
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
              opacity: (hov || menuOpen) ? 1 : 0.3,
              transition: "opacity .12s, background .12s",
              fontFamily: "inherit",
            }}
            ref={menuBtnRef}
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
                minWidth: 150,
                padding: 4,
                background: "var(--panel-pop)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)",
              }}
            >
              <TaskMenuItem label="Comment" onClick={openComments} />
              <TaskMenuItem
                label="Remove"
                danger
                onClick={() => { setMenuOpen(false); onAction("delete"); }}
              />
            </div>,
            document.body
          )}
        </div>
      </div>

      {showComments && (
        <div style={{
          padding: "4px 16px 14px 48px",
          background: "var(--bg-sidebar)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 0 4px",
          }}>
            <span style={{
              fontSize: 10.5,
              letterSpacing: "0.14em",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--text-very-dim)",
            }}>
              Comments {(task.comments || []).length > 0 && `· ${task.comments.length}`}
            </span>
            <button
              onClick={() => setShowComments(false)}
              aria-label="Collapse comments"
              title="Collapse"
              style={{
                width: 22,
                height: 22,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "var(--text-very-dim)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
                transition: "background .12s, color .12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--panel-2)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-very-dim)"; }}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          {(task.comments || []).map((c) => (
            <div key={c.id} style={{
              display: "flex",
              gap: 12,
              padding: "8px 0",
              borderTop: "1px solid var(--border-subtle)",
            }}>
              <div style={{
                width: 22, height: 22, flex: "0 0 22px",
                borderRadius: "50%",
                background: "var(--panel-2)",
                color: "var(--text-dim)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 600,
              }}>You</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  color: "var(--text)",
                  lineHeight: 1.45,
                  textWrap: "pretty",
                }}>{c.text}</div>
                <div style={{ fontSize: 11, color: "var(--text-very-dim)", marginTop: 2 }}>
                  {c.ts.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingTop: 10,
            borderTop: (task.comments || []).length > 0 ? "1px solid var(--border-subtle)" : "none",
          }}>
            <input
              ref={commentInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitComment();
                if (e.key === "Escape") cancelComment();
              }}
              placeholder="Write a comment…"
              style={{
                flex: 1,
                padding: "7px 10px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                fontSize: 12.5,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <button
              onClick={cancelComment}
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: "var(--text-very-dim)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--panel-2)"; e.currentTarget.style.color = "var(--text-dim)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-very-dim)"; }}
            >Cancel</button>
            <button
              onClick={submitComment}
              disabled={!draft.trim()}
              style={{
                padding: "6px 12px",
                background: draft.trim() ? "var(--accent)" : "var(--panel-2)",
                color: draft.trim() ? "#1a1408" : "var(--text-very-dim)",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: draft.trim() ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >Post</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskMenuItem({ label, onClick, danger }) {
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

Object.assign(window, { TasksView });
