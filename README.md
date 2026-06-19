# YapAtMe

YapAtMe is a local-first, AI-powered notes app. You dictate or write quick notes into an inbox; the AI reads each note and automatically routes the content into the right place — people, projects, ideas, and tasks — inside a folder of plain Markdown files that lives on your own computer.

- Your notes stay on your machine (a folder you pick). Nothing is uploaded.
- Your AI key is stored locally in the browser and only sent to your chosen AI provider.
- Output is plain Markdown, so your data is always portable and yours.

## Features

- **Smart inbox routing** — turns a freeform note into structured updates across people/projects/ideas.
- **Auto task extraction** — pulls action items, follow-ups, delegations, and decisions out of your notes.
- **Urgent / important flags** — mark tasks via the 3-dots menu; they surface in "Needs Your Call".
- **Wikilinks** — `[[Name]]` mentions are detected and linked to entities automatically.
- **People / Projects / Ideas modules** — each is a folder of Markdown files; modules can be toggled.
- **Command center & dashboard** — overview of activity, open tasks, and what needs attention.
- **Multiple AI providers** — OpenRouter, Anthropic, OpenAI, or local Ollama.
- **Bring your own vault** — point it at any empty (new) or existing YapAtMe folder.

## Requirements

- A Chromium-based browser (Chrome, Edge, Brave) — needed for local folder access.
- [Node.js](https://nodejs.org) 18+ **or** [Bun](https://bun.sh).
- An AI API key (e.g. from OpenRouter or Anthropic), unless you use local Ollama.

## Install & Run

### Option A — VS Code + GitHub Copilot (easiest)

1. Install [VS Code](https://code.visualstudio.com) and [Node.js](https://nodejs.org).
2. In VS Code: `File > Clone Repository`, paste this repo's URL, open it.
3. Open Copilot Chat and paste:
   > Install dependencies and start the dev server for this project.
4. Open the local URL it prints (usually `http://localhost:5173`).

### Option B — Terminal

```bash
git clone <REPO_URL>
cd YapAtMe
npm install      # or: bun install
npm run dev      # or: bun run dev
```

Then open the printed URL (usually `http://localhost:5173`).

## First-time setup (in the app)

1. **Choose a folder** — pick an empty folder for a new vault, or an existing YapAtMe vault.
2. **Add your AI key** — in onboarding (or `Settings > AI Setup`), pick a provider + model and paste your key.
3. **Write a note** — go to the Inbox, write something, and click process. The AI routes it for you.

## AI setup notes

- **Provider/model** are chosen in `Settings > AI Setup` (dropdowns included).
- **Anthropic in-browser**: the app sends the required browser opt-in header automatically.
- **Ollama**: select it as the provider to run fully local with no API key.

## Build for production

```bash
npm run build     # or: bun run build
npm run preview   # serve the production build locally
```

## Tech stack

React + Vite, Tailwind, Milkdown editor, IndexedDB (settings/cache), and the browser File System Access API for the local vault.