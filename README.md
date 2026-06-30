# YapAtMe

YapAtMe is a local-first, AI-powered notes app. You dictate or write quick notes into an inbox; the AI reads each note and automatically routes the content into the right place — people, projects, ideas, and tasks — inside a folder of plain Markdown files that lives on your own computer.

- Your notes stay on your machine (a folder you pick). Nothing is uploaded.
- Your AI key is stored locally and only sent to your chosen AI provider.
- Output is plain Markdown, so your data is always portable and yours.
- **Voice dictation needs Google Chrome** — the speech engine only works there.

---

## Which version should I get?

| Version | Best for | What you download | You need |
|---|---|---|---|
| **1. Browser / Developer** | Any OS, trying it out, editing the code | This repo | Node.js + a browser |
| **2. Ubuntu app** | A normal desktop app on Ubuntu/Debian | `yapatme_*.deb` | Google Chrome |
| **3. macOS app** | A normal desktop app on a Mac | `YapAtMe-*.dmg` | Google Chrome |

The standalone apps (2 and 3) **bundle Node.js for you** — you only need **Google Chrome** installed.

---

## 1. Browser / Developer version (any OS)

Run from source. Best for development or a quick trial.

### Easiest: VS Code + GitHub Copilot

1. Install [VS Code](https://code.visualstudio.com) and [Node.js 18+](https://nodejs.org).
2. In VS Code: `File > Clone Repository`, paste this repo's URL, open it.
3. Open Copilot Chat and paste: _"Install dependencies and start the dev server."_
4. Open the URL it prints (usually `http://localhost:5173`).

### Terminal

```bash
git clone <REPO_URL>
cd YapAtMe
npm install
npm run dev          # opens http://localhost:5173
```

> Tip: use **Google Chrome** if you want voice dictation.

---

## 2. Ubuntu standalone app

A real desktop app with an icon in your app grid. Node.js is bundled; you only need Google Chrome.

Installers are published under GitHub Releases (not in the repository file list):
https://github.com/katarzyna-oscen/YapAtMe/releases

### Install

1. Install **Google Chrome** if you don't have it: <https://www.google.com/chrome/>
2. Download **`yapatme_<version>_amd64.deb`** from the Releases page.
3. Install it (or just double-click the `.deb` in your file manager):
   ```bash
   sudo apt install ./yapatme_<version>_amd64.deb
   ```

### Start it

- Open your apps and click **YapAtMe**, **or** run `yapatme` in a terminal.

YapAtMe opens in its own Google Chrome window. Pick your notes folder once and you're set.

---

## 3. macOS standalone app

A real Mac app. Node.js is bundled; you only need Google Chrome.

Installers are published under GitHub Releases (not in the repository file list):
https://github.com/katarzyna-oscen/YapAtMe/releases

### Install

1. Install **Google Chrome** if you don't have it: <https://www.google.com/chrome/>
2. Download **`YapAtMe-<version>-<arch>.dmg`** from the Releases page
   (`arm64` for Apple Silicon, `x64` for Intel Macs).
3. Open the `.dmg` and drag **YapAtMe** into **Applications**.
4. First launch only: right-click the app → **Open** (to clear the unsigned-app warning once).

### Start it

- Open **YapAtMe** from Applications or Spotlight. It opens in its own Google Chrome window.

---

## First-time setup (all versions)

1. **Choose a folder** — pick an empty folder for a new vault, or an existing YapAtMe vault.
2. **Add your AI key** — in onboarding (or `Settings > AI Setup`), pick a provider + model and paste your key. (Or pick **Ollama** to run fully local with no key.)
3. **Write or dictate a note** — go to the Inbox, add something, and process it. The AI routes it for you.

---

## Features

- **Smart inbox routing** — turns a freeform note into structured updates across people/projects/ideas.
- **Voice dictation** — speak your notes (Google Chrome only).
- **Auto task extraction** — pulls action items, follow-ups, delegations, and decisions out of your notes.
- **Urgent / important flags** — mark tasks via the 3-dots menu; they surface in "Needs Your Call".
- **Wikilinks** — `[[Name]]` mentions are detected and linked to entities automatically.
- **People / Projects / Ideas modules** — each is a folder of Markdown files; modules can be toggled.
- **Command center & dashboard** — overview of activity, open tasks, and what needs attention.
- **Multiple AI providers** — OpenRouter, Anthropic, OpenAI, or local Ollama.
- **Bring your own vault** — point it at any empty (new) or existing YapAtMe folder.

---

## Building the installers yourself

Run from a clone of the repo. Each command bundles the matching Node.js runtime automatically:

```bash
npm run pkg:deb     # build the Ubuntu .deb   (run on Linux)  -> dist/yapatme_*.deb
npm run pkg:mac     # build the macOS .dmg     (run on macOS)  -> dist/YapAtMe-*.dmg
```

Optional: drop a `build/icon.png` (1024×1024) before `pkg:mac` to embed a macOS icon.
`build/icon.svg` is used for the Linux app icon.

### Run the launcher without packaging

```bash
npm run app           # build assets, then open in Google Chrome
npm run app:launch    # open in Google Chrome using the existing build
npm run app:install   # install a desktop shortcut for this clone (proper icon)
```

> The app window matches your desktop's text-scaling automatically. To override,
> set `YAPATME_ZOOM` (e.g. `YAPATME_ZOOM=0.9 npm run app:launch`).

---

## AI setup notes

- **Provider/model** are chosen in `Settings > AI Setup` (dropdowns included).
- **Anthropic in-browser**: the app sends the required browser opt-in header automatically.
- **Ollama**: select it as the provider to run fully local with no API key.

---

## Tech stack

React + Vite, Tailwind, Milkdown editor, IndexedDB (settings/cache), and the File System Access API for the local vault. The standalone apps serve the built site locally and open it in Google Chrome via a small zero-dependency Node launcher (`tools/yapatme.cjs`), which also bridges native file access and proxies AI calls.
