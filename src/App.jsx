import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { useFileSystem } from './hooks/useFileSystem'
import { useSettings } from './hooks/useSettings'
import { initVault, todayInboxPath, dailyNoteTemplate } from './lib/vaultInit'
import { generateFile, toSlug } from './lib/templates'
import { mergeTagsIntoIndex } from './lib/tags'
import { invalidateFileIndex } from './lib/fileIndex'
import { restoreTasksForRecreatedPerson, retargetTasksForFile, readTasksIndex } from './lib/tasksIndex'
import { TASKS_INDEX_CHANGED_EVENT } from './lib/tasksIndex'
import { clearProcessedState } from './lib/processedNotes'
import { parseFrontmatter, buildFileContent } from './lib/frontmatter'
import { dbGet, dbPut } from './lib/db'
import Sidebar from './components/Sidebar'
import ConfirmDialog from './components/ConfirmDialog'
import WikilinkCreatePopover from './components/WikilinkCreatePopover'
import TasksPage from './core/TasksPage'
import CommandPage from './core/CommandPage'
import SettingsPage from './core/SettingsPage'
import ProcessedNoteViewer from './core/ProcessedNoteViewer'
import PersonViewer from './core/PersonViewer'
import ProjectViewer from './core/ProjectViewer'
import IdeaViewer from './core/IdeaViewer'
import PlansPage from './core/PlansPage'
import IdeaBacklogPage from './core/IdeaBacklogPage'

const InboxPage = lazy(() => import('./core/InboxPage'))
const NotesPage = lazy(() => import('./core/NotesPage'))
const ArchivePage = lazy(() => import('./core/ArchivePage'))
const VaultFileViewer = lazy(() => import('./components/VaultFileViewer'))
const ArchiveViewer = lazy(() => import('./components/ArchiveViewer'))

function resolveWikilinkTarget(linkText, tree = {}) {
  const raw = String(linkText || '').trim()
  if (!raw) return null
  const value = raw.split('|')[0].trim()
  if (!value) return null

  const dateMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dateMatch) {
    const direct = `notes/${value}.md`
    const alt = `notes/${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}.md`
    const noteSet = new Set((tree?.notes || []).map((entry) => entry?.path).filter(Boolean))
    if (noteSet.has(direct)) return direct
    if (noteSet.has(alt)) return alt
  }

  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!slug) return null

  // tightSlug removes all non-alphanumeric chars entirely (handles Ubuntu.com → ubuntucom)
  const tightSlug = value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '')
  const candidates = [
    `people/${slug}.md`,
    `people/${tightSlug}.md`,
    `projects/${slug}.md`,
    `projects/${tightSlug}.md`,
    `projects/${tightSlug}s.md`,
    `ideas/${slug}.md`,
    `ideas/${tightSlug}.md`,
    `notes/${value}.md`,
    `notes/${slug}.md`,
  ]

  const allEntries = Object.values(tree || {}).flatMap((arr) => Array.isArray(arr) ? arr : [])
  const pathToOriginal = new Map(allEntries.map((entry) => [String(entry?.path || '').toLowerCase(), entry?.path]).filter(([k]) => k))
  const match = candidates.find((path) => pathToOriginal.has(path.toLowerCase()))
  return match ? pathToOriginal.get(match.toLowerCase()) : null
}

