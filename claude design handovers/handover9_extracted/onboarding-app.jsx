// Onboarding app — owns flow state, computes the step order per path,
// handles back/Enter navigation, and swaps to the demo inbox on completion.

const STEP_BASE = ["welcome", "name", "folder", "ai", "modules"];
function stepsFor(path) {
  if (path === "pro") return [...STEP_BASE, "ready"];
  return [...STEP_BASE, "seed", "ready"]; // "new" (and default)
}

function OnboardingApp() {
  const [screen, setScreen] = React.useState("flow"); // "flow" | "app"
  const [step, setStep] = React.useState("welcome");
  const [showFirstRun, setShowFirstRun] = React.useState(false);

  const [s, setS] = React.useState({
    path: null,
    name: "",
    folder: null,
    provider: "openrouter",
    apiKey: "",
    modules: { people: true, projects: true, ideas: true },
    seedPeople: [{ name: "", role: "" }, { name: "", role: "" }],
    seedProjects: [{ name: "" }, { name: "" }],
    seeded: false,
  });
  const patch = (p) => setS((prev) => ({ ...prev, ...p }));

  const order = stepsFor(s.path);
  const idx = Math.max(0, order.indexOf(step));
  const total = order.length;
  const showBack = step !== "welcome";

  const goNext = () => {
    const i = order.indexOf(step);
    if (i >= 0 && i < order.length - 1) setStep(order[i + 1]);
  };
  const goBack = () => {
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
  };

  const act = {
    next: goNext,
    back: goBack,
    choosePath: (path) => { patch({ path }); setStep("name"); },
    setName: (name) => patch({ name }),
    setFolder: (folder) => patch({ folder }),
    connectExisting: () => { patch({ folder: { ...s.folder, state: "A", connected: true } }); setStep("ai"); },
    setProvider: (provider) => patch({ provider }),
    setApiKey: (apiKey) => patch({ apiKey }),
    toggleModule: (id) => setS((prev) => ({ ...prev, modules: { ...prev.modules, [id]: !prev.modules[id] } })),
    addSeed: (kind) => setS((prev) => {
      const key = kind === "people" ? "seedPeople" : "seedProjects";
      if (prev[key].length >= 3) return prev;
      const blank = kind === "people" ? { name: "", role: "" } : { name: "" };
      return { ...prev, [key]: [...prev[key], blank] };
    }),
    removeSeed: (kind, i) => setS((prev) => {
      const key = kind === "people" ? "seedPeople" : "seedProjects";
      const arr = prev[key].slice();
      arr.splice(i, 1);
      return { ...prev, [key]: arr.length ? arr : [kind === "people" ? { name: "", role: "" } : { name: "" }] };
    }),
    editSeed: (kind, i, field, val) => setS((prev) => {
      const key = kind === "people" ? "seedPeople" : "seedProjects";
      const arr = prev[key].map((row, j) => j === i ? { ...row, [field]: val } : row);
      return { ...prev, [key]: arr };
    }),
    finishSetup: (skip) => { patch({ seeded: !skip }); setStep("ready"); },
    openApp: () => { setScreen("app"); if (s.path === "new") setShowFirstRun(true); },
  };

  const restart = () => {
    setScreen("flow");
    setStep("welcome");
    setShowFirstRun(false);
    setS({
      path: null, name: "", folder: null, provider: "openrouter", apiKey: "",
      modules: { people: true, projects: true, ideas: true },
      seedPeople: [{ name: "", role: "" }, { name: "", role: "" }],
      seedProjects: [{ name: "" }, { name: "" }],
      seeded: false,
    });
  };

  // Keyboard: Enter advances on non-input steps; Escape does nothing.
  React.useEffect(() => {
    if (screen !== "flow") return;
    const onKey = (e) => {
      if (e.key !== "Enter") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return; // those handle their own
      if (step === "folder" && s.folder && s.folder.state === "A") goNext();
      else if (step === "modules") goNext();
      else if (step === "seed") act.finishSetup(false);
      else if (step === "ready") act.openApp();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [screen, step, s.folder, s.path]);

  if (screen === "app") {
    return (
      <React.Fragment>
        <DemoInbox s={s} onRestart={restart} />
        {showFirstRun && <FirstRunPopup onDismiss={() => setShowFirstRun(false)} />}
      </React.Fragment>
    );
  }

  const renderStep = () => {
    switch (step) {
      case "welcome": return <WelcomeScreen act={act} />;
      case "name":    return <NameScreen s={s} act={act} />;
      case "folder":  return <FolderScreen s={s} act={act} />;
      case "ai":      return <AiScreen s={s} act={act} />;
      case "modules": return <ModulesScreen s={s} act={act} />;
      case "seed":    return <SeedScreen s={s} act={act} />;
      case "ready":   return <ReadyScreen s={s} act={act} />;
      default:        return null;
    }
  };

  return (
    <OnbShell stepKey={step} total={total} current={idx} showBack={showBack} onBack={goBack}>
      {renderStep()}
    </OnbShell>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<OnboardingApp />);
