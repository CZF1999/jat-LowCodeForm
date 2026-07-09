<template>
  <el-dialog
    v-model="showCodeDialogComputed"
    title="生成的Vue组件代码"
    width="80%"
    destroy-on-close
  >
    <div class="code-dialog-content">
      <el-button type="primary" @click="copyCode" style="margin-bottom: 16px;">
        复制代码
      </el-button>
      <pre class="code-block"><code>{{ generatedCode }}</code></pre>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showCodeDialogComputed = false">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  components: {
    type: Array,
    default: () => []
  },
  showCodeDialog: {
    type: Boolean,
    default: false
  },
  pageSettings: {
    type: Object,
    default: () => ({ layout: 'vertical', columns: 2 })
  }
})

const emit = defineEmits(['update:showCodeDialog'])

const generatedCode = ref('')

const showCodeDialogComputed = computed({
  get: () => props.showCodeDialog,
  set: (val) => emit('update:showCodeDialog', val)
})

const formComponentTypes = [
  'input', 'textarea', 'number', 'radio', 'checkbox', 'select',
  'date', 'time', 'switch', 'slider', 'rate', 'upload'
]

// 容器类型（需要递归处理子组件）
const containerTypes = ['subform', 'block']

const getDefaultValue = (type) => {
  switch (type) {
    case 'input':
    case 'textarea':
    case 'select':
    case 'date':
    case 'time':
    case 'radio':
      return ''
    case 'number':
    case 'slider':
    case 'rate':
      return 0
    case 'checkbox':
      return []
    case 'switch':
      return false
    default:
      return ''
  }
}

const getDefaultLabel = (type) => {
  const labelMap = {
    input: '输入框',
    textarea: '多行文本框',
    number: '数字输入框',
    radio: '单选按钮组',
    checkbox: '复选框组',
    select: '下拉选择器',
    date: '日期选择器',
    time: '时间选择器',
    switch: '开关',
    slider: '滑块',
    rate: '评分',
    upload: '文件上传',
    'static-text': '静态文本',
    divider: '分隔线',
    button: '按钮',
    block: '区块'
  }
  return labelMap[type] || type
}

const getDataType = (componentType) => {
  const typeMap = {
    'input': 'string',
    'textarea': 'string',
    'number': 'number',
    'radio': 'string',
    'checkbox': 'array',
    'select': 'string',
    'date': 'date',
    'time': 'time',
    'switch': 'boolean',
    'slider': 'number',
    'rate': 'number',
    'upload': 'file'
  }
  return typeMap[componentType] || 'string'
}

// 计算 el-form-item 的宽度样式
const getItemWidthStyle = (component) => {
  const layout = props.pageSettings?.layout || 'vertical'
  if (layout === 'vertical') return ''
  const span = component.props?.span || 24
  const pct = ((span / 24) * 100).toFixed(2)
  if (layout === 'grid') {
    return ' style="width: calc(' + pct + '% - 8px); flex-shrink: 0;"'
  }
  return ''
}

