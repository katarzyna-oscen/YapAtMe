// Root app

function App() {
  const [view, setView] = React.useState({ type: "dashboard" });
  const [inbox, setInbox]     = React.useState(MEM_INBOX);
  const [notes, setNotes]     = React.useState(MEM_NOTES);
  const [tasks, setTasks]     = React.useState(MEM_ACTIONS.map(t => ({ ...t, comments: t.comments || [] })));
  const [people, setPeople]   = React.useState(MEM_PEOPLE);
  const [projects, setProjects] = React.useState(MEM_PROJECTS);
  const [ideas, setIdeas]     = React.useState(MEM_IDEAS);
  const [backlog, setBacklog] = React.useState(MEM_IDEA_BACKLOG);
  const [categories, setCategories] = React.useState(MEM_IDEA_CATEGORIES);
  const [archive, setArchive] = React.useState([]);
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  const [pending, setPending] = React.useState(null);

  const stats = React.useMemo(() => {
    const stale = MEM_PROJECTS.filter(p => ageDays(p.touched) >= 14).length;
    return {
      projects: MEM_PROJECTS.length,
      stale,
      actions: tasks.filter(a => !a.done).length,
    };
  }, [tasks]);

  const handleItemAction = (action, source, item) => {
    setPending({ action, source, item });
  };

  const cancelPending = () => setPending(null);

  const commitPending = () => {
    if (!pending) return;
    const { action, source, item, ids } = pending;
    if (action === "delete-all" && source === "task" && Array.isArray(ids)) {
      const idSet = new Set(ids);
      setTasks((arr) => arr.filter((x) => !idSet.has(x.id)));
      setPending(null);
      return;
    }
    const setter =
      source === "inbox"  ? setInbox :
      source === "note"   ? setNotes :
      source === "task"   ? setTasks :
      source === "person" ? setPeople :
      source === "idea"   ? setIdeas :
      null;
    const list =
      source === "inbox"  ? inbox :
      source === "note"   ? notes :
      source === "task"   ? tasks :
      source === "person" ? people :
      source === "idea"   ? ideas :
      [];
    const removed = list.find((x) => x.id === item.id);
    if (setter) setter((arr) => arr.filter((x) => x.id !== item.id));
    if (action === "archive" && removed) {
      setArchive((arr) => [{ id: removed.id, label: item.label }, ...arr]);
    }
    if ((view.type === "inbox-note" || view.type === "note" || view.type === "person" || view.type === "idea") && view.id === item.id) {
      setView({ type: "dashboard" });
    }
    setPending(null);
  };

  const updatePerson = (id, patch) =>
    setPeople((arr) => arr.map((p) => p.id === id ? { ...p, ...patch } : p));

  const updateIdea = (id, patch) =>
    setIdeas((arr) => arr.map((p) => p.id === id ? { ...p, ...patch, lastUpdated: MEM_NOW } : p));

  // ── Ideas backlog ──
  const setBacklogCategory = (id, category) =>
    setBacklog((arr) => arr.map((b) => b.id === id ? { ...b, category } : b));

  const addCategory = (name) =>
    setCategories((arr) => arr.includes(name) ? arr : [...arr, name]);

  const killBacklogItem = (item) =>
    setBacklog((arr) => arr.filter((b) => b.id !== item.id));

  // Promote a backlog item into a full Idea file (built on the idea-view
  // template), drop it from the backlog, and open the new file.
  const promoteBacklogItem = (item) => {
    const titleFrom = (s) => {
      let t = (s || "").split("\u2014")[0].trim();
      const words = t.split(/\s+/);
      if (words.length > 8) t = words.slice(0, 8).join(" ");
      return t.replace(/[.,;:]$/, "");
    };
    const newIdea = {
      id: "idea-" + Date.now(),
      title: titleFrom(item.summary),
      type: "idea",
      domain: item.category || null,
      status: "spark",
      origin: item.captured,
      touched: MEM_NOW,
      lastUpdated: MEM_NOW,
      relatedProjects: [],
      relatedPeople: [],
      tags: item.category ? [`idea_${item.category.toLowerCase()}`] : [],
      summary: item.summary,
      originText: `Filed from the backlog \u2014 the AI flagged this as #idea in the note from ${item.sourceDate}.`,
      developing: [],
      outcome: null,
      plan: [],
      recentMentions: [],
    };
    setIdeas((arr) => [newIdea, ...arr]);
    setBacklog((arr) => arr.filter((b) => b.id !== item.id));
    setView({ type: "idea", id: newIdea.id });
  };

  // Toggle a `## Current Plan` step on a project or idea — the optimistic
  // write the Plans screen makes back to the source entity.
  const toggleProjectStep = (projectId, stepId) =>
    setProjects((arr) => arr.map((p) =>
      p.id === projectId
        ? { ...p, touched: MEM_NOW, plan: (p.plan || []).map((s) => s.id === stepId ? { ...s, done: !s.done } : s) }
        : p
    ));

  const toggleIdeaStep = (ideaId, stepId) =>
    setIdeas((arr) => arr.map((i) =>
      i.id === ideaId
        ? { ...i, lastUpdated: MEM_NOW, plan: (i.plan || []).map((s) => s.id === stepId ? { ...s, done: !s.done } : s) }
        : i
    ));

  const plansStepsLeft =
    projects.reduce((n, p) => n + (p.plan || []).filter((s) => !s.done).length, 0) +
    ideas.reduce((n, i) => n + (i.plan || []).filter((s) => !s.done).length, 0);

  const renderView = () => {
    if (view.type === "inbox-note") {
      const note = inbox.find((n) => n.id === view.id);
      if (note) return (
        <InboxNoteView
          note={note}
          onAction={(action, item) => handleItemAction(action, "inbox", item)}
        />
      );
    }
    if (view.type === "note") {
      const note = notes.find((n) => n.id === view.id);
      if (note) return (
        <ProcessedNoteView
          note={note}
          onAction={(action, item) => handleItemAction(action, "note", item)}
        />
      );
    }
    if (view.type === "person") {
      const person = people.find((p) => p.id === view.id);
      if (person) return (
        <PersonView
          person={person}
          onUpdate={(patch) => updatePerson(person.id, patch)}
          onAction={(action, item) => handleItemAction(action, "person", item)}
        />
      );
    }
    if (view.type === "idea") {
      const idea = ideas.find((p) => p.id === view.id);
      if (idea) return (
        <IdeaView
          idea={idea}
          onUpdate={(patch) => updateIdea(idea.id, patch)}
          onAction={(action, item) => handleItemAction(action, "idea", item)}
          onNavigate={setView}
        />
      );
    }
    if (view.type === "ideas-backlog") {
      return (
        <IdeaBacklogView
          backlog={backlog}
          categories={categories}
          onSetCategory={setBacklogCategory}
          onAddCategory={addCategory}
          onPromote={promoteBacklogItem}
          onKill={killBacklogItem}
          onNavigate={setView}
        />
      );
    }
    if (view.type === "tasks") {
      return (
        <TasksView
          tasks={tasks}
          setTasks={setTasks}
          onAction={(action, item) => handleItemAction(action, "task", item)}
          onRemoveAllDone={(ids) => setPending({
            action: "delete-all",
            source: "task",
            ids,
            item: { id: "__all_done__", label: `${ids.length} done task${ids.length === 1 ? "" : "s"}` },
          })}
        />
      );
    }
    if (view.type === "plans") {
      return (
        <PlansView
          projects={projects}
          ideas={ideas}
          onToggleProjectStep={toggleProjectStep}
          onToggleIdeaStep={toggleIdeaStep}
          onNavigate={setView}
        />
      );
    }
    if (view.type === "settings") {
      return (
        <SettingsView
          view={view}
          onNavigate={setView}
          settings={settings}
          setSettings={setSettings}
        />
      );
    }
    return (
      <React.Fragment>
        <TopBar stats={stats} />
        <NeedsCallRow items={MEM_NEEDS_CALL} />
        <Summaries />
        <ProjectsSection />
        <ActionsSection />
        <PeopleSection />
        <IdeasSection
          ideas={ideas}
          onNavigate={setView}
          onStatusChange={(id, status) => updateIdea(id, { status })}
        />
      </React.Fragment>
    );
  };

  const dialogCopy = pending && (() => {
    const kind =
      pending.source === "inbox"  ? "inbox note" :
      pending.source === "note"   ? "note" :
      pending.source === "task"   ? "task" :
      pending.source === "person" ? "person" :
      pending.source === "idea"   ? "idea" :
      "item";
    if (pending.action === "delete-all") {
      return {
        title: `Remove all done tasks?`,
        message: `${pending.item.label} will be permanently removed. This action cannot be undone.`,
        confirmLabel: "Remove all",
        danger: true,
      };
    }
    if (pending.action === "delete") {
      return {
        title: `Delete ${kind}?`,
        message: `“${pending.item.label}” will be permanently removed. This action cannot be undone.`,
        confirmLabel: "Delete",
        danger: true,
      };
    }
    return {
      title: `Archive ${kind}?`,
      message: `“${pending.item.label}” will be moved to the Archive. You can restore it later from the Archive section.`,
      confirmLabel: "Archive",
      danger: true,
    };
  })();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      <Sidebar
        view={view}
        onNavigate={setView}
        onItemAction={handleItemAction}
        inbox={inbox}
        notes={notes}
        tasks={tasks}
        people={people}
        ideas={ideas}
        backlogCount={backlog.length}
        archive={archive}
        plansCount={plansStepsLeft}
      />
      <main
        style={{ flex: 1, overflowY: "auto", color: "var(--text)" }}
        data-screen-label={
          view.type === "inbox-note" ? "Inbox note"
          : view.type === "note"   ? "Note"
          : view.type === "person" ? "Person"
          : view.type === "idea"   ? "Idea"
          : view.type === "ideas-backlog" ? "Ideas backlog"
          : view.type === "tasks"  ? "Tasks"
          : view.type === "plans"  ? "Plans"
          : view.type === "settings" ? "Settings"
          : "Dashboard"
        }
      >
        {renderView()}
      </main>
      <ConfirmDialog
        open={!!pending}
        title={dialogCopy?.title}
        message={dialogCopy?.message}
        confirmLabel={dialogCopy?.confirmLabel}
        danger={dialogCopy?.danger}
        onConfirm={commitPending}
        onCancel={cancelPending}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
