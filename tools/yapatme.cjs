#!/usr/bin/env node
/*
 * YapAtMe standalone launcher.
 *
 * Why this exists:
 *   - YapAtMe relies on the Web Speech API (dictation) and the File System
 *     Access API. The Web Speech API only works in *real* Google Chrome,
 *     because Chromium/Electron do not ship Google's speech service API key.
 *   - So instead of wrapping the app in Electron (which silently breaks
 *     dictation), we serve the built app locally and open it in real Chrome
 *     using "app mode" (a standalone window with no tabs/address bar).
 *
 * What it does:
 *   1. Serves ./dist on a private 127.0.0.1 port (a localhost origin is a
 *      secure context, which both the Web Speech API and the File System
 *      Access API require).
 *   2. Launches Chrome in --app mode with a dedicated, isolated user profile.
 *   3. Shuts the local server down automatically when the window is closed.
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PROFILE_DIR = path.join(os.homedir(), '.config', 'yapatme-chrome');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'yapatme');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// ── Persisted config (stores the chosen vault path) ──────────────────────────
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

// ── Content scale ────────────────────────────────────────────────────────────
// Default is native 100% (full window, layout intact). If the app ever looks
// too big/small on a given machine, set an explicit scale via the YAPATME_ZOOM
// env var (e.g. 0.9) or a "zoom" value in config.json. This is applied through
// Chrome's --force-device-scale-factor, which shrinks content WITHOUT breaking
// 100vh layouts the way a CSS `zoom` would.
function detectContentZoom() {
  const envZoom = parseFloat(process.env.YAPATME_ZOOM);
  if (Number.isFinite(envZoom) && envZoom > 0.3 && envZoom < 3) return envZoom;

  const cfg = readConfig();
  if (Number.isFinite(cfg.zoom) && cfg.zoom > 0.3 && cfg.zoom < 3) return cfg.zoom;

  return 1;
}

// ── Native directory picker (per platform) ──────────────────────────────────
function pickDirectoryNative() {
  return new Promise((resolve) => {
    // macOS: AppleScript folder chooser.
    if (process.platform === 'darwin') {
      const script =
        'POSIX path of (choose folder with prompt "Select your YapAtMe vault folder")';
      const child = spawn('osascript', ['-e', script], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      let buf = '';
      child.stdout.on('data', (d) => { buf += d; });
      child.on('close', () => resolve(buf.trim().replace(/\/$/, '') || null));
      child.on('error', () => resolve(null));
      return;
    }

    // Windows: PowerShell FolderBrowserDialog.
    if (process.platform === 'win32') {
      const ps =
        'Add-Type -AssemblyName System.Windows.Forms; ' +
        '$f = New-Object System.Windows.Forms.FolderBrowserDialog; ' +
        "$f.Description = 'Select your YapAtMe vault folder'; " +
        "if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }";
      const child = spawn(
        'powershell',
        ['-NoProfile', '-STA', '-Command', ps],
        { stdio: ['ignore', 'pipe', 'ignore'] },
      );
      let buf = '';
      child.stdout.on('data', (d) => { buf += d; });
      child.on('close', () => resolve(buf.trim() || null));
      child.on('error', () => resolve(null));
      return;
    }

    // Linux: zenity / kdialog / qarma.
    const tryTool = (cmd, args) => {
      try {
        const out = execSync(`command -v ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
        if (!out) return false;
      } catch {
        return false;
      }
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = '';
      child.stdout.on('data', (d) => { buf += d; });
      child.on('close', () => resolve(buf.trim() || null));
      child.on('error', () => resolve(null));
      return true;
    };

    if (tryTool('zenity', ['--file-selection', '--directory', '--title=Select your YapAtMe vault folder'])) return;
    if (tryTool('kdialog', ['--getexistingdirectory', os.homedir()])) return;
    if (tryTool('qarma', ['--file-selection', '--directory', '--title=Select your YapAtMe vault folder'])) return;
    resolve(null);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function findChrome() {
  // 1. Explicit override.
  if (process.env.YAPATME_CHROME && fs.existsSync(process.env.YAPATME_CHROME)) {
    return process.env.YAPATME_CHROME;
  }

  // 2. Known absolute install locations per platform.
  const absoluteCandidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
        ]
      : process.platform === 'win32'
        ? [
            `${process.env['PROGRAMFILES'] || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['LOCALAPPDATA'] || ''}\\Google\\Chrome\\Application\\chrome.exe`,
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
          ];

  for (const candidate of absoluteCandidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      /* keep looking */
    }
  }

  // 3. PATH lookup (Linux/macOS via `command -v`, Windows via `where`).
  const names =
    process.platform === 'win32'
      ? ['chrome', 'chrome.exe']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

  for (const name of names) {
    try {
      const lookup = process.platform === 'win32' ? `where ${name}` : `command -v ${name}`;
      const resolved = execSync(lookup, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .split(/\r?\n/)[0]
        .trim();
      if (resolved) return resolved;
    } catch {
      /* not found, keep looking */
    }
  }
  return null;
}

