import { useState, useCallback } from 'react'
import { callLLM } from '../lib/llm'
import { MODULE_REGISTRY } from '../lib/modules'
import { toSlug } from '../lib/templates'
import { autoLinkKnownMentions } from '../lib/wikilinks'

const MARKER_SYNONYMS = {
  todo: 'action',
  task: 'action',
  tasks: 'action',
  note: 'mention',
  mentions: 'mention',
  decision: 'decision',
  decisions: 'decision',
  urgent: 'urgent',
  important: 'important',
  priority: 'important',
  'high-priority': 'important',
  followup: 'follow-up',
  'follow-up': 'follow-up',
}

function normalizeMarker(marker) {
  const raw = String(marker || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
  return MARKER_SYNONYMS[raw] || raw
}

function inferMarkerFromChange(change) {
  const text = `${change?.title || ''} ${change?.content || ''}`.toLowerCase()
  if (!text.trim()) return 'mention'
  if (/\b(urgent|asap|immediately|critical|blocker)\b/.test(text)) return 'urgent'
  if (/\b(important|high-priority|priority)\b/.test(text)) return 'important'
  if (/\b(decision|decide|decided|agreed|resolved)\b/.test(text)) return 'decision'
  if (/\b(follow\s*up|check\s*in|ping\b|circle\s*back|discuss|want\s+to\s+talk|need\s+to\s+talk|touch\s+base)\b/.test(text)) return 'follow-up'
  if (/\b(delegate|assigned\s+to|ask\s+[^.]+\s+to|need\s+to\s+tell|needs\s+to)\b/.test(text)) return 'delegate'
  if (/^-\s*\[[ x]\]/i.test(String(change?.content || '')) || /\b(todo|task|action item|next step)\b/.test(text)) return 'action'
  return 'mention'
}

function resolveModule(change) {
  const moduleId = String(change?.module || '').trim().toLowerCase()
  if (moduleId) {
    const byId = MODULE_REGISTRY.find((m) => m.id === moduleId)
    if (byId) return byId
  }

  const folder = String(change?.target_file || '').split('/')[0]?.toLowerCase()
  if (!folder) return null
  return MODULE_REGISTRY.find((m) => m.vaultFolder === folder || m.id === folder) || null
}

function resolveTargetSection(moduleDef, marker, fallbackSection) {
  const rules = moduleDef?.matchRules || []
  if (rules.length === 0) return fallbackSection || '## Notes'

  const byMarker = new Map(rules.map((rule) => [normalizeMarker(rule.marker), rule.targetSection]))

  // 1) Exact marker match always wins.
  const direct = byMarker.get(marker)
  if (direct) return direct

  // 2) Priority-like markers map to action section when available.
  if (marker === 'urgent' || marker === 'important' || marker === 'priority') {
    if (byMarker.has('action')) return byMarker.get('action')
    if (byMarker.has('follow-up')) return byMarker.get('follow-up')
    if (byMarker.has('mention')) return byMarker.get('mention')
  }

  // 3) Task-ish and decision-ish markers degrade safely.
  if (marker === 'action' && byMarker.has('mention')) return byMarker.get('mention')
  if (marker === 'decision' && byMarker.has('mention')) return byMarker.get('mention')
  if (marker === 'delegate' && byMarker.has('follow-up')) return byMarker.get('follow-up')

  // 4) Never trust arbitrary LLM section names for known modules.
  if (byMarker.has('mention')) return byMarker.get('mention')
  return rules[0].targetSection || '## Notes'
}

function buildSystemPrompt(allowedFiles, enabledModules = {}) {
  const activeModules = MODULE_REGISTRY.filter((moduleDef) => enabledModules[moduleDef.id] !== false)
  const moduleList = activeModules.map((moduleDef) => `${moduleDef.id}: folder=${moduleDef.vaultFolder}`).join(', ')

  return `You route note fragments into a personal knowledge vault.

Return STRICT JSON with shape:
{
  "annotated_note": "string",
  "changes": [
    {
      "target_file": "projects/example.md",
      "target_section": "## Open Actions",
      "content": "- [ ] task text",
      "marker": "action",
      "title": "task text",
      "module": "projects"
    }
  ],
  "unknown_entities": [
    {"type": "project|person|idea", "name": "string"}
  ]
}

Only use target files from this allow list:
${allowedFiles.length ? allowedFiles.join('\n') : '(none)'}

Active modules:
${moduleList || '(none)'}

Rules:
- Use only the content of the current note. Do not use or infer facts from any other vault note, context summary, or prior responses.
- You may match names mentioned in the current note against filenames from the allow list, but only to detect whether an existing person/project/idea file already exists. Do not infer any file contents.
- If the note is empty or has no actionable content, return the note unchanged with an empty changes array and empty unknown_entities.
- Keep annotated_note as markdown.
- Keep changes concise and specific.
- For changes targeting "## Recent Mentions": content must follow this exact format:
  "DD-MM-YYYY — [one sentence describing what was discussed, decided, or referenced]. Source: [noteFilename]"
  Extract the date from the note filename (inbox/YYYY-MM-DD.md) and reformat it as DD-MM-YYYY. Never return just a date with no sentence after the dash.
- Use marker values that match intent: action, decision, mention, delegate, follow-up, urgent, important.
- If text explicitly says urgent/important/ASAP, preserve that in marker (urgent or important), not plain action.
- target_section must be one of the standard sections for the target module/file. Never invent headings.
- For people files: use marker=follow-up when you want to discuss, talk about, or check in with the person. Use marker=delegate when you are assigning a task *to* that person for them to do.
- If a file does not exist, return it as unknown_entities instead of inventing a file.
`
}

function buildUserPrompt({ noteContent, noteFilename }) {
  return `Current note file: ${noteFilename}\n\nCurrent note markdown:\n${noteContent}`
}

function hasMeaningfulNoteContent(noteContent) {
  const text = String(noteContent || '')
    .replace(/^\s*#\s+.+$/gm, ' ')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > 0
}

function normalizeNestedWikilinks(text) {
  let out = String(text || '')
  for (let i = 0; i < 4; i += 1) {
    const next = out
      .replace(/\[\[\[\[\s*([^\]]+?)\s*\]\]\]\]/g, '[[$1]]')
      .replace(/\[\[\[\s*([^\]]+?)\s*\]\]\]/g, '[[$1]]')
      .replace(/\[{4,}\s*([^\]]+?)\s*\]{4,}/g, '[[$1]]')
    if (next === out) break
    out = next
  }
  return out
}

