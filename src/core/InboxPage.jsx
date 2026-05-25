import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import { useNoteProcessor } from '../hooks/useNoteProcessor'
import { applyChange } from '../lib/approvalHandler'
import { rebuildContext } from '../lib/rebuildContext'
import { moveFile } from '../lib/vaultWriter'
import { buildAllowedFiles } from '../lib/vaultScanner'
import { getFileIndex, invalidateFileIndex } from '../lib/fileIndex'
import { extractTagsFromMarkdown, mergeTagsIntoIndex, normalizeTag, parseTagsFromContent } from '../lib/tags'
import { autoLinkPeopleMentions } from '../lib/wikilinks'
import EntityCreateModal from '../components/EntityCreateModal'
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
  const parsed = splitTitleBody(markdown)
  if (!parsed.title) return markdown || ''

  const body = stripLeadingH1(parsed.body)
  return body ? `# ${parsed.title}\n\n${body}` : `# ${parsed.title}\n`
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

function tagsForChange(change) {
  const marker = normalizeTag(change?.marker)
  const tags = []
  if (marker) tags.push(marker)

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

export default function InboxPage({ file, readFile, writeFile, deleteFile, listTree, settings, setPage, onArchiveFile, onDeleteFile, onConfirmAction, onBusyChange, onProcessedNote }) {
  const [filePath, setFilePath] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [title, setTitle] = useState('')
  const [editorBody, setEditorBody] = useState('')

  const loadFile = useCallback(async (path) => {
    setLoading(true)
    try {
      const raw = await readFile(path)
      if (raw.trimStart().startsWith('# ')) {
        const lines = raw.split('\n')
        const titleLine = lines[0].replace(/^#+ /, '').trim()
        const bodyLines = lines.slice(1).join('\n').trimStart()
        setTitle(titleLine)
        setEditorBody(bodyLines)
      } else {
        setTitle('')
        setEditorBody(raw)
      }
      setFilePath(path)
    } catch {
      setTitle('')
      setEditorBody('')
      setFilePath(path)
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
      setPage={setPage}
      onBusyChange={onBusyChange}
      onProcessedNote={onProcessedNote}
      onArchiveFile={onArchiveFile}
      onDeleteFile={onDeleteFile}
      onConfirmAction={onConfirmAction}
    />
  )
}

function InboxEditor({ filePath, readFile, writeFile, deleteFile, listTree, settings, title, editorBody, setTitle, setEditorBody, setPage, onArchiveFile, onDeleteFile, onConfirmAction, onBusyChange, onProcessedNote }) {
  const [saving, setSaving] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState('')
  const [dictateHover, setDictateHover] = useState(false)
  const [processHover, setProcessHover] = useState(false)
  const [processNotice, setProcessNotice] = useState('')
  const saveTimer = useRef(null)
  const { process, status, result, error, reset: resetProcessor } = useNoteProcessor()
  const [showReview, setShowReview] = useState(false)
  const [createTarget, setCreateTarget] = useState(null)
  const [tagSuggestions, setTagSuggestions] = useState([])

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
    // Warm file index in the background so Process click does not pay cold-scan cost.
    getFileIndex(listTree, buildAllowedFiles).catch(() => {})
  }, [listTree, filePath])

  useEffect(() => {
    onBusyChange?.(saving || status === 'loading')
    return () => onBusyChange?.(false)
  }, [saving, status, onBusyChange])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const buildContent = (body, heading = title) => {
    const trimmedTitle = heading.trim()
    const sanitizedBody = stripLeadingH1(body)
    return trimmedTitle ? `# ${trimmedTitle}\n\n${sanitizedBody}` : sanitizedBody
  }

  const liveNoteTags = extractTagsFromMarkdown(buildContent(editorBody))

  const queueSave = (body, heading = title) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (!filePath) return
      setSaving(true)
      writeFile(filePath, buildContent(body, heading))
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
    setEditorBody(val)
    queueSave(val)
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
      appendText(newPart + ' ')
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

  const handleProcess = async () => {
    let allowedFiles = []
    try {
      allowedFiles = await getFileIndex(listTree, buildAllowedFiles)
    } catch {}

    const noteContent = buildContent(editorBody)
    if (!hasProcessableNoteContent(noteContent)) {
      resetProcessor()
      setShowReview(false)
      setProcessNotice('Add some note content before processing. Title-only notes are not processed.')
      return
    }

    setProcessNotice('')

    const linkedNoteContent = autoLinkPeopleMentions(noteContent, allowedFiles)

    const nextResult = await process({
      noteContent: linkedNoteContent,
      noteFilename: filePath,
      contextContent: '',
      allowedFiles,
      settings,
      enabledModules: settings?.enabledModules || {},
    })

    if (!hasProcessableNoteContent(nextResult?.annotated_note || linkedNoteContent)) {
      setShowReview(false)
      setProcessNotice('There is not enough content to process this note.')
      return
    }

    setShowReview(true)
  }

  const handleApprove = async (change) => {
    let existedBefore = true
    try {
      await readFile(change.target_file)
    } catch {
      existedBefore = false
    }

    await applyChange(readFile, writeFile, change)

    // Re-index only when approval created a previously-missing file.
    if (!existedBefore) {
      await invalidateFileIndex()
    }
  }

  const handleDismiss = () => {}

  const handleDone = async () => {
    setShowReview(false)

    if (!hasProcessableNoteContent(result?.annotated_note || buildContent(editorBody))) {
      resetProcessor()
      return
    }

    if (result && filePath) {
      const annotated = result.annotated_note || buildContent(editorBody)
      const notesPath = filePath.replace('inbox/', 'notes/')

      try {
        clearTimeout(saveTimer.current)
        const withTags = annotateRoutingTags(annotated, result.changes || [])

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

        const detectedTags = extractTagsFromMarkdown(withTags)
        await mergeTagsIntoIndex(readFile, writeFile, detectedTags)
        setTagSuggestions((prev) => [...new Set([...prev, ...detectedTags])].sort((a, b) => a.localeCompare(b)))

        await onProcessedNote?.(notesPath)
        setPage?.('viewer', notesPath)
      } catch (err) {
        console.error('Failed to move note:', err.message)
      }
    }

    try {
      await rebuildContext(readFile, writeFile, settings)
    } catch (err) {
      console.error('Context rebuild failed - non-fatal:', err.message)
    }

    resetProcessor()
  }

  const handleCreateEntity = (unknown) => setCreateTarget(unknown)

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
            <button
              onClick={handleProcess}
              disabled={status === 'loading'}
              onMouseEnter={() => setProcessHover(true)}
              onMouseLeave={() => setProcessHover(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: status === 'loading'
                  ? 'oklch(0.80 0.13 80 / 0.18)'
                  : (processHover ? 'oklch(0.80 0.13 80 / 0.22)' : 'oklch(0.80 0.13 80 / 0.12)'),
                color: 'oklch(0.88 0.13 80)',
                border: `1px solid ${processHover ? 'oklch(0.80 0.13 80 / 0.55)' : 'oklch(0.80 0.13 80 / 0.36)'}`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: status === 'loading' ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <svg
                viewBox="0 0 16 16"
                width="13"
                height="13"
                fill="currentColor"
                style={{ animation: status === 'loading' ? 'sparkleSpin 1.2s linear infinite' : 'none' }}
              >
                <path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" />
              </svg>
              {status === 'loading' ? 'Processing…' : 'Process note'}
            </button>
          )}
        </div>
      </div>

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
          <div key={filePath} className="milkdown-wrapper">
            <EditorComponent
              initialValue={editorBody}
              onChange={handleChange}
              tagSuggestions={tagSuggestions}
              interimPreview={isListening ? interimTranscript : ''}
            />
          </div>
        </div>
      </div>

      {showReview && result && (
        <RoutingReview
          result={result}
          onApprove={handleApprove}
          onDismiss={handleDismiss}
          onDone={handleDone}
          onCreateEntity={handleCreateEntity}
        />
      )}

      {createTarget && (
        <EntityCreateModal
          unknown={createTarget}
          writeFile={writeFile}
          onCreated={async () => {
            setCreateTarget(null)
            try {
              await invalidateFileIndex()
              // Re-process the note now that the new entity exists
              // This ensures note content gets routed to the newly created person/project/idea
              setTimeout(() => {
                handleProcess()
              }, 100)
            } catch {}
          }}
          onCancel={() => setCreateTarget(null)}
        />
      )}

      {status === 'error' && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded shadow-lg z-50">
          Processing failed - check API key in Settings
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
