<template>
  <div class="property-panel">
    <h3>属性编辑</h3>
    
    <div v-if="!selectedComponent" class="no-selection">
      请选择一个组件进行编辑
    </div>
    
    <div v-else class="property-content">
      <!-- 基本信息 -->
      <div class="property-section">
        <h4>基本信息</h4>
        <el-form :model="selectedComponent" size="small">
          <el-form-item label="组件类型">
            <el-input 
              v-model="selectedComponent.type" 
              disabled 
            />
          </el-form-item>
          <el-form-item label="显示名称">
            <el-input 
              v-model="selectedComponent.label" 
              @input="updateComponent"
            />
          </el-form-item>
          <el-form-item label="标题位置">
            <el-select 
              v-model="selectedComponent.titlePosition" 
              @change="updateComponent"
              style="width: 100%;"
            >
              <el-option label="上方" value="top"></el-option>
              <el-option label="左侧" value="left"></el-option>
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      
      <!-- 属性编辑 -->
      <div class="property-section">
        <h4>属性</h4>
        <el-form :model="selectedComponent.props" size="small">
          <template v-for="(value, key) in selectedComponent.props" :key="key">
            <!-- 字符串类型 -->
            <el-form-item :label="getPropertyLabel(key)" v-if="typeof value === 'string'">
              <el-input 
                v-model="selectedComponent.props[key]" 
                @input="updateComponent"
              />
            </el-form-item>
            
            <!-- 布尔类型 -->
            <el-form-item :label="getPropertyLabel(key)" v-else-if="typeof value === 'boolean'">
              <el-switch 
                v-model="selectedComponent.props[key]" 
                @change="updateComponent"
              />
            </el-form-item>
            
            <!-- 数字类型 -->
            <el-form-item :label="getPropertyLabel(key)" v-else-if="typeof value === 'number'">
              <el-input-number 
                v-model="selectedComponent.props[key]" 
                @change="updateComponent"
              />
            </el-form-item>
          </template>
        </el-form>
      </div>
      
      <!-- 验证规则 -->
      <div class="property-section" v-if="isFormComponent">
        <h4>验证规则</h4>
        <el-form :model="validationRules" size="small">
          <el-form-item label="必填项">
            <el-switch 
              v-model="validationRules.required" 
              @change="updateValidationRules"
            />
          </el-form-item>
          <el-form-item label="数据类型">
            <el-select 
              v-model="validationRules.type" 
              @change="updateValidationRules"
              style="width: 100%;"
            >
              <el-option label="文本" value="string"></el-option>
              <el-option label="数字" value="number"></el-option>
              <el-option label="邮箱" value="email"></el-option>
              <el-option label="手机号" value="phone"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="最小长度" v-if="validationRules.type === 'string'">
            <el-input-number 
              v-model="validationRules.minLength" 
              @change="updateValidationRules"
            />
          </el-form-item>
          <el-form-item label="最大长度" v-if="validationRules.type === 'string'">
            <el-input-number 
              v-model="validationRules.maxLength" 
              @change="updateValidationRules"
            />
          </el-form-item>
          <el-form-item label="最小值" v-if="validationRules.type === 'number'">
            <el-input-number 
              v-model="validationRules.min" 
              @change="updateValidationRules"
            />
          </el-form-item>
          <el-form-item label="最大值" v-if="validationRules.type === 'number'">
            <el-input-number 
              v-model="validationRules.max" 
              @change="updateValidationRules"
            />
          </el-form-item>
          <el-form-item label="正则表达式" v-if="validationRules.type === 'string'">
            <el-input 
              v-model="validationRules.pattern" 
              @input="updateValidationRules"
              placeholder="输入正则表达式"
            />
          </el-form-item>
        </el-form>
      </div>

      <!-- 选项编辑 -->
      <div class="property-section" v-if="hasOptions">
        <h4>选项配置</h4>
        <div class="options-container">
          <div 
            v-for="(option, index) in options" 
            :key="index"
            class="option-item"
          >
            <div class="option-inputs">
              <el-input 
                v-model="option.label" 
                placeholder="选项文本" 
                size="small"
                @input="updateOptions"
              />
              <el-input 
                v-model="option.value" 
                placeholder="选项值" 
                size="small"
                @input="updateOptions"
              />
            </div>
            <el-button 
              size="small" 
              type="danger" 
              @click="removeOption(index)"
            >
              删除
            </el-button>
          </div>
          <el-button 
            size="small" 
            type="primary" 
            @click="addOption"
            class="add-option-btn"
          >
            添加选项
          </el-button>
        </div>
      </div>

      <!-- 样式编辑 -->
      <div class="property-section">
        <h4>样式</h4>
        <el-form :model="selectedComponent.styles" size="small">
          <template v-for="(value, key) in selectedComponent.styles" :key="key">
            <el-form-item :label="getStyleLabel(key)">
              <el-input 
                v-model="selectedComponent.styles[key]" 
                @input="updateComponent"
              />
            </el-form-item>
          </template>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useEditorStore } from '../stores/editorStore'

