// Internal Milkdown component — used only by useMarkdownEditor hook.
// Separated into its own file to satisfy Vite's Fast Refresh rule:
// a file must export only components OR only hooks, not both.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, Milkdown, MilkdownProvider } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, prosePluginsCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { nord } from '@milkdown/theme-nord'
import { Plugin } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

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
          decorations.push(Decoration.inline(innerStart, innerEnd, { class: 'ms-token ms-token-wikilink-inner' }))
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

function EditorCore({ initialValue, onChange, tagSuggestions = [] }) {
  const onChangeRef = useRef(onChange)
  const initialValueRef = useRef(initialValue)
  const lastMarkdownRef = useRef(initialValue)
  const applyTagRef = useRef(() => {})
  const [tagMenu, setTagMenu] = useState({ open: false, query: '', x: 0, y: 0, index: 0 })

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

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

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

    const onKeyDown = (e) => {
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

    const onInput = () => refreshMenu()
    const onSelectionChange = () => refreshMenu()

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
  }, [menuItems, tagMenu.open, tagMenu.index])

  useEditor((root) => {
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
  return (
    <>
      <Milkdown />
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
    </>
  )
}

export function MarkdownEditorComponent({ initialValue, onChange, tagSuggestions }) {
  return (
    <MilkdownProvider>
      <EditorCore initialValue={initialValue} onChange={onChange} tagSuggestions={tagSuggestions} />
    </MilkdownProvider>
  )
}
