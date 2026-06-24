import { useState, useCallback } from 'react'
import { callLLM } from '../lib/llm'
import { MODULE_REGISTRY } from '../lib/modules'
import { toSlug, WRITER_ACTIONS_SECTION } from '../lib/templates'
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

function buildEntityReferenceBlock(allowedFiles) {
  const peopleRefs = (allowedFiles || [])
    .filter((path) => String(path).toLowerCase().startsWith('people/') && String(path).toLowerCase().endsWith('.md'))
    .map((path) => `- ${humanizeEntityName(path)} → ${path}`)
  const projectRefs = (allowedFiles || [])
    .filter((path) => String(path).toLowerCase().startsWith('projects/') && String(path).toLowerCase().endsWith('.md'))
    .map((path) => `- ${humanizeEntityName(path)} → ${path}`)
  const ideaRefs = (allowedFiles || [])
    .filter((path) => String(path).toLowerCase().startsWith('ideas/') && String(path).toLowerCase().endsWith('.md') && !path.toLowerCase().endsWith('backlog.md'))
    .map((path) => `- ${humanizeEntityName(path)} → ${path}`)
  return `Known people:\n${peopleRefs.length ? peopleRefs.join('\n') : '- (none)'}\n\nKnown projects:\n${projectRefs.length ? projectRefs.join('\n') : '- (none)'}\n\nKnown ideas:\n${ideaRefs.length ? ideaRefs.join('\n') : '- (none)'}`
}

function buildMentionSystemPrompt(allowedFiles) {
  const entityReferenceBlock = buildEntityReferenceBlock(allowedFiles)
  return `You extract entity mentions from a daily note.

The first line of every inbox note is a date heading formatted as # DD-MM-YYYY.
Always preserve it exactly as-is on its own line, separated from the note body by a blank line.
Never merge the heading with the body text.
Never append body content to the heading line.

For every person, project, or idea referenced by wikilink ([[Name]]), emit one mention change.
One mention per entity per note — never more.

Return STRICT JSON only:
{
  "changes": [
    {
      "target_file": "people/Name.md | projects/Name.md | ideas/Name.md",
      "target_section": "## Recent Mentions",
      "content": "[[DD-MM-YYYY]] — [one concise sentence summary]",
      "marker": "mention",
      "title": "[short label]",
      "module": "people | projects | ideas"
    }
  ]
}

${entityReferenceBlock}

Valid write targets:
${allowedFiles.length ? allowedFiles.join('\n') : '(none)'}

Rules:
- Only emit a mention if the entity's file appears in Valid write targets.
- One mention per wikilinked entity — do not repeat.
- Mention format — content field must be exactly: [[DD-MM-YYYY]] — [one concise sentence summary]
- Where DD-MM-YYYY is today's note date.
- No Source tag and no extra fields.
- Example: [[28-05-2026]] — Approved expense report and laptop order; discussed Friday workshop.
- Entity names containing dots must be preserved verbatim inside wikilinks (example: [[Ubuntu.]]).
- Do not emit tasks, decisions, or any other change type.
- Return { "changes": [] } if there is nothing to mention.
`
}

function buildTaskSystemPrompt(allowedFiles) {
  const entityReferenceBlock = buildEntityReferenceBlock(allowedFiles)
  return `You extract actionable tasks AND ideas from a daily note.

The first line of every inbox note is a date heading formatted as # DD-MM-YYYY.
Always preserve it exactly as-is on its own line, separated from the note body by a blank line.
Never merge the heading with the body text.
Never append body content to the heading line.

Return STRICT JSON only:
{
  "changes": [
    {
      "target_file": "people/Name.md",
      "target_section": "## Talk About",
      "content": "- [ ] [task title]",
      "marker": "follow-up",
      "title": "[task title]",
      "module": "people"
    }
  ]
}

${entityReferenceBlock}

Valid write targets:
${allowedFiles.length ? allowedFiles.join('\n') : '(none)'}

Rules:
- Extract every actionable item AND every idea/concept from the note — do not skip any sentence.
- Generate task changes for ALL actionable sentences, regardless of whether the mentioned person or entity exists in the vault or has a file in the allowed list.
- Narrative recaps are NOT tasks. A sentence that reports something that already happened (past tense: "presented", "shouted", "informed me", "showed", "was furious", "created") is a MENTION, not an action. Do NOT emit a task/action change for it — leave it to the mention pass. Only emit a task when there is a concrete FUTURE action someone still has to do.
  Example: "Gloria presented the campaign materials to Mark and he was furious" → NO task (pure recap). The follow-up "Diana has to present the new T-shirt" → one follow-up on Diana.
  IMPORTANT: the recap rule does NOT apply to ideas. A hypothetical or proposal ("what if we built…", "we could build…", "idea: …") is an IDEA, not a recap — always emit an idea change for it even though it may use a past-tense verb like "built".
- Never route a past-tense recap to the vault owner's actions. "target_file: null → vault owner" applies ONLY to genuine future actions with no identifiable owner, never to recaps.
- One task per actionable item. Never duplicate the same task across multiple people.
- Each task has exactly one owner — the person who must act or decide.
  Do not fan out one task to every person mentioned in a sentence.
  Example: "Diana questioned whether Lyubo should attend" → one follow-up on Diana.md only.
- If a sentence contains a clear action, follow-up, or delegation but no person in the vault can be identified as owner, generate the change with target_file: null and module: "unattached". Do not skip the sentence. It will be routed to the vault owner automatically.
- First-person items ("I need to...", "I will...", "I should...") are tasks with no specific person owner — output them with target_file: null and module: "unattached". They will be routed to the vault owner automatically.
- You do not require [[wikilink]] syntax to identify actionable content. Plain text person names are sufficient to extract a task.
- Task title: concise imperative phrase, 10 words max, no raw sentences copied from the note.
- Markers (mutually exclusive per item — pick one):
  action    = the writer must do something
  follow-up = the writer needs to raise something with, or get input/approval from, a specific person
  delegate  = another person must do or decide something
  decision  = an open question about a project or topic where the decision-maker is NOT a named person in the vault
  idea      = a new creative concept, feature proposal, or exploration thought that has not been captured as a named idea yet
- Decision vs follow-up distinction (critical):
  "needs Diana's decision" / "waiting for Diana's approval" / "Diana needs to decide" → follow-up on Diana, NOT a decision marker.
  Use decision ONLY when no named person in the vault is the decision-maker (e.g. "we still need to decide the launch date").
  NEVER emit a decision change targeting a people/ file. Decisions only go on project files.
- Decision routing rule: decisions belong on PROJECT files, not person files. If a decision involves both a person and a project, route it to the project file. People files do not have a Decisions section. If no project file is identifiable, output target_file: null and module: "unattached".
- Do not include "- [ ]" in task content. Return plain task text in content and title.
- Idea marker rules:
  ALWAYS emit an idea change for any sentence that proposes, imagines, or explores a new concept, feature, or workflow improvement — even if the writer is not committing to it.
  Phrases like "been thinking about", "want to explore", "idea:", "what if", "could be interesting" are strong signals.
  Do NOT skip ideas just because they feel speculative — capture them all.
  Route idea markers to: target_file: ideas/backlog.md, target_section: ## Backlog, module: ideas.
  Content format for ideas: [[DD-MM-YYYY]] — [one sentence describing the idea]
  Where DD-MM-YYYY is today's note date.
- Sections by marker:
  follow-up → ## Talk About
  delegate  → ## Delegate
  action    → ## Open Actions (projects) or ## Talk About (people)
  decision  → ## Decisions
  idea      → ideas/backlog.md > ## Backlog
- Few-shot examples:
  Input: "I need to talk with Sophie about weather in Berlin."
  Output:
  {
    "target_file": "people/Sophie.md",
    "target_section": "## Talk About",
    "content": "Talk about Berlin weather",
    "marker": "follow-up",
    "title": "Talk about Berlin weather",
    "module": "people"
  }
  (Reason: "talk with X about Y" means the writer needs to raise this with X → follow-up on X's Talk About, NOT an action on the vault owner.)

  Input: "I need to prioritise my calendar this week."
  Output:
  {
    "target_file": null,
    "target_section": "## Open Actions",
    "content": "Prioritise calendar this week",
    "marker": "action",
    "title": "Prioritise calendar this week",
    "module": "unattached"
  }
  (Reason: pure first-person self-action with no other person to discuss with → action on null/owner.)

  Input: "Gloria presented the campaign materials to Mark and he was furious about the visuals Isaac created."
  Output:
  { "changes": [] }
  (Reason: this is a past-tense recap of what already happened — no future action for anyone. The mention pass records it; the task pass emits nothing. Do NOT route this to the vault owner.)

  Input: "Been thinking about a voice shortcut that drops a note directly into inbox."
  Output:
  {
    "target_file": "ideas/backlog.md",
    "target_section": "## Backlog",
    "content": "[[DD-MM-YYYY]] — Voice shortcut that drops a spoken note directly into inbox",
    "marker": "idea",
    "title": "Voice shortcut to inbox",
    "module": "ideas"
  }
- Only emit changes targeting files in Valid write targets.
- Exception 1: when target_file is null and module is "unattached", the change is valid even without a matching file in Valid write targets.
- Exception 2: idea marker changes targeting ideas/backlog.md are ALWAYS valid regardless of whether ideas/backlog.md appears in Valid write targets.
- Return { "changes": [] } if there is nothing actionable and no ideas.
`
}

