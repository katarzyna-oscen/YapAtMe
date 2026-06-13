import { useState, useEffect, useCallback } from 'react'
import { dbGet, dbPut } from '../lib/db'

const HANDLE_KEY = 'rootDir'
const TASK_CHECKBOX_CLEANUP_FLAG = 'task-checkbox-cleanup-v1'
const NOTES_DATE_MIGRATION_FLAG = 'notes-date-filename-migration-v1'

function isUserAgentPermissionError(err) {
  const name = String(err?.name || '')
  const msg = String(err?.message || '').toLowerCase()
  return name === 'NotAllowedError'
    || msg.includes('not allowed by the user agent')
    || msg.includes('platform in the current context')
}
const TASK_SECTION_HEADERS = new Set([
  '## Open Actions',
  '## Delegate',
  '## Talk About',
  '## Decisions',
  '## Delegations',
  '## My Actions',
])

// ── Vault shape ─────────────────────────────────────────────────────────────

const VAULT_DIRS = ['inbox', 'notes', 'projects', 'people', 'ideas', 'archive', 'context']

const VAULT_SEEDS = [
  ['context/_context.md',         '## Current Focus\n_Process your first note to populate this section._\n\nActive themes:\n* _Add your active themes here_\n\n## Active Projects\n_Projects will appear here after processing your first note._\n\n## Standing Decisions\n_Key decisions will appear here after processing your first note._\n\n## Key People\n_Key people will appear here after processing your first note._\n'],
  ['context/_context_log.md',     '# Context Log\n*Append-only. Never edit existing entries.*\n\n---\n\n'],
  ['context/projects-index.md',   '# Projects Index\n*Last updated: —*\n\n_Will be populated automatically after processing your first note._\n'],
  ['context/people-index.md',     '# People Index\n*Last updated: —*\n\n_Will be populated automatically after processing your first note._\n'],
  ['context/ideas-index.md',      '# Ideas Index\n*Last updated: —*\n\n_Will be populated automatically after processing your first note._\n'],
  ['ideas/backlog.md',            '# Ideas Backlog\n\n## Backlog\n'],
  ['context/tags.md',
`# Tags
> One tag per line. Used for autocomplete in the editor and routing by AI.

important
blocked
waiting
quick-win
high-impact
action
decision
follow-up
experiment
personal
idea_AI
idea_process
idea_design
idea_project
idea_ops
idea_personal
`],
]

// ── Helpers (no React, no hooks) ─────────────────────────────────────────────

async function initVault(handle) {
  // Create top-level directories
  for (const dir of VAULT_DIRS) {
    await handle.getDirectoryHandle(dir, { create: true })
  }
  // Seed files — skip any that already exist
  for (const [filePath, content] of VAULT_SEEDS) {
    const parts = filePath.split('/')
    let dir = handle
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true })
    }
    const filename = parts[parts.length - 1]
    try {
      await dir.getFileHandle(filename)  // throws if absent
      // file exists — skip
    } catch {
      const fh = await dir.getFileHandle(filename, { create: true })
      const w  = await fh.createWritable()
      await w.write(content)
      await w.close()
    }
  }
}