function extractPromptTerms(text) {
  const source = String(text || '')
  const terms = new Set()

  const wikiMatches = source.match(/\[\[[^\]]+\]\]/g) || []
  for (const m of wikiMatches) {
    const inner = m.replace(/^\[\[/, '').replace(/\]\]$/, '').trim().toLowerCase()
    if (inner) terms.add(inner)
  }

  const simpleWords = source
    .toLowerCase()
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)

  for (const w of simpleWords.slice(0, 40)) terms.add(w)
  return [...terms]
}

function selectPromptAllowList(noteContent, allowedFiles) {
  const files = allowedFiles || []
  if (files.length <= 40) return files

  const terms = extractPromptTerms(noteContent)
  const matched = []
  for (const path of files) {
    const base = String(path || '').toLowerCase().replace(/\.md$/i, '')
    if (terms.some((term) => base.includes(term))) {
      matched.push(path)
      if (matched.length >= 40) break
    }
  }

  if (matched.length >= 10) return matched

  const folderPriority = ['people/', 'projects/', 'ideas/', 'notes/']
  const padded = [...matched]
  for (const prefix of folderPriority) {
    for (const path of files) {
      if (padded.length >= 40) break
      if (!String(path).toLowerCase().startsWith(prefix)) continue
      if (!padded.includes(path)) padded.push(path)
    }
    if (padded.length >= 40) break
  }

  return padded.length > 0 ? padded : files.slice(0, 40)
}

function guessPersonName(noteContent) {
  const wiki = String(noteContent || '').match(/\[\[([^\]]+)\]\]/)
  if (wiki?.[1]) return wiki[1].trim()

  const byWith = String(noteContent || '').match(/\b(?:with|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/)
  if (byWith?.[1]) return byWith[1].trim()
  return ''
}

