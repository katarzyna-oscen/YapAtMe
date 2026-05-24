// Parse, serialize, and rebuild YAML frontmatter.
// Values supported: strings, booleans, inline arrays ([a, b, c]).

import { todayISO } from './templates'

const DATE_AUTO_FIELDS = ['last_updated', 'origin']

// ── Parse ─────────────────────────────────────────────────────────────────

function parseSimpleYAML(yaml) {
  const result = {}
  for (const line of yaml.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const raw = line.slice(colon + 1).trim()
    if (!key) continue

    if (raw === 'true')        result[key] = true
    else if (raw === 'false')  result[key] = false
    else if (raw.startsWith('[') && raw.endsWith(']')) {
      const inner = raw.slice(1, -1).trim()
      result[key] = inner ? inner.split(',').map(s => s.trim()).filter(Boolean) : []
    } else {
      result[key] = raw     // plain string, may be empty
    }
  }
  return result
}

// Returns { fields: object|null, body: string }
export function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { fields: null, body: content }
  const end = content.indexOf('\n---', 3)
  if (end === -1)              return { fields: null, body: content }

  const yaml = content.slice(4, end)
  const body = content.slice(end + 4).replace(/^\n/, '')
  return { fields: parseSimpleYAML(yaml), body }
}

// ── Serialize ─────────────────────────────────────────────────────────────

function serializeSimpleYAML(fields) {
  return Object.entries(fields)
    .map(([k, v]) => {
      if (typeof v === 'boolean') return `${k}: ${v}`
      if (Array.isArray(v))       return `${k}: [${v.join(', ')}]`
      return `${k}: ${v ?? ''}`
    })
    .join('\n')
}

// Combine fields + body back into a complete file string
export function buildFileContent(fields, body) {
  if (!fields) return body
  return `---\n${serializeSimpleYAML(fields)}\n---\n\n${body}`
}

// Return a copy of fields with auto-managed date fields bumped to today
export function autoUpdateDates(fields) {
  const today   = todayISO()
  const updated = { ...fields }
  for (const f of DATE_AUTO_FIELDS) {
    if (f in updated) updated[f] = today
  }
  return updated
}