function buildUserPrompt({ noteContent, noteFilename, contextContent }) {
  const ctx = String(contextContent || '').trim()
  if (ctx) {
    return `Current note file: ${noteFilename}\n\nCurrent working context (_context.md):\n${ctx}\n\nCurrent note:\n${noteContent}`
  }
  return `Current note file: ${noteFilename}\n\nCurrent note:\n${noteContent}`
}

function hasMeaningfulNoteContent(noteContent) {
  const text = String(noteContent || '')
    .replace(/^\s*#\s+(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})\s*$/gm, ' ')
    .replace(/^\s*#\s+(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})\s+/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > 20
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

function humanizeEntityName(path) {
  const base = String(path || '').split('/').pop()?.replace(/\.md$/i, '') || ''
  const raw = base.replace(/[-_]+/g, ' ').trim()
  if (!raw) return ''
  return raw
    .split(/\s+/)
    .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

function normalizeEntityCandidate(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ensureEntityWikilink(text, entityName) {
  const source = String(text || '')
  const name = String(entityName || '').trim()
  if (!source || !name) return source

  const linked = source.match(/\[\[([^\]]+)\]\]/g) || []
  const alreadyLinked = linked.some((entry) => {
    const inner = entry.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim().toLowerCase()
    return inner === name.toLowerCase()
  })
  if (alreadyLinked) return source

  const rx = new RegExp(`(?<!\\[\\[)\\b${escapeRegex(name)}\\b(?!\\]\\])`, 'gi')
  if (!rx.test(source)) return source
  rx.lastIndex = 0
  return source.replace(rx, (match) => `[[${match}]]`)
}

function extractEntityCandidates(noteContent) {
  const text = String(noteContent || '')
  const buckets = new Map()

  // 1. Extract from wikilinks
  const wiki = text.match(/\[\[[^\]]+\]\]/g) || []
  for (const entry of wiki) {
    const inner = entry.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim()
    if (!inner) continue
    const key = inner.toLowerCase()
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(inner)
  }

  // 2. Extract names from explicit person-name contexts.
  // Strong person verbs (met/called/told/asked/emailed/pinged/talked to/spoke) are a
  // reliable person signal, so we allow lowercase here to catch dictated names like
  // "met with valerio". Generic prepositions (with/to/from/and) stay capital-only —
  // they are too common to risk on lowercase words.
  const STOP_WORDS = new Set([
    'the', 'this', 'that', 'then', 'them', 'they', 'their', 'there', 'these', 'those',
    'today', 'tomorrow', 'tuesday', 'thursday', 'wednesday', 'monday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    'quick', 'some', 'about', 'also', 'just', 'very', 'much', 'many', 'more', 'most',
    'make', 'made', 'meet', 'figure', 'discuss', 'check', 'show', 'create', 'brief', 'me', 'it', 'do', 'be', 'get', 'go',
    'work', 'set', 'use', 'help', 'see', 'find', 'next', 'new', 'his', 'her', 'our', 'your', 'light', 'dark', 'later', 'mostly',
  ])
  const addCandidate = (raw) => {
    let candidate = String(raw || '').trim()
    if (!candidate || candidate.length < 2) return
    if (STOP_WORDS.has(candidate.toLowerCase())) return
    // Capitalize each word for consistency (e.g. "valerio" → "Valerio")
    candidate = candidate.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const key = candidate.toLowerCase()
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(candidate)
  }

  // 2a. Strong person verbs — allow lowercase first word (dictated names).
  const STRONG_NAME_RE = /\b(?:met(?:\s+with)?|called|told|asked|emailed|pinged|talked\s+to|spoke\s+(?:to|with)|spoke)\s+([A-Za-z][\w\u00C0-\u017E]+(?:\s+[A-Z][\w\u00C0-\u017E]+){0,2})/gu
  for (const match of text.matchAll(STRONG_NAME_RE)) {
    addCandidate(match[1])
  }

  // 2b. Generic prepositions — capital-only to avoid common words.
  const NAME_CONTEXT_RE = /\b(?:with|and|to|from|cc|via)\s+([A-Z][\w\u00C0-\u017E]+(?:\s+[A-Z][\w\u00C0-\u017E]+){0,2})/gu
  for (const match of text.matchAll(NAME_CONTEXT_RE)) {
    addCandidate(match[1])
  }

  // 2c. Conjunction lists: "Paweł and Alorah", "Alex, Maria and Sam" — capture BOTH sides.
  // The NAME_CONTEXT rule only grabs the word after "and", so the word before is missed.
  // Capital-only: lowercase here would flag everyday "<word> and <word>" pairs.
  const CONJ_RE = /\b([A-Z][\w\u00C0-\u017E]+)\s*(?:,|and|&)\s*([A-Z][\w\u00C0-\u017E]+)\b/gu
  for (const match of text.matchAll(CONJ_RE)) {
    addCandidate(match[1])
    addCandidate(match[2])
  }

  // 2d. Relative clauses: "that Isaac created", "which Diana prepared".
  // This catches names that are not preceded by the context triggers above.
  const RELATIVE_RE = /\b(?:that|which|who)\s+([A-Z][\w\u00C0-\u017E]+(?:\s+[A-Z][\w\u00C0-\u017E]+){0,2})\s+(?:created|made|built|designed|prepared|presented|informed|shared|sent|wrote|drafted|reviewed|approved|updated|changed|did)\b/gu
  for (const match of text.matchAll(RELATIVE_RE)) {
    addCandidate(match[1])
  }

  // 3. Extract names from possessive form (e.g. "Diana's decision", "Paweł's report")
  const POSSESSIVE_RE = /\b([A-Z][\w\u00C0-\u017E]+(?:\s+[A-Z][\w\u00C0-\u017E]+)?)['\u2019]s\b/gu
  for (const match of text.matchAll(POSSESSIVE_RE)) {
    addCandidate(match[1])
  }

  const unique = [...buckets.values()].map((values) =>
    values.sort((a, b) => a.length - b.length)[0]
  )

  // Keep shortest candidate when two names share the first word (e.g. "Acme" vs "Acme Core").
  unique.sort((a, b) => a.length - b.length)
  const firstWordSeen = new Set()
  const deduped = []
  for (const candidate of unique) {
    const firstWord = String(candidate || '').trim().split(/\s+/)[0]?.toLowerCase()
    if (!firstWord) continue
    if (firstWordSeen.has(firstWord)) continue
    firstWordSeen.add(firstWord)
    deduped.push(candidate)
  }

  return deduped
}

function normalizeProjectLookup(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripExistingWikilinks(text) {
  let out = String(text || '')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')

  for (let i = 0; i < 6; i += 1) {
    const next = out
      .replace(/\[\[\[\s*([^\]]+?)\s*\]\]\]/g, '$1')
      .replace(/\[\[\s*([^\]]+?)\s*\]\]/g, '$1')
    if (next === out) break
    out = next
  }

  return out
}

function stripExistingInlineTags(text) {
  return String(text || '')
    .replace(/\s*#(?:action|decision|follow-up|delegate|mention|idea)\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n +/g, '\n')
    .trim()
}

function ensureEntityWikilinkForAlias(text, alias, entityName) {
  const source = String(text || '')
  const name = String(entityName || '').trim()
  const aliasText = String(alias || '').trim()
  if (!source || !name || !aliasText) return source

  const linked = source.match(/\[\[([^\]]+)\]\]/g) || []
  const alreadyLinked = linked.some((entry) => {
    const inner = entry.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim().toLowerCase()
    return inner === name.toLowerCase()
  })
  if (alreadyLinked) return source

  const rx = new RegExp(`(?<!\\[\\[)\\b${escapeRegex(aliasText)}\\b(?!\\]\\])`, 'ig')
  if (!rx.test(source)) return source
  rx.lastIndex = 0
  return source.replace(rx, () => `[[${name}]]`)
}

function extractUnknownProjectsNearKeyword(noteContent, projectPaths = []) {
  const text = String(noteContent || '')
  const unknown = []

  const patterns = [
    /\bproject(?:s)?\b(?:\W+\w+){0,5}\W+([A-Z][A-Za-z0-9&'’._-]*(?:\s+[A-Z][A-Za-z0-9&'’._-]*){0,4})/gi,
    /([A-Z][A-Za-z0-9&'’._-]*(?:\s+[A-Z][A-Za-z0-9&'’._-]*){0,4})(?:\W+\w+){0,5}\W+\bproject(?:s)?\b/gi,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = String(match[1] || '').trim()
      if (!candidate || candidate.length < 2) continue
      const known = matchEntityPath(candidate, projectPaths, true)
      if (known) continue
      unknown.push(candidate)
    }
  }

  return [...new Set(unknown.map((value) => value.trim()).filter(Boolean))]
}