function findPeoplePathByName(name, allowedFiles) {
  if (!name) return null
  const needle = String(name).trim().toLowerCase()
  const peopleFiles = (allowedFiles || []).filter((path) => String(path).toLowerCase().startsWith('people/'))
  for (const path of peopleFiles) {
    const base = String(path).split('/').pop()?.replace(/\.md$/i, '').toLowerCase() || ''
    if (!base) continue
    if (base === needle || base.includes(needle) || needle.includes(base)) return path
  }
  return null
}

function tryFastRouteShortNote(noteContent, noteFilename, allowedFiles = []) {
  const normalized = normalizeNestedWikilinks(String(noteContent || '').trim())
  if (!normalized) return null

  const compact = normalized.replace(/\s+/g, ' ').trim()
  if (compact.length > 190) return null

  const lower = compact.toLowerCase()
  const discussIntent = /\b(discuss|talk\s+to|talk\s+about|call\s+with|check\s+in|follow\s*up|touch\s+base|ping)\b/.test(lower)
  const delegateIntent = /\b(delegate|ask\s+[^.]+\s+to|needs?\s+to|assign\s+to)\b/.test(lower)
  if (!discussIntent && !delegateIntent) return null

  const guessedName = guessPersonName(compact)
  if (!guessedName) return null

  const targetPath = findPeoplePathByName(guessedName, allowedFiles)
  const isUrgent = /\b(urgent|asap|immediately|critical|blocker)\b/.test(lower)
  const isImportant = /\b(important|priority|high-priority|high priority)\b/.test(lower)
  const marker = delegateIntent && !discussIntent ? 'delegate' : (isUrgent ? 'urgent' : (isImportant ? 'important' : 'follow-up'))
  const section = delegateIntent && !discussIntent ? '## Delegate' : '## Talk About'
  const title = normalizeNestedWikilinks(compact)
  const tagSuffix = isUrgent ? ' #urgent' : (isImportant ? ' #important' : '')

  return {
    annotated_note: normalizeNestedWikilinks(noteContent),
    changes: targetPath ? [{
      id: crypto.randomUUID?.() || `${Date.now()}-fast`,
      target_file: targetPath,
      target_section: section,
      content: `- [ ] ${title}${tagSuffix}`,
      marker,
      title,
      module: 'people',
    }] : [],
    unknown_entities: targetPath ? [] : [{ type: 'person', name: guessedName }],
    _fastPath: true,
    _note: noteFilename,
  }
}

function safeParseJSON(raw) {
  const text = String(raw || '').trim()
  if (!text) throw new Error('LLM returned empty response')

  const direct = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    return JSON.parse(direct)
  } catch {}

  // If the model wrapped JSON with prose, extract the first top-level JSON object.
  const start = text.indexOf('{')
  if (start !== -1) {
    let depth = 0
    let inString = false
    let escape = false

    for (let i = start; i < text.length; i += 1) {
      const ch = text[i]

      if (inString) {
        if (escape) {
          escape = false
        } else if (ch === '\\') {
          escape = true
        } else if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === '{') depth += 1
      if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          const candidate = text.slice(start, i + 1)
          try {
            return JSON.parse(candidate)
          } catch {
            break
          }
        }
      }
    }
  }

  throw new Error(`Invalid JSON from LLM: ${text.slice(0, 160)}`)
}

function folderForEntityType(type) {
  const t = String(type || '').trim().toLowerCase()
  if (t === 'person' || t === 'people') return 'people'
  if (t === 'project' || t === 'projects') return 'projects'
  if (t === 'idea' || t === 'ideas') return 'ideas'
  return null
}

function entityCandidatePaths(entity) {
  const folder = folderForEntityType(entity?.type)
  const name = String(entity?.name || '').trim()
  if (!folder || !name) return []

  const slug = toSlug(name)
  const candidates = [
    `${folder}/${name}.md`,
    `${folder}/${slug}.md`,
  ]

  // Deduplicate while preserving order.
  return [...new Set(candidates)]
}

function splitIntoSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .match(/[^.!?\n]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || []
}

