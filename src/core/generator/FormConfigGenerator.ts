// 表单配置 JSON 生成器
// 将内部组件树 (ComponentSchema[]) 转换为声明式表单配置 JSON

import type { ComponentSchema, FieldConfig, FormConfig, ValidationRule } from '../schema/types'

// 表单组件类型（生成 field 的类型）
const FORM_COMPONENT_TYPES: string[] = [
  'input', 'textarea', 'number', 'radio', 'checkbox', 'select', 'cascader',
  'date', 'time', 'switch', 'slider', 'rate', 'upload'
]

// 内部元数据属性（不应输出到 props 中）
const META_PROPS: string[] = [
  'fieldName', 'span', 'pidField', 'visibleCondition',
  'optionsType', 'optionsApi', 'options', 'defaultValue',
  'separator', 'multiple', 'checkStrictly', 'emitPath'
]

// 获取数据类型默认值
const getDefaultValue = (type: string): string | number | boolean | string[] => {
  switch (type) {
    case 'input':
    case 'textarea':
    case 'select':
    case 'cascader':
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
const getFieldKey = (component: ComponentSchema): string => {
  return component.props?.fieldName || component.label || component.type
}

// 过滤出需要输出的 Element Plus 属性
const filterOutputProps = (props: Record<string, any> | undefined): Record<string, any> | undefined => {
  if (!props) return undefined
  const output: Record<string, any> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!META_PROPS.includes(key) && value !== undefined && value !== '') {
      output[key] = value
    }
  }
  return Object.keys(output).length > 0 ? output : undefined
}

// 生成 options 字段
const generateOptions = (component: ComponentSchema): string | Array<{label: string, value: any}> | undefined => {
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
const generateRules = (component: ComponentSchema): ValidationRule[] | undefined => {
  const validation = component.validation
  if (!validation) return undefined

  const rules: ValidationRule[] = []

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
      pattern: '^1[3-9]\\d{9}$',
      message: '请输入正确的手机号码',
      trigger: 'blur'
    })
  }

  return rules.length > 0 ? rules : undefined
}