function tightNorm(value) {
  // Strip ALL non-alphanumeric chars for resilient matching (handles Ubuntu.com → ubuntucom)
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Extract meaningful words for bag-of-words matching (removes stop words, crude-depluralize)
const _TOKEN_STOP = new Set(['for','and','the','of','a','an','in','on','to','with','at','by','from','or','is','are','was'])
function extractContentTokens(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !_TOKEN_STOP.has(w))
    .map((w) => w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w) // crude depluralize
}

function matchEntityPath(candidate, entityPaths, partial = false) {
  const needle = normalizeEntityCandidate(candidate)
  const tightNeedle = tightNorm(candidate)
  if (!needle && !tightNeedle) return null

  let best = null
  let bestScore = -1

  for (const path of entityPaths || []) {
    const base = String(path || '').split('/').pop()?.replace(/\.md$/i, '') || ''
    const aliases = [base, base.replace(/[-_]+/g, ' ')].map(normalizeEntityCandidate).filter(Boolean)
    const tightBase = tightNorm(base)

    for (const alias of aliases) {
      const exact = alias === needle
      const fuzzy = partial && (alias.includes(needle) || needle.includes(alias))
      if (exact || fuzzy) {
        const score = exact ? 1000 : Math.min(alias.length, needle.length)
        if (score > bestScore) { best = path; bestScore = score }
        continue
      }
      // Fallback: tight normalization handles special chars like dots (Ubuntu.com → ubuntucom)
      if (tightNeedle && tightBase) {
        const tightExact = tightBase === tightNeedle
        const tightFuzzy = partial && (tightBase.includes(tightNeedle) || tightNeedle.includes(tightBase))
        if (tightExact || tightFuzzy) {
          const score = tightExact ? 500 : Math.min(tightBase.length, tightNeedle.length) / 2
          if (score > bestScore) { best = path; bestScore = score }
        }
      }
    }

    // Bag-of-words tier: handles non-contiguous word matches like
    // "architecture for product bubble" → "information-architecture-framework-for-product-bubbles"
    if (partial && bestScore < 500) {
      const needleTokens = extractContentTokens(candidate)
      const baseTokens = extractContentTokens(base)
      if (needleTokens.length >= 2 && baseTokens.length >= 2) {
        const baseSet = new Set(baseTokens)
        const hits = needleTokens.filter((t) => baseSet.has(t)).length
        const coverage = hits / needleTokens.length
        if (coverage >= 0.8 && hits >= 2) {
          const score = coverage * 200
          if (score > bestScore) { best = path; bestScore = score }
        }
      }
    }
  }

  return best
}

