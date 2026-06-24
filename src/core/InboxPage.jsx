import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { runCleanupPrepass, useNoteProcessor } from '../hooks/useNoteProcessor'
import { applyChange } from '../lib/approvalHandler'
import { rebuildIndexFiles, rebuildContext } from '../lib/rebuildContext'
import { moveFile } from '../lib/vaultWriter'
import { buildAllowedFiles } from '../lib/vaultScanner'
import { getFileIndex, invalidateFileIndex } from '../lib/fileIndex'
import { extractTagsFromMarkdown, mergeTagsIntoIndex, normalizeTag, parseTagsFromContent } from '../lib/tags'
import { appendActivityEntry } from '../lib/activityLog'
import { isAuthErrorMessage } from '../lib/llm'
import { generateFile, toSlug } from '../lib/templates'
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons'
import { parseFrontmatter } from '../lib/frontmatter'
import { getProcessedState, setProcessedState, clearProcessedState } from '../lib/processedNotes'
import { extractHashtagChanges, resolveHashtagTargets, extractHashtags } from '../lib/hashtagRouter'
import CleanupModal from '../components/CleanupModal'
import TrashMenuButton from '../components/TrashMenuButton'
import RoutingReview from './RoutingReview'
import { todayInboxPath, dailyNoteTemplate } from '../lib/vaultInit'

