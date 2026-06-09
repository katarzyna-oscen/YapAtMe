import { useState, useEffect, useRef, useCallback } from 'react'
import { useMarkdownEditor } from '../hooks/useMarkdownEditor.jsx'
import { useVoiceDictation } from '../hooks/useVoiceDictation'
import TrashMenuButton from '../components/TrashMenuButton'
import { extractTagsFromMarkdown, mergeTagsIntoIndex, parseTagsFromContent } from '../lib/tags'
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

function formatHeaderDate(filePath, lastSavedTime) {
  if (!filePath) return ''
  const raw = filePath.replace('notes/', '').replace('.md', '')
  const dateLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!dateLike) {
    return `${raw.toUpperCase()}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
  }

  const [, yyyy, mm, dd] = dateLike
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return `${raw.toUpperCase()}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
  }

  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase()

  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  const age = daysAgo === 0 ? 'TODAY' : daysAgo === 1 ? '1 DAY AGO' : `${daysAgo} DAYS AGO`

  return `${formatted} · ${age}${lastSavedTime ? ` · saved ${lastSavedTime}` : ''}`
}

export default function ProcessedNoteViewer({
  filePath,
  readFile,
  writeFile,
  deleteFile,
  renameFile,
  fileExists,
  onWikilinkClick,
  onConfirmAction,
  onFileDeleted,
  onFileRenamed,
  wikilinkSuggestions,
  onDisplayNameChanged,
}) {
  const [title, setTitle] = useState('')
  const [editorBody, setEditorBody] = useState('')
  const [noteTags, setNoteTags] = useState([])
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastSavedTime, setLastSavedTime] = useState('')
  const [dictateHover, setDictateHover] = useState(false)
  const saveTimer = useRef(null)
  const prevTranscript = useRef('')
  const renamePending = useRef(false)

  const { EditorComponent, appendText } = useMarkdownEditor()
  const { isListening, isSupported, start, stop, transcript, reset } = useVoiceDictation()

  useEffect(() => {
    if (filePath) loadFile(filePath)
  }, [filePath])

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
    if (!transcript) return
    const newPart = transcript.slice(prevTranscript.current.length)
    if (newPart) appendText(`${newPart} `)
    prevTranscript.current = transcript
  }, [transcript, appendText])

  const loadFile = async (path) => {
    setLoading(true)
    setLastSavedTime('')

    try {
      const raw = await readFile(path)
      const parsed = splitTitleBody(raw)
      if (parsed.title) {
        setTitle(parsed.title)
        setEditorBody(stripLeadingH1(parsed.body))
      } else {
        setTitle('')
        setEditorBody(raw)
      }
      setNoteTags(extractTagsFromMarkdown(raw))
    } catch {
      setTitle('')
      setEditorBody('')
      setNoteTags([])
    }

    setLoading(false)
  }

  const save = useCallback(async (body, heading = title) => {
    if (!filePath) return
    const trimmedTitle = heading.trim()
    const full = trimmedTitle ? `# ${trimmedTitle}\n\n${stripLeadingH1(body)}` : stripLeadingH1(body)

    try {
      await writeFile(filePath, full)
      const tags = extractTagsFromMarkdown(full)
      await mergeTagsIntoIndex(readFile, writeFile, tags)
      setTagSuggestions((prev) => [...new Set([...prev, ...tags])].sort((a, b) => a.localeCompare(b)))
      const t = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      setLastSavedTime(t)
    } catch {}
  }, [filePath, writeFile, title, readFile])

  const queueSave = (body, heading = title) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save(body, heading)
    }, 800)
  }

  const handleBodyChange = (newBody) => {
    setEditorBody(newBody)
    setNoteTags(extractTagsFromMarkdown(`# ${title}\n\n${stripLeadingH1(newBody)}`))
    queueSave(newBody)
  }

  const isUntitledFile = () => {
    const stem = (filePath || '').replace('notes/', '').replace(/\.md$/i, '')
    return /^untitled/i.test(stem)
  }

  const isDateBasedFile = () => {
    const stem = (filePath || '').replace('notes/', '').replace(/\.md$/i, '')
    return /^\d{2}-\d{2}-\d{4}$/.test(stem)
  }

  const renameToTitle = async (newTitle) => {
    if (!filePath || !newTitle?.trim() || !isUntitledFile() || renamePending.current) return
    const slug = newTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) return
    const newPath = `notes/${slug}.md`
    if (newPath === filePath) return
    renamePending.current = true
    try {
      const exists = typeof fileExists === 'function' ? await fileExists(newPath) : false
      if (exists) return // don't clobber
      clearTimeout(saveTimer.current)
      const full = newTitle.trim() ? `# ${newTitle.trim()}\n\n${stripLeadingH1(editorBody)}` : stripLeadingH1(editorBody)
      await writeFile(newPath, full)
      await deleteFile(filePath)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('memostack:toast', {
          detail: { message: `Renamed to ${slug}.md` },
        }))
      }
      onFileRenamed?.(newPath)
    } catch {
      renamePending.current = false
    }
  }

  const handleTitleBlur = () => {
    if (!title.trim()) return
    if (isUntitledFile()) {
      renameToTitle(title)
      return
    }
    // For date-based notes the filename is the stable identity (wikilinks reference the date).
    // Changing the H1 title should never rename the file — just save in place.
    clearTimeout(saveTimer.current)
    save(editorBody, title)
  }

  const handleTitleChange = (nextTitle) => {
    setTitle(nextTitle)
    setNoteTags(extractTagsFromMarkdown(`# ${nextTitle}\n\n${stripLeadingH1(editorBody)}`))
    queueSave(editorBody, nextTitle)
    onDisplayNameChanged?.(filePath, nextTitle)
  }

  const handleDictate = () => {
    if (isListening) {
      stop()
      return
    }

    reset()
    prevTranscript.current = ''
    start()
  }

  const handleArchive = async () => {
    if (!filePath) return
    const filename = filePath.split('/').pop()
    const content = await readFile(filePath)
    await writeFile(`archive/${filename}`, content)
    await deleteFile(filePath)
    onFileDeleted?.()
  }

  const handleDelete = async () => {
    if (!filePath) return
    await deleteFile(filePath)
    onFileDeleted?.()
  }

  const noteLabel = title || filePath?.replace('notes/', '').replace('.md', '') || 'this note'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-very-dim)', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 48px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-very-dim)',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatHeaderDate(filePath, lastSavedTime)}
        </div>

        {noteTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {noteTags.map((tag) => (
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                animation: isListening ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
            {isListening ? 'Recording…' : 'Dictate'}
          </button>

          <TrashMenuButton
            label={noteLabel}
            onConfirmAction={onConfirmAction}
            onArchive={handleArchive}
            onDelete={handleDelete}
            getArchiveConfirm={(label) => ({
              title: `Archive "${label}"?`,
              message: 'This note will be moved to archive/.',
              confirmLabel: 'Archive',
              danger: false,
            })}
            getDeleteConfirm={(label) => ({
              title: `Delete "${label}"?`,
              message: 'This file will be permanently removed. This cannot be undone.',
              confirmLabel: 'Delete',
              danger: true,
            })}
          />
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '32px 48px 48px', maxWidth: 760 }}>
          <textarea
            value={title}
            onChange={(event) => {
              handleTitleChange(event.target.value)
              event.target.style.height = 'auto'
              event.target.style.height = event.target.scrollHeight + 'px'
            }}
            onBlur={handleTitleBlur}
            placeholder="Untitled"
            rows={1}
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
              resize: 'none',
              overflow: 'hidden',
              lineHeight: 1.25,
              minHeight: '1.25em',
            }}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
          />

          <div key={filePath} className="milkdown-wrapper">
            <EditorComponent initialValue={editorBody} onChange={handleBodyChange} onWikilinkClick={onWikilinkClick} tagSuggestions={tagSuggestions} wikilinkSuggestions={wikilinkSuggestions ?? []} />
          </div>
        </div>
      </div>
    </div>
  )
}
