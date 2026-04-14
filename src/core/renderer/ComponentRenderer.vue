<template>
  <div 
    :id="component.id"
    :class="[
      'lc-component', 
      `lc-${component.type}`, 
      { 
        'lc-component-selected': selectedId === component.id,
        'title-left': component.titlePosition === 'left'
      }
    ]"
    :style="component.styles"
    @click="handleClick"
    @mousedown="handleMouseDown"
  >
    <!-- 可编辑的表单元素标题（subform、static-text和divider除外） -->
            <div v-if="component.type !== 'subform' && component.type !== 'static-text' && component.type !== 'divider'" class="component-title" @click.stop="startEditing">
              <div v-if="!isEditing" class="title-text">
                {{ component.label || getDefaultLabel(component.type) }}
              </div>
              <el-input
                v-else
                v-model="editTitle"
                size="small"
                class="title-input"
                @blur="endEditing"
                @keyup.enter="endEditing"
                @keyup.esc="cancelEditing"
                ref="titleInputRef"
              />
            </div>
    
    <!-- 渲染具体组件 -->
    <div class="component-content" @click="handleComponentClick">
      <template v-if="component.type === 'textarea'">
        <el-input
          type="textarea"
          v-bind="component.props"
          v-on="component.events"
          @click.stop="handleComponentClick"
        />
      </template>
      <template v-else-if="component.type === 'radio'">
        <el-radio-group
          v-bind="component.props"
          v-on="component.events"
          @click.stop="handleComponentClick"
        >
          <el-radio
            v-for="option in component.props.options"
            :key="option.value"
            :label="option.value"
            @click.stop="handleComponentClick"
          >
            {{ option.label }}
          </el-radio>
        </el-radio-group>
      </template>
      <template v-else-if="component.type === 'checkbox'">
        <el-checkbox-group
          v-bind="component.props"
          v-on="component.events"
          @click.stop="handleComponentClick"
        >
          <el-checkbox
            v-for="option in component.props.options"
            :key="option.value"
            :label="option.value"
            @click.stop="handleComponentClick"
          >
            {{ option.label }}
          </el-checkbox>
        </el-checkbox-group>
      </template>
      <template v-else-if="component.type === 'select'">
        <el-select
          v-bind="component.props"
          v-on="component.events"
          @click.stop="handleComponentClick"
        >
          <el-option
            v-for="option in component.props.options"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </template>
      <template v-else-if="component.type === 'subform'">
        <div
          v-bind="component.props"
          :style="{
            ...component.styles,
            display: 'flex',
            gap: '20px',
            flexWrap: 'nowrap',
            border: 'none',
            backgroundColor: 'transparent'
          }"
          @click.stop="handleComponentClick"
          @dragover="handleDragOver"
          @drop="handleDrop"
        >
          <!-- 渲染子组件 -->
          <template v-if="component.children && component.children.length > 0">
            <div 
              v-for="(child, index) in component.children" 
              :key="child.id"
              class="subform-column"
              :style="{
                flex: '1',
                minWidth: '0'
              }"
            >
              <ComponentRenderer 
                :component="child"
                :selected-id="selectedId"
                @select="handleSelect"
                @delete="(id) => handleDeleteChild(index, id)"
                @update:component="handleUpdateComponent"
              />
            </div>
          </template>
          
          <!-- 空列占位符 -->
          <div 
            v-if="(!component.children || component.children.length < 2)"
            class="subform-empty-column"
            :style="{
              flex: '1',
              minWidth: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100px'
            }"
            @dragover="handleDragOver"
            @drop="handleDrop"
          >
            <span v-if="!component.children || component.children.length === 0">拖入组件到此处</span>
            <span v-else>拖入第二个组件到此处</span>
          </div>
        </div>
      </template>
      <template v-else-if="component.type === 'static-text'">
        <div
          v-bind="component.props"
          :style="{
            ...component.styles,
            fontSize: component.props.fontSize,
            color: component.props.color
          }"
        >
          {{ component.props.content }}
        </div>
      </template>
      <template v-else-if="component.type === 'upload'">
        <el-upload
          v-bind="component.props"
          v-on="component.events"
          @click.stop="handleComponentClick"
          :action="'#'"
          :show-file-list="true"
          :auto-upload="false"
        >
          <el-button type="primary">
            <el-icon><Upload /></el-icon>
            {{ component.props.placeholder || '上传文件' }}
          </el-button>
        </el-upload>
      </template>
      <template v-else>
        <component 
          :is="getComponent(component.type)"
          v-bind="component.props"
          v-on="component.events"
          @click.stop="handleComponentClick"
        >
          <!-- 渲染子组件 -->
          <template v-if="component.children && component.children.length > 0">
            <ComponentRenderer 
              v-for="child in component.children" 
              :key="child.id"
              :component="child"
              :selected-id="selectedId"
              @select="handleSelect"
            />
          </template>
        </component>
      </template>
    </div>
    
    <!-- 选中状态指示器 -->
    <div 
      v-if="selectedId === component.id" 
      class="component-selected-mask"
    >
      <div class="component-actions">
        <el-button 
          size="small" 
          circle 
          @click.stop="handleDelete"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
        <el-button 
          size="small" 
          circle 
          @click.stop="handleCopy"
        >
          <el-icon><DocumentCopy /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { Delete, DocumentCopy, Upload } from '@element-plus/icons-vue'

