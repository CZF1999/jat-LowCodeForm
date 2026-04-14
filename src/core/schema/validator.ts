// Schema验证器
import type { ComponentSchema, PageSchema } from './types'

// 验证组件Schema
export function validateComponentSchema(schema: ComponentSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // 验证必填字段
  if (!schema.id) {
    errors.push('Component must have an id')
  }
  
  if (!schema.type) {
    errors.push('Component must have a type')
  }
  
  // 验证children（如果存在）
  if (schema.children) {
    schema.children.forEach((child, index) => {
      const childValidation = validateComponentSchema(child)
      if (!childValidation.valid) {
        errors.push(`Child component at index ${index}: ${childValidation.errors.join(', ')}`)
      }
    })
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// 验证页面Schema
export function validatePageSchema(schema: PageSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // 验证版本号
  if (!schema.version) {
    errors.push('Page schema must have a version')
  }
  
  // 验证基本信息
  if (!schema.info) {
    errors.push('Page schema must have info')
  } else {
    if (!schema.info.name) {
      errors.push('Page info must have a name')
    }
  }
  
  // 验证组件
  if (schema.components) {
    schema.components.forEach((component, index) => {
      const componentValidation = validateComponentSchema(component)
      if (!componentValidation.valid) {
        errors.push(`Component at index ${index}: ${componentValidation.errors.join(', ')}`)
      }
    })
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// 验证Schema版本
export function validateSchemaVersion(version: string): boolean {
  // 简单的版本号格式验证 (x.y.z)
  const versionRegex = /^\d+\.\d+\.\d+$/ 
  return versionRegex.test(version)
}
