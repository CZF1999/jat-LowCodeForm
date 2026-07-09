<template>
  <div class="canvas-container">
    <div
      ref="canvasRef"
      :class="[
        'canvas',
        `canvas-layout-${pageSettings.layout || 'vertical'}`
      ]"
      :style="{
        width: pageSettings.width || '100%',
        backgroundColor: pageSettings.backgroundColor || '#ffffff',
        justifyContent: 'left'
      }"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @click="handleCanvasClick"
    >
      <!-- 空状态提示（SortableJS 自动忽略此元素） -->
      <div v-if="components.length === 0 && !editorStore.isDragging" class="empty-state">
        <div class="empty-state-content">
          <el-icon class="empty-state-icon"><Plus /></el-icon>
          <p>请从左侧物料库拖入组件</p>
        </div>
      </div>

      <!-- 组件列表（由 SortableJS 管理排序） -->
      <ComponentRenderer
        v-for="(component, index) in components"
        :key="component.id"
        :component="component"
        :selected-id="selectedId"
        :page-settings="pageSettings"
        @select="handleSelect"
        @delete="handleDelete"
        @copy="handleCopy"
        @update:component="handleUpdateComponent"
      />

      <!-- 物料拖入时的插入指示器（绝对定位，SortableJS 自动忽略） -->
      <div
        v-if="editorStore.isDragging && editorStore.dragType === 'material' && components.length > 0"
        class="material-drop-indicator"
        :style="editorStore.dragPlaceholderStyle"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import ComponentRenderer from './ComponentRenderer.vue'
import { useEditorStore } from '../../stores/editorStore'

const editorStore = useEditorStore()

// 组件属性
const props = defineProps({
  components: Array,
  pageSettings: Object,
  selectedId: [String, null]
})

// 组件事件
const emit = defineEmits(['select', 'delete', 'copy', 'dragover', 'drop', 'update:component'])

// SortableJS 实例
const canvasRef = ref(null)
let sortableInstance = null

// ── SortableJS 初始化 ──
const initSortable = () => {
  if (!canvasRef.value) return
  if (sortableInstance) sortableInstance.destroy()

  sortableInstance = Sortable.create(canvasRef.value, {
    // 只拖拽组件元素，忽略 empty-state 和 indicator
    draggable: '.lc-component',
    // 拖拽手柄：hover 时出现的 Rank 图标
    handle: '.drag-handle',
    // 平滑动画时长（ms）
    animation: 150,
    // 占位符 class
    ghostClass: 'sortable-ghost',
    // 被拖动元素 class
    chosenClass: 'sortable-chosen',
    // 拖动中 class
    dragClass: 'sortable-drag',
    // 滚动灵敏度
    scrollSensitivity: 50,
    // 边缘触发滚动的距离
    scrollSpeed: 20,
    // 防止默认的触摸滚动
    preventOnFilter: false,

    // 拖动结束时同步数据到 Store
    onEnd(evt) {
      const componentId = evt.item.id
      // oldIndex / newIndex 反映的是当前 DOM 中 .lc-component 元素的位置
      // 但由于空状态/指示器可能存在，直接用 newIndex 映射到 components 数组
      editorStore.moveComponent(componentId, evt.newIndex)
    }
  })
}

// ── 生命周期 ──
onMounted(() => {
  nextTick(() => initSortable())
})

onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
})

// 组件列表变化时刷新 SortableJS（确保新增/删除的 DOM 元素被正确管理）
// 注意：SortableJS 在调用 onEnd 后 DOM 已正确，Vue 重渲染会重新创建元素，
// 但 Sortable 实例仍然有效，因为容器还是同一个 DOM 节点。
// 这里不用 watch 重建实例，因为 SortableJS 监听的是 DOM 容器，
// Vue 的列表渲染在同一个容器内增删子元素，SortableJS 会自动感知。

// ── 事件处理 ──
const handleSelect = (id) => {
  emit('select', id)
}

const handleDelete = (id) => {
  emit('delete', id)
}

const handleCopy = (component) => {
  emit('copy', component)
}

// 物料拖拽经过（由 App.vue → useDraggable 处理）
const handleDragOver = (event) => {
  emit('dragover', event)
}

// 物料放置（由 App.vue → useDraggable 处理）
const handleDrop = (event) => {
  emit('drop', event)
}

// 组件更新
const handleUpdateComponent = (updatedComponent) => {
  emit('update:component', updatedComponent)
}

// 点击画布空白区域取消选择
const handleCanvasClick = (event) => {
  if (event.target === event.currentTarget) {
    emit('select', null)
  }
}
</script>

<style scoped>
.canvas-container {
  position: relative;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #f5f7fa;
}

.canvas {
  position: relative;
  margin: 20px auto;
  background-color: #ffffff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 20px;
  width: 100%;
  min-width: 300px;
  min-height: 400px;
  box-sizing: border-box;
  border: 1px dashed #409EFF;
  background-image:
    linear-gradient(rgba(220, 220, 220, 0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(220, 220, 220, 0.3) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: -1px -1px;
}

/* 栅格布局：横向排列，自动换行 */
.canvas-layout-grid {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

/* 行内布局：横向排列 */
.canvas-layout-inline {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* 垂直布局：纵向排列（默认） */
.canvas-layout-vertical {
  flex-direction: column;
  gap: 0;
}

/* ── 物料拖入插入指示器 ── */
.material-drop-indicator {
  position: absolute;
  border: none;
  border-radius: 2px;
  pointer-events: none;
  z-index: 100;
}

/* ── SortableJS 拖拽视觉反馈 ── */
.sortable-ghost {
  opacity: 0.3;
  background-color: #c8ebfb;
}

.sortable-chosen {
  /* 被拖动的原始元素，保持位置但降低可见度 */
}

.sortable-drag {
  opacity: 0.8;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  width: 100%;
}

.empty-state-content {
  text-align: center;
  padding: 40px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  background-color: #fafafa;
  color: #999;
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #d9d9d9;
}

.empty-state-content p {
  margin: 0;
  font-size: 16px;
}
</style>