// 组件属性
const props = defineProps({
  component: Object,
  selectedId: [String, null]
})

// 组件事件
const emit = defineEmits(['select', 'delete', 'copy', 'update:component'])

// 编辑状态
const isEditing = ref(false)
const editTitle = ref('')
const titleInputRef = ref(null)

// 物料组件映射
const materialComponents = {
  button: 'el-button',
  input: 'el-input',
  text: 'div',
  container: 'div',
  textarea: 'el-input',
  number: 'el-input-number',
  radio: 'el-radio-group',
  checkbox: 'el-checkbox-group',
  select: 'el-select',
  date: 'el-date-picker',
  time: 'el-time-picker',
  switch: 'el-switch',
  slider: 'el-slider',
  rate: 'el-rate',
  upload: 'el-upload',
  divider: 'el-divider',
  'static-text': 'div',
  subform: 'div'
  // 可以扩展更多组件
}

// 获取组件
const getComponent = (type) => {
  return materialComponents[type] || 'div'
}

// 获取默认标签
const getDefaultLabel = (type) => {
  const labelMap = {
    button: 'Button',
    input: 'Input',
    text: 'Text',
    container: 'Container',
    textarea: 'Textarea',
    number: 'Number',
    radio: 'Radio Group',
    checkbox: 'Checkbox Group',
    select: 'Select',
    date: 'Date Picker',
    time: 'Time Picker',
    switch: 'Switch',
    slider: 'Slider',
    rate: 'Rate',
    upload: 'Upload',
    divider: 'Divider',
    'static-text': 'Static Text',
    subform: 'Subform'
  }
  return labelMap[type] || type
}

// 开始编辑
const startEditing = () => {
  isEditing.value = true
  editTitle.value = props.component.label || getDefaultLabel(props.component.type)
  
  // 等待DOM更新后聚焦输入框
  nextTick(() => {
    if (titleInputRef.value) {
      titleInputRef.value.focus()
      titleInputRef.value.select()
    }
  })
}

// 结束编辑
const endEditing = () => {
  if (editTitle.value.trim() !== '') {
    const updatedComponent = {
      ...props.component,
      label: editTitle.value.trim()
    }
    emit('update:component', updatedComponent)
  }
  isEditing.value = false
}

// 取消编辑
const cancelEditing = () => {
  isEditing.value = false
  editTitle.value = ''
}

// 处理点击事件
const handleClick = () => {
  emit('select', props.component.id)
}

// 处理删除
const handleDelete = () => {
  emit('delete', props.component.id)
}

// 处理复制
const handleCopy = () => {
  emit('copy', props.component)
}

// 处理组件拖拽开始
const handleComponentDragStart = (event) => {
  if (!event.dataTransfer) return
  
  // 设置拖拽数据
  const dragData = {
    type: 'component',
    component: props.component
  }
  event.dataTransfer.setData('application/json', JSON.stringify(dragData))
  
  // 设置拖拽效果
  event.dataTransfer.effectAllowed = 'move'
}

// 处理拖拽结束
const handleDragEnd = () => {
  // 可以在这里添加拖拽结束的逻辑
}

// 处理鼠标按下事件，拦截表单元素的原生行为
const handleMouseDown = (event) => {
  // 阻止事件冒泡，确保点击组件时不会触发表单元素的原生行为
  event.stopPropagation()
}

