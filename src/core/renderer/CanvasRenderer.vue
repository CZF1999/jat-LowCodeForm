<template>
  <div class="canvas-container">
    <draggable
      v-model="editorStore.pageSchema.components"
      group="components"
      handle=".drag-handle"
      item-key="id"
      :class="['canvas', `canvas-layout-${pageSettings.layout || 'vertical'}`]"
      :style="{
        width: pageSettings.width || '100%',
        backgroundColor: pageSettings.backgroundColor || '#ffffff',
        justifyContent: 'left'
      }"
      ghost-class="sortable-ghost"
      chosen-class="sortable-chosen"
      drag-class="sortable-drag"
      :animation="150"
      @change="handleChange"
      @click="handleCanvasClick"
    >
      <template #item="{ element }">
        <ComponentRenderer
          :component="element"
          :selected-id="selectedId"
          :page-settings="pageSettings"
          @select="handleSelect"
          @delete="handleDelete"
          @copy="handleCopy"
          @update:component="handleUpdateComponent"
        />
      </template>
      <template #footer>
        <div v-if="components.length === 0" class="empty-state">
          <div class="empty-state-content">
            <el-icon class="empty-state-icon"><Plus /></el-icon>
            <p>请从左侧物料库拖入组件</p>
          </div>
        </div>
      </template>
    </draggable>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import ComponentRenderer from './ComponentRenderer.vue'
import { useEditorStore } from '../../stores/editorStore'
import type { ComponentSchema, PageSettings } from '../../core/schema/types'

const editorStore = useEditorStore()

const props = defineProps({
  components: Array as () => ComponentSchema[],
  pageSettings: Object as () => PageSettings,
  selectedId: [String, null] as unknown as () => string | null
})

const emit = defineEmits(['select', 'delete', 'copy', 'update:component'])

interface DraggableChangeEvent {
  added?: { element: ComponentSchema }
  moved?: { element: ComponentSchema }
  removed?: { element: ComponentSchema }
}

const handleChange = (evt: DraggableChangeEvent): void => {
  console.log('handleChange', evt)
  if (evt.added) {
    editorStore.selectedId = evt.added.element.id // 拖入新组件后自动选中
  }
  editorStore.saveHistory() // 任何排序/增删都记录到撤销栈
}

const handleSelect = (id: string): void => {
  emit('select', id)
}

const handleDelete = (id: string): void => {
  emit('delete', id)
}

const handleCopy = (component: ComponentSchema): void => {
  emit('copy', component)
}

const handleUpdateComponent = (updatedComponent: ComponentSchema): void => {
  emit('update:component', updatedComponent)
}

const handleCanvasClick = (event: MouseEvent): void => {
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

.canvas-layout-grid {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.canvas-layout-inline {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.canvas-layout-vertical {
  flex-direction: column;
  gap: 0;
}

.sortable-ghost {
  opacity: 0.3;
  background-color: #c8ebfb;
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