async function buildTree(dirHandle, basePath = '') {
  const entries = []
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue
    const path = basePath ? `${basePath}/${name}` : name
    if (handle.kind === 'directory') {
      const children = await buildTree(handle, path)
      entries.push({ name, kind: 'directory', path, children })
    } else if (handle.kind === 'file' && name.endsWith('.md')) {
      let modified = null
      try {
        const file = await handle.getFile()
        modified = Number.isFinite(file?.lastModified) ? file.lastModified : null
      } catch {
        modified = null
      }
      entries.push({ name, kind: 'file', path, modified })
    }
  }
  // Directories first, then files; alphabetical within each group
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function stripTaskCheckboxLinesFromEntity(raw) {
  const lines = String(raw || '').split('\n')
  const out = []
  let inTaskSection = false
  let changed = false

  for (const line of lines) {
    const headingMatch = String(line || '').match(/^##\s+(.+)$/)
    if (headingMatch) {
      const normalizedHeading = `## ${String(headingMatch[1] || '').trim()}`
      inTaskSection = TASK_SECTION_HEADERS.has(normalizedHeading) && normalizedHeading !== '## Recent Mentions'
      out.push(line)
      continue
    }

    if (inTaskSection && /^\s*-\s*\[[ xX]\]\s+/.test(line)) {
      changed = true
      continue
    }

    out.push(line)
  }

  const normalized = out.join('\n').replace(/\n{3,}/g, '\n\n')
  return { changed, content: normalized }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFileSystem() {
  const [rootHandle,     setRootHandle]     = useState(null)
  const [folderName,     setFolderName]     = useState(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [vaultReady,     setVaultReady]     = useState(false)
  const [pickerError,    setPickerError]    = useState(null)

  // Restore handle from previous session
  useEffect(() => {
    dbGet('handles', HANDLE_KEY).then(async handle => {
      if (handle) {
        const perm = await handle.queryPermission({ mode: 'readwrite' })
        if (perm === 'granted') {
          setRootHandle(handle)
          setFolderName(handle.name)
          setVaultReady(true)
        } else {
          setFolderName(handle.name)
          setNeedsReconnect(true)
        }
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const openFolder = useCallback(async () => {
    if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
      setPickerError('Folder access is not supported in this browser. Use Chrome, Edge, or another Chromium-based browser.')
      return null
    }

    try {
      setPickerError(null)
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      await dbPut('handles', HANDLE_KEY, handle)
      await initVault(handle)
      setRootHandle(handle)
      setFolderName(handle.name)
      setNeedsReconnect(false)
      setVaultReady(true)
      return handle
    } catch (err) {
      if (isUserAgentPermissionError(err)) {
        setPickerError('Folder permission was blocked by the browser context. Open Yapper in a single localhost tab and choose the folder manually.')
        setNeedsReconnect(false)
        return null
      }
      if (err.name !== 'AbortError') throw err
      return null
    }
  }, [])

  const initVaultNow = useCallback(async () => {
    if (!rootHandle) return
    try {
      await initVault(rootHandle)
      setVaultReady(true)
    } catch (err) {
      if (isUserAgentPermissionError(err)) {
        setPickerError('Vault access is blocked by browser permissions in this context. Reconnect the folder from this tab.')
        setNeedsReconnect(true)
        setVaultReady(false)
        return
      }
      throw err
    }
  }, [rootHandle])

  const reconnect = useCallback(async () => {
    const handle = await dbGet('handles', HANDLE_KEY)
    if (!handle) return null
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        await initVault(handle)
        setRootHandle(handle)
        setNeedsReconnect(false)
        setVaultReady(true)
        setPickerError(null)
        return handle
      }
    } catch (err) {
      if (isUserAgentPermissionError(err)) {
        setPickerError('Reconnect was blocked by browser permissions. Use "Choose different folder" and select the vault again.')
        setNeedsReconnect(true)
        setVaultReady(false)
        return null
      }
      if (err.name !== 'AbortError') throw err
    }
    return null
  }, [])

  const readFile = useCallback(async (path) => {
    if (!rootHandle) throw new Error('No vault folder open')
    const parts = path.split('/').filter(Boolean)
    let dir = rootHandle
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }
    const fh   = await dir.getFileHandle(parts[parts.length - 1])
    const file = await fh.getFile()
    return file.text()
  }, [rootHandle])

  const writeFile = useCallback(async (path, content) => {
    if (!rootHandle) throw new Error('No vault folder open')
    const parts = path.split('/').filter(Boolean)
    let dir = rootHandle
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true })
    }
    const fh       = await dir.getFileHandle(parts[parts.length - 1], { create: true })
    const writable = await fh.createWritable()
    await writable.write(content)
    await writable.close()
  }, [rootHandle])

  const deleteFile = useCallback(async (path) => {
    if (!rootHandle) throw new Error('No vault folder open')
    const parts = path.split('/').filter(Boolean)
    const filename = parts.pop()

    let dir = rootHandle
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: false })
    }

    await dir.removeEntry(filename)
  }, [rootHandle])

  const renameFile = useCallback(async (oldPath, newPath) => {
    const content = await readFile(oldPath)
    const caseOnlyRename = oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath

    if (caseOnlyRename) {
      await deleteFile(oldPath)
      await writeFile(newPath, content)
      return
    }

    await writeFile(newPath, content)
    await deleteFile(oldPath)
  }, [readFile, writeFile, deleteFile])

  const listFiles = useCallback(async (dirPath = '') => {
    if (!rootHandle) return []
    try {
      let dir = rootHandle
      if (dirPath) {
        for (const part of dirPath.split('/').filter(Boolean)) {
          dir = await dir.getDirectoryHandle(part)
        }
      }
      const entries = []
      for await (const [name, handle] of dir.entries()) {
        entries.push({ name, kind: handle.kind, path: dirPath ? `${dirPath}/${name}` : name })
      }
      return entries.sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  }, [rootHandle])

  const listTree = useCallback(async () => {
    if (!rootHandle) return []
    return buildTree(rootHandle)
  }, [rootHandle])

  const fileExists = useCallback(async (path) => {
    if (!rootHandle) return false
    try {
      await readFile(path)
      return true
    } catch {
      return false
    }
  }, [rootHandle, readFile])

  useEffect(() => {
    let cancelled = false

    const runNotesFilenameMigrationOnce = async () => {
      if (!vaultReady || !rootHandle) return
      const alreadyDone = await dbGet('settings', NOTES_DATE_MIGRATION_FLAG).catch(() => false)
      if (alreadyDone) return

      try {
        const notesDir = await rootHandle.getDirectoryHandle('notes', { create: true })
        const renames = []

        for await (const [name, handle] of notesDir.entries()) {
          if (cancelled) return
          if (handle.kind !== 'file') continue
          const m = String(name).match(/^(\d{4})-(\d{2})-(\d{2})\.md$/)
          if (!m) continue
          const nextName = `${m[3]}-${m[2]}-${m[1]}.md`
          if (nextName === name) continue

          try {
            await notesDir.getFileHandle(nextName)
            continue
          } catch {}

          renames.push({ oldName: name, newName: nextName })
        }

        for (const rename of renames) {
          if (cancelled) return
          try {
            const sourceHandle = await notesDir.getFileHandle(rename.oldName)
            const sourceFile = await sourceHandle.getFile()
            const content = await sourceFile.text()
            const targetHandle = await notesDir.getFileHandle(rename.newName, { create: true })
            const writable = await targetHandle.createWritable()
            await writable.write(content)
            await writable.close()
            await notesDir.removeEntry(rename.oldName)
          } catch (err) {
            console.warn('Notes filename migration skipped for', rename.oldName, err?.message || err)
          }
        }

        await dbPut('settings', NOTES_DATE_MIGRATION_FLAG, true)
      } catch (err) {
        console.warn('Notes filename migration failed:', err?.message || err)
      }
    }

    const runTaskCheckboxCleanupOnce = async () => {
      if (!vaultReady || !rootHandle) return

      const alreadyDone = await dbGet('settings', TASK_CHECKBOX_CLEANUP_FLAG).catch(() => false)
      if (alreadyDone) return

      try {
        const tree = await buildTree(rootHandle)
        const queue = [...tree]
        const filePaths = []

        while (queue.length > 0) {
          const node = queue.shift()
          if (!node) continue
          if (node.kind === 'directory') {
            queue.push(...(node.children || []))
            continue
          }
          if (node.kind !== 'file') continue
          const path = String(node.path || '')
          if (!path.endsWith('.md')) continue
          if (!path.startsWith('people/') && !path.startsWith('projects/')) continue
          filePaths.push(path)
        }

        const strippedFiles = []
        for (const path of filePaths) {
          if (cancelled) return
          let raw = ''
          try {
            raw = await readFile(path)
          } catch {
            continue
          }

          const { changed, content } = stripTaskCheckboxLinesFromEntity(raw)
          if (!changed) continue
          await writeFile(path, content)
          strippedFiles.push(path)
        }

        if (strippedFiles.length > 0) {
          console.log('[Task checkbox cleanup] stripped markdown checkbox lines from:', strippedFiles)
        }
        await dbPut('settings', TASK_CHECKBOX_CLEANUP_FLAG, true)
      } catch (err) {
        console.warn('Task checkbox cleanup failed:', err?.message || err)
      }
    }

    runNotesFilenameMigrationOnce().then(() => runTaskCheckboxCleanupOnce())
    return () => { cancelled = true }
  }, [vaultReady, rootHandle, readFile, writeFile])

  return {
    rootHandle,
    folderName,
    loading,
    needsReconnect,
    vaultReady,
    pickerError,
    openFolder,
    reconnect,
    initVaultNow,
    readFile,
    writeFile,
    deleteFile,
    renameFile,
    listFiles,
    listTree,
    fileExists,
  }
}
