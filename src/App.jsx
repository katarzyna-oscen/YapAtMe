import { useState, useEffect, lazy, Suspense } from 'react'
import { useFileSystem } from './hooks/useFileSystem'
import { useSettings } from './hooks/useSettings'
import { initVault, todayInboxPath, dailyNoteTemplate } from './lib/vaultInit'
import { generateFile } from './lib/templates'
import { mergeTagsIntoIndex } from './lib/tags'
import Sidebar from './components/Sidebar'
import ConfirmDialog from './components/ConfirmDialog'
import TasksPage from './core/TasksPage'
import CommandPage from './core/CommandPage'
import SettingsPage from './core/SettingsPage'
import ProcessedNoteViewer from './core/ProcessedNoteViewer'
import PersonViewer from './core/PersonViewer'
import ProjectViewer from './core/ProjectViewer'

const InboxPage = lazy(() => import('./core/InboxPage'))
const NotesPage = lazy(() => import('./core/NotesPage'))
const ArchivePage = lazy(() => import('./core/ArchivePage'))
const VaultFileViewer = lazy(() => import('./components/VaultFileViewer'))

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
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: null,
  })

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

  useEffect(() => {
    if (!vaultReady) return
    createTodayNoteIfMissing()

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
  }, [vaultReady, listTree, vaultInitialised])

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

  const navigate = (page, file = null) => {
    setActivePage(page)
    setActiveFile(file)
  }

  const refreshDashboard = () => {
    setDashboardRefreshKey((value) => value + 1)
  }

  const refreshTasks = () => {
    setTasksVersion((value) => value + 1)
  }

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
  }

  const handleFileRenamed = (newPath) => {
    setActiveFile(newPath)
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
    refreshTree()
  }

  const deleteVaultFile = async (path) => {
    if (!path || typeof deleteFile !== 'function') return
    await deleteFile(path)
    refreshTree()
  }

  const handleCreateFile = async (folder) => {
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
        filePath = `${folder}/Untitled-${tsWithTime}.md`
        content = '# Untitled\n\n'
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
          await writeFile(filePath, dailyNoteTemplate(filePath.replace('inbox/', '').replace('.md', '')))
        }
        refreshTree()
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
    refreshTree()

    if (folder === 'inbox') {
      navigate('inbox', filePath)
      return
    }

    navigate('viewer', filePath)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Sidebar
        page={activePage}
        activePath={activeFile}
        folderName={folderName}
        isBusy={sidebarBusy}
        openTaskCount={null}
        tree={tree}
        onNavigate={navigate}
        onOpenFolder={openFolder}
        onCreateFile={handleCreateFile}
        onRefreshDashboard={refreshDashboard}
        onArchiveFile={archiveFile}
        onDeleteFile={deleteVaultFile}
        onConfirmAction={showConfirm}
        settings={settings}
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
        {activePage === 'inbox'    && (
          <Suspense fallback={<PageLoading />}> 
            <InboxPage
              file={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              deleteFile={deleteFile}
              onBusyChange={setSidebarBusy}
              onProcessedNote={async () => {
                refreshTree()
                refreshTasks()
              }}
              onArchiveFile={archiveFile}
              onDeleteFile={deleteVaultFile}
              onConfirmAction={showConfirm}
              listTree={listTree}
              settings={settings}
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
              onConfirmAction={showConfirm}
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
              deleteFile={deleteFile}
              renameFile={renameFile}
              fileExists={fileExists}
              tasksVersion={tasksVersion}
              onFileRenamed={handleFileRenamed}
              onConfirmAction={showConfirm}
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
              deleteFile={deleteFile}
              renameFile={renameFile}
              fileExists={fileExists}
              tasksVersion={tasksVersion}
              onFileRenamed={handleFileRenamed}
              onConfirmAction={showConfirm}
              onFileDeleted={() => {
                refreshTree()
                setActiveFile(null)
                setActivePage('command')
              }}
            />
          </Suspense>
        )}
        {activePage === 'viewer' && activeFile && !activeFile.startsWith('notes/') && !activeFile.startsWith('people/') && !activeFile.startsWith('projects/') && (
          <Suspense fallback={<PageLoading />}>
            <VaultFileViewer
              filePath={activeFile}
              readFile={readFile}
              writeFile={writeFile}
              deleteFile={deleteFile}
              onArchiveFile={archiveFile}
              onDeleteFile={deleteVaultFile}
              onConfirmAction={showConfirm}
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
