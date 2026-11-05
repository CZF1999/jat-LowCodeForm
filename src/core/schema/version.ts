// Schema版本管理

// 当前Schema版本
export const CURRENT_SCHEMA_VERSION = '1.0.0'

// 版本迁移映射
const versionMigrations: Record<string, (schema: any) => any> = {
  // 从 0.1.0 迁移到 1.0.0
  '0.1.0': (schema) => {
    // 迁移逻辑
    if (!schema.version) {
      schema.version = '1.0.0'
    }
    if (!schema.info) {
      schema.info = {
        name: 'Untitled',
        description: '',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    }
    return schema
  }
}

// 迁移Schema到最新版本
export function migrateSchema(schema: any): any {
  if (!schema.version) {
    schema.version = '0.1.0' // 默认旧版本
  }
  
  // 按顺序应用迁移
  const versions = Object.keys(versionMigrations).sort()
  let currentVersion = schema.version
  
  for (const version of versions) {
    // 当前版本 <= 迁移键时应用（含恰好停在该版本的情况）
    if (compareVersions(currentVersion, version) <= 0) {
      schema = versionMigrations[version](schema)
      currentVersion = version
    }
  }
  
  // 最终更新到当前版本
  schema.version = CURRENT_SCHEMA_VERSION
  return schema
}

// 版本比较函数
function compareVersions(version1: string, version2: string): number {
  const v1 = version1.split('.').map(Number)
  const v2 = version2.split('.').map(Number)
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0
    const num2 = v2[i] || 0
    
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  
  return 0
}