function escapeRegex(source) {
  return String(source || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function peoplePathToName(path) {
  const filename = String(path || '').split('/').pop() || ''
  return filename.replace(/\.md$/i, '').trim()
}

function hasMatchingPeopleChange(changes, personPath, sentence) {
  const pathNeedle = String(personPath || '').toLowerCase()
  const sentenceNorm = normalizeTaskText(sentence)
  return (changes || []).some((change) => {
    if (String(change?.target_file || '').toLowerCase() !== pathNeedle) return false
    const titleNorm = normalizeTaskText(change?.title || '')
    const contentNorm = normalizeTaskText(change?.content || '')
    const titleScore = similarityScore(sentenceNorm, titleNorm)
    const contentScore = similarityScore(sentenceNorm, contentNorm)
    const containsTitle = sentenceNorm.length >= 12 && (sentenceNorm.includes(titleNorm) || titleNorm.includes(sentenceNorm))
    const containsContent = sentenceNorm.length >= 12 && (sentenceNorm.includes(contentNorm) || contentNorm.includes(sentenceNorm))
    return titleScore >= 0.52 || contentScore >= 0.52 || containsTitle || containsContent
  })
}

function normalizeTaskText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\[\[|\]\]/g, '')
    .replace(/^-\s*\[[ x]\]\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarityScore(a, b) {
  const aTokens = new Set(normalizeTaskText(a).split(' ').filter(Boolean))
  const bTokens = new Set(normalizeTaskText(b).split(' ').filter(Boolean))
  if (aTokens.size === 0 || bTokens.size === 0) return 0

  let intersection = 0
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1
  }
  const union = aTokens.size + bTokens.size - intersection
  return union > 0 ? intersection / union : 0
}

function dedupeChanges(changes = []) {
  const kept = []

  for (const change of changes) {
    const path = String(change?.target_file || '').toLowerCase()
    const marker = normalizeMarker(change?.marker)
    const textA = change?.title || change?.content || ''

    const duplicateIdx = kept.findIndex((existing) => {
      const samePath = String(existing?.target_file || '').toLowerCase() === path
      if (!samePath) return false

      const markerA = marker
      const markerB = normalizeMarker(existing?.marker)
      const sameMarkerFamily = markerA === markerB || (['delegate', 'follow-up'].includes(markerA) && ['delegate', 'follow-up'].includes(markerB))
      if (!sameMarkerFamily) return false

      const textB = existing?.title || existing?.content || ''
      const normA = normalizeTaskText(textA)
      const normB = normalizeTaskText(textB)
      const score = similarityScore(normA, normB)
      const containment = normA.length >= 12 && normB.length >= 12 && (normA.includes(normB) || normB.includes(normA))
      return score >= 0.52 || containment
    })

    if (duplicateIdx === -1) {
      kept.push(change)
      continue
    }

    const existing = kept[duplicateIdx]
    const preferCurrent = String(change?.content || '').length > String(existing?.content || '').length
    if (preferCurrent) kept[duplicateIdx] = change
  }

  return kept
}

function markerFamily(marker) {
  const m = normalizeMarker(marker)
  if (m === 'delegate' || m === 'follow-up') return 'people-action'
  return m
}

function matchChangeToSentence(change, sentences = []) {
  const source = normalizeTaskText(change?.title || change?.content || '')
  if (!source || sentences.length === 0) return { index: -1, score: 0 }

  let bestIndex = -1
  let bestScore = 0
  for (let i = 0; i < sentences.length; i += 1) {
    const score = similarityScore(source, sentences[i])
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }
  return { index: bestIndex, score: bestScore }
}

function preferRank(change, matchScore) {
  const text = `${change?.title || ''} ${change?.content || ''}`
  const hasWiki = /\[\[[^\]]+\]\]/.test(text)
  const hasCheckbox = /^-\s*\[[ x]\]/i.test(String(change?.content || ''))
  return (hasWiki ? 100 : 0) + (hasCheckbox ? 20 : 0) + Math.round(matchScore * 1000)
}

