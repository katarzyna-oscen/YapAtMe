import { useState } from 'react'
import DotGrid from './DotGrid'

function Icon({ name, size = 14 }) {
  const s = { width: size, height: size, flex: '0 0 auto' }

  switch (name) {
    case 'grid':
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      )
    case 'check':
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 8 3.5 3.5L13 5" />
        </svg>
      )
    case 'cog':
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" />
        </svg>
      )
    case 'folder':
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4c.4 0 .77.16 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
        </svg>
      )
    case 'plus':
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 3v10M3 8h10" />
        </svg>
      )
    case 'caret':
      return (
        <svg viewBox="0 0 10 10" style={s} fill="currentColor">
          <path d="M3 1 L7 5 L3 9 Z" />
        </svg>
      )
    case 'sync':
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 8a5 5 0 1 1-1.6-3.66" />
          <path d="M13 2.5V5h-2.5" />
        </svg>
      )
    default:
      return null
  }
}

function MenuItem({ label, danger = false, onClick }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 10px',
        fontSize: 12.5,
        borderRadius: 5,
        cursor: 'pointer',
        color: danger
          ? (hover ? 'oklch(0.84 0.16 22)' : 'var(--text-dim)')
          : (hover ? 'var(--text)' : 'var(--text-dim)'),
        background: hover
          ? (danger ? 'oklch(0.70 0.18 22 / 0.12)' : 'var(--panel-2)')
          : 'transparent',
      }}
    >
      {label}
    </div>
  )
}

