// 拖拽功能逻辑
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore'

// 拖拽数据接口
export function useDraggable() {
  const editorStore = useEditorStore()
  const isDragging = ref(false)
  const dragStartPos = ref({ x: 0, y: 0 })
  
  // 处理拖拽开始
  const handleDragStart = (event, material) => {
    if (!event.dataTransfer) return
    
    isDragging.value = true
    dragStartPos.value = { x: event.clientX, y: event.clientY }
    
    // 设置拖拽数据
    const dragData = {
      type: 'material',
      material
    }
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    
    // 设置拖拽效果
    event.dataTransfer.effectAllowed = 'copy'
  }
  
  // 处理拖拽结束
  const handleDragEnd = () => {
    isDragging.value = false
    editorStore.setDragging(false)
    editorStore.setDragPlaceholderStyle({})
  }
  
  // 处理拖拽经过
  const handleDragOver = (event) => {
    event.preventDefault()
    if (!event.dataTransfer) return
    
    event.dataTransfer.dropEffect = 'copy'
    
    // 更新占位符位置
    if (isDragging.value) {
      const canvas = event.currentTarget
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      
      // 获取所有组件元素
      const componentElements = canvas.querySelectorAll('.lc-component')
      let placeholderStyle = {
        left: `${x - 50}px`,
        top: `${y - 20}px`,
        width: '100px',
        height: '40px'
      }
      
      // 计算插入位置
      if (componentElements.length > 0) {
        for (let i = 0; i < componentElements.length; i++) {
          const el = componentElements[i]
          const elRect = el.getBoundingClientRect()
          const elTop = elRect.top - rect.top
          const elBottom = elTop + elRect.height
          
          // 检查是否悬停在组件上方或下方
          if (y < elTop - 10) {
            // 插入到当前组件上方
            placeholderStyle = {
              left: '0px',
              top: `${elTop - 2}px`,
              width: '100%',
              height: '4px',
              backgroundColor: 'rgba(64, 158, 255, 0.3)',
              border: 'none',
              borderRadius: '2px'
            }
            break
          } else if (y > elBottom + 10) {
            // 插入到当前组件下方
            if (i === componentElements.length - 1) {
              placeholderStyle = {
                left: '0px',
                top: `${elBottom + 2}px`,
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(64, 158, 255, 0.3)',
                border: 'none',
                borderRadius: '2px'
              }
            }
          } else {
            // 插入到组件内部（如果是容器）
            placeholderStyle = {
              left: `${el.offsetLeft}px`,
              top: `${el.offsetTop}px`,
              width: `${el.offsetWidth}px`,
              height: `${el.offsetHeight}px`,
              border: '2px dashed #409EFF',
              backgroundColor: 'rgba(64, 158, 255, 0.1)'
            }
            break
          }
        }
      }
      
      editorStore.setDragging(true)
      editorStore.setDragPlaceholderStyle(placeholderStyle)
    }
  }
  
  // 处理放置
  const handleDrop = (event) => {
    event.preventDefault()
    if (!event.dataTransfer) return
    
    try {
      const dragData = JSON.parse(event.dataTransfer.getData('application/json'))
      
      if (dragData.type === 'material') {
        // 创建新组件
        const newComponent = {
          type: dragData.material.type,
          label: dragData.material.name,
          props: { ...dragData.material.defaultProps },
          styles: { ...dragData.material.defaultStyles },
          events: {},
          children: dragData.material.isContainer ? [] : undefined
        }
        
        // 添加到编辑器
        editorStore.addComponent(newComponent)
      } else if (dragData.type === 'component') {
        // 处理组件拖拽
        // 这里可以实现组件位置调整的逻辑
        // 目前我们简单地重新添加组件，后续可以实现更复杂的位置调整
        const movedComponent = {
          ...dragData.component,
          id: dragData.component.id // 保持原ID
        }
        
        // 删除原组件
        editorStore.deleteComponent(dragData.component.id)
        
        // 添加回组件（简单实现，后续可以优化为位置调整）
        editorStore.addComponent(movedComponent)
      }
    } catch (error) {
      console.error('Failed to process drag data:', error)
    } finally {
      handleDragEnd()
    }
  }
  
  // 键盘快捷键处理
  const handleKeyDown = (event) => {
    // 处理Ctrl+Z撤销
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault()
      editorStore.undo()
    }
    // 处理Ctrl+Y重做
    if (event.ctrlKey && event.key === 'y') {
      event.preventDefault()
      editorStore.redo()
    }
    // 处理Delete删除
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editorStore.selectedId) {
        editorStore.deleteComponent(editorStore.selectedId)
      }
    }
    // 处理Ctrl+C复制
    if (event.ctrlKey && event.key === 'c') {
      if (editorStore.selectedComponent) {
        editorStore.copyComponent(editorStore.selectedComponent)
      }
    }
    // 处理Ctrl+V粘贴
    if (event.ctrlKey && event.key === 'v') {
      editorStore.pasteComponent()
    }
  }
  
  // 生命周期
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
