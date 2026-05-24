// Creates the core vault folder structure on first launch.
// Module folders are NOT created here — they are created when a module is enabled.
// Safe to call multiple times — skips files that already exist.

export const CORE_VAULT_STRUCTURE = {
  files: [
    { path: 'inbox/.keep',           content: '' },
    { path: 'notes/.keep',           content: '' },
    { path: 'archive/.keep',         content: '' },
    {
      path: 'context/_context.md',
      content: `# Context\n\n## Current Focus\n\n## Active Projects\n\n## Standing Decisions\n\n## Key People\n`,
    },
    {
      path: 'context/_context_log.md',
      content: `# Context Log\n\nAppend-only record of items removed from _context.md.\n`,
    },
    {
      path: 'context/tags.md',
      content: [
        'important', 'blocked', 'waiting', 'quick-win', 'high-impact',
        'action', 'decision', 'follow-up', 'experiment', 'personal', 'urgent',
      ].join('\n'),
    },
    { path: 'context/tasks-index.json', content: '[]' },
    {
      path: 'archive/tasks.md',
      content: `# Resolved Tasks\n\nResolved tasks are appended here.\n`,
    },
  ],
}

export async function initVault(writeFile, fileExists) {
  for (const { path, content } of CORE_VAULT_STRUCTURE.files) {
    try {
      if (fileExists) {
        const exists = await fileExists(path)
        if (exists) continue
      }
      await writeFile(path, content)
    } catch (err) {
      console.warn(`vaultInit: skipped ${path}:`, err.message)
    }
  }
}

export function todayInboxPath() {
  const now  = new Date()
  const dd   = String(now.getDate()).padStart(2, '0')
  const mm   = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `inbox/${dd}-${mm}-${yyyy}.md`
}

export function dailyNoteTemplate(dateStr) {
  return `# ${dateStr}\n\n`
}
