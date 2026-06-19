// Root app

function App() {
  const [view, setView] = React.useState({ type: "dashboard" });
  const [inbox, setInbox]     = React.useState(MEM_INBOX);
  const [notes, setNotes]     = React.useState(MEM_NOTES);
  const [tasks, setTasks]     = React.useState(MEM_ACTIONS.map(t => ({ ...t, comments: t.comments || [] })));
  const [people, setPeople]   = React.useState(MEM_PEOPLE);
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
      null;
    const list =
      source === "inbox"  ? inbox :
      source === "note"   ? notes :
      source === "task"   ? tasks :
      source === "person" ? people :
      [];
    const removed = list.find((x) => x.id === item.id);
    if (setter) setter((arr) => arr.filter((x) => x.id !== item.id));
    if (action === "archive" && removed) {
      setArchive((arr) => [{ id: removed.id, label: item.label }, ...arr]);
    }
    if ((view.type === "inbox-note" || view.type === "note" || view.type === "person") && view.id === item.id) {
      setView({ type: "dashboard" });
    }
    setPending(null);
  };

  const updatePerson = (id, patch) =>
    setPeople((arr) => arr.map((p) => p.id === id ? { ...p, ...patch } : p));

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
        <IdeasSection />
      </React.Fragment>
    );
  };

  const dialogCopy = pending && (() => {
    const kind =
      pending.source === "inbox"  ? "inbox note" :
      pending.source === "note"   ? "note" :
      pending.source === "task"   ? "task" :
      pending.source === "person" ? "person" :
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
        archive={archive}
      />
      <main
        style={{ flex: 1, overflowY: "auto", color: "var(--text)" }}
        data-screen-label={
          view.type === "inbox-note" ? "Inbox note"
          : view.type === "note"   ? "Note"
          : view.type === "person" ? "Person"
          : view.type === "tasks"  ? "Tasks"
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