// 处理组件内部点击事件，确保点击表单元素时也能选中组件
const handleComponentClick = (event) => {
  event.stopPropagation()
  emit('select', props.component.id)
}

// 处理拖拽经过
const handleDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

// 处理拖拽放置
const handleDrop = (event) => {
  event.preventDefault()
  event.stopPropagation() // 阻止事件冒泡，避免触发父容器的drop事件
  
  try {
    const dragData = JSON.parse(event.dataTransfer.getData('application/json'))
    if (dragData.type === 'material' && dragData.material) {
      // 检查子组件数量是否已达上限
      const currentChildren = props.component.children || []
      if (currentChildren.length >= 2) {
        return // 最多支持两个子组件
      }
      
      // 检查是否是subform组件，如果是，不允许嵌套
      if (dragData.material.type === 'subform') {
        return // 不允许在subform中嵌套subform
      }
      
      // 创建新组件
      const newComponent = {
        type: dragData.material.type,
        label: dragData.material.name,
        props: { ...dragData.material.defaultProps },
        styles: { ...dragData.material.defaultStyles },
        events: {},
        children: dragData.material.isContainer ? [] : undefined,
        id: `component_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        titlePosition: 'left'
      }
      
      // 更新子组件列表
      const updatedComponent = {
        ...props.component,
        children: [...currentChildren, newComponent]
      }
      
      emit('update:component', updatedComponent)
    }
  } catch (error) {
    console.error('Failed to handle drop:', error)
  }
}

// 处理删除子组件
const handleDeleteChild = (index, id) => {
  const currentChildren = props.component.children || []
  const updatedChildren = currentChildren.filter((_, i) => i !== index)
  
  const updatedComponent = {
    ...props.component,
    children: updatedChildren
  }
  
  emit('update:component', updatedComponent)
}

// 处理组件更新
const handleUpdateComponent = (updatedComponent) => {
  emit('update:component', updatedComponent)
}
</script>

<style scoped>
.lc-component {
  position: relative;
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-direction: column;
}

/* subform组件特殊样式 */
.lc-component.lc-subform {
  background-color: transparent !important;
  padding: 0 !important;
  border: 1px solid transparent !important;
  margin: 0 !important;
}

/* 确保subform选中时也没有边框 */
.lc-component.lc-subform.lc-component-selected {
  border: 1px solid transparent !important;
  background-color: transparent !important;
}

/* 标题在左侧的布局 */
.lc-component.title-left {
  flex-direction: row;
  align-items: center;
}

.lc-component.title-left .component-title {
  margin-bottom: 0;
  width: auto;
  min-width: 80px;
  flex-shrink: 0;
}

.lc-component.title-left .component-content {
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

/* 确保表单元素能够填充内容区域 */
.lc-component .component-content > * {
  width: 100%;
  box-sizing: border-box;
}

/* 确保所有表单组件默认宽度为100% */
.lc-component .component-content :deep(el-input),
.lc-component .component-content :deep(el-select),
.lc-component .component-content :deep(el-date-picker),
.lc-component .component-content :deep(el-time-picker),
.lc-component .component-content :deep(el-textarea),
.lc-component .component-content :deep(el-slider),
.lc-component .component-content :deep(el-upload),
.lc-component .component-content :deep(el-rate),
.lc-component .component-content :deep(el-checkbox-group),
.lc-component .component-content :deep(el-radio-group),
.lc-component .component-content :deep(el-switch) {
  width: 100% !important;
  box-sizing: border-box !important;
}

.lc-component:hover {
  border-color: #409EFF;
  background-color: rgba(64, 158, 255, 0.05);
}

.lc-component-selected {
  border: 2px solid #409EFF;
  background-color: rgba(64, 158, 255, 0.1);
}

.component-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  cursor: text;
  width: 100%;
}

.title-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.title-text:hover {
  border-color: #409EFF;
  background-color: rgba(64, 158, 255, 0.05);
}

.title-input {
  width: 200px;
  margin: 0;
}

.component-content {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.component-selected-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px solid #409EFF;
  background-color: rgba(64, 158, 255, 0.1);
  z-index: 10;
  pointer-events: none;
}

/* 对于subform，确保内容区域可以接收拖拽事件 */
.lc-component.lc-subform .component-content {
  position: relative;
  z-index: 11;
  pointer-events: auto;
}

.component-actions {
  position: absolute;
  top: -10px;
  right: -10px;
  display: flex;
  gap: 4px;
  pointer-events: auto;
}
</style>
