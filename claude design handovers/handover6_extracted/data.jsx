// Memory OS — seed data
// Status taxonomy used across the dashboard:
//   building      → in active development (green)
//   triaged       → scoped, waiting to start (amber)
//   to-be-deployed→ done, awaiting deploy (blue)
//   needs-call    → blocked / decision needed (red)
//   idle          → not touched recently (slate)

const NOW = new Date("2026-05-22T16:48:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);

const STATUS = {
  "building":      { label: "Building",       hue: 150 },
  "triaged":       { label: "Triaged",        hue: 80  },
  "to-be-deployed":{ label: "To Be Deployed", hue: 230 },
  "needs-call":    { label: "Needs Your Call",hue: 25  },
  "idle":          { label: "Idle",           hue: 260 },
};

const PROJECTS = [
  {
    id: "content-system",
    title: "Content System",
    status: "to-be-deployed",
    summary: "There is no one-stop-shop solution for everything Sites related and no self-service flow for marketing.",
    tags: ["Sites", "Apps"],
    touched: daysAgo(11),
    openActions: 2,
    progress: 0.85,
  },
  {
    id: "ia-framework",
    title: "Information Architecture Framework For Product Bubbles",
    status: "triaged",
    summary: "Each product bubble has different IA architecture which does not provide unified experience.",
    tags: ["IA", "Sites", "Product"],
    touched: daysAgo(18),
    openActions: 4,
    progress: 0.2,
  },
  {
    id: "memory-os-app",
    title: "Memory OS App",
    status: "building",
    summary: "My brain is overloaded — need a system to process ideas and daily tasks.",
    tags: ["AI", "apps", "hackathon"],
    touched: daysAgo(1),
    openActions: 6,
    progress: 0.45,
  },
  {
    id: "ubuntucom-revamp",
    title: "Ubuntu.com Home Page Revamp",
    status: "triaged",
    summary: "Ubuntu.com is outdated and old although it is our flagship website with huge traffic.",
    tags: ["Ubuntu", "Sites"],
    touched: daysAgo(23),
    openActions: 3,
    progress: 0.1,
  },
  {
    id: "design-tokens-v2",
    title: "Design Tokens v2",
    status: "building",
    summary: "Reconcile semantic tokens across Vanilla, Canonical brand, and product surfaces.",
    tags: ["DS", "infra"],
    touched: daysAgo(3),
    openActions: 5,
    progress: 0.55,
  },
  {
    id: "hackathon-demo",
    title: "Hackathon Demo Prep",
    status: "needs-call",
    summary: "Demo slot is Friday. Need to decide which two flows to show and who presents.",
    tags: ["events"],
    touched: daysAgo(2),
    openActions: 7,
    progress: 0.3,
  },
];

const PEOPLE = [
  {
    id: "elaine",
    name: "Elaine Liman",
    role: "UX designer / Prof I",
    relationship: "direct report",
    touched: daysAgo(2),
    initials: "EL",
    note: "1:1 prep",
    cadence: 5,
    summary: "Elaine is one of my designers, focused on the IA framework and the Memory OS dashboard. Strong systems thinker, weaker on stakeholder management — that's our current development arc together. Our 1:1 is weekly on Tuesdays.",
    relatedProjects: ["ia-framework", "memory-os-app"],
    delegate: [
      { id: "ed1", text: "Audit Ubuntu.com nav as input to IA Framework", done: false },
      { id: "ed2", text: "Draft Memory OS empty states for next review", done: false },
      { id: "ed3", text: "Send last week's research synth to Sophie",      done: true  },
    ],
    talkAbout: [
      { id: "et1", text: "Q3 development plan — how to broaden stakeholder rep", done: false },
      { id: "et2", text: "Conference talk proposal idea (drafted on Slack)",     done: false },
      { id: "et3", text: "Vacation in early July overlap",                       done: false },
    ],
    recentMentions: [
      { date: daysAgo(1),  context: "Caught Katarzyna up on Elaine's progress on the IA scaffold.",      source: "2026-05-22" },
      { date: daysAgo(5),  context: "Elaine shared screens that solve the bubble nav problem cleanly.", source: "2026-05-18 · 1:1" },
      { date: daysAgo(12), context: "Sophie suggested Elaine could lead the shadow IA pairing.",        source: "inbox-2026-05-11" },
    ],
    notes: "Started March 2024. Came in via the Berlin meetup connection — Tomáš had worked with her at Mozilla. Prefers async written context before any review meeting. Has been quietly resentful about being passed over for the Brand WG; worth raising directly at Q3.",
  },
  {
    id: "katarzyna",
    name: "Katarzyna Duda",
    role: "Design manager",
    relationship: "manager",
    touched: daysAgo(5),
    initials: "KD",
    note: "Q3 review",
    cadence: 4,
    summary: "My manager. Pragmatic, very calendar-driven, allergic to ambiguity. Reports up to the VP. Reads written prep before any 1:1 — putting things in writing earns trust.",
    relatedProjects: ["content-system", "ubuntucom-revamp"],
    delegate: [
      { id: "kd1", text: "Confirm Q3 review date with VP's EA", done: false },
    ],
    talkAbout: [
      { id: "kt1", text: "Q3 review agenda — three artefacts she wants", done: false },
      { id: "kt2", text: "Push back on Ubuntu.com revamp timeline",      done: false },
      { id: "kt3", text: "Headcount ask for IA framework research",      done: false },
    ],
    recentMentions: [
      { date: daysAgo(3), context: "Katarzyna pinged about the Q3 prep doc — she wants it by Wednesday.", source: "2026-05-20" },
      { date: daysAgo(9), context: "Reviewed Content System with Katarzyna; she signed off on launch.",    source: "2026-05-14" },
    ],
    notes: "Took over from Marcus's old line in early 2025. Strong on operational rhythms; less interested in craft details. Best to bring her the call, not the deliberation.",
  },
  {
    id: "sophie",
    name: "Sophie Felder",
    role: "UX designer / Prof II",
    relationship: "colleague",
    touched: daysAgo(9),
    initials: "SF",
    note: "shadow IA project",
    cadence: 3,
    summary: "Sister team's senior designer. We've been pairing on the IA framework as a shadow workstream — she brings the cross-product perspective I'm missing.",
    relatedProjects: ["ia-framework"],
    delegate: [],
    talkAbout: [
      { id: "st1", text: "Atlassian IA references — discuss reads",      done: false },
      { id: "st2", text: "Joint working session for the framework draft", done: false },
    ],
    recentMentions: [
      { date: daysAgo(0), context: "Sophie sent three IA references in #design.",                source: "inbox-2026-05-22" },
      { date: daysAgo(9), context: "Compared notes with Sophie on product nav patterns.",        source: "2026-05-13" },
    ],
    notes: "",
  },
  {
    id: "marcus",
    name: "Marcus Chen",
    role: "Engineering lead",
    relationship: "cross-team",
    touched: daysAgo(14),
    initials: "MC",
    note: "deploy pipeline",
    cadence: 2,
    summary: "Engineering lead on the deploy infrastructure. We don't sync often, but when we do it tends to unblock a lot.",
    relatedProjects: ["content-system"],
    delegate: [
      { id: "md1", text: "Wire deploy step for Content System", done: false },
    ],
    talkAbout: [
      { id: "mt1", text: "Bug — deploy script silently swallows errors", done: false },
    ],
    recentMentions: [
      { date: daysAgo(14), context: "Marcus mentioned the CDN token rotation in the infra channel.", source: "2026-05-08" },
    ],
    notes: "",
  },
  {
    id: "priya",
    name: "Priya Shah",
    role: "Product manager",
    relationship: "cross-team",
    touched: daysAgo(21),
    initials: "PS",
    note: "roadmap sync",
    cadence: 2,
    summary: "PM partner on the Ubuntu.com revamp. Mostly absent during scoping; we should re-establish a regular sync.",
    relatedProjects: ["ubuntucom-revamp"],
    delegate: [],
    talkAbout: [
      { id: "pt1", text: "Roadmap — Q3 commit for Ubuntu.com", done: false },
    ],
    recentMentions: [],
    notes: "",
  },
  {
    id: "tomas",
    name: "Tomáš Reyes",
    role: "User researcher",
    relationship: "colleague",
    touched: daysAgo(28),
    initials: "TR",
    note: "interview synthesis",
    cadence: 1,
    summary: "Researcher who'd be a great fit for the IA framework — but we've been quiet for a month. Worth a check-in just to keep the relationship warm.",
    relatedProjects: ["ia-framework"],
    delegate: [],
    talkAbout: [
      { id: "tt1", text: "Capacity for 2 weeks on IA framework", done: false },
    ],
    recentMentions: [
      { date: daysAgo(28), context: "Tomáš shared the discovery synthesis doc.", source: "2026-04-24" },
    ],
    notes: "",
  },
];

const IDEAS = [
  { id: "ai-memory-os",     title: "AI Memory OS",          status: "building", touched: daysAgo(1) },
  { id: "daily-review",     title: "Daily review ritual",   status: "triaged",  touched: daysAgo(6) },
  { id: "project-health",   title: "Project health score",  status: "triaged",  touched: daysAgo(12) },
  { id: "smart-inbox",      title: "Smart inbox triage",    status: "idle",     touched: daysAgo(34) },
  { id: "weekly-digest",    title: "Friday weekly digest",  status: "idle",     touched: daysAgo(41) },
];

const ACTIONS = [
  { id: "a1", text: "Reply to Katarzyna re: Q3 review agenda",          project: "—",                   category: "actions",     created: daysAgo(1),  done: false, comments: [] },
  { id: "a2", text: "Cut hackathon demo to 2 flows + assign presenters",project: "Hackathon Demo Prep", category: "needs-call",  created: daysAgo(3),  done: false, comments: [
    { id: "c-seed-1", text: "Marcus suggested flow A (onboarding) + flow C (memory recall). Need to confirm with Priya.", ts: daysAgo(1) },
  ]},
  { id: "a3", text: "Audit Ubuntu.com nav for IA framework draft",      project: "IA Framework",        category: "actions",     created: daysAgo(8),  done: false, comments: [] },
  { id: "a4", text: "Wire deploy step for Content System",              project: "Content System",      category: "delegate",    created: daysAgo(2),  done: false, comments: [] },
  { id: "a5", text: "Draft Memory OS dashboard spec",                   project: "Memory OS App",       category: "actions",     created: daysAgo(5),  done: true,  comments: [] },
  { id: "a6", text: "Send Sophie scope notes for shadow IA",            project: "IA Framework",        category: "delegate",    created: daysAgo(17), done: false, comments: [] },
  { id: "a7", text: "Decide token naming: --color-* vs --c-*",          project: "Design Tokens v2",    category: "decisions",   created: daysAgo(11), done: false, comments: [] },
];

const TASK_CATEGORIES = [
  { id: "needs-call", label: "Needs Your Call", hue: 25,  description: "Blockers and decisions waiting on you" },
  { id: "actions",    label: "Actions",         hue: 150, description: "Work to do yourself" },
  { id: "delegate",   label: "Delegate",        hue: 230, description: "To hand off to someone else" },
  { id: "decisions",  label: "Decisions",       hue: 80,  description: "Calls to make, options to weigh" },
  { id: "done",       label: "Done",            hue: 260, description: "Completed tasks", isDone: true },
];

// Needs your call: decisions and blockers waiting on you.
// Each is a single actionable line with an optional related person, an
// importance flag, and an age — surfaced as priority cards on the dashboard.
const NEEDS_CALL = [
  { id: "nc-demo",   title: "Decide presenters for Friday's hackathon demo",   person: { name: "Elaine", hue: 150 }, important: true,  age: 2,  done: false },
  { id: "nc-ubuntu", title: "Ubuntu.com revamp — commit this sprint or drop it", person: { name: "Priya",  hue: 240 }, important: true,  age: 16, done: false },
  { id: "nc-tomas",  title: "Reconnect with Tomáš — no contact in 4 weeks",     person: { name: "Tomáš",  hue: 25 },  important: false, age: 28, done: false },
];

// Activity: count of touched items per day, last 12 weeks (84 days).
// Seeded so it looks like a real working week rhythm.
const ACTIVITY = (() => {
  const out = [];
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 83; i >= 0; i--) {
    const d = new Date(NOW.getTime() - i * 86400000);
    const dow = d.getDay();
    const weekend = (dow === 0 || dow === 6);
    const base = weekend ? rand() * 1.2 : rand() * 5 + 1;
    const v = Math.max(0, Math.round(base + (rand() < 0.12 ? 4 : 0)));
    out.push({ date: d, count: v });
  }
  // Make today substantial
  out[out.length - 1].count = 7;
  out[out.length - 2].count = 4;
  return out;
})();

