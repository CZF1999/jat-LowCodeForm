// 拖拽功能逻辑
// ── 职责分工 ──
// • 物料 → 画布：原生 HTML5 Drag & Drop API（本文件）
// • 画布内排序：SortableJS（在 CanvasRenderer.vue 中集成，动画丝滑、触摸兼容）
import { onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore'

export function useDraggable() {
  const editorStore = useEditorStore()

  // ── 物料拖拽开始（从物料面板拖入新组件）──
  const handleDragStart = (event, material) => {
    if (!event.dataTransfer) return

    editorStore.setDragging(true)

    const dragData = {
      type: 'material',
      material
    }
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'copy'

    editorStore.setDragType('material')
  }

  // ── 拖拽结束（清理状态）──
  const handleDragEnd = () => {
    editorStore.setDragging(false)
    editorStore.setDragPlaceholderStyle({})
    editorStore.setDragType(null)
    editorStore.setInsertionIndex(-1)
  }

  // ── 根据鼠标 Y 坐标计算插入位置索引（仅用于物料拖入）──
  const calculateInsertionIndex = (event, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const y = event.clientY - rect.top

    const componentElements = canvas.querySelectorAll('.lc-component')
    if (componentElements.length === 0) return 0

    for (let i = 0; i < componentElements.length; i++) {
      const el = componentElements[i]
      const elRect = el.getBoundingClientRect()
      const elMiddle = elRect.top + elRect.height / 2 - rect.top

      if (y < elMiddle) {
        return i  // 鼠标在组件上半部 → 插入到它前面
      }
    }
    return componentElements.length  // 鼠标在所有组件下方 → 追加到末尾
  }

  // ── 物料拖拽经过画布（显示插入指示器）──
  const handleDragOver = (event) => {
    event.preventDefault()
    if (!event.dataTransfer) return

    // 仅处理物料拖入；组件排序由 SortableJS 负责
    event.dataTransfer.dropEffect = 'copy'

    const canvas = event.currentTarget
    const index = calculateInsertionIndex(event, canvas)
    editorStore.setInsertionIndex(index)

    if (editorStore.isDragging) {
      const componentElements = canvas.querySelectorAll('.lc-component')
      let placeholderStyle = {}

      if (componentElements.length > 0) {
        placeholderStyle = {
          left: '20px',
          top: `${event.clientY - canvas.getBoundingClientRect().top}px`,
          width: 'calc(100% - 40px)',
          height: '3px',
          backgroundColor: '#409EFF',
          border: 'none',
          borderRadius: '2px',
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 100
        }
      }

      editorStore.setDragging(true)
      editorStore.setDragPlaceholderStyle(placeholderStyle)
    }
  }

  // ── 物料放置（创建新组件）──
  const handleDrop = (event) => {
    event.preventDefault()
    if (!event.dataTransfer) return

    try {
      const dragData = JSON.parse(event.dataTransfer.getData('application/json'))

      if (dragData.type === 'material') {
        const newComponent = {
          type: dragData.material.type,
          label: dragData.material.name,
          props: { ...dragData.material.defaultProps },
          styles: { ...dragData.material.defaultStyles },
          events: {},
          children: dragData.material.isContainer ? [] : undefined
        }

        const insertIndex = editorStore.insertionIndex
        if (insertIndex >= 0 && insertIndex < editorStore.pageSchema.components.length) {
          editorStore.insertComponentAt(newComponent, insertIndex)
        } else {
          editorStore.addComponent(newComponent)
        }
      }
      // 组件排序由 SortableJS 处理，不再在此处处理 dragData.type === 'component'
    } catch (error) {
      console.error('Failed to process drag data:', error)
    } finally {
      handleDragEnd()
    }
  }

  // ── 判断焦点是否在输入元素中（避免编辑属性时误触发快捷键）──
  const isInputFocused = () => {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return document.activeElement?.isContentEditable || false
  }

  // ── 键盘快捷键处理 ──
  const handleKeyDown = (event) => {
    // 焦点在输入框时，不拦截任何快捷键（让浏览器原生处理）
    if (isInputFocused()) return

    // Ctrl+Z 撤销
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault()
      editorStore.undo()
    }
    // Ctrl+Y 重做
    if (event.ctrlKey && event.key === 'y') {
      event.preventDefault()
      editorStore.redo()
    }
    // Delete / Backspace 删除选中组件
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editorStore.selectedId) {
        event.preventDefault()
        editorStore.deleteComponent(editorStore.selectedId)
      }
    }
    // Ctrl+C 复制
    if (event.ctrlKey && event.key === 'c') {
      if (editorStore.selectedComponent) {
        event.preventDefault()
        editorStore.copyComponent(editorStore.selectedComponent)
      }
    }
    // Ctrl+V 粘贴
    if (event.ctrlKey && event.key === 'v') {
      event.preventDefault()
      editorStore.pasteComponent()
    }
  }

  // ── 生命周期 ──
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  return {
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  }
}