function runDeterministicEntityPrepass(noteContent, allowedFiles = [], enabledModules = {}) {
  // Strip inline tags but keep wikilinks so extractEntityCandidates can read them
  const cleanedForCandidates = stripExistingInlineTags(noteContent)
  const candidates = extractEntityCandidates(cleanedForCandidates)
  console.log('[Prepass] candidates extracted', { candidates, inputPreview: cleanedForCandidates?.slice(0, 100) })
  // Now strip wikilinks for the re-linking loop (prevents double-linking known entities)
  let out = String(stripExistingWikilinks(cleanedForCandidates) || '')

  const peoplePaths = enabledModules.people === false
    ? []
    : (allowedFiles || []).filter((path) => String(path).toLowerCase().startsWith('people/') && String(path).toLowerCase().endsWith('.md'))
  const projectPaths = enabledModules.projects === false
    ? []
    : (allowedFiles || []).filter((path) => String(path).toLowerCase().startsWith('projects/') && String(path).toLowerCase().endsWith('.md'))

  const unknownPeople = []
  const unknownProjects = []
  const linkedPeople = new Set()
  const linkedProjects = new Set()
  const linkedProjectLookups = new Set()
  const ideasPaths = enabledModules.ideas === false
    ? []
    : (allowedFiles || []).filter((path) => String(path).toLowerCase().startsWith('ideas/') && String(path).toLowerCase().endsWith('.md'))

  for (const candidate of candidates) {
    const candidateType = classifyUnknownEntityType(candidate.trim())
    // Ignore technical acronyms/tokens (e.g. "AI", "VS", "AppScript")
    // before any path matching so they are not auto-linked as projects.
    if (candidateType === 'ignore') {
      continue
    }

    const personPath = matchEntityPath(candidate, peoplePaths, false)
    if (personPath) {
      const display = humanizeEntityName(personPath)
      out = ensureEntityWikilink(out, display)
      linkedPeople.add(display)
      continue
    }

    const projectPath = matchEntityPath(candidate, projectPaths, true)
    if (projectPath) {
      const display = humanizeEntityName(projectPath)
      // Use candidate text (user's original wording) so special chars like dots are preserved
      out = ensureEntityWikilink(out, candidate)
      linkedProjects.add(display)
      linkedProjectLookups.add(normalizeProjectLookup(display))
      continue
    }

    // Check ideas paths — if matched, link silently without adding to unknown
    const ideaPath = matchEntityPath(candidate, ideasPaths, true)
    if (ideaPath) {
      out = ensureEntityWikilink(out, candidate)
      continue
    }

    // Classify the unknown by heuristic so the cleanup modal shows the right type chip.
    if (candidateType === 'project') {
      unknownProjects.push(candidate.trim())
    } else {
      unknownPeople.push(candidate.trim())
    }
  }

  // Scan for known projects by checking if each known project name appears in the note text.
  // This is name-first (not candidate-first) to avoid false positives.
  if (projectPaths.length > 0) {
    for (const projectPath of projectPaths) {
      const display = humanizeEntityName(projectPath)
      if (linkedProjects.has(display)) continue
      // Build a slug version for fuzzy matching (lowercase, strip hyphens/underscores)
      const slug = display.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
      const noteForMatch = out.toLowerCase()
      if (!noteForMatch.includes(display.toLowerCase()) && !noteForMatch.includes(slug)) continue
      out = ensureEntityWikilink(out, display)
      linkedProjects.add(display)
      linkedProjectLookups.add(normalizeProjectLookup(display))
    }
  }

  // Secondary signal: detect project-noun phrases regardless of capitalisation.
  // Dictated text won't have capital letters, so we anchor on the word "project" (or "project of")
  // and walk BACKWARD collecting content words until a stop word, yielding a tight project name.
  // Runs even when no projects exist yet (fresh vault).
  if (enabledModules.projects !== false) {
    const PROJ_STOP = new Set([
      'the','a','an','this','that','these','those','our','my','your','their','its',
      'on','in','at','to','for','with','by','of','from','about','into','over','than',
      'and','or','but','so','yet','nor','as','via','per','out','up','down','off',
      'i','we','he','she','they','it','you','me','us','them','him','her',
      'is','are','was','were','be','been','being','have','has','had','am',
      'do','does','did','will','would','could','should','may','might','must','can','shall',
      'now','then','also','just','very','some','any','all','more','most','slightly','quite','really',
      'today','tomorrow','yesterday','monday','tuesday','wednesday','thursday','friday','saturday','sunday',
      'late','early','soon','later','again','still','back','here','there','when','while','after','before',
    ])

    const tokens = out.split(/(\s+)/) // keep separators so indices map back
    const wordTokens = []
    for (let i = 0; i < tokens.length; i += 1) {
      if (/^\s+$/.test(tokens[i]) || tokens[i] === '') continue
      wordTokens.push(tokens[i])
    }
    const cleanWord = (w) => String(w || '').replace(/[^\w\u00C0-\u017E]/g, '').toLowerCase()

    // Walk backward from index `anchorIdx` collecting content words until a stop word.
    // Returns the title-cased phrase (excludes the anchor word itself).
    const collectBackward = (anchorIdx, maxWords = 4) => {
      const collected = []
      for (let j = anchorIdx - 1; j >= 0 && collected.length < maxWords; j -= 1) {
        const w = cleanWord(wordTokens[j])
        if (!w || PROJ_STOP.has(w)) break
        // Stop if word is inside an existing wikilink
        if (/\[\[|\]\]/.test(wordTokens[j])) break
        collected.unshift(wordTokens[j].replace(/[^\w\u00C0-\u017E]/g, ''))
      }
      return collected
    }

    const pushProject = (words, extraNoun) => {
      const all = extraNoun ? [...words, extraNoun] : words
      if (all.length === 0) return
      if (all.every(w => PROJ_STOP.has(w.toLowerCase()))) return
      const titleCased = all.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      if (matchEntityPath(titleCased, projectPaths, true)) return // known project
      const norm = titleCased.toLowerCase()
      if (!unknownProjects.some(u => u.toLowerCase() === norm)) {
        unknownProjects.push(titleCased)
      }
    }

    for (let i = 0; i < wordTokens.length; i += 1) {
      const w = cleanWord(wordTokens[i])
      // Anchor only on the literal word "project" — most reliable signal in dictated prose.
      if (w !== 'project') continue
      // Handle "project of X" — walk forward
      if (cleanWord(wordTokens[i + 1]) === 'of') {
        const fwd = []
        for (let j = i + 2; j < wordTokens.length && fwd.length < 4; j += 1) {
          const fw = cleanWord(wordTokens[j])
          if (!fw || PROJ_STOP.has(fw)) break
          if (/\[\[|\]\]/.test(wordTokens[j])) break
          fwd.push(wordTokens[j].replace(/[^\w\u00C0-\u017E]/g, ''))
        }
        pushProject(fwd)
      } else {
        // "X project" — walk backward
        pushProject(collectBackward(i))
      }
    }
  }

  // Exclude from unknownPeople any candidate that also appears in unknownProjects
  // (prevents "Canonical Slides" showing as both PERSON and PROJECT in CleanupModal)
  const unknownProjectsLower = new Set(unknownProjects.map(n => n.toLowerCase()))
  const filteredUnknownPeople = [...new Set(
    unknownPeople.map((name) => name.trim()).filter(Boolean)
      .filter(name => !unknownProjectsLower.has(name.toLowerCase()))
  )]

  const result = {
    noteContent: normalizeNestedWikilinks(out),
    unknownPeople: filteredUnknownPeople,
    unknownProjects: [...new Set(unknownProjects.map((name) => name.trim()).filter(Boolean))],
    linkedPeople: [...linkedPeople],
    linkedProjects: [...linkedProjects],
  }
  console.log('[Prepass] result', { unknownPeople: result.unknownPeople, unknownProjects: result.unknownProjects, linkedPeople: result.linkedPeople })
  return result
}

