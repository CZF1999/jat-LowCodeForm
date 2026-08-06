// 物料注册管理
import type { Component } from 'vue'
import type { MaterialMeta } from '../core/schema/types'
import Button from './base/Button/index.vue'
import Input from './base/Input/index.vue'
import Block from './base/Block/index.vue'
import Cascader from './base/Cascader/index.vue'

// PropSchema 中每个属性的定义
interface PropSchemaItem {
  type: string
  default?: any
  enum?: string[]
}

// 扩展的物料定义（包含 propsSchema 详情）
interface MaterialDef extends MaterialMeta {
  propsSchema: Record<string, PropSchemaItem>
  defaultProps: Record<string, any>
  defaultStyles: Record<string, string>
}

// 物料元数据定义
const materials: MaterialDef[] = [
  {
    type: 'block',
    name: '空白区块',
    icon: 'Grid',
    category: 'layout',
    version: '1.0.0',
    propsSchema: {
      title: {
        type: 'string',
        default: '区块'
      },
      padding: {
        type: 'string',
        default: '16px'
      },
      backgroundColor: {
        type: 'string',
        default: '#ffffff'
      },
      border: {
        type: 'boolean',
        default: true
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      title: '区块',
      padding: '16px',
      backgroundColor: '#ffffff',
      border: true,
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      margin: '8px 0'
    },
    isContainer: true,
    childrenTypes: ['button', 'input', 'textarea', 'number', 'radio', 'checkbox', 'select', 'cascader', 'date', 'time', 'switch', 'slider', 'rate', 'upload', 'static-text']
  },
  {
    type: 'button',
    name: '按钮',
    icon: 'Button',
    category: 'layout',
    version: '1.0.0',
    propsSchema: {
      type: {
        type: 'string',
        enum: ['primary', 'success', 'warning', 'danger', 'info', 'text'],
        default: 'primary'
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      label: {
        type: 'string',
        default: 'Button'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      round: {
        type: 'boolean',
        default: false
      },
      circle: {
        type: 'boolean',
        default: false
      }
    },
    defaultProps: {
      type: 'primary',
      size: 'small',
      label: 'Button',
      disabled: false,
      round: false,
      circle: false
    },
    defaultStyles: {
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'input',
    name: '输入框',
    icon: 'Edit',
    category: 'layout',
    version: '1.0.0',
    propsSchema: {
      placeholder: {
        type: 'string',
        default: 'Please input'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      maxlength: {
        type: 'number',
        default: undefined
      },
      showWordLimit: {
        type: 'boolean',
        default: false
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      placeholder: 'Please input',
      disabled: false,
      size: 'small',
      maxlength: undefined,
      showWordLimit: false,
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      width: '100%',
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'textarea',
    name: '多行文本框',
    icon: 'Edit',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      placeholder: {
        type: 'string',
        default: 'Please input'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      rows: {
        type: 'number',
        default: 3
      },
      maxlength: {
        type: 'number',
        default: undefined
      },
      showWordLimit: {
        type: 'boolean',
        default: false
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      placeholder: 'Please input',
      disabled: false,
      rows: 3,
      maxlength: undefined,
      showWordLimit: false,
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      width: '100%',
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'number',
    name: '数字输入框',
    icon: 'Document',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      placeholder: {
        type: 'string',
        default: 'Please input'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      min: {
        type: 'number',
        default: undefined
      },
      max: {
        type: 'number',
        default: undefined
      },
      step: {
        type: 'number',
        default: 1
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      placeholder: 'Please input',
      disabled: false,
      size: 'small',
      min: undefined,
      max: undefined,
      step: 1,
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      width: '100%',
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'radio',
    name: '单选按钮组',
    icon: 'Operation',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      options: {
        type: 'array',
        default: [
          { label: 'Option 1', value: '1' },
          { label: 'Option 2', value: '2' },
          { label: 'Option 3', value: '3' }
        ]
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      },
      optionsType: {
        type: 'string',
        enum: ['static', 'async'],
        default: 'static'
      },
      optionsApi: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      options: [
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' }
      ],
      disabled: false,
      size: 'small',
      fieldName: '',
      span: 24,
      visibleCondition: '',
      optionsType: 'static',
      optionsApi: ''
    },
    defaultStyles: {
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'checkbox',
    name: '复选框组',
    icon: 'Operation',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      options: {
        type: 'array',
        default: [
          { label: 'Option 1', value: '1' },
          { label: 'Option 2', value: '2' },
          { label: 'Option 3', value: '3' }
        ]
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      },
      optionsType: {
        type: 'string',
        enum: ['static', 'async'],
        default: 'static'
      },
      optionsApi: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      options: [
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' }
      ],
      disabled: false,
      size: 'small',
      fieldName: '',
      span: 24,
      visibleCondition: '',
      optionsType: 'static',
      optionsApi: ''
    },
    defaultStyles: {
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'select',
    name: '下拉选择器',
    icon: 'Operation',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      options: {
        type: 'array',
        default: [
          { label: 'Option 1', value: '1' },
          { label: 'Option 2', value: '2' },
          { label: 'Option 3', value: '3' }
        ]
      },
      placeholder: {
        type: 'string',
        default: 'Please select'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      },
      pidField: {
        type: 'string',
        default: ''
      },
      optionsType: {
        type: 'string',
        enum: ['static', 'async'],
        default: 'static'
      },
      optionsApi: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      options: [
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' }
      ],
      placeholder: 'Please select',
      disabled: false,
      size: 'small',
      fieldName: '',
      span: 24,
      visibleCondition: '',
      pidField: '',
      optionsType: 'static',
      optionsApi: ''
    },
    defaultStyles: {
      width: '100%',
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'cascader',
    name: '级联选择器',
    icon: 'Menu',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      options: {
        type: 'array',
        default: [
          { label: '北京', value: 'beijing', children: [
            { label: '海淀区', value: 'haidian' },
            { label: '朝阳区', value: 'chaoyang' }
          ]},
          { label: '上海', value: 'shanghai', children: [
            { label: '浦东新区', value: 'pudong' },
            { label: '黄浦区', value: 'huangpu' }
          ]}
        ]
      },
      placeholder: {
        type: 'string',
        default: '请选择'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      separator: {
        type: 'string',
        default: '/'
      },
      multiple: {
        type: 'boolean',
        default: false
      },
      checkStrictly: {
        type: 'boolean',
        default: false
      },
      emitPath: {
        type: 'boolean',
        default: false
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      },
      pidField: {
        type: 'string',
        default: ''
      },
      optionsType: {
        type: 'string',
        enum: ['static', 'async'],
        default: 'static'
      },
      optionsApi: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      options: [
        { label: '北京', value: 'beijing', children: [
          { label: '海淀区', value: 'haidian' },
          { label: '朝阳区', value: 'chaoyang' }
        ]},
        { label: '上海', value: 'shanghai', children: [
          { label: '浦东新区', value: 'pudong' },
          { label: '黄浦区', value: 'huangpu' }
        ]}
      ],
      placeholder: '请选择',
      disabled: false,
      size: 'small',
      separator: '/',
      multiple: false,
      checkStrictly: false,
      emitPath: false,
      fieldName: '',
      span: 24,
      visibleCondition: '',
      pidField: '',
      optionsType: 'static',
      optionsApi: ''
    },
    defaultStyles: {
      width: '100%'
    },
    isContainer: false
  },
  {
    type: 'date',
    name: '日期选择器',
    icon: 'Document',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      placeholder: {
        type: 'string',
        default: 'Pick a date'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      placeholder: 'Pick a date',
      disabled: false,
      size: 'small',
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      width: '100%',
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'time',
    name: '时间选择器',
    icon: 'Document',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      placeholder: {
        type: 'string',
        default: 'Pick a time'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
        default: 'small'
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      placeholder: 'Pick a time',
      disabled: false,
      size: 'small',
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      width: '100%',
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'switch',
    name: '开关',
    icon: 'Operation',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      disabled: {
        type: 'boolean',
        default: false
      },
      activeText: {
        type: 'string',
        default: ''
      },
      inactiveText: {
        type: 'string',
        default: ''
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      disabled: false,
      activeText: '',
      inactiveText: '',
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'slider',
    name: '滑块',
    icon: 'Operation',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      min: {
        type: 'number',
        default: 0
      },
      max: {
        type: 'number',
        default: 100
      },
      step: {
        type: 'number',
        default: 1
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      min: 0,
      max: 100,
      step: 1,
      disabled: false,
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      width: '100%',
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'rate',
    name: '评分',
    icon: 'Operation',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      max: {
        type: 'number',
        default: 5
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      max: 5,
      disabled: false,
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'upload',
    name: '文件上传',
    icon: 'Upload',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      placeholder: {
        type: 'string',
        default: 'Upload file'
      },
      disabled: {
        type: 'boolean',
        default: false
      },
      fieldName: {
        type: 'string',
        default: ''
      },
      span: {
        type: 'number',
        default: 24
      },
      visibleCondition: {
        type: 'string',
        default: ''
      }
    },
    defaultProps: {
      placeholder: 'Upload file',
      disabled: false,
      fieldName: '',
      span: 24,
      visibleCondition: ''
    },
    defaultStyles: {
      // margin: '8px'
    },
    isContainer: false
  },
  {
    type: 'divider',
    name: '分隔线',
    icon: 'Operation',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      content: {
        type: 'string',
        default: ''
      },
      direction: {
        type: 'string',
        enum: ['horizontal', 'vertical'],
        default: 'horizontal'
      }
    },
    defaultProps: {
      content: '',
      direction: 'horizontal'
    },
    defaultStyles: {
      margin: '16px 0'
    },
    isContainer: false
  },
  {
    type: 'static-text',
    name: '静态文本',
    icon: 'Document',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      content: {
        type: 'string',
        default: 'Static Text'
      },
      fontSize: {
        type: 'string',
        default: '14px'
      },
      color: {
        type: 'string',
        default: '#333333'
      }
    },
    defaultProps: {
      content: 'Static Text',
      fontSize: '14px',
      color: '#333333'
    },
    defaultStyles: {
      // margin: '8px',
      padding: '8px'
    },
    isContainer: false
  },
  {
    type: 'text',
    name: 'Text',
    icon: 'Document',
    category: 'basic',
    version: '1.0.0',
    propsSchema: {
      content: {
        type: 'string',
        default: 'Text content'
      },
      fontSize: {
        type: 'string',
        default: '14px'
      },
      color: {
        type: 'string',
        default: '#333333'
      }
    },
    defaultProps: {
      content: 'Text content',
      fontSize: '14px',
      color: '#333333'
    },
    defaultStyles: {
      // margin: '8px',
      padding: '8px'
    },
    isContainer: false
  },
  {
    type: 'container',
    name: 'Container',
    icon: 'Grid',
    category: 'layout',
    version: '1.0.0',
    propsSchema: {
      direction: {
        type: 'string',
        enum: ['horizontal', 'vertical'],
        default: 'horizontal'
      },
      align: {
        type: 'string',
        enum: ['left', 'center', 'right'],
        default: 'left'
      }
    },
    defaultProps: {
      direction: 'horizontal',
      align: 'left'
    },
    defaultStyles: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      // // margin: '8px',
      padding: '16px',
      border: '1px solid #e0e0e0',
      borderRadius: '4px'
    },
    isContainer: true,
    childrenTypes: ['button', 'input', 'text']
  },
  {
    type: 'subform',
    name: '子表单',
    icon: 'Grid',
    category: 'form',
    version: '1.0.0',
    propsSchema: {
      title: {
        type: 'string',
        default: 'Subform'
      }
    },
    defaultProps: {
      title: 'Subform'
    },
    defaultStyles: {
      margin: '16px 0',
      padding: '16px',
      border: '1px solid #e0e0e0',
      borderRadius: '4px'
    },
    isContainer: true,
    childrenTypes: ['button', 'input', 'textarea', 'number', 'radio', 'checkbox', 'select', 'cascader', 'date', 'time', 'switch', 'slider', 'rate', 'upload', 'static-text']
  }
]

// 物料组件映射
const materialComponents: Record<string, Component> = {
  button: Button,
  input: Input,
  block: Block,
  cascader: Cascader
}

// 获取物料列表
export function getMaterials(): MaterialDef[] {
  return materials
}

// 根据类型获取物料
export function getMaterialByType(type: string): MaterialDef | undefined {
  return materials.find(material => material.type === type)
}

// 根据类型获取组件
export function getComponentByType(type: string): Component | undefined {
  return materialComponents[type]
}

// 注册新物料
export function registerMaterial(material: MaterialDef, component: Component): void {
  materials.push(material)
  materialComponents[material.type] = component
}

// 注销物料
export function unregisterMaterial(type: string): void {
  const index = materials.findIndex(material => material.type === type)
  if (index > -1) {
    materials.splice(index, 1)
  }
  delete materialComponents[type]
}
