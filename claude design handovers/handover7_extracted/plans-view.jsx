// PlansView — intentional execution roadmaps across Projects and Ideas.
//
// Complement to the Tasks screen. Where Tasks captures to-dos routed from inbox
// notes, Plans surfaces the `## Current Plan` checklists the user authors inside
// each project and idea — grouped by entity, sorted most-recently-active first.
//
// Reuses globals: Tag, StatusPill, IdeaStatusPill, Icon (dashboard-top / sidebar).
// Babel files don't share scope, so the small bits below are self-contained.

// Group-header accent dots — entity-type colour, not status.
const PLANS_GROUP_HUE = { projects: 230, ideas: 150 };

// ────────────────────────────────────────────────────────────
//  Filter segmented control — amber active state (the one place amber
//  is allowed on this screen)
// ────────────────────────────────────────────────────────────
function PlansFilter({ value, onChange }) {
  const opts = [
    { id: "all", label: "All" },
    { id: "projects", label: "Projects" },
    { id: "ideas", label: "Ideas" },
  ];
  return (
    <div style={{
      display: "inline-flex",
      gap: 3,
      padding: 3,
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 9,
    }}>
      {opts.map((o) => {
        const active = value === o.id;
        return <FilterPill key={o.id} label={o.label} active={active} onClick={() => onChange(o.id)} />;
      })}
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "5px 13px",
        borderRadius: 6,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        fontFamily: "inherit",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background .12s, color .12s, border-color .12s",
        background: active
          ? "oklch(0.80 0.13 80 / 0.16)"
          : (hov ? "var(--panel-2)" : "transparent"),
        color: active
          ? "oklch(0.88 0.13 80)"
          : (hov ? "var(--text)" : "var(--text-dim)"),
        border: active
          ? "1px solid oklch(0.80 0.13 80 / 0.40)"
          : "1px solid transparent",
      }}
    >{label}</button>
  );
}

// ────────────────────────────────────────────────────────────
//  Group header — "PROJECTS 3" / "IDEAS 1", matching Tasks section heads
// ────────────────────────────────────────────────────────────
function PlansGroupHeader({ label, count, hue }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "0 4px" }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: `oklch(0.78 0.16 ${hue})`,
        flex: "0 0 6px",
      }} />
      <h2 style={{
        fontSize: 11,
        letterSpacing: "0.16em",
        fontWeight: 600,
        textTransform: "uppercase",
        color: "var(--text-dim)",
        margin: 0,
      }}>{label}</h2>
      <span style={{ fontSize: 11, color: "var(--text-very-dim)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Plan step row — same checkbox affordance as the Tasks screen
// ────────────────────────────────────────────────────────────
function PlanStepRow({ step, onToggle }) {
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
        padding: "11px 18px",
        borderTop: "1px solid var(--border-subtle)",
        background: hov ? "var(--panel-2)" : "transparent",
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
          borderColor: step.done ? "var(--success)" : (boxHov ? "var(--success)" : "var(--border-strong)"),
          borderRadius: 5,
          background: step.done ? "var(--success)" : "transparent",
          cursor: "pointer", padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--bg)",
          transition: "border-color .12s, background .12s",
        }}
      >
        {step.done && (
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
        )}
      </button>
      <span style={{
        flex: 1, fontSize: 13.5,
        color: step.done ? "var(--text-very-dim)" : "var(--text)",
        textDecoration: step.done ? "line-through" : "none",
        minWidth: 0,
      }}>{step.text}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Plan block — one project or idea with its checklist
