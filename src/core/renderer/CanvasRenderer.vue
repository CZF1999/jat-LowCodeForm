<template>
  <div class="canvas-container">
    <div 
      class="canvas"
      :style="{
        width: pageSettings.width || '100%',
        backgroundColor: pageSettings.backgroundColor || '#ffffff',
        justifyContent: 'left'
      }"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @click="handleCanvasClick"
    >
      <!-- 空状态提示 -->
      <div v-if="components.length === 0 && !isDragging" class="empty-state">
        <div class="empty-state-content">
          <el-icon class="empty-state-icon"><Plus /></el-icon>
          <p>请从左侧物料库拖入组件</p>
        </div>
      </div>
      
      <!-- 渲染根组件 -->
      <ComponentRenderer 
        v-for="component in components" 
        :key="component.id"
        :component="component"
        :selected-id="selectedId"
        @select="handleSelect"
        @delete="handleDelete"
        @copy="handleCopy"
        @update:component="handleUpdateComponent"
      />
      
      <!-- 拖拽占位符 -->
      <div 
        v-if="isDragging"
        class="drag-placeholder"
        :style="dragPlaceholderStyle"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import ComponentRenderer from './ComponentRenderer.vue'

// 组件属性
const props = defineProps({
  components: Array,
  pageSettings: Object,
  selectedId: [String, null],
  isDragging: Boolean,
  dragPlaceholderStyle: Object
})

// 组件事件
const emit = defineEmits(['select', 'delete', 'copy', 'dragover', 'drop', 'update:component'])



// 处理选择
const handleSelect = (id) => {
  emit('select', id)
}

// 处理删除
const handleDelete = (id) => {
  emit('delete', id)
}

// 处理复制
const handleCopy = (component) => {
  emit('copy', component)
}

// 处理拖拽经过
const handleDragOver = (event) => {
  emit('dragover', event)
}

// 处理放置
const handleDrop = (event) => {
  emit('drop', event)
}

// 处理组件更新
const handleUpdateComponent = (updatedComponent) => {
  emit('update:component', updatedComponent)
}

// 处理画布点击，取消组件选择
const handleCanvasClick = (event) => {
  // 检查点击目标是否是画布本身，而不是画布内的组件
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
  /* 宽度限制 */
  width: 100%;
  max-width: 800px;
  min-width: 300px;
  min-height: 400px;
  box-sizing: border-box;
  /* 虚线边框 */
  border: 1px dashed #409EFF;
  /* 网格线背景 */
  background-image: 
    linear-gradient(rgba(220, 220, 220, 0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(220, 220, 220, 0.3) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: -1px -1px;
}



.drag-placeholder {
  position: absolute;
  border: 2px dashed #409EFF;
  background-color: rgba(64, 158, 255, 0.1);
  pointer-events: none;
  z-index: 100;
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