// INBOX_NOTES — raw intake, typed or dictated. Body is plain text.
// The "title" of the file on disk is always the date; the title field below is
// an optional human-readable subtitle the user can add before processing.
const INBOX_NOTES = [
  {
    id: "inbox-2026-05-22-1648",
    dateTitle: "2026-05-22 · Friday 16:48",
    title: "",
    body: `sophie sent three references for the IA framework in #design this morning

- atlassian product nav patterns (the "bubble" model)
- stripe docs IA case study from 2024
- notion internal IA RFC (in DM, redact before circulating)

worth a look before the ubuntu.com revamp kickoff. all three argue for shared scaffold + local affordances — probably where we land too.

todo
- skim end to end before friday
- pull two diagrams into IA framework note
- ping sophie monday to compare reads`,
  },
  {
    id: "inbox-2026-05-21-0912",
    dateTitle: "2026-05-21 · Thursday 09:12",
    title: "deploy script swallows errors",
    body: `publish script exits 0 even when the cdn upload fails. only noticed because pages 404 in prod.

repro
- trigger deploy with bad cdn token
- watch log say "done."
- hit url → 404

fix
- wrap upload in set -e, propagate non-zero exit
- add smoke test that fetches index post-deploy, asserts 200

ask marcus about the deploy job runner config — there might be a flag we already have.`,
  },
  {
    id: "inbox-2026-05-20-2204",
    dateTitle: "2026-05-20 · Wednesday 22:04",
    title: "",
    body: `idea — weekly digest email every friday 5pm

what changed across projects (status moves, age)
people not touched in 14+ days
ideas sitting in triaged too long
one "focus suggestion" for next week from needs your call

composes nicely with the daily review ritual idea. daily for noise, weekly for shape.`,
  },
];