// 生成单个字段配置
const generateField = (component: ComponentSchema): FieldConfig => {
  const field: FieldConfig = {
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
  if (['select', 'radio', 'checkbox', 'cascader'].includes(component.type)) {
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
const CONTAINER_TYPES: string[] = ['subform', 'block']

// 递归收集所有表单字段（展平容器的 children）
const collectFields = (components: ComponentSchema[]): FieldConfig[] => {
  const fields: FieldConfig[] = []

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
export function generateFormConfig(components: ComponentSchema[], pageSettings: Record<string, any> = {}): FormConfig {
  const formTitle: string = pageSettings.formTitle || 'form'
  const formKey: string = formTitle
    .replace(/[\s_-]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[\s_-]+/g, '')
    .replace(/^./, (c: string) => c.toLowerCase())

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
const isValidIdentifier = (key: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)

// 判断字符串是否应该作为代码输出（函数体）
const isCodeExpression = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('(') || trimmed.startsWith('async') || trimmed.startsWith('function')
}

// 将任意 JS 值转为源码字符串
const toJS = (value: unknown, indent = 0): string => {
  const pad = '  '.repeat(indent)
  const childPad = '  '.repeat(indent + 1)

  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)

  // 函数体字符串 → 直接输出代码
  if (isCodeExpression(value)) return value as string

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
    const allSimple = value.every((v: unknown) =>
      typeof v === 'number' || typeof v === 'boolean' || v === null ||
      (typeof v === 'string' && v.length < 30 && !v.includes('\n'))
    )
    if (allSimple) {
      const items = value.map((v: unknown) => toJS(v, 0)).join(', ')
      const line = `[${items}]`
      if (line.length < 80) return line
    }
    const items = value.map((v: unknown) => `${childPad}${toJS(v, indent + 1)}`).join(',\n')
    return `[\n${items}\n${pad}]`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
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
 */
export function generateFormConfigJS(components: ComponentSchema[], pageSettings: Record<string, any> = {}): string {
  const config = generateFormConfig(components, pageSettings)
  const body = toJS(config, 1)
  return `const formConfig = ${body}\n\nexport default formConfig\n`
}

/**
 * 生成 TS 格式的表单配置代码（自包含，含内联类型定义）
 */
export function generateFormConfigTS(components: ComponentSchema[], pageSettings: Record<string, any> = {}): string {
  const config = generateFormConfig(components, pageSettings)
  const body = toJS(config, 1)

  // 内联类型定义（自包含，无需外部依赖即可直接使用）
  const typeDefs = `/** 校验规则 */
interface ValidationRule {
  required?: boolean
  message?: string
  trigger?: string
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  type?: string
}

/** 单个字段配置 */
interface FieldConfig {
  key: string
  label: string
  type?: string
  span?: number
  pidField?: string
  visible?: string
  options?: string | Array<{ label: string, value: any }>
  rules?: ValidationRule[]
  props?: Record<string, any>
  defaultValue?: any
}

/** 表单配置 */
interface FormConfig {
  [formKey: string]: {
    title: string
    layout: 'grid' | 'inline' | 'vertical'
    columns: number
    fields: FieldConfig[]
  }
}
`
  return `${typeDefs}
const formConfig: FormConfig = ${body}

export default formConfig
`
}

/**
 * 生成格式化的 JSON 字符串（保留兼容）
 */
export function generateFormConfigJSON(components: ComponentSchema[], pageSettings: Record<string, any> = {}): string {
  const config = generateFormConfig(components, pageSettings)
  return JSON.stringify(config, null, 2)
}

// ========== 组件类型 → TS 类型映射 ==========

const TS_TYPE_MAP: Record<string, string> = {
  'input': 'string',
  'textarea': 'string',
  'number': 'number',
  'radio': 'string',
  'checkbox': 'string[]',
  'select': 'string',
  'cascader': 'string',
  'date': 'string',
  'time': 'string',
  'switch': 'boolean',
  'slider': 'number',
  'rate': 'number',
  'upload': 'File[]'
}

// ========== 字段元信息（供 TS 类型 / async-validator 生成使用） ==========

interface FieldMeta {
  key: string
  label: string
  componentType: string
  tsType: string
  validation?: ValidationRule[]
  defaultValue: unknown
}

/** 遍历组件树，收集表单字段的元信息（含容器内子组件） */
const collectFieldMeta = (components: ComponentSchema[]): FieldMeta[] => {
  const result: FieldMeta[] = []

  components.forEach(component => {
    if (CONTAINER_TYPES.includes(component.type) && component.children) {
      result.push(...collectFieldMeta(component.children))
    } else if (FORM_COMPONENT_TYPES.includes(component.type)) {
      const key = getFieldKey(component)
      result.push({
        key,
        label: component.label || component.type,
        componentType: component.type,
        tsType: TS_TYPE_MAP[component.type] || 'string',
        validation: generateRules(component),
        defaultValue: component.props?.defaultValue ?? getDefaultValue(component.type)
      })
    }
  })

  return result
}

// ========== 命名推导 ==========

/** 从 formTitle 推导接口名（如 "登录表单" → "LoginFormFormData"） */
const deriveInterfaceName = (pageSettings: Record<string, any>): string => {
  const title: string = pageSettings.formTitle || 'form'
  const camel = title
    .replace(/[\s_-]+(.)/g, (_: string, c: string) => c.toUpperCase())
    .replace(/[\s_-]+/g, '')
    .replace(/^./, (c: string) => c.toUpperCase())
  return camel + 'FormData'
}

/** 从 formTitle 推导 composable 函数名（如 "登录表单" → "useLoginFormForm"） */
const deriveComposableName = (pageSettings: Record<string, any>): string => {
  const title: string = pageSettings.formTitle || 'form'
  const camel = title
    .replace(/[\s_-]+(.)/g, (_: string, c: string) => c.toUpperCase())
    .replace(/[\s_-]+/g, '')
    .replace(/^./, (c: string) => c.toLowerCase())
  return 'use' + camel.charAt(0).toUpperCase() + camel.slice(1) + 'Form'
}

/** 从 formTitle 推导变量名前缀（如 "登录表单" → "loginForm"） */
const deriveVarPrefix = (pageSettings: Record<string, any>): string => {
  const title: string = pageSettings.formTitle || 'form'
  return title
    .replace(/[\s_-]+(.)/g, (_: string, c: string) => c.toUpperCase())
    .replace(/[\s_-]+/g, '')
    .replace(/^./, (c: string) => c.toLowerCase())
}

// ========== async-validator 规则辅助 ==========

/** 将用户输入的 pattern 字符串转为正则表达式字面量 */
const toRegexLiteral = (pattern: string): string => {
  let inner = pattern
  // 去掉可能存在的首尾斜杠
  if (inner.startsWith('/') && inner.endsWith('/')) {
    inner = inner.slice(1, -1)
  }
  // 转义内部的斜杠
  inner = inner.replace(/\//g, '\\/')
  return `/${inner}/`
}

/**
 * 生成 async-validator 单字段的 Rule 条目源码数组
 * 复用 generateRules 的输出，但将 pattern 字符串转为 RegExp 字面量
 */
const generateAsyncRuleItems = (meta: FieldMeta): string[] => {
  const items: string[] = []
  const rules = meta.validation
  if (!rules || rules.length === 0) return items

  for (const rule of rules) {
    const parts: string[] = []

    if (rule.required !== undefined) {
      parts.push(`required: ${rule.required}`)
    }
    if (rule.message) {
      parts.push(`message: '${rule.message.replace(/'/g, "\\'")}'`)
    }
    if (rule.trigger) {
      parts.push(`trigger: '${rule.trigger}'`)
    }
    if (rule.type) {
      parts.push(`type: '${rule.type}'`)
    }
    if (rule.min !== undefined) {
      parts.push(`min: ${rule.min}`)
    }
    if (rule.max !== undefined) {
      parts.push(`max: ${rule.max}`)
    }
    if (rule.minLength !== undefined) {
      // async-validator: string 类型的 min/max 即是最小/最大长度
      parts.push(`min: ${rule.minLength}`)
    }
    if (rule.maxLength !== undefined) {
      parts.push(`max: ${rule.maxLength}`)
    }
    if (rule.pattern) {
      parts.push(`pattern: ${toRegexLiteral(rule.pattern)}`)
    }

    items.push(`{ ${parts.join(', ')} }`)
  }

  return items
}

// ========== 公开导出函数 ==========

/**
 * 生成表单数据的 TypeScript 类型接口
 *
 * @example
 * // 输出：
 * // export interface LoginFormData {
 * //   /** 用户名 * /
 * //   username: string
 * //   /** 密码 * /
 * //   password: string
 * // }
 */
export function generateFormDataInterface(
  components: ComponentSchema[],
  pageSettings: Record<string, any> = {}
): string {
  const fields = collectFieldMeta(components)
  const interfaceName = deriveInterfaceName(pageSettings)

  let code = `/** 表单数据类型（自动生成） */\n`
  code += `export interface ${interfaceName} {\n`

  for (const field of fields) {
    code += `  /** ${field.label} */\n`
    code += `  ${field.key}: ${field.tsType}\n`
  }

  code += '}\n'
  return code
}

/**
 * 生成 async-validator 校验规则 descriptor（TS 代码字符串）
 *
 * 输出标准 async-validator Rules 对象，可直接用于：
 *   import Schema from 'async-validator'
 *   const validator = new Schema(rules)
 */
export function generateAsyncValidatorRules(
  components: ComponentSchema[],
  pageSettings: Record<string, any> = {}
): string {
  const fields = collectFieldMeta(components)
  const varPrefix = deriveVarPrefix(pageSettings)
  const rulesVarName = varPrefix + 'FormRules'

  let code = `import type { Rules } from 'async-validator'\n\n`
  code += `/** async-validator 校验规则（自动生成） */\n`
  code += `export const ${rulesVarName}: Rules = {\n`

  for (const field of fields) {
    const ruleItems = generateAsyncRuleItems(field)
    if (ruleItems.length === 0) continue

    code += `  ${field.key}: [\n`
    for (const item of ruleItems) {
      code += `    ${item},\n`
    }
    code += `  ],\n`
  }

  // 即使没有规则也输出空对象以保持类型合法
  code += '}\n'
  return code
}

/**
 * 生成依赖清单（Markdown 格式）
 *
 * 分析组件列表，列出运行产物所需的 npm 依赖及推荐版本
 */
export function generateDependencyManifest(
  components: ComponentSchema[],
  _pageSettings: Record<string, any> = {}
): string {
  const deps: { name: string; version: string; reason: string }[] = [
    { name: 'vue', version: '^3.3.0', reason: 'Vue 3 核心框架' },
    { name: 'element-plus', version: '^2.0.0', reason: 'Element Plus UI 组件库（表单组件）' },
    { name: 'async-validator', version: '^4.0.0', reason: '表单数据校验（element-plus 已内置，显式声明以便独立使用）' }
  ]

  // 检查是否包含上传组件
  const hasUpload = components.some(c => c.type === 'upload')
  if (hasUpload) {
    deps.push({ name: 'axios', version: '^1.0.0', reason: '文件上传 HTTP 请求（若使用自定义上传逻辑）' })
  }

  let md = '# 依赖清单\n\n'
  md += '> 以下为运行表单产物所需的 npm 依赖，自动生成。\n\n'
  md += '## 安装命令\n\n```bash\n'
  md += 'npm install ' + deps.map(d => d.name).join(' ') + '\n'
  md += '```\n\n'
  md += '## 详细说明\n\n'
  md += '| 包名 | 推荐版本 | 说明 |\n'
  md += '|------|----------|------|\n'
  for (const dep of deps) {
    md += `| \`${dep.name}\` | ${dep.version} | ${dep.reason} |\n`
  }
  md += '\n'
  md += '## 使用方式\n\n'
  md += '将导出的 `useXxxForm.ts` 文件放入项目，在 Vue 组件中引入：\n\n'
  md += '```vue\n'
  md += '<script setup lang="ts">\n'
  md += "import { useXxxForm } from './useXxxForm'\n"
  md += 'const { form, rules, submitForm, resetForm } = useXxxForm()\n'
  md += '</script>\n'
  md += '```\n'

  return md
}

/**
 * 生成完整表单逻辑模块（自包含 composable）
 *
 * 产出物是一个独立的 .ts 文件，包含：
 * 1. 文件头注释（依赖说明 + 使用方式）
 * 2. import 语句
 * 3. 表单数据 TS 类型接口
 * 4. async-validator 校验规则
 * 5. 初始值常量
 * 6. useXxxForm() composable 函数
 *
 * 真正做到"导入即用、零配置运行"。
 */
export function generateFormLogicModule(
  components: ComponentSchema[],
  pageSettings: Record<string, any> = {}
): string {
  const fields = collectFieldMeta(components)
  const interfaceName = deriveInterfaceName(pageSettings)
  const composableName = deriveComposableName(pageSettings)
  const varPrefix = deriveVarPrefix(pageSettings)
  const rulesVarName = varPrefix + 'FormRules'

  let code = ''

  // ---- 文件头 ----
  code += '/**\n'
  code += ' * ========================================\n'
  code += ' * 自动生成的表单逻辑模块\n'
  code += ' * ========================================\n'
  code += ' *\n'
  code += ' * 依赖安装:\n'
  code += ' *   npm install vue async-validator\n'
  code += ' *\n'
  code += ' * Element Plus 组件需在 main.ts 中全局注册。\n'
  code += ' *\n'
  code += ' * 使用方式:\n'
  code += ' * ```vue\n'
  code += ' * <template>\n'
  code += ' *   <el-form :model="form" :rules="rules">\n'
  code += ' *     <el-form-item label="用户名" prop="username">\n'
  code += ' *       <el-input v-model="form.username" />\n'
  code += ' *     </el-form-item>\n'
  code += ' *     <el-button @click="submitForm">提交</el-button>\n'
  code += ' *   </el-form>\n'
  code += ' * </template>\n'
  code += ' *\n'
  code += ' * <script setup lang="ts">\n'
  code += ` * import { ${composableName} } from './${composableName}'\n`
  code += ' * const { form, rules, submitForm, resetForm } = ' + composableName + '()\n'
  code += ` * </` + 'script>\n'
  code += ' * ```\n'
  code += ' */\n\n'

  // ---- import ----
  code += "import { ref } from 'vue'\n"
  code += "import Schema from 'async-validator'\n"
  code += "import type { Rules } from 'async-validator'\n\n"

  // ---- TS 类型接口 ----
  code += `/** 表单数据类型（自动生成） */\n`
  code += `export interface ${interfaceName} {\n`
  for (const field of fields) {
    code += `  /** ${field.label} */\n`
    code += `  ${field.key}: ${field.tsType}\n`
  }
  code += '}\n\n'

  // ---- async-validator 规则 ----
  code += `/** async-validator 校验规则 */\n`
  code += `export const ${rulesVarName}: Rules = {\n`
  for (const field of fields) {
    const ruleItems = generateAsyncRuleItems(field)
    if (ruleItems.length === 0) continue
    code += `  ${field.key}: [\n`
    for (const item of ruleItems) {
      code += `    ${item},\n`
    }
    code += `  ],\n`
  }
  code += '}\n\n'

  // ---- 初始值 ----
  const initialVarName = 'initial' + interfaceName.charAt(0).toUpperCase() + interfaceName.slice(1)
  // 重命名避免 double "initialInitial..."
  const finalInitialVarName = initialVarName.startsWith('Initial') ? initialVarName : 'initial' + interfaceName

  code += `/** 表单初始值 */\n`
  code += `export const ${finalInitialVarName}: ${interfaceName} = {\n`
  for (const field of fields) {
    code += `  ${field.key}: ${toJS(field.defaultValue)},\n`
  }
  code += '}\n\n'

  // ---- composable ----
  code += '/**\n'
  code += ` * 表单逻辑 composable\n`
  code += ` *\n`
  code += ` * 提供表单数据、校验规则、校验器实例及提交/重置方法\n`
  code += ' */\n'
  code += `export function ${composableName}() {\n`
  code += `  const form = ref<${interfaceName}>({ ...${finalInitialVarName} })\n`
  code += `  const validator = new Schema(${rulesVarName})\n\n`

  code += '  /** 校验表单 */\n'
  code += '  const validate = async (): Promise<{ valid: boolean; errors?: Record<string, any> }> => {\n'
  code += '    try {\n'
  code += '      await validator.validate(form.value)\n'
  code += '      return { valid: true }\n'
  code += '    } catch (err: any) {\n'
  code += '      return { valid: false, errors: err.errors || err }\n'
  code += '    }\n'
  code += '  }\n\n'

  code += '  /** 提交表单 */\n'
  code += '  const submitForm = async () => {\n'
  code += '    const result = await validate()\n'
  code += '    if (result.valid) {\n'
  code += '      console.log(\'表单提交数据:\', form.value)\n'
  code += '      // TODO: 在此调用你的 API\n'
  code += '    }\n'
  code += '    return result\n'
  code += '  }\n\n'

  code += '  /** 重置表单 */\n'
  code += '  const resetForm = () => {\n'
  code += `    form.value = { ...${finalInitialVarName} }\n`
  code += '  }\n\n'

  code += '  return {\n'
  code += '    form,\n'
  code += `    rules: ${rulesVarName},\n`
  code += '    validator,\n'
  code += '    validate,\n'
  code += '    submitForm,\n'
  code += '    resetForm\n'
  code += '  }\n'
  code += '}\n'

  return code
}
