const { app, BrowserWindow, dialog, ipcMain, session } = require('electron')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')

const isDev = !app.isPackaged
const STATE_FILE = 'desktop-state.json'
let staticServer = null

const ALLOWED_PERMISSIONS = new Set([
  'audioCapture',
  'media',
  'microphone',
])

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function statePath() {
  return path.join(app.getPath('userData'), STATE_FILE)
}

async function readState() {
  try {
    const raw = await fs.readFile(statePath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeState(nextState) {
  await fs.mkdir(path.dirname(statePath()), { recursive: true })
  await fs.writeFile(statePath(), JSON.stringify(nextState, null, 2), 'utf8')
}

async function setVaultPath(vaultPath) {
  const current = await readState()
  current.vaultPath = vaultPath || null
  await writeState(current)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#121212',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  })

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173')
    return
  }

  startStaticServer()
    .then((url) => win.loadURL(url))
    .catch((err) => {
      console.error('Failed to start packaged app server:', err)
      win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    })
}

async function startStaticServer() {
  if (staticServer?.url) return staticServer.url

  const distDir = path.join(__dirname, '..', 'dist')
  const indexPath = path.join(distDir, 'index.html')

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1')
      const pathname = decodeURIComponent(requestUrl.pathname || '/')
      const relativePath = pathname === '/'
        ? 'index.html'
        : pathname.replace(/^\/+/, '')
      const candidatePath = path.normalize(path.join(distDir, relativePath))
      const safePath = candidatePath.startsWith(distDir) ? candidatePath : indexPath

      let filePath = safePath
      let stat
      try {
        stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html')
          stat = await fs.stat(filePath)
        }
      } catch {
        filePath = indexPath
        stat = await fs.stat(filePath)
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'
      const body = await fs.readFile(filePath)
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      })
      res.end(body)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`Failed to serve app: ${err?.message || err}`)
    }
  })

  const url = await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not determine packaged app server port'))
        return
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })

  staticServer = { server, url }
  return url
}

ipcMain.handle('vault:pickDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('vault:getStoredPath', async () => {
  const state = await readState()
  return state.vaultPath || null
})

ipcMain.handle('vault:setStoredPath', async (_event, vaultPath) => {
  await setVaultPath(vaultPath)
  return true
})

ipcMain.handle('vault:clearStoredPath', async () => {
  await setVaultPath(null)
  return true
})

ipcMain.handle('fs:statPath', async (_event, targetPath) => {
  try {
    const stat = await fs.stat(targetPath)
    return {
      exists: true,
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      mtimeMs: stat.mtimeMs,
      name: path.basename(targetPath),
    }
  } catch {
    return { exists: false, isDirectory: false, isFile: false, mtimeMs: null, name: path.basename(targetPath) }
  }
})

ipcMain.handle('fs:ensureDir', async (_event, targetPath) => {
  await fs.mkdir(targetPath, { recursive: true })
  return true
})

ipcMain.handle('fs:readDir', async (_event, targetPath) => {
  const entries = await fs.readdir(targetPath, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? 'directory' : 'file',
  }))
})

ipcMain.handle('fs:readTextFile', async (_event, targetPath) => fs.readFile(targetPath, 'utf8'))

ipcMain.handle('fs:writeTextFile', async (_event, targetPath, content) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, String(content ?? ''), 'utf8')
  return true
})

ipcMain.handle('fs:removeEntry', async (_event, targetPath) => {
  await fs.rm(targetPath, { recursive: true, force: false })
  return true
})

ipcMain.handle('fs:renamePath', async (_event, fromPath, toPath) => {
  await fs.mkdir(path.dirname(toPath), { recursive: true })
  await fs.rename(fromPath, toPath)
  return true
})

ipcMain.handle('net:httpRequest', async (_event, { url, method = 'GET', headers = {}, body } = {}) => {
  const response = await fetch(url, { method, headers, body })
  const text = await response.text()
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: text,
  }
})

app.whenReady().then(() => {
  const electronSession = session.defaultSession
  electronSession.setPermissionCheckHandler((_webContents, permission) => ALLOWED_PERMISSIONS.has(permission))
  electronSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  staticServer?.server?.close()
})