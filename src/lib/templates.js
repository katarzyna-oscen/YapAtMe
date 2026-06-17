// File templates for each entity type.
// generateFile(folder, name) → { slug, path, content }

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function toSlug(name) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!slug) return ''
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

export const WRITER_ACTIONS_SECTION = '## My Actions'

export function ensureWriterActionsSection(content) {
  const raw = String(content || '')
  if (!raw.trim()) return raw
  if (/^##\s+My Actions\b/im.test(raw)) return raw
  return `${raw.trimEnd()}\n\n${WRITER_ACTIONS_SECTION}\n_Personal actions routed from first-person notes._\n`
}

// Folders that get a + button
export const PLUS_FOLDERS = new Set(['inbox', 'projects', 'people', 'ideas', 'notes', 'archive'])

export function hasPlus(folderName) {
  return PLUS_FOLDERS.has(folderName.toLowerCase())
}

export function generateFile(folder, name, options = {}) {
  const today = todayISO()
  const slug  = toSlug(name) || 'Untitled'

  switch (folder.toLowerCase()) {

    case 'projects':
      return {
        slug,
        content:
`---
type: project
name: ${name}
status: Untriaged
domain: 
owner: 
core_problem: 
last_updated: ${today}
---

## Current Plan
_What's the current approach and the immediate next step?_


## Open Actions


## Delegations


## Decisions


## Recent Mentions
_Populated by AI._

## Notes
_Observations, raw thoughts, context. AI will use this to keep the project current._
`,
      }

    case 'people':
      const relationship = String(options.relationship || '').trim()
      const role = String(options.role || '').trim()
      return {
        slug,
        content:
`---
type: person
full_name: ${name}
relationship: ${relationship}
role: ${role}
last_updated: ${today}
---

## Related Projects


## Talk About


## Delegate


## My Actions


## Recent Mentions
_Populated by AI._


## Notes
_Observations, context, anything worth remembering about this person._
`,
      }

    case 'ideas':
      return {
        slug,
        content:
`---
type: idea
domain: 
status: Spark
origin: ${today}
related_projects: []
related_people: []
tags: []
last_updated: ${today}
---

## Summary
_What is this idea in one paragraph?_

## Problem It Solves
_What specific problem or gap does this address?_

## Next Step
_What's the smallest action to move this forward?_

## Notes
_Raw thoughts, links, context. AI will refine Summary from this._
`,
      }

    case 'notes':
      return {
        slug,
        content:
`---
type: note
last_updated: ${today}
---

# ${name}

## Summary

## Key Points

## Actions
`,
      }

    default:
      return { slug, content: `# ${name}\n\n` }
  }
}
