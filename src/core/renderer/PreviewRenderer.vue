<template>
  <div class="preview-container">
    <div
      :class="[
        'preview-form',
        `preview-layout-${pageSettings.layout || 'vertical'}`
      ]"
      :style="{
        backgroundColor: pageSettings.backgroundColor || '#ffffff'
      }"
    >
      <!-- 空状态提示 -->
      <div v-if="components.length === 0" class="empty-state">
        <div class="empty-state-content">
          <el-icon class="empty-state-icon"><Plus /></el-icon>
          <p>表单为空</p>
        </div>
      </div>
      
      <!-- 渲染根组件 -->
      <ComponentRenderer
        v-for="component in components"
        :key="component.id"
        :component="component"
        :selected-id="null"
        :page-settings="pageSettings"
      />
      
      <!-- 提交和取消按钮 -->
      <div class="form-actions" v-if="components.length > 0">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleSubmit">提交</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Plus } from '@element-plus/icons-vue'
import ComponentRenderer from './ComponentRenderer.vue'

// 组件属性
const props = defineProps({
  components: Array,
  pageSettings: Object
})

// 事件定义
const emit = defineEmits(['submit', 'cancel'])

// 处理提交
const handleSubmit = () => {
  emit('submit')
}

// 处理取消
const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.preview-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px;
  background-color: #f5f7fa;
  min-height: 400px;
}

.preview-form {
  width: 100%;
  max-width: 800px;
  padding: 30px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

/* 预览栅格布局 */
.preview-layout-grid {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
}

/* 预览行内布局 */
.preview-layout-inline {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
}

/* 预览垂直布局 */
.preview-layout-vertical {
  flex-direction: column;
}

/* 确保预览中的组件没有外边距 */
.preview-form :deep(.lc-component) {
  margin: 0 !important;
  padding: 0 !important;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}
</style>