function startServer() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error(
      `\n[YapAtMe] No build found at ${DIST_DIR}.\n` +
        `Run "npm run build" first (or use "npm run app").\n`,
    );
    process.exit(1);
  }

  // Injected into index.html. Exposes a window.electronAPI bridge identical to
  // the Electron build's preload API, implemented over local HTTP. This lets
  // the app run in its "desktop" mode: the vault is stored as a native path and
  // silently reconnects every launch (no File System Access permission prompts).
  const BRIDGE_SCRIPT =
    '<script>(function(){' +
    'var call=function(p,b){return fetch(p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b||{})}).then(function(r){return r.json()})};' +
    'window.electronAPI={' +
    'isDesktop:true,' +
    'statPath:function(p){return call("/__fs/stat",{path:p})},' +
    'ensureDir:function(p){return call("/__fs/ensureDir",{path:p}).then(function(){return true})},' +
    'readDir:function(p){return call("/__fs/readDir",{path:p}).then(function(r){return r.entries})},' +
    'readTextFile:function(p){return call("/__fs/readTextFile",{path:p}).then(function(r){return r.content})},' +
    'writeTextFile:function(p,c){return call("/__fs/writeTextFile",{path:p,content:c}).then(function(){return true})},' +
    'removeEntry:function(p){return call("/__fs/removeEntry",{path:p}).then(function(){return true})},' +
    'renamePath:function(a,b){return call("/__fs/rename",{from:a,to:b}).then(function(){return true})},' +
    'pickDirectory:function(){return call("/__vault/pick",{}).then(function(r){return r.path})},' +
    'getStoredVaultPath:function(){return call("/__vault/get",{}).then(function(r){return r.path})},' +
    'setStoredVaultPath:function(p){return call("/__vault/set",{path:p}).then(function(){return true})},' +
    'clearStoredVaultPath:function(){return call("/__vault/clear",{}).then(function(){return true})},' +
    'httpRequest:function(req){return call("/__llm_proxy",req)}' +
    '};})();</script>';

  const serveIndex = (res) => {
    fs.readFile(path.join(DIST_DIR, 'index.html'), 'utf8', (e2, html) => {
      if (e2) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      // Chrome app-mode windows color the title bar from <meta name="theme-color">.
      const THEME_META = '<meta name="theme-color" content="#0a1230">';
      let out = html;
      if (!out.includes('window.electronAPI')) {
        out = out.replace('</head>', `${BRIDGE_SCRIPT}</head>`);
      }
      if (!out.includes('theme-color')) {
        out = out.replace('</head>', `${THEME_META}</head>`);
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(out);
    });
  };

  // Read a JSON request body (with a size guard) and hand it to a handler.
  const readJsonBody = (req, res, handler) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) req.destroy(); // 50MB guard
    });
    req.on('end', async () => {
      let payload = {};
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
      try {
        await handler(payload);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String((err && err.message) || err) }));
      }
    });
  };

  const sendJson = (res, obj, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  // Filesystem + vault endpoints backing the electronAPI bridge above.
  const FS_ROUTES = {
    '/__fs/stat': async ({ path: p }) => {
      try {
        const st = await fsp.stat(p);
        return {
          exists: true,
          isFile: st.isFile(),
          isDirectory: st.isDirectory(),
          mtimeMs: st.mtimeMs,
        };
      } catch {
        return { exists: false, isFile: false, isDirectory: false, mtimeMs: 0 };
      }
    },
    '/__fs/ensureDir': async ({ path: p }) => {
      await fsp.mkdir(p, { recursive: true });
      return { ok: true };
    },
    '/__fs/readDir': async ({ path: p }) => {
      const dirents = await fsp.readdir(p, { withFileTypes: true });
      return {
        entries: dirents.map((d) => ({
          name: d.name,
          kind: d.isDirectory() ? 'directory' : 'file',
        })),
      };
    },
    '/__fs/readTextFile': async ({ path: p }) => {
      const content = await fsp.readFile(p, 'utf8');
      return { content };
    },
    '/__fs/writeTextFile': async ({ path: p, content }) => {
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await fsp.writeFile(p, String(content ?? ''), 'utf8');
      return { ok: true };
    },
    '/__fs/removeEntry': async ({ path: p }) => {
      await fsp.rm(p, { recursive: true, force: true });
      return { ok: true };
    },
    '/__fs/rename': async ({ from, to }) => {
      await fsp.rename(from, to);
      return { ok: true };
    },
    '/__vault/pick': async () => {
      const picked = await pickDirectoryNative();
      return { path: picked || null };
    },
    '/__vault/get': async () => {
      const stored = readConfig().vaultPath || null;
      if (!stored) return { path: null };
      try {
        const st = await fsp.stat(stored);
        if (!st.isDirectory()) return { path: null };
      } catch {
        return { path: null };
      }
      return { path: stored };
    },
    '/__vault/set': async ({ path: p }) => {
      writeConfig({ vaultPath: p || null });
      return { ok: true };
    },
    '/__vault/clear': async () => {
      writeConfig({ vaultPath: null });
      return { ok: true };
    },
  };

  // Server-side proxy for LLM provider calls. The page POSTs the target request
  // here; we perform it from Node (no browser CORS restrictions) and relay the
  // response back. Only outbound https/http requests are forwarded.
  const handleProxy = (req, res) => {
    readJsonBody(req, res, async ({ url, method, headers, body: reqBody }) => {
      if (!url || !/^https?:\/\//i.test(url)) {
        sendJson(res, { error: 'Invalid target URL' }, 400);
        return;
      }
      try {
        const upstream = await fetch(url, {
          method: method || 'GET',
          headers: headers || {},
          body: reqBody,
        });
        const text = await upstream.text();
        sendJson(res, {
          ok: upstream.ok,
          status: upstream.status,
          statusText: upstream.statusText,
          body: text,
        });
      } catch (err) {
        sendJson(res, { error: String((err && err.message) || err) }, 502);
      }
    });
  };

  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

    if (urlPath === '/__llm_proxy' && req.method === 'POST') {
      handleProxy(req, res);
      return;
    }

    if (FS_ROUTES[urlPath] && req.method === 'POST') {
      readJsonBody(req, res, async (payload) => {
        sendJson(res, await FS_ROUTES[urlPath](payload));
      });
      return;
    }

    if (urlPath === '/' || urlPath === '') {
      serveIndex(res);
      return;
    }

    // Resolve and confine to DIST_DIR (prevents path traversal).
    const resolved = path.normalize(path.join(DIST_DIR, urlPath));
    if (!resolved.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(resolved, (err, data) => {
      if (err) {
        // Single-page app: fall back to index.html for unknown routes.
        serveIndex(res);
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    // Use a FIXED port so the origin (http://127.0.0.1:<port>) stays stable
    // across launches. The app stores settings (API key, vault selection) in
    // IndexedDB/localStorage, which the browser scopes per origin — a changing
    // port would make that data appear lost on every start.
    const PREFERRED_PORT = 47615;

    const listen = (port, isLastAttempt) => {
      server.removeAllListeners('error');
      server.once('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && !isLastAttempt) {
          // Fixed port busy (e.g. another instance) — fall back to a random
          // free port so the app still launches.
          listen(0, true);
          return;
        }
        reject(err);
      });
      server.listen(port, '127.0.0.1', () => {
        resolve({ server, port: server.address().port });
      });
    };

    listen(PREFERRED_PORT, false);
  });
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error(
      '\n[YapAtMe] Google Chrome was not found.\n' +
        'Dictation requires real Google Chrome (the Web Speech API does not\n' +
        'work in Chromium/Electron). Install it from:\n' +
        '  https://www.google.com/chrome/\n',
    );
    process.exit(1);
  }

  const { server, port } = await startServer();
  const url = `http://127.0.0.1:${port}/`;
  console.log(`[YapAtMe] Serving locally on ${url}`);

  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const args = [
    `--app=${url}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Give the window a defined size/position. Without explicit geometry,
    // Chrome's app-mode window on Wayland can jump to maximized when the title
    // bar is dragged.
    '--window-size=1280,860',
    '--window-position=120,80',
    '--disable-features=Translate,MediaRouter',
    // Ask Chrome to render its UI (incl. the title bar) in dark mode.
    '--force-dark-mode',
  ];

  // Linux-only: WM class for app grouping; harmless elsewhere but skipped.
  if (process.platform === 'linux') {
    args.splice(2, 0, '--class=YapAtMe');
  }

  // Optional content scaling (opt-in via YAPATME_ZOOM or config.zoom). Uses the
  // device scale factor so the window content shrinks/grows but still fills the
  // whole window — unlike a CSS zoom, which leaves empty space.
  const scale = detectContentZoom();
  if (scale !== 1) {
    args.push(`--force-device-scale-factor=${scale}`);
  }

  const env = { ...process.env };
  if (process.platform === 'linux') {
    // The title bar is a GTK window decoration drawn by the system, not the
    // web content — so a dark GTK theme is what actually darkens it.
    env.GTK_THEME = 'Adwaita:dark';
  }

  const child = spawn(chrome, args, {
    stdio: ['ignore', 'ignore', 'inherit'],
    env,
  });

  const shutdown = () => {
    try {
      server.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  child.on('exit', shutdown);
  process.on('SIGINT', () => {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    shutdown();
  });
  process.on('SIGTERM', () => {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    shutdown();
  });
}

main().catch((err) => {
  console.error('[YapAtMe] Failed to launch:', err);
  process.exit(1);
});
