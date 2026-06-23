// Internal Milkdown component — used only by useMarkdownEditor hook.
// Separated into its own file to satisfy Vite's Fast Refresh rule:
// a file must export only components OR only hooks, not both.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, prosePluginsCtx, editorViewCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { nord } from '@milkdown/theme-nord'
import { replaceAll } from '@milkdown/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

// Mutable ref updated by EditorCore when wikilinkSuggestions change.
// The decoration plugin reads this on every doc change — no plugin rebuild needed.
const _knownWikilinksRef = { current: new Set() }
// Set to true once the known-set has been populated at least once, so that
// we don't fall back to "all resolved" before suggestions load.
const _knownWikilinksReadyRef = { current: false }

function buildTokenDecorations(doc) {
  const decorations = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return

    node.forEach((child, childOffset) => {
      if (!child.isText || !child.text) return
      if (child.marks?.some((mark) => mark.type?.name === 'code')) return

      const text = child.text
      const base = pos + 1 + childOffset

      const wikilinkRx = /\[\[[^\]\n]+\]\]/g
      let wikiMatch
      while ((wikiMatch = wikilinkRx.exec(text)) !== null) {
        const start = base + wikiMatch.index
        const end = start + wikiMatch[0].length
        const innerStart = start + 2
        const innerEnd = end - 2
        if (innerStart > start) {
          decorations.push(Decoration.inline(start, innerStart, { class: 'ms-token ms-token-wikilink-bracket' }))
        }
        if (innerEnd > innerStart) {
          const innerName = wikiMatch[0].slice(2, -2).trim()
          const knownSet = _knownWikilinksRef.current
          const innerLower = innerName.toLowerCase()
          const innerTight = innerLower.replace(/[^a-z0-9 ]/g, '')
          const isResolved = _knownWikilinksReadyRef.current && (knownSet.has(innerLower) || knownSet.has(innerTight))
          const innerClass = isResolved
            ? 'ms-token ms-token-wikilink-inner'
            : 'ms-token ms-token-wikilink-inner ms-token-wikilink-unresolved'
          decorations.push(Decoration.inline(innerStart, innerEnd, { class: innerClass }))
        }
        if (end > innerEnd) {
          decorations.push(Decoration.inline(innerEnd, end, { class: 'ms-token ms-token-wikilink-bracket' }))
        }
      }

      const hashtagRx = /(^|[^\w])#([a-zA-Z0-9][a-zA-Z0-9:_-]{0,63})/g
      let hashMatch
      while ((hashMatch = hashtagRx.exec(text)) !== null) {
        const prefixLength = hashMatch[1] ? hashMatch[1].length : 0
        const tagStart = base + hashMatch.index + prefixLength
        const tagEnd = tagStart + 1 + hashMatch[2].length
        decorations.push(Decoration.inline(tagStart, tagEnd, { class: 'ms-token ms-token-hashtag' }))
      }
    })
  })

  return DecorationSet.create(doc, decorations)
}

const tokenDecorationPlugin = new Plugin({
  props: {
    decorations(state) {
      return buildTokenDecorations(state.doc)
    },
  },
})

// Automatically applies link marks to bare URLs in the document after every
// transaction. This handles both typed and pasted URLs without intercepting
// events — the same approach used by Notion and Obsidian.
const URL_RE = /https?:\/\/[^\s\])\[,"'<>]+/g
const autoLinkPlugin = new Plugin({
  appendTransaction(_transactions, _oldState, newState) {
    const linkType = newState.schema.marks.link
    if (!linkType) return null

    const tr = newState.tr
    let modified = false

    newState.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return
      // Skip nodes that are already fully covered by a link mark
      if (node.marks.some((m) => m.type === linkType)) return

      let match
      URL_RE.lastIndex = 0
      while ((match = URL_RE.exec(node.text)) !== null) {
        const from = pos + match.index
        const to = from + match[0].length
        // Check if this range already has a link mark
        const $from = newState.doc.resolve(from)
        if ($from.marks().some((m) => m.type === linkType)) continue
        tr.addMark(from, to, linkType.create({ href: match[0], title: null }))
        modified = true
      }
    })

    return modified ? tr : null
  },
})

function toggleTaskItem(view, nodePos) {
  const node = view.state.doc.nodeAt(nodePos)
  if (!node || typeof node.attrs?.checked !== 'boolean') return false

  const tr = view.state.tr.setNodeMarkup(
    nodePos,
    node.type,
    { ...node.attrs, checked: !node.attrs.checked },
    node.marks
  )

  view.dispatch(tr)
  return true
}

