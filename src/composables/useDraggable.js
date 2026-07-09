// 键盘快捷键功能
import { onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore'

export function useKeyboard() {
  const editorStore = useEditorStore()

  const isInputFocused = () => {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return document.activeElement?.isContentEditable || false
  }

  const handleKeyDown = (event) => {
    if (isInputFocused()) return

    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault()
      editorStore.undo()
    }
    if (event.ctrlKey && event.key === 'y') {
      event.preventDefault()
      editorStore.redo()
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editorStore.selectedId) {
        event.preventDefault()
        editorStore.deleteComponent(editorStore.selectedId)
      }
    }
    if (event.ctrlKey && event.key === 'c') {
      if (editorStore.selectedComponent) {
        event.preventDefault()
        editorStore.copyComponent(editorStore.selectedComponent)
      }
    }
    if (event.ctrlKey && event.key === 'v') {
      event.preventDefault()
      editorStore.pasteComponent()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
}
