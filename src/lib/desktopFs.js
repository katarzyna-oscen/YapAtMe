function isDesktopRuntime() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop)
}

function joinNativePath(basePath, name) {
  const separator = String(basePath || '').includes('\\') ? '\\' : '/'
  return `${String(basePath || '').replace(/[\\/]$/, '')}${separator}${name}`
}

function createNotFoundError(message) {
  const err = new Error(message)
  err.name = 'NotFoundError'
  return err
}

function createAbortError() {
  const err = new Error('The user aborted a request.')
  err.name = 'AbortError'
  return err
}

function normalizeName(targetPath) {
  const value = String(targetPath || '').replace(/\\/g, '/')
  return value.split('/').filter(Boolean).pop() || value
}

function createDesktopFileHandle(filePath) {
  return {
    kind: 'file',
    name: normalizeName(filePath),
    __desktopPath: filePath,
    async getFile() {
      const stat = await window.electronAPI.statPath(filePath)
      if (!stat?.exists || !stat.isFile) throw createNotFoundError(`File not found: ${filePath}`)
      return {
        lastModified: stat.mtimeMs ?? Date.now(),
        text: async () => window.electronAPI.readTextFile(filePath),
      }
    },
    async createWritable() {
      let pendingContent = ''
      return {
        write: async (content) => {
          pendingContent = String(content ?? '')
        },
        close: async () => {
          await window.electronAPI.writeTextFile(filePath, pendingContent)
        },
      }
    },
  }
}

function createDesktopDirectoryHandle(dirPath) {
  return {
    kind: 'directory',
    name: normalizeName(dirPath),
    __desktopPath: dirPath,
    async queryPermission() {
      return 'granted'
    },
    async requestPermission() {
      return 'granted'
    },
    async getDirectoryHandle(name, options = {}) {
      const targetPath = joinNativePath(dirPath, name)
      const stat = await window.electronAPI.statPath(targetPath)
      if (!stat?.exists) {
        if (!options.create) throw createNotFoundError(`Directory not found: ${targetPath}`)
        await window.electronAPI.ensureDir(targetPath)
        return createDesktopDirectoryHandle(targetPath)
      }
      if (!stat.isDirectory) throw new Error(`Not a directory: ${targetPath}`)
      return createDesktopDirectoryHandle(targetPath)
    },
    async getFileHandle(name, options = {}) {
      const targetPath = joinNativePath(dirPath, name)
      const stat = await window.electronAPI.statPath(targetPath)
      if (!stat?.exists) {
        if (!options.create) throw createNotFoundError(`File not found: ${targetPath}`)
        await window.electronAPI.writeTextFile(targetPath, '')
        return createDesktopFileHandle(targetPath)
      }
      if (!stat.isFile) throw new Error(`Not a file: ${targetPath}`)
      return createDesktopFileHandle(targetPath)
    },
    async *entries() {
      const entries = await window.electronAPI.readDir(dirPath)
      for (const entry of entries) {
        const childPath = joinNativePath(dirPath, entry.name)
        yield [
          entry.name,
          entry.kind === 'directory'
            ? createDesktopDirectoryHandle(childPath)
            : createDesktopFileHandle(childPath),
        ]
      }
    },
    async *values() {
      for await (const [, handle] of this.entries()) {
        yield handle
      }
    },
    async removeEntry(name) {
      await window.electronAPI.removeEntry(joinNativePath(dirPath, name))
    },
  }
}

async function pickVaultDirectory() {
  if (isDesktopRuntime()) {
    const selectedPath = await window.electronAPI.pickDirectory()
    if (!selectedPath) throw createAbortError()
    return createDesktopDirectoryHandle(selectedPath)
  }

  if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
    throw new Error('Folder access is not supported in this browser.')
  }

  return window.showDirectoryPicker({ mode: 'readwrite' })
}

async function getStoredVaultHandle() {
  if (!isDesktopRuntime()) return null
  const storedPath = await window.electronAPI.getStoredVaultPath()
  if (!storedPath) return null
  const stat = await window.electronAPI.statPath(storedPath)
  if (!stat?.exists || !stat.isDirectory) {
    await window.electronAPI.clearStoredVaultPath()
    return null
  }
  return createDesktopDirectoryHandle(storedPath)
}

async function hasStoredVaultSelection() {
  if (!isDesktopRuntime()) return false
  return Boolean(await getStoredVaultHandle())
}

async function persistVaultHandle(handle) {
  if (!isDesktopRuntime()) return
  await window.electronAPI.setStoredVaultPath(handle?.__desktopPath || null)
}

async function clearStoredVaultHandle() {
  if (!isDesktopRuntime()) return
  await window.electronAPI.clearStoredVaultPath()
}

export {
  clearStoredVaultHandle,
  createDesktopDirectoryHandle,
  getStoredVaultHandle,
  hasStoredVaultSelection,
  isDesktopRuntime,
  persistVaultHandle,
  pickVaultDirectory,
}