function splitTitleBody(markdown) {
  const normalized = (markdown || '').replace(/^\uFEFF/, '')
  const lines = normalized.split('\n')
  const firstNonEmpty = lines.findIndex((line) => line.trim().length > 0)

  if (firstNonEmpty === -1) return { title: '', body: '' }

  const firstLine = lines[firstNonEmpty]
  const titleMatch = firstLine.match(/^#\s+(.+)$/)
  if (!titleMatch) return { title: '', body: normalized }

  const before = lines.slice(0, firstNonEmpty)
  const after = lines.slice(firstNonEmpty + 1)
  const body = [...before, ...after].join('\n').replace(/^\n+/, '')
  return { title: titleMatch[1].trim(), body }
}

function stripLeadingH1(markdown) {
  return (markdown || '').replace(/^\uFEFF/, '').replace(/^\s*#\s+.+\n+/, '')
}

function normalizeInboxMarkdown(markdown) {
  // Strip HTML line-break tags before further processing so they render as
  // blank lines rather than literal `<br />` text in the note textarea/editor.
  const withoutBr = String(markdown || '').replace(/<br\s*\/?>/gi, '\n\n')
  const parsed = splitTitleBody(withoutBr)
  if (!parsed.title) return withoutBr

  const body = stripLeadingH1(parsed.body)
  return body ? `# ${parsed.title}\n\n${body}` : `# ${parsed.title}\n`
}

function splitMergedDateHeading(markdown) {
  const source = String(markdown || '')
  if (!source.startsWith('#')) return source

  const lineEnd = source.indexOf('\n')
  const firstLine = lineEnd === -1 ? source : source.slice(0, lineEnd)
  const match = firstLine.match(/^(#\s*(?:\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2}))(\s+.+)$/)
  if (!match) return source

  const splitIndex = match[1].length
  const bodyStart = source.slice(splitIndex).trimStart()
  if (!bodyStart) return `${match[1]}\n`
  return `${match[1]}\n\n${bodyStart}`
}

function buildInboxNoteBody(body, heading = '') {
  const trimmedTitle = String(heading || '').trim()
  const sanitizedBody = stripLeadingH1(body)
  return trimmedTitle ? `# ${trimmedTitle}\n\n${sanitizedBody}` : sanitizedBody
}

function unescapeWikilinks(text) {
  // Milkdown serializes [[ as \[\[ — unescape before writing to disk or displaying
  return String(text || '')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
}

function stripLegacyFrontmatter(text) {
  // Remove any --- frontmatter block that may have been written by previous versions
  return String(text || '').replace(/^---[\s\S]*?---\n?/, '').trimStart()
}

function hasProcessableNoteContent(markdown) {
  const text = String(markdown || '')
    .replace(/^\s*#\s+.+$/gm, ' ')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > 0
}

function normalizeLineForMatch(line) {
  return String(line || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function tokenizeForMatch(text) {
  return normalizeLineForMatch(text)
    .replace(/\[\[|\]\]|[#*_`~>\-]/g, ' ')
    .replace(/[^a-z0-9\s:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function injectTagsIntoBestSentence(line, tags, sentenceHints = []) {
  const safeLine = String(line || '')
  if (!safeLine.trim() || tags.length === 0) return safeLine

  const sentenceMatches = safeLine.match(/[^.!?\n]+[.!?]*(?:\s+|$)/g)
  if (!sentenceMatches || sentenceMatches.length === 0) {
    return `${safeLine} ${tags.join(' ')}`
  }

  const hintTokens = new Set(
    sentenceHints
      .flatMap((hint) => tokenizeForMatch(hint))
      .filter((token) => token.length > 2)
  )

  let bestIdx = -1
  let bestScore = 0
  if (hintTokens.size > 0) {
    sentenceMatches.forEach((sentence, idx) => {
      const sentenceTokens = new Set(tokenizeForMatch(sentence))
      let score = 0
      hintTokens.forEach((token) => {
        if (sentenceTokens.has(token)) score += 1
      })
      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    })
  }

  // If no sentence was confidently matched, append to the first sentence.
  const targetIdx = bestIdx >= 0 ? bestIdx : 0
  const target = sentenceMatches[targetIdx]
  const trailingWs = target.match(/\s*$/)?.[0] || ''
  const core = target.slice(0, target.length - trailingWs.length)
  const existingInTarget = new Set()
  core.replace(/(^|[^\w])#([a-zA-Z0-9][a-zA-Z0-9:_-]{0,63})/g, (_m, _p, tag) => {
    existingInTarget.add(normalizeTag(tag))
    return _m
  })
  const missing = tags.filter((tag) => !existingInTarget.has(normalizeTag(tag.replace(/^#/, ''))))
  if (missing.length === 0) return safeLine

  sentenceMatches[targetIdx] = `${core} ${missing.join(' ')}${trailingWs}`
  return sentenceMatches.join('')
}

function dedupeSentenceHashtags(text) {
  const lines = String(text || '').split('\n')
  const dedupedLines = lines.map((line) => {
    if (!line.includes('#')) return line

    const sentenceMatches = line.match(/[^.!?\n]+[.!?]*(?:\s+|$)/g)
    if (!sentenceMatches || sentenceMatches.length === 0) return line

    const normalizedSentences = sentenceMatches.map((sentence) => {
      const seen = new Set()
      return sentence.replace(/(^|[^\w])#([a-zA-Z0-9][a-zA-Z0-9:_-]{0,63})/g, (full, prefix, tag) => {
        const norm = normalizeTag(tag)
        if (!norm) return `${prefix}#${tag}`
        if (seen.has(norm)) return prefix
        seen.add(norm)
        return `${prefix}#${tag}`
      }).replace(/\s{2,}/g, ' ')
    })

    return normalizedSentences.join('')
  })

  return dedupedLines.join('\n')
}

function escapeRegex(source) {
  return String(source || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceWholeWordIgnoreCase(text, needle, replacement) {
  const raw = String(text || '')
  const word = String(needle || '').trim()
  if (!raw || !word) return raw
  const rx = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegex(word)})(?=$|[^A-Za-z0-9_])`, 'gi')
  return raw.replace(rx, (_m, p1) => `${p1}${replacement}`)
}

function applyEntityResolutions(noteContent, resolvedEntities = []) {
  let next = String(noteContent || '')
  const preResolvedUnknownEntities = []
  const suppressedUnknownEntities = []

  const addSuppressed = (type, name) => {
    const t = String(type || '').trim().toLowerCase()
    const n = String(name || '').trim()
    if (!t || !n) return
    const exists = suppressedUnknownEntities.some((entity) =>
      String(entity?.type || '').toLowerCase() === t && String(entity?.name || '').toLowerCase() === n.toLowerCase()
    )
    if (!exists) suppressedUnknownEntities.push({ type: t, name: n })
  }

  const suppressProjectParts = (name) => {
    const words = String(name || '')
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9'_\-]/g, '').trim())
      .filter((word) => word.length >= 2)
    for (const word of words) addSuppressed('project', word)
  }

  for (const entity of resolvedEntities || []) {
    const originalName = String(entity?.originalName || '').trim()
    const correctedName = String(entity?.correctedName || originalName).trim()
    const type = String(entity?.type || '').trim().toLowerCase()
    const resolution = String(entity?.resolution || 'create').trim().toLowerCase()

    if (!originalName || !type) continue

    if (resolution === 'dismissed') {
      addSuppressed(type, originalName)
      if (type === 'project') suppressProjectParts(originalName)
      continue
    }

    const linkedName = correctedName || originalName
    next = replaceWholeWordIgnoreCase(next, originalName, `[[${linkedName}]]`)
    addSuppressed(type, originalName)
    if (type === 'project') suppressProjectParts(originalName)

    if (resolution === 'link') {
      addSuppressed(type, linkedName)
      if (type === 'project') suppressProjectParts(linkedName)
    }

    if (resolution === 'create') {
      preResolvedUnknownEntities.push({ type, name: linkedName })
    }
  }

  return {
    noteContent: next,
    preResolvedUnknownEntities,
    suppressedUnknownEntities,
  }
}

function tagsForChange(change) {
  const marker = normalizeTag(change?.marker)
  const tags = []
  if (marker) tags.push(marker)

  // Entity slug intentionally NOT added — wikilinks already serve as connectors.

  const text = `${change?.title || ''} ${change?.content || ''}`.toLowerCase()
  if (/\b(urgent|asap|immediately|critical|blocker)\b/.test(text)) {
    tags.push('urgent')
  }
  if (/\b(important|priority|high-priority|high priority)\b/.test(text)) {
    tags.push('important')
  }

  return [...new Set(tags)]
}

function annotateRoutingTags(markdown, changes = []) {
  const lines = String(markdown || '').split('\n')

  const paragraphs = []
  let current = []
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const norm = normalizeLineForMatch(raw)

    if (!norm) {
      if (current.length > 0) {
        paragraphs.push(current)
        current = []
      }
      continue
    }

    if (norm.startsWith('#')) {
      if (current.length > 0) {
        paragraphs.push(current)
        current = []
      }
      continue
    }

    current.push(i)
  }
  if (current.length > 0) paragraphs.push(current)

  let fallbackParagraphCursor = 0

  for (const change of changes) {
    const tags = tagsForChange(change)
    if (tags.length === 0) continue

    const titleNeedle = normalizeLineForMatch(change?.title)
    const contentNeedle = normalizeLineForMatch(String(change?.content || '').replace(/^-\s*\[[ x]\]\s*/i, '').trim())
    const needles = [titleNeedle, contentNeedle].filter(Boolean)

    let targetIndex = -1
    if (needles.length > 0) {
      targetIndex = lines.findIndex((line) => {
        const norm = normalizeLineForMatch(line)
        if (!norm || norm.startsWith('#')) return false
        return needles.some((needle) => needle && norm.includes(needle))
      })
    }

    if (targetIndex === -1 && needles.length > 0) {
      for (const para of paragraphs) {
        const paraNorm = normalizeLineForMatch(para.map((idx) => lines[idx]).join(' '))
        if (needles.some((needle) => needle && paraNorm.includes(needle))) {
          targetIndex = para[para.length - 1]
          break
        }
      }
    }

    if (targetIndex === -1 && paragraphs.length > 0) {
      const contentTokens = tokenizeForMatch(change?.content || change?.title || '')
      if (contentTokens.length > 0) {
        let bestScore = 0
        let bestIdx = -1
        for (const para of paragraphs) {
          const paraTokens = new Set(tokenizeForMatch(para.map((idx) => lines[idx]).join(' ')))
          const overlap = contentTokens.reduce((acc, token) => acc + (paraTokens.has(token) ? 1 : 0), 0)
          if (overlap > bestScore) {
            bestScore = overlap
            bestIdx = para[para.length - 1]
          }
        }
        if (bestScore > 0) targetIndex = bestIdx
      }
    }

    if (targetIndex === -1) {
      if (paragraphs.length > 0) {
        const para = paragraphs[fallbackParagraphCursor % paragraphs.length]
        fallbackParagraphCursor += 1
        targetIndex = para[para.length - 1]
      } else {
        targetIndex = lines.findIndex((line) => {
          const norm = normalizeLineForMatch(line)
          return norm && !norm.startsWith('#')
        })
      }
    }

    if (targetIndex >= 0 && targetIndex < lines.length) {
      const hashTags = tags.map((tag) => `#${tag}`)
      lines[targetIndex] = injectTagsIntoBestSentence(lines[targetIndex], hashTags, [change?.title, change?.content])
    }
  }

  return dedupeSentenceHashtags(lines.join('\n'))
}

function dedupeRoutingChanges(changes = []) {
  const seen = new Set()
  const out = []
  for (const change of changes || []) {
    const key = [change?.target_file, change?.target_section, change?.marker, change?.title, change?.content]
      .map((value) => String(value || '').trim().toLowerCase())
      .join('||')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(change)
  }
  return out
}

function stripHashtagRoutingLines(markdown) {
  return String(markdown || '')
    .split('\n')
    .map((line) => line.replace(/\s*#(?:action|decision|delegate|follow-up|important|urgent|idea)\b/gi, ''))
    .map((line) => line.replace(/\s{2,}/g, ' ').trimEnd())
    .join('\n')
}

export default function InboxPage({ file, readFile, writeFile, deleteFile, listTree, settings, setPage, onWikilinkClick, onArchiveFile, onDeleteFile, onConfirmAction, onBusyChange, onProcessedNote, onProcessedState }) {
  const [filePath, setFilePath] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [title, setTitle] = useState('')
  const [editorBody, setEditorBody] = useState('')
  const [processedState, setProcessedStateLocal] = useState({ processed: false, processed_at: null, tags: [] })

  const loadFile = useCallback(async (path) => {
    setLoading(true)
    try {
      const raw = await readFile(path)
      const { body } = parseFrontmatter(raw)
      const cleanBody = stripLegacyFrontmatter(body || raw)
      const unescaped = unescapeWikilinks(cleanBody)
      const parsed = splitTitleBody(unescaped)
      if (parsed.title) {
        const titleLine = parsed.title
        const bodyLines = parsed.body
        setTitle(titleLine)
        setEditorBody(bodyLines)
      } else {
        setTitle('')
        setEditorBody(unescaped)
      }
      setFilePath(path)

      const saved = await getProcessedState(path)
      const noteForCheck = parsed.title ? `# ${parsed.title}\n\n${parsed.body}` : unescaped
      const hasContent = hasProcessableNoteContent(noteForCheck)
      if (!hasContent && saved?.processed) {
        await clearProcessedState(path)
        setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
      } else {
        setProcessedStateLocal(saved || { processed: false, processed_at: null, tags: [] })
      }
    } catch {
      setTitle('')
      setEditorBody('')
      setFilePath(path)
      setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
    }
    setLoading(false)
  }, [readFile])

  useEffect(() => {
    const target = file || todayInboxPath()
    loadFile(target)
  }, [file, loadFile])

  useEffect(() => {
    onBusyChange?.(loading)
    return () => onBusyChange?.(false)
  }, [loading, onBusyChange])

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
            {filePath?.replace('inbox/', '') || ''}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <InboxEditor
      key={filePath}
      filePath={filePath}
      readFile={readFile}
      writeFile={writeFile}
      deleteFile={deleteFile}
      listTree={listTree}
      settings={settings}
      title={title}
      editorBody={editorBody}
      setTitle={setTitle}
      setEditorBody={setEditorBody}
      processedState={processedState}
      setProcessedStateLocal={setProcessedStateLocal}
      setPage={setPage}
      onWikilinkClick={onWikilinkClick}
      onBusyChange={onBusyChange}
      onProcessedNote={onProcessedNote}
      onProcessedState={onProcessedState}
      onArchiveFile={onArchiveFile}
      onDeleteFile={onDeleteFile}
      onConfirmAction={onConfirmAction}
    />
  )
}

function InboxEditor({ filePath, readFile, writeFile, deleteFile, listTree, settings, title, editorBody, setTitle, setEditorBody, processedState, setProcessedStateLocal, setPage, onWikilinkClick, onArchiveFile, onDeleteFile, onConfirmAction, onBusyChange, onProcessedNote, onProcessedState }) {
  const [saving, setSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState('')
  const [dictateHover, setDictateHover] = useState(false)
  const [processHover, setProcessHover] = useState(false)
  const [processNotice, setProcessNotice] = useState('')
  const [approvedChangeIds, setApprovedChangeIds] = useState(new Set())
  const [cleanupDraft, setCleanupDraft] = useState(null)
  const saveTimer = useRef(null)
  const { process, status, result, error, reset: resetProcessor } = useNoteProcessor()
  const [showReview, setShowReview] = useState(false)
  const [routingResult, setRoutingResult] = useState(null)
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [allowedFiles, setAllowedFiles] = useState([])

  const { EditorComponent, appendText } = useMarkdownEditor()

  useEffect(() => {
    let cancelled = false
    const loadTags = async () => {
      try {
        const raw = await readFile('context/tags.md')
        const tags = parseTagsFromContent(raw)
        if (!cancelled) setTagSuggestions(tags)
      } catch {
        if (!cancelled) setTagSuggestions([])
      }
    }
    loadTags()
    return () => { cancelled = true }
  }, [readFile, filePath])

  useEffect(() => {
    let cancelled = false
    // Warm file index and keep result for wikilink suggestions + Process Note
    getFileIndex(listTree, buildAllowedFiles)
      .then((files) => { if (!cancelled) setAllowedFiles(files || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [listTree, filePath])

  useEffect(() => {
    onBusyChange?.(saving || status === 'loading')
    return () => onBusyChange?.(false)
  }, [saving, status, onBusyChange])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const buildContent = (body, heading = title) => {
    return buildInboxNoteBody(body, heading)
  }

  const liveNoteTags = extractTagsFromMarkdown(buildContent(editorBody))

  // Derive entity suggestions for the wikilink autocomplete in the editor
  const wikilinkSuggestions = useMemo(() => {
    const TYPE_MAP = { people: 'person', projects: 'project', ideas: 'idea' }
    const RANK = { person: 0, project: 1, idea: 2, note: 3 }
    const em = settings?.enabledModules || {}
    const seen = new Set()
    const suggestions = []
    for (const path of allowedFiles) {
      if (seen.has(path)) continue
      seen.add(path)
      const parts = path.split('/')
      const folder = parts[0]
      // Exclude files from disabled modules
      if (folder === 'people'    && em.people    === false) continue
      if (folder === 'projects'  && em.projects  === false) continue
      if (folder === 'ideas'     && em.ideas     === false) continue
      const base = (parts[parts.length - 1] || '').replace(/\.md$/i, '')
      if (!base) continue
      const name = base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      suggestions.push({ name, path, type: TYPE_MAP[folder] || 'note' })
    }
    suggestions.sort((a, b) => (RANK[a.type] ?? 3) - (RANK[b.type] ?? 3) || a.name.localeCompare(b.name))
    return suggestions
  }, [allowedFiles, settings?.enabledModules])

  const queueSave = (body, heading = title) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (!filePath) return
      setSaving(true)
      const cleanBody = unescapeWikilinks(buildContent(body, heading))
      writeFile(filePath, cleanBody)
        .then(() => {
          const savedAt = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          setLastSavedTime(savedAt)
          setSaving(false)
        })
        .catch(() => setSaving(false))
    }, 800)
  }

  const handleChange = (val) => {
    const nextBody = stripLeadingH1(val)
    setEditorBody(nextBody)
    queueSave(nextBody)
  }

  const handleTitleChange = (val) => {
    setTitle(val)
    queueSave(editorBody, val)
  }

  const { isListening, isSupported, start, stop, transcript, interimTranscript, reset } = useVoiceDictation()

  // Append only the new portion of the transcript since last update
  const prevTranscript = useRef('')
  useEffect(() => {
    if (!transcript) return
    const newPart = transcript.slice(prevTranscript.current.length)
    if (newPart) {
      appendText(newPart)
    }
    prevTranscript.current = transcript
  }, [transcript]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDictate = () => {
    if (isListening) {
      stop()
    } else {
      reset()
      prevTranscript.current = ''
      start()
    }
  }

  const isInboxFile = filePath?.startsWith('inbox/')
  const isProcessed = processedState?.processed === true
  const hasContent = hasProcessableNoteContent(buildContent(editorBody))
  const canProcess = hasContent
  const canFile = isProcessed
  const processLabel = isProcessed ? 'Reprocess' : 'Process note'

  const handleProcessNote = async () => {
    setRoutingResult(null)
    setShowReview(false)
    let allowedFiles = []
    try {
      allowedFiles = await getFileIndex(listTree, buildAllowedFiles, true)
    } catch {}

    const noteContent = unescapeWikilinks(buildContent(editorBody))
    console.log('[ProcessNote] noteContent after unescape:', noteContent?.slice(0, 200))
    console.log('[ProcessNote] allowedFiles count:', allowedFiles?.length, 'enabledModules:', settings?.enabledModules)
    if (!hasProcessableNoteContent(noteContent)) {
      resetProcessor()
      setProcessNotice('Add some note content before processing. Title-only notes are not processed.')
      return
    }
    setProcessNotice('')
    const prepass = runCleanupPrepass(noteContent, allowedFiles, settings?.enabledModules || {})

    setCleanupDraft({
      noteContent: prepass.noteContent.replace(/<br\s*\/?>/gi, '\n\n'),
      noteFilename: filePath,
      unknownPeople: prepass.unknownPeople,
      unknownProjects: prepass.unknownProjects,
      allowedFiles,
      enabledModules: settings?.enabledModules || {},
    })
    resetProcessor()
  }

  const handleCleanupConfirm = async ({ correctedNote, resolvedEntities }) => {
    const corrected = applyEntityResolutions(correctedNote, resolvedEntities)
    setRoutingResult(null)
    const createdPaths = []

    // Create all new entities first, before LLM routing runs.
    for (const entity of resolvedEntities || []) {
      if (entity?.resolution === 'create' && entity?.correctedName?.trim()) {
        try {
          const folder = entity.type === 'person'
            ? 'people'
            : entity.type === 'project'
              ? 'projects'
              : 'ideas'
          const generated = generateFile(folder, entity.correctedName.trim(), {
            relationship: entity.type === 'person' ? entity.relationship : '',
            role: entity.type === 'person' ? entity.role : '',
          })
          if (generated?.content) {
            let content = generated.content
            if (folder === 'people' && !/^type:\s*person\s*$/im.test(content)) {
              content = content.startsWith('---\n')
                ? content.replace(/^---\n/, '---\ntype: person\n')
                : `---\ntype: person\n---\n\n${content}`
            }
            const slug = toSlug(entity.correctedName.trim())
            const createdPath = `${folder}/${slug}.md`
            await writeFile(createdPath, content)
            createdPaths.push(createdPath)
          }
        } catch (err) {
          console.warn('Entity pre-creation failed:', err?.message || err)
        }
      }
    }

    if (createdPaths.length > 0) {
      await invalidateFileIndex()
    }

    setCleanupDraft(null)
    setProcessNotice('')
    try {
      const annotated = unescapeWikilinks(corrected.noteContent)
      const normalizedAnnotated = normalizeInboxMarkdown(splitMergedDateHeading(annotated))
      const parsed = splitTitleBody(normalizedAnnotated)
      const annotatedBody = parsed.title ? parsed.body : normalizedAnnotated
      const cleanBody = unescapeWikilinks(normalizedAnnotated)
      await writeFile(filePath, cleanBody)

      const today = new Date().toISOString().slice(0, 10)
      const detectedTags = extractHashtags(cleanBody)
      const nextState = { processed: true, processed_at: today, tags: detectedTags }
      await setProcessedState(filePath, nextState)
      setProcessedStateLocal(nextState)

      if (parsed.title) {
        setTitle(parsed.title)
        setEditorBody(parsed.body)
      } else {
        setEditorBody(annotatedBody)
      }
      setProcessNotice('Note processed — review and hit File note when ready')
      resetProcessor()
      setApprovedChangeIds(new Set())
      await onProcessedState?.({
        stage: 'processed',
        source: filePath,
        createdPaths,
      })
    } catch (err) {
      console.error('Processing failed:', err)
      setProcessNotice(`Processing failed: ${err?.message || 'Unknown error'}. Try again or check your API settings.`)
    }
  }

  const handleFileNote = async () => {
    if (!filePath || !canFile) return
    setRoutingResult(null)
    setShowReview(false)

    const currentState = await getProcessedState(filePath)
    if (!currentState?.processed) {
      setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })
      setProcessNotice('This note must be processed before filing.')
      return
    }

    console.log('[FileNote] started', {
      filePath,
      canFile,
      processed: currentState?.processed,
    })

    let raw = ''
    try {
      raw = await readFile(filePath)
    } catch (err) {
      console.error('Failed to reload processed note:', err?.message || err)
      setProcessNotice('Could not reload the note from disk.')
      return
    }

    const { body } = parseFrontmatter(raw)
    const fileBody = stripLegacyFrontmatter(body || raw)
    const cleanBody = normalizeInboxMarkdown(splitMergedDateHeading(unescapeWikilinks(fileBody)))

    const allowedFiles = await getFileIndex(listTree, buildAllowedFiles, true).catch(() => [])
    const hashtagRaw = extractHashtagChanges(cleanBody, filePath)
    const hashtagChanges = resolveHashtagTargets(hashtagRaw, allowedFiles)
    const noteForLLMRaw = stripHashtagRoutingLines(cleanBody)
    // Skip splitMergedDateHeading if content already has a correct # DD-MM-YYYY\n\n heading
    const alreadyNormalizedHeading = /^#\s+\d{2}-\d{2}-\d{4}\n\n/.test(noteForLLMRaw)
    const noteForLLM = alreadyNormalizedHeading ? noteForLLMRaw : normalizeInboxMarkdown(splitMergedDateHeading(noteForLLMRaw))

    // Resolve writerFile: use settings value, or fall back to any people/*.md with relationship: Me
    let resolvedWriterFile = settings?.writerFile || ''
    // Ignore a writerFile that doesn't exist in THIS vault (e.g. a stale owner
    // carried over from a previously opened vault) so the relationship: Me scan
    // below can resolve the current vault's owner instead.
    if (resolvedWriterFile && !allowedFiles.includes(resolvedWriterFile)) {
      resolvedWriterFile = ''
    }
    if (!resolvedWriterFile && settings?.enabledModules?.people !== false) {
      const peoplePaths = allowedFiles.filter(p => p.startsWith('people/') && p.endsWith('.md'))
      for (const p of peoplePaths) {
        try {
          const raw = await readFile(p)
          const { fields } = parseFrontmatter(raw)
          if (String(fields?.relationship || '').trim().toLowerCase() === 'me') {
            resolvedWriterFile = p
            break
          }
        } catch {}
      }
    }
    const effectiveSettings = resolvedWriterFile !== (settings?.writerFile || '')
      ? { ...settings, writerFile: resolvedWriterFile }
      : settings

    const moduleRoutingOptions = {
      peopleModuleEnabled: settings?.enabledModules?.people !== false,
      ideasModuleEnabled: settings?.enabledModules?.ideas !== false,
      writerFile: resolvedWriterFile,
    }
    const enabledFolders = ['projects', 'people', 'ideas'].filter((folder) => settings?.enabledModules?.[folder] !== false)
    const scopedAllowedFiles = (allowedFiles || []).filter((path) => enabledFolders.includes(String(path || '').split('/')[0]))

    try {
      let contextContent = ''
      try {
        contextContent = await readFile('context/_context.md')
      } catch {}

      console.log('[FileNote] calling LLM', {
        noteForLLMLength: noteForLLM?.length,
        allowedFilesCount: allowedFiles?.length,
        scopedCount: scopedAllowedFiles?.length,
      })
      console.log('[Timing] process() start', Date.now())

      const llmResult = await process({
        noteContent: noteForLLM,
        noteFilename: filePath,
        contextContent,
        allowedFiles,
        settings: effectiveSettings,
        enabledModules: settings?.enabledModules || {},
        preResolvedUnknownEntities: [],
        suppressedUnknownEntities: [],
      })

      console.log('[Timing] process() end', Date.now())
      console.log('[FileNote] process() returned', {
        changesCount: llmResult?.changes?.length,
      })

      // Shape-based mention detection — the model sometimes emits a Recent
      // Mentions log entry but mislabels it as an action routed to ## Open
      // Actions. The content SHAPE is the reliable signal, not the marker:
      //   - title is literally "mention", OR
      //   - content begins with a dated log line "[[DD-MM-YYYY]] — ..." / "DD-MM-YYYY — ..."
      // Tasks are imperative and never carry this dated-narrative shape.
      const isMentionShaped = (change) => {
        const title = String(change?.title || '').trim().toLowerCase()
        if (title === 'mention') return true
        const content = String(change?.content || '').trim()
        return /^-?\s*\[{0,2}\d{1,2}-\d{1,2}-\d{4}\]{0,2}\s*[—–-]\s+/.test(content)
      }

      const isTaskLikeChange = (change) => {
        const marker = String(change?.marker || '').toLowerCase()
        // mention marker is always a mention — never treat it as a task regardless of content
        if (marker === 'mention') return false
        // mention-SHAPED content is always a mention even if the model labelled
        // it action/follow-up and routed it to a task section
        if (isMentionShaped(change)) return false
        const content = String(change?.content || '')
        const text = `${change?.title || ''} ${content}`.toLowerCase()
        if (/^-\s*\[[ x]\]/i.test(content)) return true
        if (['action', 'delegate', 'follow-up', 'decision', 'urgent', 'important'].includes(marker)) return true
        return /\b(todo|task|action item|next step|follow up|check in|delegate)\b/.test(text)
      }

      const llmMentionChanges = (llmResult?.changes || [])
        .filter((change) => {
          const marker = String(change?.marker || '').toLowerCase()
          const section = String(change?.target_section || '').toLowerCase()
          return (marker === 'mention' || section.includes('recent mentions') || isMentionShaped(change)) && !isTaskLikeChange(change)
        })
        .map((change) => {
          // Force mislabelled mentions back to the Recent Mentions section so
          // applyChange logs them correctly instead of writing a task entry.
          const marker = String(change?.marker || '').toLowerCase()
          const section = String(change?.target_section || '').toLowerCase()
          if (marker !== 'mention' || !section.includes('recent mentions')) {
            return { ...change, marker: 'mention', target_section: '## Recent Mentions' }
          }
          return change
        })

      const autoMentionChanges = dedupeRoutingChanges([
        ...llmMentionChanges,
      ])

      // Recent mentions are tracking metadata, so apply them automatically
      // and keep them out of the manual approval flow.
      for (const change of autoMentionChanges) {
        try {
          await applyChange(readFile, writeFile, change, filePath, moduleRoutingOptions)
        } catch (err) {
          console.warn('Auto mention apply failed:', err?.message || err)
        }
      }

      const mergedResult = {
        ...llmResult,
        annotated_note: cleanBody,
        changes: dedupeRoutingChanges([
          ...hashtagChanges,
          ...(llmResult?.changes || []).filter((change) => {
            if (change?.fromHashtag) return false
            const marker = String(change?.marker || '').toLowerCase()
            const section = String(change?.target_section || '').toLowerCase()
            // Decisions on people files are invalid — suppress from review queue
            if (marker === 'decision' && String(change?.target_file || '').startsWith('people/')) return false
            if (isTaskLikeChange(change)) return true
            return !(marker === 'mention' || section.includes('recent mentions') || isMentionShaped(change))
          }),
        ]),
      }

      if (mergedResult.changes.length === 0 && autoMentionChanges.length > 0) {
        setProcessNotice('Mentions applied automatically. No tasks found — review and file or add tasks manually.')
      }

      setRoutingResult(mergedResult)
      setApprovedChangeIds(new Set())
      setShowReview(true)
      if (!(mergedResult.changes.length === 0 && autoMentionChanges.length > 0)) {
        setProcessNotice('')
      }
    } catch (err) {
      console.error('Routing failed:', err)
      setShowReview(false)
      resetProcessor()
      setProcessNotice(`Routing failed: ${err?.message || 'Unknown error'}. Try again or check your API settings.`)
    }
  }

  const handleApprove = async (change) => {
    let existedBefore = true
    try {
      await readFile(change.target_file)
    } catch {
      existedBefore = false
    }

    await applyChange(readFile, writeFile, change, filePath, {
      peopleModuleEnabled: settings?.enabledModules?.people !== false,
      ideasModuleEnabled: settings?.enabledModules?.ideas !== false,
      writerFile: settings?.writerFile || '',
    })
    setApprovedChangeIds((prev) => new Set([...prev, change.id]))

    // Re-index only when approval created a previously-missing file.
    if (!existedBefore) {
      await invalidateFileIndex()
    }
  }

  const handleDismiss = () => {}

  const handleCancelReview = () => {
    setShowReview(false)
    setProcessNotice('Routing review canceled. Note kept in inbox.')
    setApprovedChangeIds(new Set())
    resetProcessor()
  }

  const handleDone = async () => {
    setShowReview(false)

    const finalResult = routingResult || result

    if (!hasProcessableNoteContent(finalResult?.annotated_note || buildContent(editorBody))) {
      resetProcessor()
      setApprovedChangeIds(new Set())
      return
    }

    const approvedChanges = (finalResult?.changes || []).filter((change) => approvedChangeIds.has(change.id))

    if (finalResult && filePath) {
      const annotated = finalResult.annotated_note || buildContent(editorBody)
      const notesPath = filePath.replace('inbox/', 'notes/')

      try {
        clearTimeout(saveTimer.current)
        const withTags = annotateRoutingTags(annotated, approvedChanges)

        // If a notes file for this date already exists, append the new content
        // rather than overwriting it. Otherwise move the inbox file normally.
        let existingNotesContent = null
        try { existingNotesContent = await readFile(notesPath) } catch { /* file doesn't exist yet */ }

        if (existingNotesContent != null) {
          // Delete the inbox file and append to the existing notes file.
          // Strip the leading H1 (date heading) from the new content since it's already
          // in the existing file — the date is the filename, no need to repeat it.
          if (typeof deleteFile === 'function') await deleteFile(filePath)
          const newBody = withTags.replace(/^\s*#\s+.+\n+/, '').trimStart()
          await writeFile(notesPath, existingNotesContent.trimEnd() + '\n\n' + newBody)
        } else {
          await moveFile(readFile, writeFile, deleteFile, filePath, notesPath)
          await writeFile(notesPath, withTags)
        }

        await clearProcessedState(filePath)
        setProcessedStateLocal({ processed: false, processed_at: null, tags: [] })

        const detectedTags = extractTagsFromMarkdown(withTags)
        await mergeTagsIntoIndex(readFile, writeFile, detectedTags)
        setTagSuggestions((prev) => [...new Set([...prev, ...detectedTags])].sort((a, b) => a.localeCompare(b)))

        const entityNames = [...new Set(
          approvedChanges
            .map((change) => String(change?.target_file || ''))
            .filter((path) => path.startsWith('people/') || path.startsWith('projects/'))
            .map((path) => {
              const base = path.split('/').pop()?.replace(/\.md$/i, '') || ''
              return base
                .replace(/[-_]+/g, ' ')
                .trim()
                .split(/\s+/)
                .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part)
                .join(' ')
            })
            .filter(Boolean)
        )]

        const decisions = approvedChanges
          .filter((change) => String(change?.marker || '').toLowerCase() === 'decision' || String(change?.target_section || '').toLowerCase().includes('decision'))
          .map((change) => String(change?.title || '').trim())
          .filter(Boolean)

        const tasksCreated = approvedChanges.filter((change) => /^-\s*\[[ x]\]/i.test(String(change?.content || ''))).length
        const summaryParts = []
        if (entityNames.length > 0) summaryParts.push(`Mentioned ${entityNames.join(', ')}`)
        summaryParts.push(`Approved ${approvedChanges.length} change${approvedChanges.length === 1 ? '' : 's'}`)
        summaryParts.push(`Created ${tasksCreated} task${tasksCreated === 1 ? '' : 's'}`)

        try {
          await appendActivityEntry(writeFile, readFile, {
            note_source: filePath,
            entities_mentioned: entityNames,
            tasks_created: tasksCreated,
            decisions,
            summary: summaryParts.join('. ') + '.',
          })
        } catch (err) {
          console.warn('Activity log append failed', err)
        }

        await onProcessedNote?.(notesPath)
        setPage?.('viewer', notesPath)
        setRoutingResult(null)

        // Always rebuild context in the background after a successful filing
        rebuildIndexFiles(readFile, writeFile, listTree)
          .then(({ changed, entityNameMap }) => {
            if (changed) return rebuildContext(readFile, writeFile, settings, entityNameMap)
          })
          .catch((err) => console.warn('Background context rebuild failed:', err?.message || err))
      } catch (err) {
        console.error('Failed to move note:', err.message)
      }
    }

    resetProcessor()
    setApprovedChangeIds(new Set())
  }

  const handleArchive = async () => {
    if (!filePath?.startsWith('inbox/')) return
    try {
      await onArchiveFile?.(filePath)
      await invalidateFileIndex()
      setPage?.('command')
    } catch (err) {
      console.error('Failed to archive inbox note:', err.message)
    }
  }

  const handleDelete = async () => {
    if (!filePath) return
    try {
      await onDeleteFile?.(filePath)
      await invalidateFileIndex()
      setPage?.('command')
    } catch (err) {
      console.error('Failed to delete inbox note:', err.message)
    }
  }

  const noteDateStr = filePath ? filePath.replace('inbox/', '').replace('.md', '') : ''
  const headerDate = (() => {
    if (!noteDateStr) return ''
    const parts = noteDateStr.split('-')
    if (parts.length !== 3) return noteDateStr
    const [dd, mm, yyyy] = parts
    const date = new Date(`${yyyy}-${mm}-${dd}`)
    if (Number.isNaN(date.getTime())) return noteDateStr
    const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
    return `${noteDateStr} · ${day}${lastSavedTime ? ` · ${lastSavedTime}` : ''}`
  })()

  return (
    <div className="flex flex-col h-full">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 48px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-very-dim)',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {headerDate}
        </span>

        {liveNoteTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {liveNoteTags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: 'oklch(0.74 0.17 300 / 0.16)',
                  color: 'oklch(0.84 0.14 300)',
                  border: '1px solid oklch(0.74 0.17 300 / 0.40)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {saving && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saving…</span>
          )}

          {isSupported && (
            <button
              onClick={handleDictate}
              disabled={!isSupported}
              onMouseEnter={() => setDictateHover(true)}
              onMouseLeave={() => setDictateHover(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: isListening
                  ? (dictateHover ? 'oklch(0.70 0.18 22 / 0.24)' : 'oklch(0.70 0.18 22 / 0.16)')
                  : (dictateHover ? 'var(--panel-2)' : 'var(--panel)'),
                color: isListening ? 'oklch(0.84 0.16 22)' : 'var(--text)',
                border: `1px solid ${isListening
                  ? (dictateHover ? 'oklch(0.70 0.18 22 / 0.55)' : 'oklch(0.70 0.18 22 / 0.40)')
                  : (dictateHover ? 'var(--border-strong)' : 'var(--border)')}`,
                borderRadius: 8,
                fontSize: 13,
                cursor: isSupported ? 'pointer' : 'not-allowed',
                opacity: isSupported ? 1 : 0.4,
                fontFamily: 'inherit',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: isListening ? 'oklch(0.75 0.20 22)' : 'var(--text-very-dim)',
                  boxShadow: isListening ? '0 0 0 4px oklch(0.70 0.18 22 / 0.20)' : 'none',
                  animation: isListening ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
                }}
              />
              {isListening ? 'Recording…' : 'Dictate'}
            </button>
          )}

          {isInboxFile && (
            <TrashMenuButton
              label={title || noteDateStr || 'this note'}
              onConfirmAction={onConfirmAction}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}

          {isInboxFile && (
            <div style={{ display: 'flex', gap: 8 }}>
              {canProcess ? (
                <PrimaryButton onClick={handleProcessNote}>{processLabel}</PrimaryButton>
              ) : (
                <SecondaryButton disabled>{processLabel}</SecondaryButton>
              )}

              {canFile ? (
                <PrimaryButton onClick={handleFileNote} loading={status === 'loading'}>
                  File note
                </PrimaryButton>
              ) : (
                <SecondaryButton disabled>File note</SecondaryButton>
              )}
            </div>
          )}
        </div>
      </div>

      {isProcessed && (
        <div style={{
          padding: '6px 48px',
          fontSize: 11.5,
          color: 'var(--text-very-dim)',
          borderBottom: '1px solid var(--border-subtle)',
          letterSpacing: '0.03em',
        }}>
          ✓ Processed {processedState.processed_at} · ready to file
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled — type a subject or leave blank"
            style={{
              display: 'block',
              width: '100%',
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              marginBottom: 20,
              fontFamily: 'inherit',
            }}
          />
          <div className="milkdown-wrapper">
            <EditorComponent
              initialValue={editorBody}
              onChange={handleChange}
              onWikilinkClick={onWikilinkClick}
              tagSuggestions={tagSuggestions}
              interimPreview={isListening ? interimTranscript : ''}
              wikilinkSuggestions={wikilinkSuggestions}
            />
          </div>
        </div>
      </div>

      {showReview && result && (
        <RoutingReview
          result={routingResult || result}
          onApprove={handleApprove}
          onDismiss={handleDismiss}
          onDone={handleDone}
          onCancel={handleCancelReview}
          onWikilinkClick={onWikilinkClick}
        />
      )}

      {cleanupDraft && (
        <CleanupModal
          noteContent={cleanupDraft.noteContent}
          noteFilename={cleanupDraft.noteFilename}
          unknownPeople={cleanupDraft.unknownPeople}
          unknownProjects={cleanupDraft.unknownProjects}
          allowedFiles={cleanupDraft.allowedFiles}
          enabledModules={cleanupDraft.enabledModules}
          onConfirm={handleCleanupConfirm}
          onCancel={() => {
            setCleanupDraft(null)
            setProcessNotice('Review before routing canceled. Note kept in inbox.')
          }}
        />
      )}

      {status === 'error' && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded shadow-lg z-50">
          {isAuthErrorMessage(error) ? 'Processing failed - check API key in Settings' : 'Processing failed'}
          {error ? `: ${error}` : ''}
        </div>
      )}

      {processNotice && status !== 'error' && (
        <div className="fixed bottom-4 right-4 bg-[var(--panel-pop)] text-[var(--text)] text-sm px-4 py-3 rounded shadow-lg z-50 border border-[var(--border-strong)] max-w-sm">
          {processNotice}
        </div>
      )}
    </div>
  )
}
