// Internal Milkdown component — used only by useMarkdownEditor hook.
// Separated into its own file to satisfy Vite's Fast Refresh rule:
// a file must export only components OR only hooks, not both.

import { useEffect, useMemo, useRef, useState } from 'react'
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
        ctx.update(prosePluginsCtx, (plugins) => [...plugins, tokenDecorationPlugin])
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
                callback(found.name)
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
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
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
