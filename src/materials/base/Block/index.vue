<template>
  <div
    class="lc-block"
    :style="blockStyle"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div class="lc-block-header">
      <span class="lc-block-title">{{ component.props?.title || '区块' }}</span>
    </div>
    <div class="lc-block-body">
      <template v-if="component.children && component.children.length > 0">
        <ComponentRenderer
          v-for="child in component.children"
          :key="child.id"
          :component="child"
          :selected-id="selectedId"
          :page-settings="pageSettings"
          @select="emit('select', $event)"
          @delete="emit('delete', $event)"
          @copy="emit('copy', $event)"
          @update:component="emit('update:component', $event)"
        />
      </template>
      <div v-else class="lc-block-empty">
        拖入组件到此处
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ComponentRenderer from '../../../core/renderer/ComponentRenderer.vue'
import { useEditorStore } from '../../../stores/editorStore'

const editorStore = useEditorStore()

const props = defineProps({
  component: Object,
  selectedId: [String, null],
  pageSettings: Object
})

const emit = defineEmits(['select', 'delete', 'copy', 'update:component'])

const blockStyle = computed(() => ({
  ...props.component.styles,
  padding: props.component.props?.padding || '16px',
  backgroundColor: props.component.props?.backgroundColor || '#ffffff',
  border: props.component.props?.border !== false ? '1px solid #e0e0e0' : 'none',
  borderRadius: '4px'
}))

const handleDragOver = (event) => {
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'copy'
}

const handleDrop = (event) => {
  event.preventDefault()
  event.stopPropagation()

  try {
    const dragData = JSON.parse(event.dataTransfer.getData('application/json'))
    if (dragData.type === 'material' && dragData.material) {
      const newChild = {
        type: dragData.material.type,
        label: dragData.material.name,
        props: { ...dragData.material.defaultProps },
        styles: { ...dragData.material.defaultStyles },
        events: {},
        children: dragData.material.isContainer ? [] : undefined,
        id: `component_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        titlePosition: 'left'
      }

      const updatedComponent = {
        ...props.component,
        children: [...(props.component.children || []), newChild]
      }
      emit('update:component', updatedComponent)
    }
  } catch (error) {
    console.error('Block drop error:', error)
  }
}
</script>

<style scoped>
.lc-block {
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.lc-block-header {
  padding: 8px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.lc-block-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.lc-block-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 60px;
}

.lc-block-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  color: #c0c4cc;
  font-size: 13px;
}
</style>
