// 表单配置 JSON 生成器
// 将内部组件树 (ComponentSchema[]) 转换为声明式表单配置 JSON

// 表单组件类型（生成 field 的类型）
const FORM_COMPONENT_TYPES = [
  'input', 'textarea', 'number', 'radio', 'checkbox', 'select',
  'date', 'time', 'switch', 'slider', 'rate', 'upload'
]

// 内部元数据属性（不应输出到 props 中）
const META_PROPS = [
  'fieldName', 'span', 'pidField', 'visibleCondition',
  'optionsType', 'optionsApi', 'options', 'defaultValue'
]

// 获取数据类型默认值
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

// 获取字段的 key（优先使用 fieldName，其次 label，最后 type）
const getFieldKey = (component) => {
  return component.props?.fieldName || component.label || component.type
}

// 过滤出需要输出的 Element Plus 属性
const filterOutputProps = (props) => {
  if (!props) return undefined
  const output = {}
  for (const [key, value] of Object.entries(props)) {
    if (!META_PROPS.includes(key) && value !== undefined && value !== '') {
      output[key] = value
    }
  }
  return Object.keys(output).length > 0 ? output : undefined
}

// 生成 options 字段
const generateOptions = (component) => {
  const props = component.props || {}
  if (props.optionsType === 'async' && props.optionsApi) {
    // 异步选项：返回函数体字符串
    return props.optionsApi
  }
  // 静态选项：返回数组
  if (Array.isArray(props.options) && props.options.length > 0) {
    return props.options
  }
  return undefined
}

// 转换验证规则
const generateRules = (component) => {
  const validation = component.validation
  if (!validation) return undefined

  const rules = []

  if (validation.required) {
    rules.push({
      required: true,
      message: `请输入${component.label || '字段'}`,
      trigger: 'blur'
    })
  }

  if (validation.type === 'string') {
    if (validation.minLength) {
      rules.push({
        min: validation.minLength,
        message: `长度不能少于${validation.minLength}个字符`,
        trigger: 'blur'
      })
    }
    if (validation.maxLength) {
      rules.push({
        max: validation.maxLength,
        message: `长度不能超过${validation.maxLength}个字符`,
        trigger: 'blur'
      })
    }
    if (validation.pattern) {
      rules.push({
        pattern: validation.pattern,
        message: '格式不正确',
        trigger: 'blur'
      })
    }
  } else if (validation.type === 'number') {
    if (validation.min !== undefined && validation.min !== null) {
      rules.push({
        min: validation.min,
        message: `不能小于${validation.min}`,
        trigger: 'blur'
      })
    }
    if (validation.max !== undefined && validation.max !== null) {
      rules.push({
        max: validation.max,
        message: `不能大于${validation.max}`,
        trigger: 'blur'
      })
    }
  } else if (validation.type === 'email') {
    rules.push({
      type: 'email',
      message: '请输入正确的邮箱地址',
      trigger: 'blur'
    })
  } else if (validation.type === 'phone') {
    rules.push({
      pattern: /^1[3-9]\d{9}$/,
      message: '请输入正确的手机号码',
      trigger: 'blur'
    })
  }

  return rules.length > 0 ? rules : undefined
}

// 生成单个字段配置
const generateField = (component) => {
  const field = {
    key: getFieldKey(component),
    label: component.label || component.type
  }

  // 类型
  if (component.type) {
    field.type = component.type
  }

  // 栅格跨度
  if (component.props?.span && component.props.span !== 24) {
    field.span = component.props.span
  }

  // 父级依赖字段
  if (component.props?.pidField) {
    field.pidField = component.props.pidField
  }

  // 可见条件
  if (component.props?.visibleCondition) {
    field.visible = component.props.visibleCondition
  }

  // 选项（select / radio / checkbox）
  if (['select', 'radio', 'checkbox'].includes(component.type)) {
    const options = generateOptions(component)
    if (options !== undefined) {
      field.options = options
    }
  }

  // 校验规则
  const rules = generateRules(component)
  if (rules) {
    field.rules = rules
  }

  // Element Plus 原生属性
  const outputProps = filterOutputProps(component.props)
  if (outputProps) {
    field.props = outputProps
  }

  // 默认值
  if (component.props?.defaultValue !== undefined) {
    field.defaultValue = component.props.defaultValue
  }

  return field
}

// 容器类型（需要递归展开子组件）
const CONTAINER_TYPES = ['subform', 'block']

// 递归收集所有表单字段（展平容器的 children）
const collectFields = (components) => {
  const fields = []

  components.forEach(component => {
    if (CONTAINER_TYPES.includes(component.type) && component.children) {
      // 容器：递归展开子组件
      fields.push(...collectFields(component.children))
    } else if (FORM_COMPONENT_TYPES.includes(component.type)) {
      fields.push(generateField(component))
    }
    // button, divider, static-text, container 等非表单组件忽略
  })

  return fields
}

/**
 * 生成表单配置数据对象
 */
export function generateFormConfig(components, pageSettings = {}) {
  const formTitle = pageSettings.formTitle || 'form'
  const formKey = formTitle
    .replace(/[\s_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[\s_-]+/g, '')
    .replace(/^./, (c) => c.toLowerCase())

  const fields = collectFields(components)

  return {
    [formKey]: {
      title: formTitle,
      layout: pageSettings.layout || 'grid',
      columns: pageSettings.columns || 2,
      fields
    }
  }
}

// ========== JS 代码生成器 ==========

// 判断是否是合法 JS 标识符（不需要引号）
const isValidIdentifier = (key) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)

// 判断字符串是否应该作为代码输出（函数体）
const isCodeExpression = (value) => {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('(') || trimmed.startsWith('async') || trimmed.startsWith('function')
}

// 将任意 JS 值转为源码字符串
const toJS = (value, indent = 0) => {
  const pad = '  '.repeat(indent)
  const childPad = '  '.repeat(indent + 1)

  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)

  // 函数体字符串 → 直接输出代码
  if (isCodeExpression(value)) return value

  if (typeof value === 'string') {
    // 优先用单引号，如果内容包含单引号则用双引号
    if (value.includes("'")) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    }
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    // 简单值（数字、布尔、短字符串）放一行
    const allSimple = value.every(v =>
      typeof v === 'number' || typeof v === 'boolean' || v === null ||
      (typeof v === 'string' && v.length < 30 && !v.includes('\n'))
    )
    if (allSimple) {
      const items = value.map(v => toJS(v, 0)).join(', ')
      const line = `[${items}]`
      if (line.length < 80) return line
    }
    const items = value.map(v => `${childPad}${toJS(v, indent + 1)}`).join(',\n')
    return `[\n${items}\n${pad}]`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const lines = entries.map(([k, v]) => {
      const key = isValidIdentifier(k) ? k : `'${k}'`
      return `${childPad}${key}: ${toJS(v, indent + 1)}`
    })
    return `{\n${lines.join(',\n')}\n${pad}}`
  }

  return JSON.stringify(value)
}

/**
 * 生成 JS 格式的表单配置代码
 * @param {Array} components
 * @param {Object} pageSettings
 * @returns {string} JS 代码字符串
 */
export function generateFormConfigJS(components, pageSettings = {}) {
  const config = generateFormConfig(components, pageSettings)
  const body = toJS(config, 1)
  return `const formConfig = ${body}\n\nexport default formConfig\n`
}

/**
 * 生成格式化的 JSON 字符串（保留兼容）
 */
export function generateFormConfigJSON(components, pageSettings = {}) {
  const config = generateFormConfig(components, pageSettings)
  return JSON.stringify(config, null, 2)
}
