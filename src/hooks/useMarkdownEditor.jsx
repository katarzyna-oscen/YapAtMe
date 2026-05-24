import { useCallback } from 'react'
import { MarkdownEditorComponent } from '../components/MarkdownEditor'

export function useMarkdownEditor() {
  const appendText = useCallback((text) => {
    const pm = document.querySelector('.milkdown .ProseMirror')
    if (!pm) return
    pm.focus()
    document.execCommand('insertText', false, text)
  }, [])

  return { EditorComponent: MarkdownEditorComponent, appendText }
}