function SidebarSection({ title, folder, files, defaultOpen = true, addable = false, activePath, onFileClick, onAdd, onArchiveFile, onDeleteFile, onConfirmAction }) {
  const [open, setOpen] = useState(defaultOpen)
  const [menuState, setMenuState] = useState(null)
  const [hoverPath, setHoverPath] = useState(null)

  const closeMenu = () => setMenuState(null)
  const selectedFile = menuState ? files.find((file) => file.path === menuState.path) : null

  const handleArchive = async (path) => {
    await onArchiveFile?.(path)
    closeMenu()
  }

  const handleDelete = async (path) => {
    await onDeleteFile?.(path)
    closeMenu()
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--text-very-dim)',
          fontWeight: 600,
          cursor: 'pointer',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            flex: '0 0 10px',
            transition: 'transform .15s ease',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Icon name="caret" size={10} />
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {addable && (
          <span
            onClick={(event) => {
              event.stopPropagation()
              onAdd?.(folder)
            }}
            style={{
              marginLeft: 'auto',
              width: 18,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-dim)',
              cursor: 'pointer',
              transition: 'background .12s, color .12s, border-color .12s',
            }}
            title={`New ${title.toLowerCase().slice(0, -1)}`}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--panel-2)'
              event.currentTarget.style.color = 'var(--text)'
              event.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent'
              event.currentTarget.style.color = 'var(--text-dim)'
              event.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 2.5v7M2.5 6h7" />
            </svg>
          </span>
        )}
      </div>

      {open && (
        files.length === 0 ? (
          <div
            style={{
              padding: '4px 10px 4px 28px',
              color: 'var(--text-very-dim)',
              fontStyle: 'italic',
              fontSize: 12.5,
            }}
          >
            empty
          </div>
        ) : (
          files.map((file) => {
            const isActive = activePath === file.path
            const isContext = folder === 'context'
            return (
              <div
                key={file.path}
                onClick={() => onFileClick(file.path)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px 5px 28px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: isActive ? 'var(--text)' : 'var(--text-dim)',
                  background: isActive ? 'var(--panel-2)' : 'transparent',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  textOverflow: 'ellipsis',
                  transition: 'background .1s, color .1s',
                }}
                onMouseEnter={(event) => {
                  setHoverPath(file.path)
                  if (!isActive) {
                    event.currentTarget.style.background = 'var(--panel-2)'
                    event.currentTarget.style.color = 'var(--text)'
                  }
                }}
                onMouseLeave={(event) => {
                  setHoverPath((current) => (current === file.path ? null : current))
                  if (!isActive) {
                    event.currentTarget.style.background = 'transparent'
                    event.currentTarget.style.color = 'var(--text-dim)'
                  }
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {file.name}
                </span>
                {!isContext && (
                  <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        const rect = event.currentTarget.getBoundingClientRect()
                        setMenuState((current) => (current?.path === file.path ? null : {
                          path: file.path,
                          left: Math.min(Math.max(rect.right - 164, 16), window.innerWidth - 180),
                          top: Math.min(rect.bottom + 8, window.innerHeight - 180),
                        }))
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        background: menuState?.path === file.path ? 'var(--border)' : 'transparent',
                        color: 'var(--text)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        padding: 0,
                        opacity: (hoverPath === file.path || menuState?.path === file.path) ? 1 : 0,
                        transition: 'opacity .12s, background .12s',
                        flexShrink: 0,
                      }}
                      aria-label={`Actions for ${file.name}`}
                      onMouseEnter={(event) => {
                        if (menuState?.path !== file.path) event.currentTarget.style.background = 'var(--border)'
                      }}
                      onMouseLeave={(event) => {
                        if (menuState?.path !== file.path) event.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <circle cx="3.5" cy="8" r="1.3" />
                        <circle cx="8" cy="8" r="1.3" />
                        <circle cx="12.5" cy="8" r="1.3" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )
      )}

      {menuState && selectedFile && (
        <div onClick={closeMenu} className="fixed inset-0 z-[59] bg-transparent" />
      )}

      {menuState && selectedFile && (
        <div
          style={{
            position: 'fixed',
            left: menuState.left,
            top: menuState.top,
            zIndex: 60,
            minWidth: 150,
            padding: 4,
            background: 'var(--panel-pop)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <MenuItem
            label="Archive"
            onClick={() => {
              closeMenu()
              onConfirmAction?.({
                title: `Archive \"${selectedFile.name}\"?`,
                message: 'This file will be moved to archive/.',
                confirmLabel: 'Archive',
                danger: false,
                onConfirm: () => handleArchive(selectedFile.path),
              })
            }}
          />
          <MenuItem
            label="Delete"
            danger
            onClick={() => {
              closeMenu()
              onConfirmAction?.({
                title: `Delete \"${selectedFile.name}\"?`,
                message: 'This file will be permanently removed from your vault. This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
                onConfirm: () => handleDelete(selectedFile.path),
              })
            }}
          />
        </div>
      )}
    </div>
  )
}

function NavItem({ icon, label, active, badge, onClick, onBadgeClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 7,
        color: active ? 'var(--text)' : 'var(--text-dim)',
        background: active ? 'var(--panel-2)' : 'transparent',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        fontSize: 13.5,
        transition: 'background .1s, color .1s',
        userSelect: 'none',
      }}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.background = 'var(--panel-2)'
          event.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.background = 'transparent'
          event.currentTarget.style.color = 'var(--text-dim)'
        }
      }}
    >
      <Icon name={icon} size={14} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge === 'sync' && (
        <span
          title="Sync vault"
          onClick={onBadgeClick ? (event) => { event.stopPropagation(); onBadgeClick() } : undefined}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 4,
            color: 'var(--text-dim)',
            cursor: onBadgeClick ? 'pointer' : 'default',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--panel-2)'
            event.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent'
            event.currentTarget.style.color = 'var(--text-dim)'
          }}
        >
          <Icon name="sync" size={14} />
        </span>
      )}
      {typeof badge === 'number' && badge > 0 && (
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 4,
            background: 'var(--panel-2)',
            color: 'var(--text-dim)',
            fontSize: 11,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  )
}