export default function App() {
  const { settings, saveSettings } = useSettings()
  const {
    vaultReady,
    folderName,
    openFolder,
    writeFile,
    readFile,
    deleteFile,
    renameFile,
    listTree,
    fileExists,
    needsReconnect,
    reconnect,
    pickerError,
  } = useFileSystem()

  const [activePage,       setActivePage]       = useState('command')
  const [activeFile,       setActiveFile]       = useState(null)
  const [sidebarBusy, setSidebarBusy] = useState(false)
  const [vaultInitialised, setVaultInitialised] = useState(false)
  const [tree, setTree] = useState({})
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)
  const [tasksVersion, setTasksVersion] = useState(0)
  const [newFilePaths, setNewFilePaths] = useState(() => new Set())
  const [ideaBacklogCount, setIdeaBacklogCount] = useState(0)
  const [openTasksCount, setOpenTasksCount] = useState(null)
  const [activePlansCount, setActivePlansCount] = useState(null)

  // Persist newFilePaths to IndexedDB so chip survives reload
  useEffect(() => {
    dbGet('settings', 'newFilePaths').then((stored) => {
      if (Array.isArray(stored) && stored.length > 0) {
        setNewFilePaths(new Set(stored))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    dbPut('settings', 'newFilePaths', [...newFilePaths]).catch(() => {})
  }, [newFilePaths])
  const [inboxSessionKey, setInboxSessionKey] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [wikiCreatePopover, setWikiCreatePopover] = useState({ open: false, name: '', x: 0, y: 0 })
  // path → user-authored display name (read from frontmatter, refreshed when tree changes)
  const [entityDisplayNames, setEntityDisplayNames] = useState(() => new Map())

  useEffect(() => {
    if (!vaultReady) return
    let cancelled = false
    const ENTITY_FOLDERS = { people: 'full_name', projects: 'name', ideas: 'name' }
    const entityEntries = Object.entries(ENTITY_FOLDERS).flatMap(([folder, field]) =>
      (tree[folder] || []).filter(f => f?.kind === 'file').map(f => ({
        path: f.path || `${folder}/${f.name}`,
        field,
      }))
    )
    const noteEntries = (tree.notes || []).filter(f => f?.kind === 'file').map(f => ({
      path: f.path || `notes/${f.name}`,
      field: null,
    }))
    const allEntries = [...entityEntries, ...noteEntries]
    Promise.all(
      allEntries.map(({ path, field }) =>
        readFile(path).then(raw => {
          let displayName
          if (field) {
            const { fields } = parseFrontmatter(raw)
            displayName = fields?.[field] || null
          } else {
            // Notes: extract H1 title
            const m = /^#\s+(.+)$/m.exec(raw)
            displayName = m ? m[1].trim() : null
          }
          return displayName ? [path, displayName] : null
        }).catch(() => null)
      )
    ).then(results => {
      if (cancelled) return
      setEntityDisplayNames(new Map(results.filter(Boolean)))
    })
    return () => { cancelled = true }
  }, [vaultReady, tree, readFile])

  const handleDisplayNameChanged = useCallback((path, name) => {
    if (!path || !name) return
    setEntityDisplayNames(prev => {
      const next = new Map(prev)
      next.set(path, name)
      return next
    })
  }, [])
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: null,
  })

  const wikilinkSuggestions = useMemo(() => {
    const TYPE_MAP = { people: 'person', projects: 'project', ideas: 'idea' }
    const RANK = { person: 0, project: 1, idea: 2, note: 3 }
    const seen = new Set()
    const suggestions = []
    for (const [folder, entries] of Object.entries(tree)) {
      if (!Array.isArray(entries)) continue
      // Exclude ideas folder when ideas module is disabled
      if (folder === 'ideas' && settings?.enabledModules?.ideas === false) continue
      // Exclude people/projects when those modules are disabled
      if (folder === 'people' && settings?.enabledModules?.people === false) continue
      if (folder === 'projects' && settings?.enabledModules?.projects === false) continue
      for (const entry of entries) {
        if (!entry || entry.kind !== 'file') continue
        const path = `${folder}/${entry.name}`
        if (seen.has(path)) continue
        seen.add(path)
        const base = entry.name.replace(/\.md$/i, '')
        if (!base) continue
        const name = base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        suggestions.push({ name, path, type: TYPE_MAP[folder] || 'note' })
      }
    }
    suggestions.sort((a, b) => (RANK[a.type] ?? 3) - (RANK[b.type] ?? 3) || a.name.localeCompare(b.name))
    return suggestions
  }, [tree, settings?.enabledModules])

  const showConfirm = ({ title, message, confirmLabel = 'Delete', danger = true, onConfirm }) => {
    setConfirmDialog({ open: true, title, message, confirmLabel, danger, onConfirm })
  }

  const hideConfirm = () => {
    setConfirmDialog((state) => ({ ...state, open: false, onConfirm: null }))
  }

  useEffect(() => {
    if (!vaultReady || vaultInitialised) return
    initVault(writeFile, fileExists)
      .then(() => setVaultInitialised(true))
      .catch(console.error)
  }, [vaultReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!vaultReady) return
    mergeTagsIntoIndex(readFile, writeFile, []).catch(() => {})
  }, [vaultReady, readFile, writeFile])

  const createTodayNoteIfMissing = async () => {
    if (!vaultReady) return

    const result = await listTree().catch(() => [])
    const inboxDir = (result || []).find((entry) => entry?.kind === 'directory' && entry.name === 'inbox')
    const inboxFiles = (inboxDir?.children || []).filter((entry) => entry?.kind === 'file')

    // Auto-create today's inbox note only for a truly empty inbox (first run UX).
    if (inboxFiles.length > 0) return

    const path = todayInboxPath()
    const dateStr = path.replace('inbox/', '').replace('.md', '')
    await writeFile(path, dailyNoteTemplate(dateStr))
    listTree().then((nextResult) => {
      const bySection = {}
      for (const entry of nextResult || []) {
        if (entry?.kind === 'directory') {
          bySection[entry.name] = entry.children || []
        }
      }
      setTree(bySection)
    }).catch(() => {})
  }

  const refreshBacklogCount = useCallback(async () => {
    try {
      const raw = await readFile('ideas/backlog.md')
      const match = raw.match(/##\s+Backlog\s*\n([\s\S]*?)(?=\n##\s|$)/i)
      if (!match) { setIdeaBacklogCount(0); return }
      const count = match[1].split('\n').filter((l) => /^-\s+/.test(l.trimStart())).length
      setIdeaBacklogCount(count)
    } catch {
      setIdeaBacklogCount(0)
    }
  }, [readFile])

  const refreshCounts = useCallback(async () => {
    // Open tasks count (non-done, non-archived)
    try {
      const entries = await readTasksIndex(readFile)
      const open = (entries || []).filter((e) => e?.status !== 'done' && e?.status !== 'archived').length
      setOpenTasksCount(open)
    } catch {
      setOpenTasksCount(null)
    }
    // Active plans count (entities with type:plan and plan_archived != true)
    try {
      const plansTree = await listTree()
      const projectsDir = (plansTree || []).find((e) => e?.name === 'projects')
      const projectFiles = (projectsDir?.children || []).filter((f) => f?.name?.endsWith('.md'))
      let planCount = 0
      await Promise.all(projectFiles.map(async (f) => {
        try {
          const raw = await readFile(`projects/${f.name}`)
          const { fields } = parseFrontmatter(raw)
          if (String(fields?.type || '').trim().toLowerCase() === 'plan' && !fields?.plan_archived) planCount++
        } catch {}
      }))
      setActivePlansCount(planCount)
    } catch {
      setActivePlansCount(null)
    }
  }, [readFile, listTree])

  useEffect(() => {
    if (!vaultReady) return
    createTodayNoteIfMissing()
    migrateTasksArchive()

    listTree()
      .then((result) => {
        const bySection = {}
        for (const entry of result || []) {
          if (entry?.kind === 'directory') {
            bySection[entry.name] = entry.children || []
          }
        }
        setTree(bySection)
      })
      .catch(() => setTree({}))
    refreshBacklogCount()
    refreshCounts()
  }, [vaultReady, listTree, vaultInitialised, refreshBacklogCount, refreshCounts])

  const navigate = (page, file = null) => {
    if (file) {
      setNewFilePaths((prev) => {
        if (!prev.has(file)) return prev
        const next = new Set(prev)
        next.delete(file)
        return next
      })
    }
    setActivePage(page)
    setActiveFile(file)
  }

  const markFileSeen = (path) => {
    if (!path) return
    setNewFilePaths((prev) => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }

  const refreshDashboard = () => {
    setDashboardRefreshKey((value) => value + 1)
  }

  const refreshTasks = () => {
    setTasksVersion((value) => value + 1)
  }

  useEffect(() => {
    const handleTasksChanged = () => { refreshTasks(); refreshCounts() }
    if (typeof window !== 'undefined') {
      window.addEventListener(TASKS_INDEX_CHANGED_EVENT, handleTasksChanged)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(TASKS_INDEX_CHANGED_EVENT, handleTasksChanged)
      }
    }
  }, [])

  useEffect(() => {
    const handleToast = (event) => {
      const message = String(event?.detail?.message || '').trim()
      if (!message) return
      setToastMessage(message)
      window.clearTimeout(window.__memostackToastTimer)
      window.__memostackToastTimer = window.setTimeout(() => setToastMessage(''), 2000)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('memostack:toast', handleToast)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('memostack:toast', handleToast)
      }
    }
  }, [])

  const refreshTree = () => {
    listTree()
      .then((result) => {
        const bySection = {}
        for (const entry of result || []) {
          if (entry?.kind === 'directory') {
            bySection[entry.name] = entry.children || []
          }
        }
        setTree(bySection)
      })
      .catch(() => {})
    refreshBacklogCount()
    refreshCounts()
  }

  const migrateTasksArchive = async () => {
    const oldPath = 'archive/tasks_done.md'
    const newPath = 'archive/tasks-archive.md'
    try {
      const newExists = await fileExists(newPath)
      const oldExists = await fileExists(oldPath)
      if (!newExists) {
        if (oldExists) {
          const content = await readFile(oldPath)
          await writeFile(newPath, content)
          await deleteFile(oldPath)
        } else {
          await writeFile(newPath, '# Tasks Archive\n\nArchived tasks are tracked in context/tasks-index.json.\n')
        }
      } else if (oldExists) {
        await deleteFile(oldPath)
      }
    } catch {}
  }

  const handleFileRenamed = (newPath) => {
    setActiveFile(newPath)
    refreshTree()
  }

  const archiveFile = async (path) => {
    if (!path) return
    const filename = path.split('/').pop()
    const targetPath = `archive/${filename}`
    const content = await readFile(path)
    await writeFile(targetPath, content)
    if (typeof deleteFile === 'function') {
      await deleteFile(path)
    }
    if (path.startsWith('inbox/')) {
      await clearProcessedState(path)
    }
    await invalidateFileIndex()
    if (activeFile === path) {
      setActiveFile(null)
      setActivePage('command')
    }
    refreshTree()
  }

  const deleteVaultFile = async (path) => {
    if (!path || typeof deleteFile !== 'function') return
    await deleteFile(path)
    if (path.startsWith('inbox/')) {
      await clearProcessedState(path)
    }
    await invalidateFileIndex()
    setNewFilePaths((prev) => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })

    if (path.startsWith('inbox/')) {
      setInboxSessionKey((value) => value + 1)
    }

    if (activeFile === path) {
      setActiveFile(null)
      setActivePage('command')
    }

    refreshTree()
  }

  const handleSidebarRename = async (oldPath, newName) => {
    if (!newName?.trim()) return
    const folder = oldPath.split('/')[0]
    const oldStem = oldPath.split('/').pop().replace(/\.md$/i, '')
    const newSlug = toSlug(newName.trim())
    if (!newSlug || newSlug.toLowerCase() === oldStem.toLowerCase()) return

    const newPath = `${folder}/${newSlug}.md`

    try {
      const exists = await fileExists(newPath)
      if (exists) return

      const raw = await readFile(oldPath)
      let newContent = raw

      if (folder === 'notes') {
        const lines = raw.split('\n')
        const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0)
        if (firstNonEmpty >= 0 && /^#\s+/.test(lines[firstNonEmpty])) {
          lines[firstNonEmpty] = `# ${newName.trim()}`
          newContent = lines.join('\n')
        }
      } else if (folder === 'people') {
        const { fields, body } = parseFrontmatter(raw)
        fields.full_name = newName.trim()
        newContent = buildFileContent(fields, body)
      } else if (folder === 'projects') {
        const { fields, body } = parseFrontmatter(raw)
        fields.name = newName.trim()
        newContent = buildFileContent(fields, body)
      }

      await writeFile(newPath, newContent)
      await deleteFile(oldPath)

      if (folder === 'people' || folder === 'projects') {
        await retargetTasksForFile(readFile, writeFile, oldPath, newPath)
        for (const ctxPath of [
          'context/_context.md',
          'context/_context_log.md',
          'context/projects-index.md',
          'context/people-index.md',
          'context/ideas-index.md',
        ]) {
          try {
            const txt = await readFile(ctxPath)
            if (txt.includes(oldPath)) {
              await writeFile(ctxPath, txt.split(oldPath).join(newPath))
            }
          } catch {}
        }
        await invalidateFileIndex()
      }

      if (activeFile === oldPath) setActiveFile(newPath)
      refreshTree()
    } catch (err) {
      console.error('Sidebar rename failed:', err?.message || err)
    }
  }

  const handleCreateFile = async (folder, customName) => {
    const date = new Date()
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    const ts = `${yyyy}-${mm}-${dd}`
    const tsWithTime = `${yyyy}-${mm}-${dd}-${hh}${min}${ss}`

    let filePath = `${folder}/Untitled-${ts}.md`
    let content = `# \n\n`

    switch (folder) {
      case 'notes':
        if (customName) {
          const slug = customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          filePath = `${folder}/${slug || `untitled-${tsWithTime}`}.md`
        } else {
          filePath = `${folder}/Untitled-${tsWithTime}.md`
        }
        content = customName ? `# ${customName.trim()}\n\n` : '# Untitled\n\n'
        break
      case 'projects': {
        const generated = generateFile(folder, '')
        filePath = `${folder}/Untitled-${ts}.md`
        content = generated.content
        break
      }
      case 'people': {
        const generated = generateFile(folder, '')
        filePath = `${folder}/Untitled-${ts}.md`
        content = generated.content
        break
      }
      case 'ideas': {
        const generated = generateFile(folder, '')
        filePath = `${folder}/Untitled-${ts}.md`
        content = generated.content
        break
      }
      case 'inbox': {
        filePath = todayInboxPath()
        const exists = await fileExists(filePath)
        if (!exists) {
          await clearProcessedState(filePath)
          await writeFile(filePath, dailyNoteTemplate(filePath.replace('inbox/', '').replace('.md', '')))
        }
        refreshTree()
        setInboxSessionKey((value) => value + 1)
        navigate('inbox', filePath)
        return
      }
      default: {
        const generated = generateFile(folder, '')
        filePath = `${folder}/Untitled-${ts}.md`
        content = generated.content
      }
    }

    await writeFile(filePath, content)
    if (folder === 'people') {
      await restoreTasksForRecreatedPerson(readFile, writeFile, filePath)
    }
    await invalidateFileIndex()
    refreshTree()

    if (folder === 'inbox') {
      navigate('inbox', filePath)
      return
    }

    navigate('viewer', filePath)
  }

  const handleWikilinkClick = (name, coords) => {
    const target = resolveWikilinkTarget(name, tree)
    if (target) {
      navigate('viewer', target)
      return
    }
    setWikiCreatePopover({
      open: true,
      name: String(name || '').trim(),
      x: coords?.x ?? window.innerWidth / 2,
      y: coords?.y ?? 200,
    })
  }

  const handleCreateFromWikilink = async (folder) => {
    const { name } = wikiCreatePopover
    setWikiCreatePopover({ open: false, name: '', x: 0, y: 0 })
    const { slug, content } = generateFile(folder, name)
    const path = `${folder}/${slug}.md`
    try {
      await writeFile(path, content)
      refreshTree()
      setNewFilePaths((prev) => { const next = new Set(prev); next.add(path); return next })
      navigate('viewer', path)
    } catch (err) {
      console.error('[WikilinkCreate] failed:', err?.message || err)
    }
  }

  if (!vaultReady) {
    return (
      <VaultPicker
        onPick={openFolder}
        needsReconnect={needsReconnect}
        folderName={folderName}
        onReconnect={reconnect}
        pickerError={pickerError}
      />
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Sidebar
        page={activePage}
        activePath={activeFile}
        folderName={folderName}
        isBusy={sidebarBusy}
        openTaskCount={null}
        ideaBacklogCount={ideaBacklogCount}
        openTasksCount={openTasksCount}
        activePlansCount={activePlansCount}
        tree={tree}
        onNavigate={navigate}
        onOpenFolder={openFolder}
        onCreateFile={handleCreateFile}
        onRefreshDashboard={refreshDashboard}
        onArchiveFile={archiveFile}
        onDeleteFile={deleteVaultFile}
        onConfirmAction={showConfirm}
        settings={settings}
        newFilePaths={newFilePaths}
        onMarkFileSeen={markFileSeen}
        onRenameFile={handleSidebarRename}
        entityDisplayNames={entityDisplayNames}
      />
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
        {activePage === 'command'  && (
          <CommandPage
            key={dashboardRefreshKey}
            readFile={readFile}
            writeFile={writeFile}
            listTree={listTree}
            settings={settings}
            saveSettings={saveSettings}
            setPage={(page, file) => navigate(page, file)}
          />
        )}
        {activePage === 'tasks'    && (
          <TasksPage
            readFile={readFile}
            writeFile={writeFile}
            fileExists={fileExists}
            listTree={listTree}
            settings={settings}
          />
        )}
        {activePage === 'plans'    && (
          <PlansPage
            readFile={readFile}
            writeFile={writeFile}
            listTree={listTree}
            settings={settings}
            onNavigate={navigate}
          />
        )}
        {activePage === 'ideas-backlog' && (
          <IdeaBacklogPage
            readFile={readFile}
            writeFile={writeFile}
            fileExists={fileExists}
            onFileCreated={async () => {
              await invalidateFileIndex()
              refreshTree()
              refreshBacklogCount()
            }}
            onNavigate={navigate}
          />
        )}
        {activePage === 'inbox'    && (
          <Suspense fallback={<PageLoading />}> 
            <InboxPage
              key={`${activeFile || 'today'}:${inboxSessionKey}`}
              file={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              deleteFile={deleteFile}
              onBusyChange={setSidebarBusy}
              onProcessedNote={async () => {
                refreshTree()
                refreshTasks()
              }}
              onProcessedState={async (payload) => {
                refreshTree()
                const createdPaths = Array.isArray(payload?.createdPaths)
                  ? payload.createdPaths.filter(Boolean)
                  : []
                if (createdPaths.length > 0) {
                  setNewFilePaths((prev) => {
                    const next = new Set(prev)
                    createdPaths.forEach((path) => next.add(path))
                    return next
                  })
                }
              }}
              onArchiveFile={archiveFile}
              onDeleteFile={deleteVaultFile}
              onConfirmAction={showConfirm}
              listTree={listTree}
              settings={settings}
              onWikilinkClick={handleWikilinkClick}
              setPage={(page, file) => navigate(page, file)}
            />
          </Suspense>
        )}
        {activePage === 'notes'    && (
          <Suspense fallback={<PageLoading />}>
            <NotesPage
              readFile={readFile}
              writeFile={writeFile}
              listTree={listTree}
              activePath={activeFile}
            />
          </Suspense>
        )}
        {activePage === 'viewer' && activeFile?.startsWith('notes/') && (
          <Suspense fallback={<PageLoading />}>
            <ProcessedNoteViewer
              filePath={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              deleteFile={deleteFile}
              renameFile={renameFile}
              fileExists={fileExists}
              onConfirmAction={showConfirm}
              onWikilinkClick={handleWikilinkClick}
              wikilinkSuggestions={wikilinkSuggestions}
              onDisplayNameChanged={handleDisplayNameChanged}
              onFileRenamed={(newPath) => {
                refreshTree()
                setActiveFile(newPath)
              }}
              onFileDeleted={() => {
                refreshTree()
                setActiveFile(null)
                setActivePage('command')
              }}
            />
          </Suspense>
        )}
        {activePage === 'viewer' && activeFile?.startsWith('people/') && (
          <Suspense fallback={<PageLoading />}>
            <PersonViewer
              filePath={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              listTree={listTree}
              deleteFile={deleteFile}
              renameFile={renameFile}
              fileExists={fileExists}
              tasksVersion={tasksVersion}
              settings={settings}
              wikilinkSuggestions={wikilinkSuggestions}
              onNavigate={navigate}
              onTasksChanged={refreshTasks}
              onFileRenamed={handleFileRenamed}
              onConfirmAction={showConfirm}
              onWikilinkClick={handleWikilinkClick}
              onDisplayNameChanged={handleDisplayNameChanged}
              onFileDeleted={() => {
                refreshTree()
                setActiveFile(null)
                setActivePage('command')
              }}
            />
          </Suspense>
        )}
        {activePage === 'viewer' && activeFile?.startsWith('projects/') && (
          <Suspense fallback={<PageLoading />}>
            <ProjectViewer
              filePath={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              listTree={listTree}
              deleteFile={deleteFile}
              renameFile={renameFile}
              fileExists={fileExists}
              tasksVersion={tasksVersion}
              wikilinkSuggestions={wikilinkSuggestions}
              onNavigate={navigate}
              onTasksChanged={refreshTasks}
              onFileRenamed={handleFileRenamed}
              onConfirmAction={showConfirm}
              onWikilinkClick={handleWikilinkClick}
              onDisplayNameChanged={handleDisplayNameChanged}
              onFileDeleted={() => {
                refreshTree()
                setActiveFile(null)
                setActivePage('command')
              }}
            />
          </Suspense>
        )}
        {activePage === 'viewer' && activeFile?.startsWith('ideas/') && (
          <Suspense fallback={<PageLoading />}>
            <IdeaViewer
              filePath={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              listTree={listTree}
              deleteFile={deleteFile}
              renameFile={renameFile}
              fileExists={fileExists}
              tasksVersion={tasksVersion}
              wikilinkSuggestions={wikilinkSuggestions}
              onNavigate={navigate}
              onTasksChanged={refreshTasks}
              onFileRenamed={handleFileRenamed}
              onConfirmAction={showConfirm}
              onDisplayNameChanged={handleDisplayNameChanged}
              onFileDeleted={() => {
                refreshTree()
                setActiveFile(null)
                setActivePage('command')
              }}
            />
          </Suspense>
        )}
        {activePage === 'viewer' && (activeFile === 'archive/tasks_done.md' || activeFile === 'archive/tasks-archive.md') && (
          <Suspense fallback={<PageLoading />}>
            <ArchiveViewer
              readFile={readFile}
              writeFile={writeFile}
              tasksVersion={tasksVersion}
            />
          </Suspense>
        )}
        {activePage === 'viewer' && activeFile && !activeFile.startsWith('notes/') && !activeFile.startsWith('people/') && !activeFile.startsWith('projects/') && !activeFile.startsWith('ideas/') && activeFile !== 'archive/tasks_done.md' && activeFile !== 'archive/tasks-archive.md' && (
          <Suspense fallback={<PageLoading />}>
            <VaultFileViewer
              filePath={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              deleteFile={deleteFile}
              onArchiveFile={archiveFile}
              onDeleteFile={deleteVaultFile}
              onConfirmAction={showConfirm}
              onWikilinkClick={handleWikilinkClick}
              onFileDeleted={() => {
                refreshTree()
                setActiveFile(null)
                setActivePage('command')
              }}
            />
          </Suspense>
        )}
        {activePage === 'archive'  && (
          <Suspense fallback={<PageLoading />}>
            <ArchivePage readFile={readFile} listTree={listTree} />
          </Suspense>
        )}
        {activePage === 'settings' && (
          <SettingsPage
            writeFile={writeFile}
            readFile={readFile}
            listTree={listTree}
            settings={settings}
            saveSettings={saveSettings}
          />
        )}
      </main>
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        danger={confirmDialog.danger}
        onConfirm={() => {
          confirmDialog.onConfirm?.()
          hideConfirm()
        }}
        onCancel={hideConfirm}
      />
      {toastMessage ? (
        <div
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 1200,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-strong)',
            background: 'var(--panel-pop)',
            color: 'var(--text)',
            fontSize: 12.5,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          {toastMessage}
        </div>
      ) : null}
      {wikiCreatePopover.open && (
        <WikilinkCreatePopover
          name={wikiCreatePopover.name}
          coords={{ x: wikiCreatePopover.x, y: wikiCreatePopover.y }}
          enabledModules={settings.enabledModules}
          onSelect={handleCreateFromWikilink}
          onClose={() => setWikiCreatePopover({ open: false, name: '', x: 0, y: 0 })}
        />
      )}
    </div>
  )
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
      Loading page...
    </div>
  )
}

function VaultPicker({ onPick, needsReconnect, folderName, onReconnect, pickerError }) {
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center space-y-6 max-w-sm px-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Memory App
        </h1>
        {pickerError && (
          <div
            className="text-sm rounded-lg px-4 py-3"
            style={{
              color: 'var(--danger)',
              background: 'color-mix(in oklab, var(--danger) 10%, transparent)',
              border: '1px solid color-mix(in oklab, var(--danger) 35%, transparent)',
            }}
          >
            {pickerError}
          </div>
        )}
        {needsReconnect ? (
          <>
            <p style={{ color: 'var(--text-muted)' }} className="text-sm">
              Reconnect to your vault folder <strong style={{ color: 'var(--text-secondary)' }}>{folderName}</strong> to continue.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onReconnect}
                className="px-6 py-3 rounded-lg text-white text-sm transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                Reconnect to {folderName}
              </button>
              <button
                onClick={onPick}
                className="px-6 py-3 rounded-lg text-sm transition-colors"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Choose different folder
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)' }} className="text-sm">
              Choose a folder on your computer to use as your vault.
              Markdown files will be created and organised there automatically.
            </p>
            <button
              onClick={onPick}
              className="px-6 py-3 rounded-lg text-white text-sm transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Choose Vault Folder
            </button>
          </>
        )}
      </div>
    </div>
  )
}