const generateComponentTemplate = (component) => {
  const label = component.label || getDefaultLabel(component.type)
  const itemStyle = getItemWidthStyle(component)
  let template = ''

  switch (component.type) {
    case 'input':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-input v-model="form.' + (component.props.fieldName || component.type) + '" placeholder="' + (component.props.placeholder || '请输入') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'textarea':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-input type="textarea" v-model="form.' + (component.props.fieldName || component.type) + '" placeholder="' + (component.props.placeholder || '请输入') + '" :rows="' + (component.props.rows || 3) + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'number':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-input-number v-model="form.' + (component.props.fieldName || component.type) + '" :min="' + (component.props.min || 0) + '" :max="' + (component.props.max || 100) + '" :step="' + (component.props.step || 1) + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'radio':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-radio-group v-model="form.' + (component.props.fieldName || component.type) + '" size="small"' + (component.props.disabled ? ' disabled' : '') + '>'
      if (component.props.options) {
        component.props.options.forEach(option => {
          const labelValue = typeof option.value === 'string' ? '\'' + option.value + '\'' : option.value
          template += '<el-radio :label=' + labelValue + '>' + option.label + '</el-radio>'
        })
      }
      template += '</el-radio-group>'
      template += '</el-form-item>'
      break
    case 'checkbox':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-checkbox-group v-model="form.' + (component.props.fieldName || component.type) + '" size="small"' + (component.props.disabled ? ' disabled' : '') + '>'
      if (component.props.options) {
        component.props.options.forEach(option => {
          const valueValue = typeof option.value === 'string' ? '\'' + option.value + '\'' : option.value
          template += '<el-checkbox :value=' + valueValue + '>' + option.label + '</el-checkbox>'
        })
      }
      template += '</el-checkbox-group>'
      template += '</el-form-item>'
      break
    case 'select':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-select v-model="form.' + (component.props.fieldName || component.type) + '" placeholder="' + (component.props.placeholder || '请选择') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + '>'
      if (component.props.options) {
        component.props.options.forEach(option => {
          const labelValue = typeof option.label === 'string' ? '\'' + option.label + '\'' : option.label
          const valueValue = typeof option.value === 'string' ? '\'' + option.value + '\'' : option.value
          template += '<el-option :label=' + labelValue + ' :value=' + valueValue + ' />'
        })
      }
      template += '</el-select>'
      template += '</el-form-item>'
      break
    case 'date':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-date-picker v-model="form.' + (component.props.fieldName || component.type) + '" type="date" placeholder="' + (component.props.placeholder || '选择日期') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'time':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-time-picker v-model="form.' + (component.props.fieldName || component.type) + '" placeholder="' + (component.props.placeholder || '选择时间') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'switch':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-switch v-model="form.' + (component.props.fieldName || component.type) + '"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'slider':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-slider v-model="form.' + (component.props.fieldName || component.type) + '" :min="' + (component.props.min || 0) + '" :max="' + (component.props.max || 100) + '" :step="' + (component.props.step || 1) + '"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'rate':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-rate v-model="form.' + (component.props.fieldName || component.type) + '" :max="' + (component.props.max || 5) + '"' + (component.props.disabled ? ' disabled' : '') + ' />'
      template += '</el-form-item>'
      break
    case 'upload':
      template += '<el-form-item label="' + label + '" prop="' + (component.props.fieldName || component.type) + '"' + itemStyle + '>'
      template += '<el-upload action="#" :show-file-list="true" :auto-upload="false"' + (component.props.disabled ? ' disabled' : '') + '><el-button type="primary" size="small"><el-icon><Upload /></el-icon>' + (component.props.placeholder || '上传文件') + '</el-button></el-upload>'
      template += '</el-form-item>'
      break
    case 'button':
      template += '<el-button type="' + (component.props.type || 'primary') + '" size="' + (component.props.size || 'small') + '"' + (component.props.disabled ? ' disabled' : '') + (component.props.round ? ' round' : '') + (component.props.circle ? ' circle' : '') + '>' + (component.props.label || 'Button') + '</el-button>'
      break
    case 'block':
      template += '<div style="padding: ' + (component.props.padding || '16px') + '; background-color: ' + (component.props.backgroundColor || '#ffffff') + '; border: ' + (component.props.border !== false ? '1px solid #e0e0e0' : 'none') + '; border-radius: 4px;' + (component.styles ? Object.entries(component.styles).map(([k, v]) => k + ': ' + v + ';').join(' ') : '') + '">'
      if (component.props.title) {
        template += '\n      <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">' + component.props.title + '</h4>'
      }
      if (component.children && component.children.length > 0) {
        template += '\n'
        component.children.forEach(child => {
          template += '      ' + generateComponentTemplate(child)
        })
        template += '    '
      }
      template += '</div>'
      break
    case 'static-text':
      template += '<div style="' + (component.styles ? Object.entries(component.styles).map(([key, value]) => key + ': ' + value + ';').join(' ') : '') + '">' + (component.props.content || '') + '</div>'
      break
    case 'divider':
      if (component.props.content) {
        template += '<el-divider content-position="center">' + component.props.content + '</el-divider>'
      } else {
        template += '<el-divider></el-divider>'
      }
      break
  }

  return template
}