export default function Sidebar({
  page,
  activePath,
  folderName,
  isBusy,
  openTaskCount,
  tree,
  onNavigate,
  onOpenFolder,
  onCreateFile,
  onRefreshDashboard,
  onArchiveFile,
  onDeleteFile,
  onConfirmAction,
  settings,
}) {
  const enabledModules = settings?.enabledModules ?? { projects: true, people: true, ideas: true }

  const filesFor = (section) =>
    (tree?.[section] || [])
      .filter((file) =>
        !file.name.startsWith('.')
        && !file.name.startsWith('_moved')
        && !(section === 'archive' && file.name === 'tasks.md')
      )
      .sort((a, b) => b.name.localeCompare(a.name))
      .map((file) => ({ name: file.name.replace('.md', ''), path: file.path || `${section}/${file.name}` }))

  return (
    <aside
      style={{
        width: 268,
        flex: '0 0 268px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        color: 'var(--text-dim)',
        fontSize: 13.5,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          padding: '18px 18px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text)',
              marginBottom: 2,
            }}
          >
            Memory OS
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
            }}
          >
            {folderName || 'No vault'}
          </div>
        </div>

        <DotGrid mode="snake" dotPx={5} gapPx={2} speed={90} active={!!isBusy} />
      </div>

      <nav
        style={{
          padding: '10px 8px 6px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <NavItem icon="grid" label="Command center" active={page === 'command'} badge="sync" onClick={() => onNavigate('command')} onBadgeClick={onRefreshDashboard} />
        <NavItem icon="check" label="Tasks" active={page === 'tasks'} badge={openTaskCount || null} onClick={() => onNavigate('tasks')} />
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 16px' }}>
        <SidebarSection title="Inbox" folder="inbox" addable files={filesFor('inbox')} activePath={activePath} onFileClick={(path) => onNavigate('inbox', path)} onAdd={onCreateFile} onArchiveFile={onArchiveFile} onDeleteFile={onDeleteFile} onConfirmAction={onConfirmAction} />
        <SidebarSection title="Notes" folder="notes" addable files={filesFor('notes')} activePath={activePath} onFileClick={(path) => onNavigate('viewer', path)} onAdd={onCreateFile} onArchiveFile={onArchiveFile} onDeleteFile={onDeleteFile} onConfirmAction={onConfirmAction} />
        {enabledModules.projects && (
          <SidebarSection
            title="Projects"
            folder="projects"
            addable
            defaultOpen={false}
            files={filesFor('projects')}
            activePath={activePath}
            onFileClick={(path) => onNavigate('viewer', path)}
            onAdd={onCreateFile}
            onArchiveFile={onArchiveFile}
            onDeleteFile={onDeleteFile}
            onConfirmAction={onConfirmAction}
          />
        )}
        {enabledModules.people && (
          <SidebarSection
            title="People"
            folder="people"
            addable
            defaultOpen={false}
            files={filesFor('people')}
            activePath={activePath}
            onFileClick={(path) => onNavigate('viewer', path)}
            onAdd={onCreateFile}
            onArchiveFile={onArchiveFile}
            onDeleteFile={onDeleteFile}
            onConfirmAction={onConfirmAction}
          />
        )}
        {enabledModules.ideas && (
          <SidebarSection
            title="Ideas"
            folder="ideas"
            addable
            defaultOpen={false}
            files={filesFor('ideas')}
            activePath={activePath}
            onFileClick={(path) => onNavigate('viewer', path)}
            onAdd={onCreateFile}
            onArchiveFile={onArchiveFile}
            onDeleteFile={onDeleteFile}
            onConfirmAction={onConfirmAction}
          />
        )}
        <SidebarSection
          title="Archive"
          folder="archive"
          defaultOpen={false}
          files={filesFor('archive')}
          activePath={activePath}
          onFileClick={(path) => onNavigate('viewer', path)}
          onArchiveFile={onArchiveFile}
          onDeleteFile={onDeleteFile}
          onConfirmAction={onConfirmAction}
        />
        <SidebarSection
          title="Context"
          folder="context"
          defaultOpen={false}
          files={filesFor('context')}
          activePath={activePath}
          onFileClick={(path) => onNavigate('viewer', path)}
        />
      </div>

      <div
        style={{
          padding: '8px 8px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <NavItem icon="cog" label="Settings" active={page === 'settings'} onClick={() => onNavigate('settings')} />
        <NavItem icon="folder" label="Change vault folder" onClick={onOpenFolder} />
      </div>
    </aside>
  )
}
