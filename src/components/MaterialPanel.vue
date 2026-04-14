<template>
  <div class="material-panel">
    <h3>物料库</h3>
    
    <!-- 物料分类 -->
    <div class="material-categories">
      <el-tabs v-model="activeCategory">
        <el-tab-pane label="表单组件" name="form">
          <div class="material-list">
            <div 
              v-for="material in formMaterials" 
              :key="material.type"
              class="material-item"
              draggable="true"
              @dragstart="handleDragStart($event, material)"
              @dragend="handleDragEnd"
            >
              <!-- 视觉化组件预览 -->
              <div class="material-preview">
                <!-- 文本域预览 -->
                <el-input 
                  v-if="material.type === 'textarea'"
                  type="textarea"
                  :placeholder="material.defaultProps.placeholder || 'Textarea'"
                  :rows="2"
                  :size="'small'"
                  style="width: 100px; height: 50px;"
                />
                
                <!-- 数字输入框预览 -->
                <el-input-number 
                  v-else-if="material.type === 'number'"
                  :size="'small'"
                  style="width: 100px;"
                />
                
                <!-- 单选按钮组预览 -->
                <div v-else-if="material.type === 'radio'" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <el-radio v-for="(option, index) in material.defaultProps.options.slice(0, 2)" :key="index" :label="option.value" size="small">
                    {{ option.label }}
                  </el-radio>
                </div>
                
                <!-- 复选框组预览 -->
                <div v-else-if="material.type === 'checkbox'" style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <el-checkbox v-for="(option, index) in material.defaultProps.options.slice(0, 2)" :key="index" :label="option.value" size="small">
                    {{ option.label }}
                  </el-checkbox>
                </div>
                
                <!-- 下拉选择器预览 -->
                <el-select 
                  v-else-if="material.type === 'select'"
                  :placeholder="material.defaultProps.placeholder || 'Select'"
                  :size="'small'"
                  style="width: 100px;"
                >
                  <el-option 
                    v-for="option in material.defaultProps.options.slice(0, 2)" 
                    :key="option.value" 
                    :label="option.label" 
                    :value="option.value"
                  />
                </el-select>
                
                <!-- 日期选择器预览 -->
                <el-date-picker 
                  v-else-if="material.type === 'date'"
                  type="date"
                  :placeholder="material.defaultProps.placeholder || 'Date'"
                  :size="'small'"
                  style="width: 100px;"
                />
                
                <!-- 时间选择器预览 -->
                <el-time-picker 
                  v-else-if="material.type === 'time'"
                  :placeholder="material.defaultProps.placeholder || 'Time'"
                  :size="'small'"
                  style="width: 100px;"
                />
                
                <!-- 开关预览 -->
                <el-switch 
                  v-else-if="material.type === 'switch'"
                  :size="'small'"
                />
                
                <!-- 滑块预览 -->
                <el-slider 
                  v-else-if="material.type === 'slider'"
                  :min="0"
                  :max="100"
                  :size="'small'"
                  style="width: 80px;"
                />
                
                <!-- 评分预览 -->
                <el-rate 
                  v-else-if="material.type === 'rate'"
                  :max="5"
                  :size="'small'"
                />
                
                <!-- 文件上传预览 -->
                <el-upload 
                  v-else-if="material.type === 'upload'"
                  :auto-upload="false"
                  style="width: 100px;"
                >
                  <el-button type="primary" :size="'small'">
                    <el-icon><Upload /></el-icon>
                    <span>Upload</span>
                  </el-button>
                </el-upload>
                
                <!-- 分隔线预览 -->
                <el-divider 
                  v-else-if="material.type === 'divider'"
                  :direction="material.defaultProps.direction || 'horizontal'"
                  style="width: 80px;"
                />
                
                <!-- 静态文本预览 -->
                <div 
                  v-else-if="material.type === 'static-text'"
                  class="text-preview"
                  :style="{
                    fontSize: material.defaultProps.fontSize || '14px',
                    color: material.defaultProps.color || '#333333'
                  }"
                >
                  {{ material.defaultProps.content || 'Static Text' }}
                </div>
                
                <!-- 子表单预览 -->
                <div 
                  v-else-if="material.type === 'subform'"
                  class="container-preview"
                  :style="{
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    width: '100px',
                    height: '80px'
                  }"
                >
                  <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">{{ material.defaultProps.title || 'Subform' }}</div>
                  <div class="container-placeholder">Form items</div>
                </div>
                
                <!-- 默认图标预览 -->
                <div v-else class="material-icon">
                  <el-icon :size="24">{{ getMaterialIcon(material.icon) }}</el-icon>
                </div>
              </div>
              <div class="material-name">{{ material.name }}</div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Operation, Edit, Document, Grid, Upload } from '@element-plus/icons-vue'
import { getMaterials } from '../materials'
import { useDraggable } from '../composables/useDraggable'

// 获取物料列表
const materials = getMaterials()

// 表单物料
const formMaterials = computed(() => {
  return materials.filter(material => material.category === 'form')
})

// 当前激活的分类
const activeCategory = computed(() => 'form')

// 拖拽功能
const { handleDragStart, handleDragEnd } = useDraggable()

// 获取物料图标
const getMaterialIcon = (iconName) => {
  const iconMap = {
    Button: Operation,
    Edit,
    Document,
    Grid,
    Upload
  }
  return iconMap[iconName] || Document
}
</script>

<style scoped>
.material-panel {
  width: 200px;
  padding: 16px;
  border-right: 1px solid #e0e0e0;
  background-color: #f5f7fa;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.material-panel h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  color: #333;
}

.material-categories {
  margin-top: 16px;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  box-sizing: border-box;
  width: 100%;
}

.material-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #ffffff;
  cursor: grab;
  transition: all 0.2s ease;
  box-sizing: border-box;
  min-width: 0;
}

.material-item:hover {
  border-color: #409EFF;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.material-item:active {
  cursor: grabbing;
}

.material-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 8px;
  min-height: 40px;
  width: 100%;
}

.preview-button {
  width: auto;
  min-width: 60px;
}

.material-icon {
  margin-bottom: 8px;
  color: #409EFF;
}

.text-preview {
  padding: 4px 8px;
  background-color: #f9f9f9;
  border-radius: 2px;
  word-break: break-word;
  text-align: center;
  max-width: 100px;
}

.container-preview {
  background-color: #f9f9f9;
}

.container-placeholder {
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.material-name {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 8px;
}
</style>