// ────────────────────────────────────────────────────────────
function PlanBlock({ name, statusPill, tags, plan, onToggleStep, onOpen }) {
  const [nameHov, setNameHov] = React.useState(false);
  const done = plan.filter((s) => s.done).length;
  const allDone = done === plan.length && plan.length > 0;
  const clickable = !!onOpen;

  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Header — name + status */}
      <div style={{ padding: "15px 18px 13px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span
            onClick={clickable ? onOpen : undefined}
            onMouseEnter={() => clickable && setNameHov(true)}
            onMouseLeave={() => setNameHov(false)}
            style={{
              flex: 1, minWidth: 0,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              lineHeight: 1.3,
              color: clickable && nameHov ? "#fff" : "var(--text)",
              cursor: clickable ? "pointer" : "default",
              textDecoration: clickable && nameHov ? "underline" : "none",
              textUnderlineOffset: 3,
              textWrap: "pretty",
            }}
          >{name}</span>
          <span style={{ flex: "0 0 auto", marginTop: 1 }}>{statusPill}</span>
        </div>
        {tags && tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
            {tags.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
        )}
      </div>

      {/* Checklist */}
      <div>
        {plan.map((s) => (
          <PlanStepRow key={s.id} step={s} onToggle={() => onToggleStep(s.id)} />
        ))}
      </div>

      {/* Footer — all-done indicator */}
      {allDone && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 18px",
          borderTop: "1px solid var(--border-subtle)",
          background: "oklch(0.74 0.14 165 / 0.06)",
          fontSize: 12,
          fontWeight: 500,
          color: "oklch(0.80 0.13 165)",
        }}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8 3.5 3.5L13 5" />
          </svg>
          All steps done
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Empty state
// ────────────────────────────────────────────────────────────
function PlansEmpty({ children }) {
  return (
    <div style={{
      padding: "44px 24px",
      textAlign: "center",
      color: "var(--text-very-dim)",
      fontSize: 14,
      lineHeight: 1.6,
      border: "1px dashed var(--border)",
      borderRadius: 10,
      background: "var(--panel)",
      textWrap: "pretty",
      maxWidth: 520,
      margin: "0 auto",
    }}>{children}</div>
  );
}

// ────────────────────────────────────────────────────────────
//  PlansView — top level
// ────────────────────────────────────────────────────────────
function PlansView({ projects, ideas, onToggleProjectStep, onToggleIdeaStep, onNavigate }) {
  const [filter, setFilter] = React.useState("all");

  // Only entities that actually have a plan with steps show up here.
  const projectsWithPlans = React.useMemo(
    () => (projects || [])
      .filter((p) => (p.plan || []).length > 0)
      .sort((a, b) => b.touched - a.touched),
    [projects]
  );
  const ideasWithPlans = React.useMemo(
    () => (ideas || [])
      .filter((i) => (i.plan || []).length > 0)
      .sort((a, b) => (b.lastUpdated || b.touched) - (a.lastUpdated || a.touched)),
    [ideas]
  );

  const showProjects = filter === "all" || filter === "projects";
  const showIdeas = filter === "all" || filter === "ideas";

  const allSteps = [
    ...projectsWithPlans.flatMap((p) => p.plan),
    ...ideasWithPlans.flatMap((i) => i.plan),
  ];
  const stepsLeft = allSteps.filter((s) => !s.done).length;
  const stepsDone = allSteps.length - stepsLeft;

  const nothingAtAll = projectsWithPlans.length === 0 && ideasWithPlans.length === 0;
  const visibleProjects = showProjects ? projectsWithPlans : [];
  const visibleIdeas = showIdeas ? ideasWithPlans : [];
  const filterEmpty = !nothingAtAll && visibleProjects.length === 0 && visibleIdeas.length === 0;

  return (
    <div data-screen-label="Plans" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
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
          }}>Plans</h1>
          <span style={{ fontSize: 13, color: "var(--text-very-dim)" }}>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{stepsLeft}</span> steps left
            <span style={{ margin: "0 8px", color: "var(--border-strong)" }}>·</span>
            <span style={{ color: "var(--text-dim)" }}>{stepsDone} done</span>
          </span>
        </div>
        <PlansFilter value={filter} onChange={setFilter} />
      </header>

      <div style={{ padding: "22px 48px 48px", display: "flex", flexDirection: "column", gap: 28 }}>
        {nothingAtAll && (
          <PlansEmpty>
            No plans yet. Open any project or idea and add steps to{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>## Current Plan</span>{" "}
            to see them here.
          </PlansEmpty>
        )}

        {filterEmpty && (
          <PlansEmpty>
            No {filter === "projects" ? "projects" : "ideas"} with active plans.
          </PlansEmpty>
        )}

        {visibleProjects.length > 0 && (
          <section>
            <PlansGroupHeader label="Projects" count={visibleProjects.length} hue={PLANS_GROUP_HUE.projects} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {visibleProjects.map((p) => (
                <PlanBlock
                  key={p.id}
                  name={p.title}
                  tags={p.tags}
                  plan={p.plan}
                  statusPill={<StatusPill status={p.status} onChange={() => {}} small />}
                  onToggleStep={(stepId) => onToggleProjectStep(p.id, stepId)}
                />
              ))}
            </div>
          </section>
        )}

        {visibleIdeas.length > 0 && (
          <section>
            <PlansGroupHeader label="Ideas" count={visibleIdeas.length} hue={PLANS_GROUP_HUE.ideas} />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {visibleIdeas.map((i) => (
                <PlanBlock
                  key={i.id}
                  name={i.title}
                  tags={i.tags}
                  plan={i.plan}
                  statusPill={<IdeaStatusPill status={i.status} onChange={() => {}} small />}
                  onToggleStep={(stepId) => onToggleIdeaStep(i.id, stepId)}
                  onOpen={() => onNavigate && onNavigate({ type: "idea", id: i.id })}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PlansView });
