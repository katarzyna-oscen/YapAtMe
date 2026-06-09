# Handover — Fix cleanEntityFiles: Add Missing Template Sections

**File to replace:** `src/lib/cleanEntityFiles.js`

---

## Root cause

The cleaner strips non-allowed sections but never adds sections that are missing.
Old people files (pre-Patch A template) only had:
`## Related Projects` / `## Delegate` / `## Talk About` / `## Recent Mentions`

After cleaning, `## Delegate` and `## Talk About` were correctly removed, but
`## Summary` and `## Notes` were never present to begin with — so they stayed absent.

The fix: after stripping, check which allowed sections are missing and append them
with their template placeholder text. Re-running the cleaner on the vault will
restore all files to the current template shape without touching existing content.

---

## Full replacement for `src/lib/cleanEntityFiles.js`

```js
import { parseFrontmatter, buildFileContent } from './frontmatter'

// Allowed sections per folder — must match current templates.js schema exactly.
const ALLOWED_SECTIONS = {
  projects: ['## Summary', '## Current Plan', '## Recent Mentions', '## Notes'],
  people:   ['## Summary', '## Related Projects', '## Recent Mentions', '## Notes'],
}

// Placeholder text inserted when a required section is missing.
// Must match the placeholder text in templates.js generateFile().
const SECTION_PLACEHOLDERS = {
  projects: {
    '## Summary':       '_What is this project and why does it matter?_',
    '## Current Plan':  "_What's the current approach and the immediate next step?_",
    '## Recent Mentions': '_Populated by AI._',
    '## Notes':         '_Observations, raw thoughts, context. AI will use this to keep the project current._',
  },
  people: {
    '## Summary':          '_Who is this person and why do they matter to you?_',
    '## Related Projects': '_Link projects this person is involved in._',
    '## Recent Mentions':  '_Populated by AI._',
    '## Notes':            '_Observations, context, anything worth remembering about this person._',
  },
}

function normalizeTreeEntries(tree, folder) {
  if (Array.isArray(tree)) {
    const dir = tree.find((entry) => entry?.kind === 'directory' && entry.name === folder)
    return (dir?.children || []).filter((entry) => entry?.kind === 'file')
  }
  return tree?.[folder] || []
}

/**
 * Strips non-allowed sections from body.
 * Returns { cleanedBody, sectionsRemoved }
 */
function stripDisallowedSections(body, allowedSet) {
  const lines = String(body || '').split('\n')
  const kept = []
  let keepCurrentSection = true
  let sectionsRemoved = 0

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const heading = line.trim()
      keepCurrentSection = allowedSet.has(heading)
      if (keepCurrentSection) {
        kept.push(line)
      } else {
        sectionsRemoved += 1
      }
      continue
    }
    if (keepCurrentSection) {
      kept.push(line)
    }
  }

  return {
    cleanedBody: kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd(),
    sectionsRemoved,
  }
}

/**
 * Adds sections that are in allowedSections but absent from body.
 * Appends them in template order with placeholder text.
 * Returns { body, sectionsAdded }
 */
function addMissingSections(body, orderedSections, placeholders) {
  let sectionsAdded = 0
  let result = body

  for (const section of orderedSections) {
    // Check if this heading exists anywhere in the body
    const regex = new RegExp(`^${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm')
    if (!regex.test(result)) {
      const placeholder = placeholders[section] || ''
      result = `${result.trimEnd()}\n\n${section}\n${placeholder}`
      sectionsAdded += 1
    }
  }

  return { body: result.replace(/\n{3,}/g, '\n\n').trimEnd(), sectionsAdded }
}

export async function cleanEntityFiles({ readFile, writeFile, listTree }) {
  const summary = { filesChecked: 0, filesCleaned: 0, sectionsRemoved: 0, sectionsAdded: 0 }
  const tree = await listTree()

  for (const folder of Object.keys(ALLOWED_SECTIONS)) {
    const orderedSections = ALLOWED_SECTIONS[folder]
    const allowedSet = new Set(orderedSections)
    const placeholders = SECTION_PLACEHOLDERS[folder]

    const files = normalizeTreeEntries(tree, folder).filter(
      (file) => file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.'),
    )

    for (const file of files) {
      const filePath = file.path || `${folder}/${file.name}`
      summary.filesChecked += 1

      let raw
      try {
        raw = await readFile(filePath)
      } catch {
        continue
      }

      const { fields, body } = parseFrontmatter(raw)

      const { cleanedBody, sectionsRemoved } = stripDisallowedSections(body, allowedSet)
      const { body: finalBody, sectionsAdded } = addMissingSections(cleanedBody, orderedSections, placeholders)

      if (sectionsRemoved > 0 || sectionsAdded > 0) {
        await writeFile(filePath, buildFileContent(fields, finalBody))
        summary.filesCleaned += 1
        summary.sectionsRemoved += sectionsRemoved
        summary.sectionsAdded += sectionsAdded
      }
    }
  }

  return summary
}
```

---

## Update SettingsPage result display

The result summary now includes `sectionsAdded`. Update the success message in
`SettingsPage.jsx` where the clean result is displayed to show both numbers:

```jsx
✓ Done — {cleanResult.sectionsRemoved} section{cleanResult.sectionsRemoved !== 1 ? 's' : ''} removed,{' '}
{cleanResult.sectionsAdded} added,{' '}
{cleanResult.filesCleaned} file{cleanResult.filesCleaned !== 1 ? 's' : ''} updated
```

---

## After deploying

Run **Clean entity files** again from Settings → Vault maintenance.

This time it will:
- Skip files that are already in the correct shape (no-op)
- Add `## Summary` + `## Notes` (with placeholder text) to any pre-Patch-A files missing them
- Leave existing content in already-present sections untouched

Content that was in `## Summary` or `## Notes` before the first cleaner run is
unfortunately unrecoverable without git history. Those sections will be restored
as empty placeholders — the user will need to refill them manually.

---

## Validation checklist

- [ ] Deploy updated `cleanEntityFiles.js`
- [ ] Run "Clean entity files" from Settings
- [ ] Result shows `N sections added` alongside sections removed
- [ ] Open a pre-Patch-A person file — `## Summary` and `## Notes` now present
- [ ] Existing content in `## Recent Mentions` and `## Related Projects` is untouched
- [ ] Running the cleaner a second time is a no-op (idempotent)
- [ ] `bun run build` passes