const editorStore = useEditorStore()

// 选中的组件
const selectedComponent = computed(() => editorStore.selectedComponent)

// 属性标签映射
const propertyLabels = {
  type: '组件类型',
  label: '显示名称',
  placeholder: '占位符',
  disabled: '禁用',
  size: '尺寸',
  maxlength: '最大长度',
  showWordLimit: '显示字数限制',
  round: '圆角',
  circle: '圆形',
  content: '内容',
  fontSize: '字体大小',
  color: '颜色',
  direction: '方向',
  align: '对齐方式'
}

// 样式标签映射
const styleLabels = {
  width: '宽度',
  height: '高度',
  margin: '外边距',
  padding: '内边距',
  backgroundColor: '背景颜色',
  color: '文字颜色',
  fontSize: '字体大小',
  fontWeight: '字体粗细',
  textAlign: '文本对齐',
  lineHeight: '行高',
  borderRadius: '圆角',
  border: '边框',
  borderColor: '边框颜色',
  borderWidth: '边框宽度',
  display: '显示方式',
  flexDirection: '排列方向',
  alignItems: '垂直对齐',
  justifyContent: '水平对齐'
}

// 获取属性标签
const getPropertyLabel = (key) => {
  return propertyLabels[key] || key
}

// 获取样式标签
const getStyleLabel = (key) => {
  return styleLabels[key] || key
}

// 更新组件
const updateComponent = () => {
  if (selectedComponent.value) {
    editorStore.updateComponent(selectedComponent.value.id, {
      ...selectedComponent.value
    })
  }
}

// 表单组件类型列表
const formComponentTypes = [
  'input', 'textarea', 'number', 'radio', 'checkbox', 'select',
  'date', 'time', 'switch', 'slider', 'rate', 'upload'
]

// 是否为表单组件
const isFormComponent = computed(() => {
  return selectedComponent.value && formComponentTypes.includes(selectedComponent.value.type)
})

// 验证规则
const validationRules = computed({
  get: () => {
    if (!selectedComponent.value) return {}
    return selectedComponent.value.validation || {
      required: false,
      type: 'string',
      minLength: undefined,
      maxLength: undefined,
      min: undefined,
      max: undefined,
      pattern: undefined
    }
  },
  set: (value) => {
    if (selectedComponent.value) {
      editorStore.updateComponent(selectedComponent.value.id, {
        ...selectedComponent.value,
        validation: value
      })
    }
  }
})

// 更新验证规则
const updateValidationRules = () => {
  if (selectedComponent.value) {
    editorStore.updateComponent(selectedComponent.value.id, {
      ...selectedComponent.value,
      validation: { ...validationRules.value }
    })
  }
}

// 监听选中组件变化
watch(selectedComponent, (newVal) => {
  // 可以在这里添加额外的逻辑
}, { deep: true })

// 是否有选项属性
const hasOptions = computed(() => {
  return selectedComponent.value && 
    ['select', 'radio', 'checkbox'].includes(selectedComponent.value.type) &&
    selectedComponent.value.props && 
    Array.isArray(selectedComponent.value.props.options)
})

// 选项数据
const options = computed({
  get: () => {
    if (!hasOptions.value) return []
    return selectedComponent.value.props.options
  },
  set: (value) => {
    if (selectedComponent.value && selectedComponent.value.props) {
      selectedComponent.value.props.options = value
      updateComponent()
    }
  }
})

// 添加选项
const addOption = () => {
  if (!hasOptions.value) return
  const newOptions = [...options.value, { label: '新选项', value: `option_${Date.now()}` }]
  options.value = newOptions
}

// 删除选项
const removeOption = (index) => {
  if (!hasOptions.value) return
  const newOptions = options.value.filter((_, i) => i !== index)
  options.value = newOptions
}

// 更新选项
const updateOptions = () => {
  if (selectedComponent.value) {
    updateComponent()
  }
}
</script>

<style scoped>
.property-panel {
  width: 300px;
  padding: 16px;
  border-left: 1px solid #e0e0e0;
  background-color: #f5f7fa;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.property-panel h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  color: #333;
}

.no-selection {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

.property-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.property-section h4 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

.el-form {
  margin-bottom: 0;
}

.el-form-item {
  margin-bottom: 12px;
}

.options-container {
  margin-top: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #ffffff;
}

.option-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-option-btn {
  margin-top: 8px;
  width: 100%;
}
</style>