function dedupePeopleBySourceSentence(changes = [], noteContent = '') {
  const sentenceNorms = splitIntoSentences(noteContent).map((s) => normalizeTaskText(s))
  if (sentenceNorms.length === 0) return changes

  const peopleIndexes = []
  const metadata = new Map()

  changes.forEach((change, idx) => {
    const isPeople = String(change?.target_file || '').toLowerCase().startsWith('people/')
    if (!isPeople) return
    peopleIndexes.push(idx)
    const match = matchChangeToSentence(change, sentenceNorms)
    metadata.set(idx, {
      family: markerFamily(change?.marker),
      path: String(change?.target_file || '').toLowerCase(),
      sentenceIndex: match.score >= 0.22 ? match.index : -1,
      score: match.score,
      rank: preferRank(change, match.score),
    })
  })

  const keep = new Set(changes.map((_c, idx) => idx))

  const matchedKeyHasEntries = new Set()
  for (const idx of peopleIndexes) {
    const m = metadata.get(idx)
    if (!m) continue
    if (m.sentenceIndex >= 0) {
      matchedKeyHasEntries.add(`${m.path}|${m.family}`)
    }
  }

  // If we already have sentence-anchored entries for a person+intent, drop generic unmatched summaries.
  for (const idx of peopleIndexes) {
    const m = metadata.get(idx)
    if (!m) continue
    if (m.sentenceIndex >= 0) continue
    if (matchedKeyHasEntries.has(`${m.path}|${m.family}`)) {
      keep.delete(idx)
    }
  }

  // For each person+intent+sentence, keep only the highest-ranked candidate.
  const bestByGroup = new Map()
  for (const idx of peopleIndexes) {
    if (!keep.has(idx)) continue
    const m = metadata.get(idx)
    if (!m || m.sentenceIndex < 0) continue
    const key = `${m.path}|${m.family}|${m.sentenceIndex}`
    const current = bestByGroup.get(key)
    if (!current || m.rank > current.rank) {
      bestByGroup.set(key, { idx, rank: m.rank })
    }
  }

  const winnerIdx = new Set(Array.from(bestByGroup.values()).map((v) => v.idx))
  for (const idx of peopleIndexes) {
    if (!keep.has(idx)) continue
    const m = metadata.get(idx)
    if (!m || m.sentenceIndex < 0) continue
    if (!winnerIdx.has(idx)) keep.delete(idx)
  }

  return changes.filter((_change, idx) => keep.has(idx))
}