function findWikilinkAtOffset(text, offset) {
  const source = String(text || '')
  const index = Number(offset)
  if (!Number.isFinite(index) || index < 0 || index > source.length) return null

  const matches = [...source.matchAll(/\[\[([^\]]+)\]\]/g)]
  for (const match of matches) {
    const start = match.index ?? -1
    const end = start + match[0].length
    if (start < 0) continue
    if (index >= start && index <= end) {
      return {
        name: match[1],
        start,
        end,
      }
    }
  }

  return null
}

function EditorCore({ initialValue, onChange, onWikilinkClick, tagSuggestions = [], interimPreview = '', wikilinkSuggestions = [] }) {
  const onChangeRef = useRef(onChange)
  const onWikilinkClickRef = useRef(onWikilinkClick)
  const initialValueRef = useRef(initialValue)
  const lastMarkdownRef = useRef(initialValue)
  const applyTagRef = useRef(() => {})
  const applyWikilinkRef = useRef(() => {})
  const [tagMenu, setTagMenu] = useState({ open: false, query: '', x: 0, y: 0, index: 0 })
  const [wikilinkMenu, setWikilinkMenu] = useState({ open: false, query: '', x: 0, y: 0, index: 0 })

  // Link insertion state
  const [linkPopover, setLinkPopover] = useState({ open: false, text: '', url: '', x: 0, y: 0 })
  const linkSavedSelectionRef = useRef(null) // { from, to, text }
  const linkUrlInputRef = useRef(null)

  const normalizedTags = useMemo(() => {
    const seen = new Set()
    const arr = []
    for (const raw of tagSuggestions || []) {
      const tag = String(raw || '').trim().replace(/^#+/, '').toLowerCase()
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      arr.push(tag)
    }
    return arr.sort((a, b) => a.localeCompare(b))
  }, [tagSuggestions])

  const menuItems = useMemo(() => {
    const q = tagMenu.query.toLowerCase()
    return normalizedTags.filter((tag) => !q || tag.startsWith(q)).slice(0, 8)
  }, [normalizedTags, tagMenu.query])

  // Filter wikilink suggestions: every typed word must appear somewhere in the entity name
  const wikilinkMenuItems = useMemo(() => {
    const q = wikilinkMenu.query.toLowerCase().trim()
    const words = q ? q.split(/\s+/).filter(Boolean) : []
    if (!q) return wikilinkSuggestions.slice(0, 10)
    return wikilinkSuggestions
      .filter((s) => { const n = s.name.toLowerCase(); return words.every((w) => n.includes(w)) })
      .slice(0, 10)
  }, [wikilinkSuggestions, wikilinkMenu.query])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onWikilinkClickRef.current = onWikilinkClick
  }, [onWikilinkClick])

  useEffect(() => {
    const pm = document.querySelector('.milkdown .ProseMirror')
    if (!pm) return

    const getTagContext = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null

      const node = sel.anchorNode
      if (!node || node.nodeType !== Node.TEXT_NODE || !pm.contains(node)) return null

      const text = node.textContent || ''
      const offset = sel.anchorOffset
      const before = text.slice(0, offset)
      const match = before.match(/(?:^|\s)#([a-z0-9:_-]*)$/i)
      if (!match) return null

      const range = sel.getRangeAt(0).cloneRange()
      range.collapse(true)
      const rect = range.getBoundingClientRect()

      return {
        node,
        offset,
        query: match[1] || '',
        x: rect.left,
        y: rect.bottom + 6,
      }
    }

    const getWikilinkContext = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null
      const node = sel.anchorNode
      if (!node || node.nodeType !== Node.TEXT_NODE || !pm.contains(node)) return null
      const text = node.textContent || ''
      const offset = sel.anchorOffset
      const before = text.slice(0, offset)
      const match = before.match(/\[\[([^\]]*)$/)
      if (!match) return null
      const range = sel.getRangeAt(0).cloneRange()
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      return { node, offset, query: match[1] || '', x: rect.left, y: rect.bottom + 6 }
    }

    const refreshMenu = () => {
      const ctx = getTagContext()
      if (!ctx) {
        setTagMenu((prev) => prev.open ? { ...prev, open: false } : prev)
        return
      }

      setTagMenu((prev) => ({
        open: true,
        query: ctx.query,
        x: ctx.x,
        y: ctx.y,
        index: 0,
      }))
    }

    const refreshWikilinkMenu = () => {
      const ctx = getWikilinkContext()
      if (!ctx) {
        setWikilinkMenu((prev) => prev.open ? { ...prev, open: false } : prev)
        return
      }
      setWikilinkMenu((prev) => ({ open: true, query: ctx.query, x: ctx.x, y: ctx.y, index: 0 }))
    }

    const applyTag = (tag) => {
      const ctx = getTagContext()
      if (!ctx) return

      const sel = window.getSelection()
      if (!sel) return

      const start = Math.max(0, ctx.offset - ctx.query.length)
      const range = document.createRange()
      range.setStart(ctx.node, start)
      range.setEnd(ctx.node, ctx.offset)
      sel.removeAllRanges()
      sel.addRange(range)
      document.execCommand('insertText', false, `${tag} `)

      setTagMenu((prev) => ({ ...prev, open: false }))
    }

    applyTagRef.current = applyTag

    const applyWikilink = (name) => {
      const ctx = getWikilinkContext()
      if (!ctx) { setWikilinkMenu((prev) => ({ ...prev, open: false })); return }
      const sel = window.getSelection()
      if (!sel) return
      const startOffset = Math.max(0, ctx.offset - ctx.query.length - 2)
      const range = document.createRange()
      range.setStart(ctx.node, startOffset)
      range.setEnd(ctx.node, ctx.offset)
      sel.removeAllRanges()
      sel.addRange(range)
      document.execCommand('insertText', false, `[[${name}]]`)
      setWikilinkMenu((prev) => ({ ...prev, open: false }))
    }

    applyWikilinkRef.current = applyWikilink

    const onKeyDown = (e) => {
      // Cmd/Ctrl+K — insert link anchored near the selection
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const instance = editor.get()
        if (!instance) return
        let selText = ''
        let anchorX = window.innerWidth / 2
        let anchorY = 200
        instance.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          const { from, to } = view.state.selection
          selText = from !== to ? view.state.doc.textBetween(from, to) : ''
          linkSavedSelectionRef.current = { from, to, text: selText }
          // Position below DOM selection
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect()
            anchorX = Math.max(8, rect.left)
            anchorY = rect.bottom + 8
          }
        })
        setLinkPopover({ open: true, text: selText, url: '', x: anchorX, y: anchorY })
        return
      }

      if (wikilinkMenu.open && wikilinkMenuItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setWikilinkMenu((prev) => ({ ...prev, index: (prev.index + 1) % wikilinkMenuItems.length }))
          return
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setWikilinkMenu((prev) => ({ ...prev, index: (prev.index - 1 + wikilinkMenuItems.length) % wikilinkMenuItems.length }))
          return
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          applyWikilink(wikilinkMenuItems[Math.min(wikilinkMenu.index, wikilinkMenuItems.length - 1)].name)
          return
        } else if (e.key === 'Escape') {
          setWikilinkMenu((prev) => ({ ...prev, open: false }))
          return
        }
      }
      if (!tagMenu.open || menuItems.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setTagMenu((prev) => ({ ...prev, index: (prev.index + 1) % menuItems.length }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setTagMenu((prev) => ({ ...prev, index: (prev.index - 1 + menuItems.length) % menuItems.length }))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applyTag(menuItems[Math.min(tagMenu.index, menuItems.length - 1)])
      } else if (e.key === 'Escape') {
        setTagMenu((prev) => ({ ...prev, open: false }))
      }
    }

    const onInput = () => { refreshMenu(); refreshWikilinkMenu() }
    const onSelectionChange = () => { refreshMenu(); refreshWikilinkMenu() }

    pm.addEventListener('keydown', onKeyDown)
    pm.addEventListener('keyup', onInput)
    pm.addEventListener('click', onInput)
    document.addEventListener('selectionchange', onSelectionChange)

    return () => {
      pm.removeEventListener('keydown', onKeyDown)
      pm.removeEventListener('keyup', onInput)
      pm.removeEventListener('click', onInput)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [menuItems, tagMenu.open, tagMenu.index, wikilinkMenuItems, wikilinkMenu.open, wikilinkMenu.index])

  const editor = useEditor((root) => {
    const milkdown = Editor.make()

    milkdown
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialValueRef.current)
        ctx.update(prosePluginsCtx, (plugins) => [autoLinkPlugin, tokenDecorationPlugin, ...plugins])
        ctx.set(editorViewOptionsCtx, {
          editable: () => true,
          attributes: {
            spellcheck: 'true',
          },
          handleDOMEvents: {
            click: (view, event) => {
              const mouseEvent = event
              const target = mouseEvent.target
              const isEditableTarget = target instanceof HTMLElement && !!target.closest('.ProseMirror')
              if (!isEditableTarget) return false

              // External link — open in new tab
              if (target instanceof HTMLElement) {
                const anchor = target.closest('a[href]')
                if (anchor) {
                  const href = anchor.getAttribute('href')
                  if (href && /^https?:\/\//.test(href)) {
                    mouseEvent.preventDefault()
                    window.open(href, '_blank', 'noopener,noreferrer')
                    return true
                  }
                }
              }

              const coords = { left: mouseEvent.clientX, top: mouseEvent.clientY }
              const pos = view.posAtCoords(coords)
              if (!pos?.pos) return false

              const $pos = view.state.doc.resolve(pos.pos)
              const text = $pos.parent?.textContent || ''
              const found = findWikilinkAtOffset(text, $pos.parentOffset)
              if (!found) return false

              const callback = onWikilinkClickRef.current
              if (typeof callback === 'function') {
                mouseEvent.preventDefault()
                mouseEvent.stopPropagation()
                callback(found.name, { x: mouseEvent.clientX, y: mouseEvent.clientY })
                return true
              }

              return false
            },
          },
          handleClickOn: (view, _pos, node, nodePos, event) => {
            const target = event.target
            const fromTaskDom = target instanceof HTMLElement
              && !!target.closest("li[data-item-type='task'], li[data-type='taskItem']")

            if (!fromTaskDom && typeof node.attrs?.checked !== 'boolean') return false
            return toggleTaskItem(view, nodePos)
          },
        })
      })
      .use(nord)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          if (markdown === lastMarkdownRef.current) return
          lastMarkdownRef.current = markdown
          if (onChangeRef.current) onChangeRef.current(markdown)
        })
      })

    return milkdown
  }, [])

  // Keep decoration plugin's known-set in sync whenever suggestions change,
  // Reset wikilink menu state when suggestions change (vault switch, etc.)
  useEffect(() => {
    // Aggressively clear module-level refs when vault/suggestions change
    _knownWikilinksRef.current = new Set()
    _knownWikilinksReadyRef.current = false
    setWikilinkMenu({ open: false, query: '', x: 0, y: 0, index: 0 })
  }, [wikilinkSuggestions])

  // Update known wikilinks set for color coding and filtering
  // then dispatch a no-op transaction so ProseMirror re-runs buildTokenDecorations
  // immediately (otherwise colors only update on the next user interaction).
  useEffect(() => {
    const names = new Set()
    for (const s of wikilinkSuggestions) {
      // Add the display name (title-cased, spaces) so [[Person Name]] resolves.
      if (s.name) {
        names.add(s.name.toLowerCase())
        // Also add a punctuation-stripped version so names like "Ubuntu.com Home Page"
        // match wikilinks written as [[Ubuntu.com Home Page]] even though the
        // filename slug dropped the dot (→ "Ubuntucom home page").
        names.add(s.name.toLowerCase().replace(/[^a-z0-9 ]/g, ''))
      }
      // Also add the raw filename stem (hyphens preserved) so date wikilinks
      // like [[02-06-2026]] resolve even though the display name is "02 06 2026".
      if (s.path) {
        const stem = s.path.split('/').pop().replace(/\.md$/i, '')
        if (stem) names.add(stem.toLowerCase())
      }
    }
    _knownWikilinksRef.current = names
    _knownWikilinksReadyRef.current = true
    const instance = editor.get()
    if (instance) {
      instance.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        view.dispatch(view.state.tr)
      })
    }
  }, [editor, wikilinkSuggestions])

  useEffect(() => {
    const nextValue = String(initialValue || '')
    initialValueRef.current = nextValue
    if (nextValue === String(lastMarkdownRef.current || '')) return

    const instance = editor.get()
    if (!instance) return

    lastMarkdownRef.current = nextValue
    instance.action(replaceAll(nextValue))
  }, [editor, initialValue])

  const insertLink = (url) => {
    const trimUrl = (url || '').trim()
    setLinkPopover((prev) => ({ ...prev, open: false }))
    if (!trimUrl) return
    const saved = linkSavedSelectionRef.current
    linkSavedSelectionRef.current = null
    const instance = editor.get()
    if (!instance) return
    instance.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const from = saved?.from ?? state.selection.from
      const to = saved?.to ?? state.selection.to
      const selText = saved?.text || trimUrl
      const linkMark = state.schema.marks.link?.create({ href: trimUrl, title: null })
      if (linkMark) {
        const tr = state.tr
        if (from !== to) {
          tr.addMark(from, to, linkMark)
        } else {
          tr.replaceSelectionWith(state.schema.text(selText, [linkMark]))
        }
        view.dispatch(tr)
      }
    })
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <Milkdown />
        <div
          aria-hidden="true"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '8px 14px',
            color: 'oklch(0.85 0.12 95 / 0.75)',
            background: 'linear-gradient(180deg, transparent, oklch(0.22 0.02 250 / 0.16))',
            borderTop: '1px dashed oklch(0.85 0.12 95 / 0.35)',
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'hidden',
            opacity: interimPreview ? 1 : 0,
            transform: interimPreview ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 180ms ease, transform 180ms ease',
          }}
        >
          {interimPreview || ' '}
        </div>
      </div>
      {tagMenu.open && menuItems.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(8, tagMenu.x - 8),
            top: tagMenu.y,
            zIndex: 500,
            minWidth: 180,
            maxWidth: 260,
            padding: 4,
            borderRadius: 8,
            background: 'var(--panel-pop)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
          }}
        >
          {menuItems.map((tag, idx) => (
            <div
              key={tag}
              onMouseDown={(e) => {
                e.preventDefault()
                applyTagRef.current(tag)
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                color: idx === tagMenu.index ? 'var(--text)' : 'var(--text-dim)',
                background: idx === tagMenu.index ? 'var(--panel-2)' : 'transparent',
              }}
            >
              #{tag}
            </div>
          ))}
        </div>
      )}
      {wikilinkMenu.open && wikilinkMenuItems.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(8, wikilinkMenu.x - 8),
            top: wikilinkMenu.y,
            zIndex: 501,
            minWidth: 220,
            maxWidth: 320,
            padding: 4,
            borderRadius: 8,
            background: 'var(--panel-pop)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
          }}
        >
          {wikilinkMenuItems.map((item, idx) => (
            <div
              key={item.path || item.name}
              onMouseDown={(e) => {
                e.preventDefault()
                applyWikilinkRef.current(item.name)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                color: idx === wikilinkMenu.index ? 'var(--text)' : 'var(--text-dim)',
                background: idx === wikilinkMenu.index ? 'var(--panel-2)' : 'transparent',
              }}
            >
              <span style={{ opacity: 0.45, fontSize: 10, minWidth: 38, textAlign: 'right' }}>{item.type}</span>
              {item.name}
            </div>
          ))}
        </div>
      )}
      {/* Cmd+K link popover — anchored near selection */}
      {linkPopover.open && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 498 }}
            onClick={() => setLinkPopover((prev) => ({ ...prev, open: false }))}
          />
          <div
            style={{
              position: 'fixed',
              left: Math.min(linkPopover.x, window.innerWidth - 300),
              top: Math.min(linkPopover.y, window.innerHeight - 100),
              zIndex: 499,
              width: 280,
              padding: '10px 12px',
              background: 'var(--panel-pop)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {linkPopover.text && (
              <div style={{ fontSize: 11.5, color: 'var(--text-very-dim)', marginBottom: 6, letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                "{linkPopover.text}"
              </div>
            )}
            <input
              ref={linkUrlInputRef}
              type="url"
              value={linkPopover.url}
              onChange={(e) => setLinkPopover((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); insertLink(linkPopover.url) }
                if (e.key === 'Escape') { setLinkPopover((prev) => ({ ...prev, open: false })) }
              }}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '7px 10px',
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </>,
        document.body
      )}
    </>
  )
}

export function MarkdownEditorComponent({ initialValue, onChange, onWikilinkClick, tagSuggestions, interimPreview = '', wikilinkSuggestions }) {
  return (
    <MilkdownProvider>
      <EditorCore
        initialValue={initialValue}
        onChange={onChange}
        onWikilinkClick={onWikilinkClick}
        tagSuggestions={tagSuggestions}
        interimPreview={interimPreview}
        wikilinkSuggestions={wikilinkSuggestions}
      />
    </MilkdownProvider>
  )
}