function tryFastRouteShortNote(noteContent, noteFilename, allowedFiles = [], enabledModules = {}) {
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
  const peopleModuleEnabled = enabledModules?.people !== false
  if (!targetPath && !peopleModuleEnabled) return null
  if (!targetPath) return null

  const isUrgent = /\b(urgent|asap|immediately|critical|blocker)\b/.test(lower)
  const isImportant = /\b(important|priority|high-priority|high priority)\b/.test(lower)
  const marker = delegateIntent && !discussIntent ? 'delegate' : (isUrgent ? 'urgent' : (isImportant ? 'important' : 'follow-up'))
  const section = delegateIntent && !discussIntent ? '## Delegate' : '## Talk About'
  const title = normalizeNestedWikilinks(compact)
  const tagSuffix = isUrgent ? ' #urgent' : (isImportant ? ' #important' : '')

  return {
    annotated_note: normalizeNestedWikilinks(noteContent),
    changes: [{
      id: crypto.randomUUID?.() || `${Date.now()}-fast`,
      target_file: targetPath,
      target_section: section,
      content: `- [ ] ${title}${tagSuffix}`,
      marker,
      title,
      module: 'people',
    }],
    unknown_entities: [],
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

async function parseRoutingResponseWithRetry({ raw, linkedNoteContent, noteFilename, promptAllowFiles, enabledModules, settings }) {
  try {
    return safeParseJSON(raw)
  } catch (firstErr) {
    console.warn('Routing JSON parse failed on first attempt, retrying with strict JSON-only prompt:', firstErr?.message || firstErr)

    const retrySystem = `${buildSystemPrompt(promptAllowFiles, enabledModules)}\n\nSTRICT OUTPUT RULES:\n- Return ONLY one valid JSON object.\n- Do not include markdown fences.\n- Do not include prose or explanation.\n- Ensure JSON is complete and parseable.`

    const retryUser = `The previous output was invalid JSON. Re-run routing for the same note and return complete strict JSON only.\n\nCurrent note file: ${noteFilename}\n\nCurrent note markdown:\n${linkedNoteContent}`

    const retryRaw = await callLLM(
      [{ role: 'user', content: retryUser }],
      retrySystem,
      settings,
      1400
    )

    return safeParseJSON(retryRaw)
  }
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

// Drop markdown heading lines (e.g. the note's "# 17-06-2026" date title) so they
// don't get collapsed into the first sentence by splitIntoSentences and pollute
// deterministic titles / token-overlap checks.
function stripHeadingLines(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .join('\n')
}

// Deterministic urgency detection. Urgent / important / critical sentences are
// an INSTANT trigger — they must always produce an action, never depend on the
// LLM noticing them. We only fire on sentences that also carry an action signal
// (first-person intent or an imperative) so we don't flag past-tense recaps.
const URGENCY_URGENT_RE = /\b(urgent(?:ly)?|asap|immediately|critical|blocker|emergency|right\s+away)\b/i
const URGENCY_IMPORTANT_RE = /\b(important|high[\s-]?priority|top[\s-]?priority|priority|crucial|vital)\b/i
const URGENCY_ACTION_SIGNAL_RE = /\b(i\s+(?:need|have|must|should|want|got|gotta)\s+to|i'?ll|i\s+will|need\s+to|needs\s+to|have\s+to|has\s+to|must\b|should\b|todo|to\s+do|remember\s+to|don'?t\s+forget|make\s+sure|ensure)\b/i
// Recap guard — a sentence that is purely reporting the past is not an action.
const URGENCY_RECAP_RE = /\b(was|were|did|presented|showed|shouted|informed|told|created|made|sent|happened|reacted|complained)\b/i

function buildUrgencyTitle(sentence) {
  let t = normalizeNestedWikilinks(String(sentence || ''))
  // Drop a trailing urgency clause: "... and it is urgent", "... (important)", "... - asap".
  t = t.replace(/[,;:–-]?\s*(?:and|but|so|because)?\s*(?:it'?s|it\s+is|this\s+is|that'?s|they'?re|it\s+was)?\s*(?:very\s+|really\s+|super\s+|quite\s+|extremely\s+)?(?:urgent(?:ly)?|important|high[\s-]?priority|top[\s-]?priority|priority|critical|crucial|vital|asap|a\s+blocker|an?\s+emergency)\b[.!?]?\s*$/i, '').trim()
  // Strip a leading first-person modal so the title is a clean imperative.
  t = t.replace(/^\s*(?:i\s+(?:need|have|must|should|want|got|gotta)\s+to\s+|i'?ll\s+|i\s+will\s+|need\s+to\s+|have\s+to\s+|must\s+|should\s+|remember\s+to\s+|make\s+sure\s+(?:to\s+)?|ensure\s+(?:to\s+)?)/i, '').trim()
  t = t.replace(/[.!?]+$/, '').trim()
  return t.replace(/^(.)/, (ch) => String(ch || '').toUpperCase())
}

function detectUrgencyActions(noteContent) {
  const out = []
  for (const raw of splitIntoSentences(stripHeadingLines(noteContent))) {
    const sentence = String(raw || '').trim()
    if (!sentence) continue
    const isUrgent = URGENCY_URGENT_RE.test(sentence)
    const isImportant = !isUrgent && URGENCY_IMPORTANT_RE.test(sentence)
    if (!isUrgent && !isImportant) continue
    // Require an action signal and reject pure past-tense recaps.
    if (!URGENCY_ACTION_SIGNAL_RE.test(sentence)) continue
    if (URGENCY_RECAP_RE.test(sentence) && !URGENCY_ACTION_SIGNAL_RE.test(sentence)) continue
    const title = buildUrgencyTitle(sentence)
    if (!title || title.length < 2) continue
    out.push({ sentence, title, marker: isUrgent ? 'urgent' : 'important' })
  }
  return out
}

// Deterministic idea detection. Proposal / exploration sentences are an instant
// trigger for an idea — they must always reach ideas/backlog.md even if the LLM
// skipped them (e.g. it mistook the subjunctive "what if we built" for a recap).
// "Intro" signals introduce a new idea; "support" signals (e.g. "could be huge")
// are evaluative reactions that merely back an idea — they never spawn their own.
const IDEA_INTRO_RE = /\b(what\s+if|how\s+about|idea:|thinking\s+about|been\s+thinking|want\s+to\s+(?:explore|try|build)|we\s+could\s+(?:build|make|create|try)|maybe\s+we\s+(?:could|should)|imagine\s+(?:if|a)|wouldn'?t\s+it\s+be)\b/i
const IDEA_SUPPORT_RE = /\bcould\s+be\s+(?:huge|cool|interesting|nice|useful|great)\b/i

// Lead-in fragments stripped (repeatedly) from the head of an idea sentence so
// the title is the bare concept rather than the framing.
const IDEA_LEADIN_RE = /^\s*(?:also\s+|then\s+)?(?:had\s+a\s+thought:?\s*|i\s+had\s+an?\s+idea:?\s*|idea:\s*|thinking\s+about\s+|been\s+thinking\s+about\s+|what\s+if\s+(?:we\s+)?|how\s+about\s+(?:we\s+)?|maybe\s+we\s+(?:could|should)\s+|we\s+could\s+|imagine\s+(?:if\s+)?(?:we\s+)?|wouldn'?t\s+it\s+be\s+(?:great|cool|nice|useful)\s+(?:if\s+)?(?:we\s+)?)/i

function buildIdeaTitle(sentence) {
  let t = normalizeNestedWikilinks(String(sentence || ''))
  // Strip leading idea lead-ins (may be chained, e.g. "Also had a thought: what if we …").
  let prev
  do {
    prev = t
    t = t.replace(IDEA_LEADIN_RE, '').trim()
  } while (t !== prev && t.length > 0)
  t = t.replace(/[.!?]+$/, '').trim()
  // Cap to a tidy length.
  const words = t.split(/\s+/)
  if (words.length > 14) t = words.slice(0, 14).join(' ')
  return t.replace(/^(.)/, (ch) => String(ch || '').toUpperCase())
}

function detectIdeas(noteContent) {
  const out = []
  for (const raw of splitIntoSentences(stripHeadingLines(noteContent))) {
    const sentence = String(raw || '').trim()
    if (!sentence) continue
    // Only an intro signal spawns a new idea. A support-only sentence is an
    // evaluative reaction to the preceding idea — skip it to avoid duplicates.
    if (!IDEA_INTRO_RE.test(sentence)) continue
    const title = buildIdeaTitle(sentence)
    if (!title || title.length < 2) continue
    out.push({ sentence, title })
  }
  return out
}

function escapeRegex(source) {
  return String(source || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


function peoplePathToName(path) {
  const filename = String(path || '').split('/').pop() || ''
  return filename.replace(/\.md$/i, '').trim()
}

function ensurePersonWikilink(text, personName) {
  return ensureEntityWikilink(text, personName)
}

function dedupeUnknownEntities(entities = []) {
  const out = []
  const seen = new Set()

  for (const entity of entities) {
    const type = String(entity?.type || '').trim().toLowerCase()
    const name = String(entity?.name || '').trim()
    if (!type || !name) continue
    const key = `${type}:${name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ type, name })
  }

  return out
}

function matchesUnknownEntity(entity, type, name) {
  const entityType = String(entity?.type || '').trim().toLowerCase()
  const entityName = String(entity?.name || '').trim().toLowerCase()
  return entityType === String(type || '').trim().toLowerCase() && entityName === String(name || '').trim().toLowerCase()
}

function collapseDoubleSpaces(text) {
  // Collapse runs of 2+ spaces/tabs into a single space, without touching newlines.
  return String(text || '').replace(/[ \t]{2,}/g, ' ')
}

export function runCleanupPrepass(noteContent, allowedFiles = [], enabledModules = {}) {
  const enabledFolders = MODULE_REGISTRY
    .filter((moduleDef) => enabledModules[moduleDef.id] !== false)
    .map((moduleDef) => moduleDef.vaultFolder)

  const scopedAllowedFiles = (allowedFiles || []).filter((path) => enabledFolders.includes(String(path || '').split('/')[0]))
  const prepass = runDeterministicEntityPrepass(stripExistingInlineTags(noteContent), scopedAllowedFiles, enabledModules)
  const linkableFolders = enabledFolders.filter((folder) => folder === 'people' || folder === 'projects')
  const linkedNoteContent = collapseDoubleSpaces(normalizeNestedWikilinks(autoLinkKnownMentions(prepass.noteContent, scopedAllowedFiles, linkableFolders)))

  return {
    noteContent: linkedNoteContent,
    unknownPeople: prepass.unknownPeople,
    unknownProjects: prepass.unknownProjects,
  }
}

// Heuristic words that suggest a wikilinked name is a project rather than a person
const _PROJECT_NOUNS = new Set([
  'revamp', 'framework', 'system', 'app', 'project', 'platform', 'initiative',
  'tool', 'service', 'upgrade', 'redesign', 'migration', 'integration', 'portal',
  'suite', 'hub', 'engine', 'dashboard', 'api', 'website', 'site', 'page', 'plan',
  'feature', 'module', 'refactor', 'release', 'launch', 'sprint', 'ops', 'operations',
  'slide', 'slides', 'deck', 'template', 'templates', 'doc', 'docs', 'spec', 'brief', 'report', 'board', 'flow',
  'script', 'appscript', 'vscode', 'sdk',
])

const _NON_PERSON_TECH_WORDS = new Set([
  'ai', 'api', 'ux', 'ui', 'llm', 'sdk', 'ide', 'vs', 'appscript', 'vscode',
  'javascript', 'typescript', 'python', 'react', 'node', 'sql', 'excel', 'sheets',
  'github', 'gitlab', 'openai', 'anthropic', 'gemini', 'claude', 'ollama',
])

function classifyUnknownEntityType(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'ignore'

  const normalizedWords = words.map((w) => String(w || '').replace(/[^\w\u00C0-\u017E-]/g, ''))
  const lowerWords = normalizedWords.map((w) => w.toLowerCase())

  // Ignore short acronyms / technical markers that are not human names.
  if (
    words.length === 1
    && (/^[A-Z]{2,5}$/.test(normalizedWords[0]) || _NON_PERSON_TECH_WORDS.has(lowerWords[0]))
  ) {
    return 'ignore'
  }

  // Ignore camel-case technical tokens like AppScript / SeeApps.
  if (words.length === 1 && /[a-z][A-Z]/.test(normalizedWords[0])) return 'ignore'

  // If any token looks technical, it's much more likely a project/topic than a person.
  if (lowerWords.some((w) => _NON_PERSON_TECH_WORDS.has(w))) return 'project'

  // 3+ words lean toward project
  if (words.length >= 3) return 'project'
  // Contains a project noun
  if (words.some((w) => _PROJECT_NOUNS.has(w.toLowerCase()))) return 'project'
  // Contains non-human chars (dots, digits)
  if (/[.0-9]/.test(name)) return 'project'
  // Default: 1-2 title-case words → person
  return 'person'
}

function extractUnknownPeopleFromWikilinks(noteContent, allowedFiles = [], enabledModules = {}) {
  // Build a lookup set for all known vault entity basenames (people + projects + ideas)
  const allEntityPaths = (allowedFiles || []).filter((path) => {
    const folder = String(path).toLowerCase().split('/')[0]
    return (
      (folder === 'people' || folder === 'projects' || folder === 'ideas') &&
      String(path).toLowerCase().endsWith('.md')
    )
  })

  const knownByBasename = new Set(
    allEntityPaths.map((path) => peoplePathToName(path).toLowerCase()).filter(Boolean)
  )

  const wikiMatches = String(noteContent || '').match(/\[\[[^\]]+\]\]/g) || []
  const unknown = []

  for (const match of wikiMatches) {
    const inner = match.replace(/^\[\[/, '').replace(/\]\]$/, '').trim()
    const candidate = inner.split('|')[0]?.trim() || ''
    if (!candidate) continue
    // Allow letters, spaces, apostrophes, hyphens, dots, digits in wikilink names
    if (!/^[A-Za-z][A-Za-z0-9\s''.\-]{0,100}$/.test(candidate)) continue

    const key = candidate.toLowerCase()
    // Exact basename match against any entity type
    if (knownByBasename.has(key)) continue
    // Fuzzy match against all known vault entity paths (handles slug mismatches and special chars)
    if (matchEntityPath(candidate, allEntityPaths, true)) continue

    const type = classifyUnknownEntityType(candidate)
    // Only surface unknown people when the people module is enabled
    if (type === 'person' && enabledModules.people === false) continue
    // Only surface unknown projects when the projects module is enabled
    if (type === 'project' && enabledModules.projects === false) continue

    unknown.push({ type, name: candidate })
  }

  return dedupeUnknownEntities(unknown)
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
      const checkA = /^-\s*\[[ x]\]/i.test(String(change?.content || ''))
      const checkB = /^-\s*\[[ x]\]/i.test(String(existing?.content || ''))
      if (checkA && checkB) {
        return score >= 0.9
      }
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
    const pendingLike = /\b(waiting\s+on|need\s+to|needs\s+to|should|will\s+need|to\s+be\s+decided|decision\s+pending|follow\s*up|check\s+in)\b/.test(lowerSentence)
    if (!delegateLike && !discussLike && !pendingLike) continue
    const urgentLike = /\b(urgent|asap|immediately|critical|blocker)\b/.test(lowerSentence)
    const useTalkAbout = (discussLike && !delegateLike) || pendingLike || urgentLike

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

  const process = useCallback(async ({
    noteContent,
    noteFilename,
    contextContent,
    allowedFiles = [],
    settings,
    enabledModules = {},
    preResolvedUnknownEntities = [],
    suppressedUnknownEntities = [],
  }) => {
    setStatus('loading')
    setError(null)

    console.log('[Processor] process() called', {
      noteLength: noteContent?.length,
    })

    try {
      const enabledFolders = MODULE_REGISTRY
        .filter((moduleDef) => enabledModules[moduleDef.id] !== false)
        .map((moduleDef) => moduleDef.vaultFolder)

      const scopedAllowedFiles = (allowedFiles || []).filter((path) => enabledFolders.includes(String(path || '').split('/')[0]))
      console.log('[Processor] scopedAllowedFiles', scopedAllowedFiles)

      // Skip re-preprocessing if content is already wikilinked (from Stage 1 cleanup modal)
      const alreadyWikilinked = /\[\[[^\]]+\]\]/.test(String(noteContent || ''))
      const linkedNoteContent = normalizeNestedWikilinks(stripExistingInlineTags(String(noteContent || '')))
      // runDeterministicEntityPrepass is pure local string matching — no LLM call
      console.log('[Timing] prepass start', Date.now())
      const prepass = alreadyWikilinked
        ? { noteContent: linkedNoteContent, unknownPeople: [], unknownProjects: [] }
        : runDeterministicEntityPrepass(stripExistingInlineTags(noteContent), scopedAllowedFiles, enabledModules)
      console.log('[Timing] prepass end', Date.now())
      console.log('[Processor] after prepass', {
        alreadyWikilinked,
        linkedNoteContentLength: linkedNoteContent?.length,
      })

      const meaningful = hasMeaningfulNoteContent(linkedNoteContent)
      console.log('[Processor] meaningful content check', { result: meaningful })
      if (!meaningful) {
        const emptyResult = {
          annotated_note: normalizeNestedWikilinks(linkedNoteContent),
          changes: [],
          unknown_entities: [],
        }
        setResult(emptyResult)
        setStatus('success')
        return emptyResult
      }

      const fastResult = tryFastRouteShortNote(linkedNoteContent, noteFilename, scopedAllowedFiles, enabledModules)
      console.log('[Processor] fast route check', { fastResult })
      if (fastResult) {
        setResult(fastResult)
        setStatus('success')
        return fastResult
      }

      const peopleAndProjectAllowed = scopedAllowedFiles.filter((path) => {
        const folder = String(path || '').split('/')[0]?.toLowerCase()
        return folder === 'people' || folder === 'projects'
      })
      let promptAllowFiles = selectPromptAllowList(
        linkedNoteContent,
        peopleAndProjectAllowed.length > 0 ? peopleAndProjectAllowed : scopedAllowedFiles
      )
      // Always include ideas/backlog.md when ideas module is enabled so the LLM can route idea markers there.
      if (enabledModules?.ideas !== false && !promptAllowFiles.includes('ideas/backlog.md')) {
        promptAllowFiles = [...promptAllowFiles, 'ideas/backlog.md']
      }
      let writerFile = enabledModules?.people !== false ? String(settings?.writerFile || '').trim() : ''
      // Guard against a stale writerFile carried over from a previously opened vault.
      // If the configured owner file is not part of THIS vault's scanned files, drop
      // it so deterministic actions fall back to an unattached ## Open Actions task
      // instead of writing to a non-existent person file from another vault.
      if (writerFile && !scopedAllowedFiles.includes(writerFile)) writerFile = ''
      if (writerFile && scopedAllowedFiles.includes(writerFile) && !promptAllowFiles.includes(writerFile)) {
        promptAllowFiles = [...promptAllowFiles, writerFile]
      }
      const promptAllowSet = new Set(promptAllowFiles)

      const safeParseChanges = (raw) => {
        if (!raw) return []
        try {
          const obj = safeParseJSON(raw)
          return Array.isArray(obj?.changes) ? obj.changes : []
        } catch {
          return []
        }
      }

      const userMsg = [{ role: 'user', content: buildUserPrompt({ noteContent: linkedNoteContent, noteFilename, contextContent }) }]

      console.log('[Processor] firing Promise.all', {
        scopedAllowedFilesCount: scopedAllowedFiles?.length,
        noteForLLMPreview: linkedNoteContent?.slice(0, 80),
      })
      console.log('[Timing] Promise.all start', Date.now())

      const [mentionRaw, taskRaw] = await Promise.all([
        callLLM(userMsg, buildMentionSystemPrompt(promptAllowFiles), settings, 1200),
        callLLM(userMsg, buildTaskSystemPrompt(promptAllowFiles), settings, 1200),
      ])

      console.log('[Timing] Promise.all end', Date.now())
      console.log('[Processor] raw mention response', JSON.stringify(mentionRaw))
      console.log('[Processor] raw task response', JSON.stringify(taskRaw))

      console.log('[Processor] Promise.all resolved', {
        mentionRawLength: mentionRaw?.length,
        taskRawLength: taskRaw?.length,
      })

      let mentionChanges = safeParseChanges(mentionRaw).filter((change) => {
        // Decisions on people files are invalid — suppress from mention pass too
        if (normalizeMarker(change?.marker) === 'decision' && String(change?.target_file || '').startsWith('people/')) return false
        return true
      })

      const MARKER_SECTION_MAP = {
        mention: null,
        action: '## Open Actions',
        'follow-up': '## Talk About',
        delegate: '## Delegate',
        decision: '## Decisions',
      }

      const extractedTaskChanges = safeParseChanges(taskRaw)
      console.log('[Processor] taskRaw extracted', extractedTaskChanges)

      let taskChanges = extractedTaskChanges.map((change) => {
        const marker = normalizeMarker(change?.marker)
        const rawContent = String(change?.content || '').trim()
        const cleaned = rawContent.replace(/^- \[ \] (action|follow-up|delegate|decision):\s*/i, '- [ ] ')
        const capitalisedContent = cleaned.replace(/^- \[ \] (.)/, (_, ch) => `- [ ] ${String(ch || '').toUpperCase()}`)
        const rawTitle = String(change?.title || '').trim()
        const cleanedTitle = rawTitle
          .replace(/^(action|follow-up|delegate|decision):\s*/i, '')
          .replace(/^(.)/, (ch) => String(ch || '').toUpperCase())

        return {
          ...change,
          marker,
          target_section: MARKER_SECTION_MAP[marker] ?? change?.target_section,
          content: capitalisedContent,
          title: cleanedTitle,
        }
      })

      taskChanges = taskChanges.flatMap((change) => {
        const marker = normalizeMarker(change?.marker)
        // Only route task-ish markers — not mention or idea
        if (!['action', 'follow-up', 'urgent', 'important', 'delegate', 'decision'].includes(marker)) return [change]

        // Decisions on people files are always wrong — suppress them entirely.
        // The intent is already captured by a follow-up on that person.
        if (marker === 'decision') {
          const target = String(change?.target_file || '')
          if (target.startsWith('people/')) return []
          return [change]
        }

        // Skip if already routed to a specific file
        if (change?.target_file) return [change]
        // Unrouted tasks → vault owner's My Actions (if owner file is set)
        if (!writerFile) return [change]
        return [{
          ...change,
          marker: 'action',
          target_file: writerFile,
          target_section: WRITER_ACTIONS_SECTION,
          module: 'people',
        }]
      })

      // Deterministic urgency guarantee — urgent / important / critical actions
      // MUST surface even if the LLM missed them. If an existing task already
      // covers the sentence, upgrade its marker + tag; otherwise inject a fresh
      // action routed to the vault owner's My Actions (or unattached if no owner).
      const urgencyActions = detectUrgencyActions(linkedNoteContent)
      for (const ua of urgencyActions) {
        const titleTokens = extractContentTokens(ua.title)
        const tag = ua.marker === 'urgent' ? '#urgent' : '#important'
        const covered = taskChanges.find((c) => {
          const existing = `${c?.title || ''} ${c?.content || ''}`
          const existingLower = existing.toLowerCase()
          if (existingLower.includes(ua.title.toLowerCase())) return true
          if (titleTokens.length === 0) return false
          const existingSet = new Set(extractContentTokens(existing))
          const hits = titleTokens.filter((t) => existingSet.has(t)).length
          return hits / titleTokens.length >= 0.6
        })
        if (covered) {
          const coveredMarker = normalizeMarker(covered.marker)
          if (['action', 'urgent', 'important'].includes(coveredMarker)) {
            covered.marker = ua.marker
          }
          // ALWAYS ensure the urgency tag is present so the UI flags it, even when
          // the existing marker can't be upgraded (e.g. follow-up / delegate / a
          // project-routed action). The tag — not the marker — drives the urgent flag.
          if (!/#urgent|#important/i.test(String(covered.content || ''))) {
            covered.content = `${String(covered.content || '').trim()} ${tag}`.trim()
          }
          continue
        }
        taskChanges.push({
          id: crypto.randomUUID?.() || `${Date.now()}-urgency-${taskChanges.length}`,
          target_file: writerFile || null,
          target_section: writerFile ? WRITER_ACTIONS_SECTION : '## Open Actions',
          content: `${ua.title} ${tag}`.trim(),
          marker: ua.marker,
          title: ua.title,
          module: writerFile ? 'people' : 'unattached',
        })
      }

      // Deterministic idea guarantee — proposal / exploration sentences ("what if
      // we built…", "could be huge…") MUST reach ideas/backlog.md even if the LLM
      // skipped them. Only runs when the ideas module is enabled.
      if (enabledModules?.ideas !== false) {
        const ideaDateSlug = (String(noteFilename || '').split('/').pop() || '')
          .replace(/\.md$/i, '').trim()
          || new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
        const detectedIdeas = detectIdeas(linkedNoteContent)
        for (const di of detectedIdeas) {
          const titleTokens = extractContentTokens(di.title)
          const alreadyCaptured = taskChanges.some((c) => {
            if (normalizeMarker(c?.marker) !== 'idea') return false
            const existing = `${c?.title || ''} ${c?.content || ''}`.toLowerCase()
            if (existing.includes(di.title.toLowerCase())) return true
            if (titleTokens.length === 0) return false
            const existingSet = new Set(extractContentTokens(existing))
            const hits = titleTokens.filter((t) => existingSet.has(t)).length
            return hits / titleTokens.length >= 0.6
          })
          if (alreadyCaptured) continue
          taskChanges.push({
            id: crypto.randomUUID?.() || `${Date.now()}-idea-${taskChanges.length}`,
            target_file: 'ideas/backlog.md',
            target_section: '## Backlog',
            content: `[[${ideaDateSlug}]] — ${di.title}`,
            marker: 'idea',
            title: di.title,
            module: 'ideas',
          })
        }
      }

      const normalisedChanges = taskChanges
      console.log('[Processor] after normalise', normalisedChanges)

      const allRawChanges = [
        ...mentionChanges,
        ...taskChanges,
      ].filter((change) => {
        const target = String(change?.target_file || '')
        // Any change destined for the vault owner's My Actions section is always
        // valid — we only ever route the owner's own actions there, and the
        // deterministic urgency fallback may target it even if writerFile was not
        // added to the prompt allow-list.
        const isWriterAction = String(change?.target_section || '').trim() === WRITER_ACTIONS_SECTION
          && (!target || target === String(writerFile || ''))
        const isUnattachedModuleAction = !target && String(change?.module || '') === 'unattached'
        if (isWriterAction || isUnattachedModuleAction) return true
        return promptAllowSet.has(target)
      })

      const filteredChanges = allRawChanges
      console.log('[Processor] after module filter', filteredChanges)

      const mergedChanges = [...mentionChanges, ...taskChanges]
      console.log('[Processor] after merge', mergedChanges)
      console.log('[Processor] parsed changes', {
        count: mergedChanges?.length,
        changes: mergedChanges,
      })

      const deterministicUnknownPeople = extractUnknownPeopleFromWikilinks(
        linkedNoteContent,
        scopedAllowedFiles,
        enabledModules
      )
      const mergedUnknownEntities = dedupeUnknownEntities([
        ...(preResolvedUnknownEntities || []),
        ...deterministicUnknownPeople,
        ...prepass.unknownPeople.map((name) => ({ type: 'person', name })),
        ...prepass.unknownProjects.map((name) => ({ type: 'project', name })),
      ]).filter((entity) => {
        return !(suppressedUnknownEntities || []).some((suppressed) =>
          matchesUnknownEntity(entity, suppressed?.type, suppressed?.name)
        )
      })

      let hydratedChanges = (allRawChanges || []).map((change, index) => ({
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

        const forceMyActions = String(change?.target_section || '').trim() === WRITER_ACTIONS_SECTION

        if (forceMyActions) {
          normalizedMarker = 'action'
        } else if (normalizedMarker === 'decision') {
          normalizedMarker = 'decision'
        } else if (moduleDef?.id === 'projects') {
          // Projects support action, decision, mention.
          // Any other task-ish marker is coerced to action.
          if (normalizedMarker !== 'action' && normalizedMarker !== 'decision' && normalizedMarker !== 'mention') {
            normalizedMarker = 'action'
          }
        } else if (moduleDef?.id === 'people') {
          if (normalizedMarker === 'urgent' || normalizedMarker === 'follow-up') {
            // Discuss / follow-up items belong in Talk About.
            normalizedMarker = 'follow-up'
          } else if (normalizedMarker === 'mention') {
            // Plain mentions belong in Recent Mentions, not delegate tasks.
            normalizedMarker = 'mention'
          } else {
            normalizedMarker = 'delegate'
          }
        }

        const normalizedModule = moduleDef?.id || String(change.module || '').trim().toLowerCase() || 'other'
        // ideas/backlog.md is a special aggregate file — always preserve its ## Backlog section
        // and don't let resolveTargetSection remap it to ## Developing (the per-idea-file rule).
        const isBacklogTarget = String(change.target_file || '').toLowerCase() === 'ideas/backlog.md'
        const normalizedSection = isBacklogTarget && normalizedMarker === 'idea'
          ? '## Backlog'
          : forceMyActions
          ? WRITER_ACTIONS_SECTION
          : (moduleDef?.id === 'projects'
            ? (normalizedMarker === 'decision'
              ? '## Decisions'
              : (normalizedMarker === 'mention' ? '## Recent Mentions' : '## Open Actions'))
            : (normalizedMarker === 'decision'
              ? '## Decisions'
              : resolveTargetSection(moduleDef, normalizedMarker, change.target_section)))

        return {
          ...change,
          marker: normalizedMarker || 'mention',
          module: normalizedModule,
          target_section: normalizedSection,
        }
      })

      hydratedChanges = hydratedChanges.map((change) => {
        const targetPath = String(change?.target_file || '').toLowerCase()
        if (!targetPath.startsWith('people/')) return change

        const personName = peoplePathToName(change.target_file)
        return {
          ...change,
          title: ensurePersonWikilink(change.title, personName),
          content: ensurePersonWikilink(change.content, personName),
        }
      })

      // Keep task ownership strictly from extracted changes.
      // The old people synthesis fallback fanned one sentence out to every mentioned person,
      // which creates duplicate follow-ups with incorrect ownership.

      // Synthesize task changes for unknown entities (files that don't exist yet).
      // This covers the first-run case where the LLM can't emit a change for a missing file.
      const unknownPeopleChanges = synthesizeUnknownPeopleChanges(
        linkedNoteContent,
        mergedUnknownEntities,
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
        mergedUnknownEntities.flatMap((entity) =>
          entityCandidatePaths(entity).map((p) => p.toLowerCase())
        )
      )

      if (scopedAllowedFiles.length > 0) {
        const validFiles = new Set(scopedAllowedFiles)
        const rejected = hydratedChanges.filter((change) => {
          const isWriterAction = String(change?.target_section || '').trim() === WRITER_ACTIONS_SECTION
            && (!change?.target_file || change.target_file === String(writerFile || ''))
          const isUnattachedModuleAction = !change?.target_file && String(change?.module || '') === 'unattached'
          if (isWriterAction || isUnattachedModuleAction) return false
          return !validFiles.has(change.target_file) && !pendingEntityPaths.has(String(change.target_file || '').toLowerCase())
        })

        if (rejected.length > 0) {
          console.warn(
            `Routing validator: rejected ${rejected.length} change(s) to unknown files:`,
            rejected.map((change) => change.target_file)
          )
        }

        hydratedChanges = hydratedChanges.filter((change) => {
          const isWriterAction = String(change?.target_section || '').trim() === WRITER_ACTIONS_SECTION
            && (!change?.target_file || change.target_file === String(writerFile || ''))
          const isUnattachedModuleAction = !change?.target_file && String(change?.module || '') === 'unattached'
          // ideas/backlog.md is always valid even if not in the scanned vault tree
          const isIdeaBacklog = String(change?.target_file || '').toLowerCase() === 'ideas/backlog.md'
            && normalizeMarker(change?.marker) === 'idea'
          if (isWriterAction || isUnattachedModuleAction || isIdeaBacklog) return true
          return validFiles.has(change.target_file) || pendingEntityPaths.has(String(change.target_file || '').toLowerCase())
        })
      }

      // Build full entity path list for cross-type fuzzy safety net
      const allEntityPaths = (scopedAllowedFiles || []).filter((path) => {
        const folder = String(path).toLowerCase().split('/')[0]
        return folder === 'people' || folder === 'projects' || folder === 'ideas'
      })

      const filteredUnknown = mergedUnknownEntities.filter((entity) => {
        const name = String(entity?.name || '').trim()
        if (!name) return false
        // Type-specific path check (fast path)
        const candidates = entityCandidatePaths(entity)
        if (candidates.some((candidate) => canonicalFileMap.has(candidate.toLowerCase()))) return false
        // Cross-type fuzzy match — catches cases where type was misclassified
        if (matchEntityPath(name, allEntityPaths, true)) return false
        return true
      })

      const hydrated = {
        annotated_note: normalizeNestedWikilinks(linkedNoteContent),
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