function synthesizePeopleDelegates(noteContent, allowedFiles, existingChanges = []) {
  const peopleFiles = (allowedFiles || []).filter((path) => String(path).toLowerCase().startsWith('people/') && String(path).toLowerCase().endsWith('.md'))
  if (peopleFiles.length === 0) return []

  const sentences = splitIntoSentences(noteContent)
  if (sentences.length === 0) return []

  const synthesized = []

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase()
    const delegateLike = /\b(needs\s+to|need\s+to\s+tell|have\s+to\s+talk\s+to|delegate\s+to|ask\s+[^.]+\s+to)\b/.test(lowerSentence)
    const discussLike = /\b(discuss|talk\s+to|talk\s+about|touch\s+base|check\s+in|follow\s*up|circle\s*back)\b/.test(lowerSentence)
    if (!delegateLike && !discussLike) continue
    const urgentLike = /\b(urgent|asap|immediately|critical|blocker)\b/.test(lowerSentence)
    const useTalkAbout = (discussLike && !delegateLike) || urgentLike

    for (const personPath of peopleFiles) {
      const personName = peoplePathToName(personPath)
      if (!personName) continue

      const nameRx = new RegExp(`(^|[^a-z0-9])${escapeRegex(personName.toLowerCase())}([^a-z0-9]|$)`, 'i')
      if (!nameRx.test(lowerSentence)) continue

      if (hasMatchingPeopleChange(existingChanges, personPath, sentence) || hasMatchingPeopleChange(synthesized, personPath, sentence)) {
        continue
      }

      synthesized.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${synthesized.length}`,
        target_file: personPath,
        target_section: useTalkAbout ? '## Talk About' : '## Delegate',
        content: `- [ ] ${sentence}`,
        marker: useTalkAbout ? 'follow-up' : 'delegate',
        title: sentence,
        module: 'people',
      })
    }
  }

  return synthesized
}

function synthesizeUnknownPeopleChanges(noteContent, unknownEntities, existingChanges = []) {
  const unknownPeople = (unknownEntities || []).filter(
    (entity) => String(entity?.type || '').toLowerCase() === 'person' || String(entity?.type || '').toLowerCase() === 'people'
  )
  if (unknownPeople.length === 0) return []

  const sentences = splitIntoSentences(noteContent)
  if (sentences.length === 0) return []

  const synthesized = []

  for (const entity of unknownPeople) {
    const name = String(entity?.name || '').trim()
    if (!name) continue

    const candidatePaths = entityCandidatePaths(entity)
    const personPath = candidatePaths[0] // use the primary candidate path
    if (!personPath) continue

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      const nameRx = new RegExp(`(^|[^a-z0-9])${escapeRegex(name.toLowerCase())}([^a-z0-9]|$)`, 'i')
      if (!nameRx.test(lowerSentence)) continue

      const discussLike = /\b(discuss|talk\s+to|talk\s+about|touch\s+base|check\s+in|follow\s*up|circle\s*back)\b/.test(lowerSentence)
      const delegateLike = /\b(needs\s+to|need\s+to\s+tell|have\s+to\s+talk\s+to|delegate\s+to|ask\s+[^.]+\s+to)\b/.test(lowerSentence)
      const urgentLike = /\b(urgent|asap|immediately|critical|blocker)\b/.test(lowerSentence)
      const importantLike = /\b(important|high-priority|priority)\b/.test(lowerSentence)

      if (!discussLike && !delegateLike && !importantLike && !urgentLike) continue

      if (hasMatchingPeopleChange(existingChanges, personPath, sentence) || hasMatchingPeopleChange(synthesized, personPath, sentence)) {
        continue
      }

      const useTalkAbout = (discussLike && !delegateLike) || urgentLike
      const marker = useTalkAbout ? 'follow-up' : 'delegate'
      const extraTags = importantLike ? ['important'] : urgentLike ? ['urgent'] : []

      synthesized.push({
        id: crypto.randomUUID?.() || `${Date.now()}-${synthesized.length}`,
        target_file: personPath,
        target_section: useTalkAbout ? '## Talk About' : '## Delegate',
        content: `- [ ] ${sentence}`,
        marker,
        extraTags,
        title: sentence,
        module: 'people',
      })
    }
  }

  return synthesized
}

export function useNoteProcessor() {
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
  }, [])

  const process = useCallback(async ({ noteContent, noteFilename, contextContent, allowedFiles = [], settings, enabledModules = {} }) => {
    setStatus('loading')
    setError(null)

    try {
      const enabledFolders = MODULE_REGISTRY
        .filter((moduleDef) => enabledModules[moduleDef.id] !== false)
        .map((moduleDef) => moduleDef.vaultFolder)

      const scopedAllowedFiles = (allowedFiles || []).filter((path) => enabledFolders.includes(String(path || '').split('/')[0]))

      const linkableFolders = enabledFolders.filter((folder) => folder === 'people' || folder === 'projects')
      const linkedNoteContent = normalizeNestedWikilinks(autoLinkKnownMentions(noteContent, scopedAllowedFiles, linkableFolders))

      if (!hasMeaningfulNoteContent(linkedNoteContent)) {
        const emptyResult = {
          annotated_note: normalizeNestedWikilinks(linkedNoteContent),
          changes: [],
          unknown_entities: [],
        }
        setResult(emptyResult)
        setStatus('success')
        return emptyResult
      }

      const fastResult = tryFastRouteShortNote(linkedNoteContent, noteFilename, scopedAllowedFiles)
      if (fastResult) {
        setResult(fastResult)
        setStatus('success')
        return fastResult
      }

      const promptAllowFiles = selectPromptAllowList(linkedNoteContent, scopedAllowedFiles)

      const raw = await callLLM(
        [{ role: 'user', content: buildUserPrompt({ noteContent: linkedNoteContent, noteFilename }) }],
        buildSystemPrompt(promptAllowFiles, enabledModules),
        settings,
        900
      )

      const parsed = safeParseJSON(raw)
      let hydratedChanges = (parsed.changes || []).map((change, index) => ({
        id: change.id || crypto.randomUUID?.() || `${Date.now()}-${index}`,
        target_file: change.target_file,
        target_section: change.target_section,
        content: normalizeNestedWikilinks(change.content),
        marker: change.marker || 'mention',
        title: normalizeNestedWikilinks(change.title || change.content?.replace(/^- \[[ x]\]\s*/, '') || 'Untitled'),
        module: change.module || (change.target_file?.split('/')[0] || 'other'),
      }))

      const canonicalFileMap = new Map((scopedAllowedFiles || []).map((path) => [String(path).toLowerCase(), path]))

      hydratedChanges = hydratedChanges.map((change) => {
        const canonical = canonicalFileMap.get(String(change.target_file || '').toLowerCase())
        return canonical ? { ...change, target_file: canonical } : change
      })

      hydratedChanges = hydratedChanges.map((change) => {
        const moduleDef = resolveModule(change)
        const inferred = inferMarkerFromChange(change)
        const current = normalizeMarker(change.marker)

        let normalizedMarker = current || inferred
        if (current === 'action' && (inferred === 'urgent' || inferred === 'important')) {
          normalizedMarker = inferred
        } else if (current === 'mention' && inferred !== 'mention') {
          normalizedMarker = inferred
        }

        if (moduleDef?.id === 'people') {
          if (normalizedMarker === 'urgent' || normalizedMarker === 'follow-up') {
            // Discuss / follow-up items belong in Talk About.
            normalizedMarker = 'follow-up'
          } else {
            normalizedMarker = 'delegate'
          }
        }

        const normalizedModule = moduleDef?.id || String(change.module || '').trim().toLowerCase() || 'other'
        const normalizedSection = resolveTargetSection(moduleDef, normalizedMarker, change.target_section)

        return {
          ...change,
          marker: normalizedMarker || 'mention',
          module: normalizedModule,
          target_section: normalizedSection,
        }
      })

      const synthesizedPeopleChanges = synthesizePeopleDelegates(linkedNoteContent, scopedAllowedFiles, hydratedChanges)
      if (synthesizedPeopleChanges.length > 0) {
        hydratedChanges = [...hydratedChanges, ...synthesizedPeopleChanges]
      }

      // Synthesize task changes for unknown entities (files that don't exist yet).
      // This covers the first-run case where the LLM can't emit a change for a missing file.
      const unknownPeopleChanges = synthesizeUnknownPeopleChanges(
        linkedNoteContent,
        parsed.unknown_entities || [],
        hydratedChanges
      )
      if (unknownPeopleChanges.length > 0) {
        hydratedChanges = [...hydratedChanges, ...unknownPeopleChanges]
      }

      hydratedChanges = dedupeChanges(hydratedChanges)
      hydratedChanges = dedupePeopleBySourceSentence(hydratedChanges, noteContent)

      // Build the set of candidate paths for entities that will be created,
      // so we can retain changes targeting those files (first-run task capture).
      const pendingEntityPaths = new Set(
        (parsed.unknown_entities || []).flatMap((entity) =>
          entityCandidatePaths(entity).map((p) => p.toLowerCase())
        )
      )

      if (scopedAllowedFiles.length > 0) {
        const validFiles = new Set(scopedAllowedFiles)
        const rejected = hydratedChanges.filter(
          (change) => !validFiles.has(change.target_file) && !pendingEntityPaths.has(String(change.target_file || '').toLowerCase())
        )

        if (rejected.length > 0) {
          console.warn(
            `Routing validator: rejected ${rejected.length} change(s) to unknown files:`,
            rejected.map((change) => change.target_file)
          )
        }

        hydratedChanges = hydratedChanges.filter(
          (change) => validFiles.has(change.target_file) || pendingEntityPaths.has(String(change.target_file || '').toLowerCase())
        )
      }

      const filteredUnknown = (parsed.unknown_entities || []).filter((entity) => {
        const candidates = entityCandidatePaths(entity)
        if (candidates.length === 0) return true
        return !candidates.some((candidate) => canonicalFileMap.has(candidate.toLowerCase()))
      })

      const hydrated = {
        annotated_note: normalizeNestedWikilinks(autoLinkKnownMentions(parsed.annotated_note || linkedNoteContent, scopedAllowedFiles, linkableFolders)),
        changes: hydratedChanges,
        unknown_entities: filteredUnknown,
      }

      setResult(hydrated)
      setStatus('success')
      return hydrated
    } catch (err) {
      setStatus('error')
      setError(err.message)
      throw err
    }
  }, [])

  return { process, status, result, error, reset }
}