// NOTES — processed, structured. Lives in the Notes folder; file id is the date.
const NOTES = [
  {
    id: "2026-05-22",
    title: "Sophie sent IA references",
    created: daysAgo(0),
    tags: ["ia", "research", "from:sophie"],
    body: [
      { type: "p", text: "Sophie dropped three IA references in the design channel this morning — worth a look before the Ubuntu.com revamp kickoff." },
      { type: "h", text: "Links" },
      { type: "ul", items: [
        "Atlassian product navigation patterns — “bubble” model",
        "Stripe Docs IA case study from 2024",
        "Notion's internal IA RFC (shared in DM, redact before circulating)",
      ]},
      { type: "h", text: "Why this matters" },
      { type: "p", text: "We've been going back and forth on whether to unify nav across product bubbles or let each have a tailored IA. These references all argue for a shared scaffold + local affordances — likely where we should land too." },
      { type: "h", text: "Next" },
      { type: "ul", items: [
        "Skim the three references end-to-end (45min)",
        "Pull two diagrams into the IA Framework note",
        "Ping Sophie to compare reads on Monday",
      ]},
    ],
    backlinks: ["ia-framework", "ubuntucom-revamp", "sophie"],
  },
  {
    id: "2026-05-21",
    title: "Bug — deploy script silently swallows errors",
    created: daysAgo(1),
    tags: ["bug", "infra"],
    body: [
      { type: "p", text: "Found while wiring up the Content System deploy step. The publish script exits 0 even when the upload to the CDN fails — we only notice because pages 404 in production." },
      { type: "h", text: "Repro" },
      { type: "ol", items: [
        "Trigger a deploy with an invalid CDN token (env var swap)",
        "Watch the job log — “Done.” appears at the end",
        "Hit the deployed URL → 404",
      ]},
      { type: "h", text: "Likely fix" },
      { type: "p", text: "Wrap the upload step in `set -e` or explicitly propagate the non-zero exit. Worth adding a smoke test that fetches the published index after deploy and asserts 200." },
    ],
    backlinks: ["content-system", "marcus"],
  },
  {
    id: "2026-05-20",
    title: "Idea — weekly digest email",
    created: daysAgo(2),
    tags: ["idea", "memory-os"],
    body: [
      { type: "p", text: "Every Friday at 5pm, Memory OS sends me a digest covering the week:" },
      { type: "ul", items: [
        "What changed across projects (status moves, age)",
        "People I haven't touched in 14+ days",
        "Ideas that have been sitting in Triaged for too long",
        "One “focus suggestion” for next week, picked from Needs Your Call",
      ]},
      { type: "p", text: "Should compose well with the daily review ritual idea — daily for noise, weekly for shape." },
    ],
    backlinks: ["ai-memory-os", "daily-review"],
  },
  {
    id: "2026-05-19",
    title: "1:1 — Katarzyna · Q3 review prep",
    created: daysAgo(3),
    tags: ["1-1", "from:katarzyna"],
    body: [
      { type: "p", text: "Half-hour prep for Q3 review. Katarzyna wants three artefacts: shipped work, in-flight bets, and one open ask." },
      { type: "h", text: "Shipped" },
      { type: "ul", items: [
        "Content System (to-be-deployed)",
        "Design Tokens v1 review",
        "Two onboarding studies with the research team",
      ]},
      { type: "h", text: "In flight" },
      { type: "ul", items: [
        "IA Framework — still scoping",
        "Memory OS App — building",
        "Ubuntu.com revamp — triaged",
      ]},
      { type: "h", text: "Ask" },
      { type: "p", text: "More dedicated research time for IA Framework before kickoff. Either pull Tomáš in for two weeks or push the kickoff back a sprint." },
    ],
    backlinks: ["katarzyna", "ia-framework"],
  },
];

Object.assign(window, {
  MEM_NOW: NOW,
  MEM_STATUS: STATUS,
  MEM_PROJECTS: PROJECTS,
  MEM_PEOPLE: PEOPLE,
  MEM_IDEAS: IDEAS,
  MEM_ACTIONS: ACTIONS,
  MEM_TASK_CATEGORIES: TASK_CATEGORIES,
  MEM_NEEDS_CALL: NEEDS_CALL,
  MEM_ACTIVITY: ACTIVITY,
  MEM_INBOX: INBOX_NOTES,
  MEM_NOTES: NOTES,
  memDaysAgo: (d) => Math.round((NOW - d) / 86400000),
});