// 递归生成验证规则
const genRuleStr = (component) => {
  const fieldName = component.props.fieldName || component.type
  const validation = component.validation
  let ruleStr = '  ' + fieldName + ': [\n'

  if (validation.required) {
    ruleStr += '    { required: true, message: \'请输入' + (component.label || '字段') + '\', trigger: \'blur\' }\n'
  }
  if (validation.type === 'string') {
    if (validation.minLength) {
      ruleStr += '    { min: ' + validation.minLength + ', message: \'长度不能少于 ' + validation.minLength + ' 个字符\', trigger: \'blur\' }\n'
    }
    if (validation.maxLength) {
      ruleStr += '    { max: ' + validation.maxLength + ', message: \'长度不能超过 ' + validation.maxLength + ' 个字符\', trigger: \'blur\' }\n'
    }
    if (validation.pattern) {
      ruleStr += '    { pattern: ' + validation.pattern + ', message: \'格式不正确\', trigger: \'blur\' }\n'
    }
  } else if (validation.type === 'number') {
    if (validation.min !== undefined && validation.min !== null) {
      ruleStr += '    { min: ' + validation.min + ', message: \'不能小于 ' + validation.min + '\', trigger: \'blur\' }\n'
    }
    if (validation.max !== undefined && validation.max !== null) {
      ruleStr += '    { max: ' + validation.max + ', message: \'不能大于 ' + validation.max + '\', trigger: \'blur\' }\n'
    }
  }

  ruleStr += '  ],\n'
  return ruleStr
}

// 递归收集数据/规则（处理容器组件）
const collectFromTree = (components, callback) => {
  components.forEach(comp => {
    if (formComponentTypes.includes(comp.type)) {
      callback(comp)
    }
    if (containerTypes.includes(comp.type) && comp.children) {
      collectFromTree(comp.children, callback)
    }
  })
}

const generateCode = () => {
  const components = props.components
  const layout = props.pageSettings?.layout || 'vertical'

  // ---- Template ----
  let template = '<template>\n  <el-form :model="form" :rules="rules" ref="formRef" label-width="120px" :class="[\'generated-form\', \'form-layout-' + layout + '\']" style="padding: 20px;">\n'

  components.forEach(component => {
    if (containerTypes.includes(component.type)) {
      template += '    ' + generateComponentTemplate(component)
    } else {
      template += '    ' + generateComponentTemplate(component)
    }
  })

  template += '    <div class="form-actions">\n      <el-button @click="cancelForm">取消</el-button>\n      <el-button type="primary" @click="submitForm">提交</el-button>\n    </div>\n  </el-form>\n</template>\n'

  // ---- Script ----
  let script = '<script setup>\nimport { ref } from "vue"\n'

  script += '\n// 表单数据\nconst form = ref({\n'
  collectFromTree(components, (comp) => {
    const fieldName = comp.props.fieldName || comp.type
    const defaultValue = comp.props.defaultValue || getDefaultValue(comp.type)
    script += '  ' + fieldName + ': ' + JSON.stringify(defaultValue) + ',\n'
  })
  script += '})\n'

  script += '\n// 表单引用\nconst formRef = ref()\n'

  script += '\n// 表单验证规则\nconst rules = ref({\n'
  collectFromTree(components, (comp) => {
    if (comp.validation) {
      script += genRuleStr(comp)
    }
  })
  script += '})\n'

  script += '\n// 表单提交\nconst submitForm = () => {\n  formRef.value?.validate((valid) => {\n    if (valid) {\n      console.log("Form submitted:", form.value)\n    } else {\n      console.log("Validation failed:", form.value)\n    }\n  })\n}\n'

  script += '\n// 表单取消\nconst cancelForm = () => {\n  formRef.value?.resetFields()\n  console.log("表单已重置")\n}\n'

  script += '</' + 'script>\n'

  // ---- Style ----
  const style = '<style scoped>\n.generated-form {\n  max-width: 800px;\n  margin: 0 auto;\n  background-color: #ffffff;\n  border-radius: 8px;\n  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);\n}\n\n.form-layout-grid {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: flex-start;\n  gap: 8px;\n}\n\n.form-layout-inline {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n}\n\n.form-layout-vertical {\n  display: flex;\n  flex-direction: column;\n}\n\n.form-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 12px;\n  margin-top: 20px;\n  padding-top: 20px;\n  border-top: 1px solid #e0e0e0;\n  width: 100%;\n}' + '</style>'

  const code = template + script + style
  generatedCode.value = code
}

const copyCode = () => {
  navigator.clipboard.writeText(generatedCode.value).then(() => {
    ElMessage.success('代码已复制到剪贴板')
  }).catch(err => {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请手动复制')
  })
}

watch(() => props.showCodeDialog, (newVal) => {
  if (newVal) {
    generateCode()
  }
})
</script>

<style scoped>
.code-dialog-content {
  max-height: 70vh;
  overflow: auto;
}

.code-block {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
  overflow: auto;
  max-height: 500px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.6;
}

.code-block code {
  white-space: pre;
  word-wrap: normal;
}
</style>
