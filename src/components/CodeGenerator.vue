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

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { ComponentSchema, PageSettings } from '../core/schema/types'

const props = defineProps({
  components: {
    type: Array as () => ComponentSchema[],
    default: () => []
  },
  showCodeDialog: {
    type: Boolean,
    default: false
  },
  pageSettings: {
    type: Object as () => PageSettings,
    default: () => ({ layout: 'vertical', columns: 2 } as PageSettings)
  }
})

const emit = defineEmits(['update:showCodeDialog'])

const generatedCode = ref('')

const showCodeDialogComputed = computed({
  get: (): boolean => props.showCodeDialog,
  set: (val: boolean) => emit('update:showCodeDialog', val)
})

const formComponentTypes: string[] = [
  'input', 'textarea', 'number', 'radio', 'checkbox', 'select',
  'date', 'time', 'switch', 'slider', 'rate', 'upload'
]

// 容器类型（需要递归处理子组件）
const containerTypes: string[] = ['subform', 'block']

// 收集需要异步加载选项的组件信息
interface AsyncOptionInfo {
  fieldName: string
  optionsApi: string
  pidField?: string
}

const asyncOptionMap = new Map<string, AsyncOptionInfo>()

const getDefaultValue = (type: string): string | number | boolean | string[] => {
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

const getDefaultLabel = (type: string): string => {
  const labelMap: Record<string, string> = {
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

const getDataType = (componentType: string): string => {
  const typeMap: Record<string, string> = {
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
const getItemWidthStyle = (component: ComponentSchema): string => {
  const layout = props.pageSettings?.layout || 'vertical'
  if (layout === 'vertical') return ''
  const span = component.props?.span || 24
  const pct = ((span / 24) * 100).toFixed(2)
  if (layout === 'grid') {
    return ' style="width: calc(' + pct + '% - 8px); flex-shrink: 0;"'
  }
  return ''
}

// 生成 v-if 显隐条件属性
const getVIf = (component: ComponentSchema): string => {
  if (component.props?.visibleCondition) {
    return ' v-if="' + component.props.visibleCondition + '"'
  }
  return ''
}

// 生成 el-form-item 开标签（含 v-if）
const formItemOpen = (component: ComponentSchema, label: string, extra: string): string => {
  const fieldName = component.props.fieldName || component.type
  const itemStyle = getItemWidthStyle(component)
  const vif = getVIf(component)
  return '<el-form-item label="' + label + '" prop="' + fieldName + '"' + vif + itemStyle + '>' + (extra ? '\n' : '')
}

const generateComponentTemplate = (component: ComponentSchema): string => {
  const label = component.label || getDefaultLabel(component.type)
  const fieldName = component.props.fieldName || component.type
  let template = ''

  // ---- 处理异步选项（select / radio / checkbox）----
  const isAsync = component.props?.optionsType === 'async' && !!component.props?.optionsApi
  if (isAsync && ['select', 'radio', 'checkbox'].includes(component.type)) {
    asyncOptionMap.set(fieldName, {
      fieldName,
      optionsApi: component.props.optionsApi,
      pidField: component.props.pidField || undefined
    })
  }

  switch (component.type) {
    case 'input':
      template += formItemOpen(component, label, '')
      template += '<el-input v-model="form.' + fieldName + '" placeholder="' + (component.props.placeholder || '请输入') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'textarea':
      template += formItemOpen(component, label, '')
      template += '<el-input type="textarea" v-model="form.' + fieldName + '" placeholder="' + (component.props.placeholder || '请输入') + '" :rows="' + (component.props.rows || 3) + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'number':
      template += formItemOpen(component, label, '')
      template += '<el-input-number v-model="form.' + fieldName + '" :min="' + (component.props.min || 0) + '" :max="' + (component.props.max || 100) + '" :step="' + (component.props.step || 1) + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'radio':
      template += formItemOpen(component, label, '')
      template += '<el-radio-group v-model="form.' + fieldName + '" size="small"' + (component.props.disabled ? ' disabled' : '') + '>\n'
      if (isAsync) {
        template += '  <el-radio v-for="item in ' + fieldName + 'Options" :key="item.value" :label="item.value">{{ item.label }}</el-radio>\n'
      } else if (component.props.options) {
        component.props.options.forEach(option => {
          const labelValue = typeof option.value === 'string' ? '\'' + option.value + '\'' : option.value
          template += '  <el-radio :label=' + labelValue + '>' + option.label + '</el-radio>\n'
        })
      }
      template += '</el-radio-group>\n'
      template += '</el-form-item>\n'
      break
    case 'checkbox':
      template += formItemOpen(component, label, '')
      template += '<el-checkbox-group v-model="form.' + fieldName + '" size="small"' + (component.props.disabled ? ' disabled' : '') + '>\n'
      if (isAsync) {
        template += '  <el-checkbox v-for="item in ' + fieldName + 'Options" :key="item.value" :value="item.value">{{ item.label }}</el-checkbox>\n'
      } else if (component.props.options) {
        component.props.options.forEach(option => {
          const valueValue = typeof option.value === 'string' ? '\'' + option.value + '\'' : option.value
          template += '  <el-checkbox :value=' + valueValue + '>' + option.label + '</el-checkbox>\n'
        })
      }
      template += '</el-checkbox-group>\n'
      template += '</el-form-item>\n'
      break
    case 'select':
      template += formItemOpen(component, label, '')
      template += '<el-select v-model="form.' + fieldName + '" placeholder="' + (component.props.placeholder || '请选择') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + '>\n'
      if (isAsync) {
        template += '  <el-option v-for="item in ' + fieldName + 'Options" :key="item.value" :label="item.label" :value="item.value" />\n'
      } else if (component.props.options) {
        component.props.options.forEach(option => {
          const labelValue = typeof option.label === 'string' ? '\'' + option.label + '\'' : option.label
          const valueValue = typeof option.value === 'string' ? '\'' + option.value + '\'' : option.value
          template += '  <el-option :label=' + labelValue + ' :value=' + valueValue + ' />\n'
        })
      }
      template += '</el-select>\n'
      template += '</el-form-item>\n'
      break
    case 'date':
      template += formItemOpen(component, label, '')
      template += '<el-date-picker v-model="form.' + fieldName + '" type="date" placeholder="' + (component.props.placeholder || '选择日期') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'time':
      template += formItemOpen(component, label, '')
      template += '<el-time-picker v-model="form.' + fieldName + '" placeholder="' + (component.props.placeholder || '选择时间') + '" size="small"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'switch':
      template += formItemOpen(component, label, '')
      template += '<el-switch v-model="form.' + fieldName + '"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'slider':
      template += formItemOpen(component, label, '')
      template += '<el-slider v-model="form.' + fieldName + '" :min="' + (component.props.min || 0) + '" :max="' + (component.props.max || 100) + '" :step="' + (component.props.step || 1) + '"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'rate':
      template += formItemOpen(component, label, '')
      template += '<el-rate v-model="form.' + fieldName + '" :max="' + (component.props.max || 5) + '"' + (component.props.disabled ? ' disabled' : '') + ' />\n'
      template += '</el-form-item>\n'
      break
    case 'upload':
      template += formItemOpen(component, label, '')
      template += '<el-upload action="#" :show-file-list="true" :auto-upload="false"' + (component.props.disabled ? ' disabled' : '') + '><el-button type="primary" size="small"><el-icon><Upload /></el-icon>' + (component.props.placeholder || '上传文件') + '</el-button></el-upload>\n'
      template += '</el-form-item>\n'
      break
    case 'button':
      template += '<el-button type="' + (component.props.type || 'primary') + '" size="' + (component.props.size || 'small') + '"' + (component.props.disabled ? ' disabled' : '') + (component.props.round ? ' round' : '') + (component.props.circle ? ' circle' : '') + '>' + (component.props.label || 'Button') + '</el-button>\n'
      break
    case 'block':
      template += '<div style="padding: ' + (component.props.padding || '16px') + '; background-color: ' + (component.props.backgroundColor || '#ffffff') + '; border: ' + (component.props.border !== false ? '1px solid #e0e0e0' : 'none') + '; border-radius: 4px;' + (component.styles ? Object.entries(component.styles).map(([k, v]) => k + ': ' + v + ';').join(' ') : '') + '">\n'
      if (component.props.title) {
        template += '  <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">' + component.props.title + '</h4>\n'
      }
      if (component.children && component.children.length > 0) {
        component.children.forEach(child => {
          template += '  ' + generateComponentTemplate(child)
        })
      }
      template += '</div>\n'
      break
    case 'static-text':
      template += '<div style="' + (component.styles ? Object.entries(component.styles).map(([key, value]) => key + ': ' + value + ';').join(' ') : '') + '">' + (component.props.content || '') + '</div>\n'
      break
    case 'divider':
      if (component.props.content) {
        template += '<el-divider content-position="center">' + component.props.content + '</el-divider>\n'
      } else {
        template += '<el-divider></el-divider>\n'
      }
      break
  }

  return template
}

// 递归生成验证规则
const genRuleStr = (component: ComponentSchema): string => {
  const fieldName = component.props.fieldName || component.type
  const validation = component.validation
  if (!validation) return ''
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
const collectFromTree = (components: ComponentSchema[], callback: (comp: ComponentSchema) => void): void => {
  components.forEach((comp: ComponentSchema) => {
    if (formComponentTypes.includes(comp.type)) {
      callback(comp)
    }
    if (containerTypes.includes(comp.type) && comp.children) {
      collectFromTree(comp.children, callback)
    }
  })
}

// 生成异步选项的 ref 声明
const genAsyncOptionRefs = (): string => {
  let code = ''
  asyncOptionMap.forEach((info) => {
    code += 'const ' + info.fieldName + 'Options = ref([])\n'
  })
  return code
}

// 生成异步选项的加载函数
const genAsyncLoadFunctions = (): string => {
  let code = ''
  asyncOptionMap.forEach((info) => {
    const fnName = 'load' + info.fieldName.charAt(0).toUpperCase() + info.fieldName.slice(1) + 'Options'
    code += '\n// 加载 ' + info.fieldName + ' 的选项\n'
    code += 'const ' + fnName + ' = async () => {\n'
    code += '  const res = await (' + info.optionsApi + ')(null, form.value)\n'
    code += '  ' + info.fieldName + 'Options.value = res || []\n'
    code += '}\n'
  })
  return code
}

// 生成级联 watch
const genAsyncWatchers = (): string => {
  let code = ''
  asyncOptionMap.forEach((info) => {
    if (info.pidField) {
      const fnName = 'load' + info.fieldName.charAt(0).toUpperCase() + info.fieldName.slice(1) + 'Options'
      code += '\n// ' + info.fieldName + ' 依赖 ' + info.pidField + '，级联加载\n'
      code += 'watch(() => form.value.' + info.pidField + ', () => {\n'
      code += '  form.value.' + info.fieldName + ' = \'\'\n'
      code += '  ' + fnName + '()\n'
      code += '})\n'
    }
  })
  return code
}

const generateCode = (): void => {
  // 清空上轮数据
  asyncOptionMap.clear()

  const components = props.components
  const layout = props.pageSettings?.layout || 'vertical'

  // ---- Template ----
  let template = '<template>\n  <el-form :model="form" :rules="rules" ref="formRef" label-width="120px" :class="[\'generated-form\', \'form-layout-' + layout + '\']" style="padding: 20px;">\n'

  components.forEach(component => {
    template += '    ' + generateComponentTemplate(component)
  })

  template += '\n    <div class="form-actions">\n      <el-button @click="cancelForm">取消</el-button>\n      <el-button type="primary" @click="submitForm">提交</el-button>\n    </div>\n  </el-form>\n</template>\n'

  // ---- Script ----
  const hasAsync = asyncOptionMap.size > 0
  const hasCascade = Array.from(asyncOptionMap.values()).some(info => !!info.pidField)

  let script = '<script setup>\nimport { ref'
  if (hasAsync) {
    script += ', onMounted'
  }
  if (hasCascade) {
    script += ', watch'
  }
  script += ' } from "vue"\n'

  // 异步选项 refs
  if (hasAsync) {
    script += '\n// ==== 异步选项数据 ====\n'
    script += genAsyncOptionRefs()
  }

  script += '\n// 表单数据\nconst form = ref({\n'
  collectFromTree(components, (comp) => {
    const fName = comp.props.fieldName || comp.type
    const defaultValue = comp.props.defaultValue || getDefaultValue(comp.type)
    script += '  ' + fName + ': ' + JSON.stringify(defaultValue) + ',\n'
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

  // 异步加载函数
  if (hasAsync) {
    script += genAsyncLoadFunctions()
    script += '\n// ==== 初始化异步选项 ====\n'
    script += 'onMounted(() => {\n'
    asyncOptionMap.forEach((info) => {
      const fnName = 'load' + info.fieldName.charAt(0).toUpperCase() + info.fieldName.slice(1) + 'Options'
      script += '  ' + fnName + '()\n'
    })
    script += '})\n'
  }

  // 级联 watch
  if (hasCascade) {
    script += genAsyncWatchers()
  }

  script += '\n// 表单提交\nconst submitForm = () => {\n  formRef.value?.validate((valid) => {\n    if (valid) {\n      console.log("Form submitted:", form.value)\n    } else {\n      console.log("Validation failed:", form.value)\n    }\n  })\n}\n'

  script += '\n// 表单取消\nconst cancelForm = () => {\n  formRef.value?.resetFields()\n  console.log("表单已重置")\n}\n'

  script += '</' + 'script>\n'

  // ---- Style ----
  const style = '<style scoped>\n.generated-form {\n  max-width: 800px;\n  margin: 0 auto;\n  background-color: #ffffff;\n  border-radius: 8px;\n  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);\n}\n\n.form-layout-grid {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: flex-start;\n  gap: 8px;\n}\n\n.form-layout-inline {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n}\n\n.form-layout-vertical {\n  display: flex;\n  flex-direction: column;\n}\n\n.form-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 12px;\n  margin-top: 20px;\n  padding-top: 20px;\n  border-top: 1px solid #e0e0e0;\n  width: 100%;\n}' + '</style>'

  const code = template + script + style
  generatedCode.value = code
}

const copyCode = (): void => {
  navigator.clipboard.writeText(generatedCode.value).then(() => {
    ElMessage.success('代码已复制到剪贴板')
  }).catch((err: Error) => {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请手动复制')
  })
}

watch(() => props.showCodeDialog, (newVal: boolean) => {
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
