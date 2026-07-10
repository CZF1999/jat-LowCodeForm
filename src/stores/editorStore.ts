// 编辑器状态管理
import { defineStore } from 'pinia'
import { CURRENT_SCHEMA_VERSION } from '../core/schema/version'
import type { ComponentSchema, PageSchema } from '../core/schema/types'

// 历史记录条目
interface HistoryEntry {
  stack: PageSchema[]
  currentIndex: number
  maxSize: number
}

// Store 状态类型
interface EditorState {
  pageSchema: PageSchema
  selectedId: string | null
  clipboard: ComponentSchema[]
  history: HistoryEntry
}

// 生成唯一ID
function generateId(): string {
  return 'component_' + Date.now() + '_' + Math.floor(Math.random() * 10000)
}

// 定义编辑器状态
export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    // 页面Schema
    pageSchema: {
      version: CURRENT_SCHEMA_VERSION,
      info: {
        name: 'Untitled Page',
        description: '',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      },
      settings: {
        title: 'Page',
        backgroundColor: '#ffffff',
        width: '1200px',
        height: '800px',
        meta: {},
        // 表单级配置
        formTitle: '表单',
        layout: 'grid',
        columns: 2
      },
      components: []
    },
    // 选中的组件ID
    selectedId: null,
    // 剪贴板
    clipboard: [],
    // 历史记录
    history: {
      stack: [],
      currentIndex: -1,
      maxSize: 50
    }
  }),

  getters: {
    // 获取当前选中的组件
    selectedComponent: (state): ComponentSchema | null => {
      if (!state.selectedId) return null

      // 递归查找组件
      const findComponent = (components: ComponentSchema[]): ComponentSchema | null => {
        for (const component of components) {
          if (component.id === state.selectedId) {
            // 确保组件有titlePosition属性，默认值为'left'
            if (!component.titlePosition) {
              component.titlePosition = 'left'
            }
            return component
          }
          if (component.children) {
            const found = findComponent(component.children)
            if (found) return found
          }
        }
        return null
      }

      return findComponent(state.pageSchema.components)
    },
    // 获取组件列表
    components: (state): ComponentSchema[] => {
      // 确保所有组件都有titlePosition属性，默认值为'left'
      const ensureTitlePosition = (components: ComponentSchema[]): void => {
        components.forEach(component => {
          if (!component.titlePosition) {
            component.titlePosition = 'left'
          }
          if (component.children) {
            ensureTitlePosition(component.children)
          }
        })
      }
      ensureTitlePosition(state.pageSchema.components)
      return state.pageSchema.components
    }
  },

  actions: {
    // 初始化时保存初始状态
    initializeStore(): void {
      // 保存初始状态到历史记录
      const initialSnapshot: PageSchema = JSON.parse(JSON.stringify(this.pageSchema))
      this.history.stack = [initialSnapshot]
      this.history.currentIndex = 0
    },

    // 删除组件
    deleteComponent(id: string): void {
      // 递归删除组件
      const deleteFromComponents = (components: ComponentSchema[]): boolean => {
        for (let i = 0; i < components.length; i++) {
          if (components[i].id === id) {
            components.splice(i, 1)
            return true
          }
          if (components[i].children) {
            const deleted = deleteFromComponents(components[i].children!)
            if (deleted) return true
          }
        }
        return false
      }

      deleteFromComponents(this.pageSchema.components)
      this.saveHistory()
      if (this.selectedId === id) {
        this.selectedId = null
      }
    },

    // 更新组件
    updateComponent(id: string, updates: Partial<ComponentSchema>): void {
      // 递归查找并更新组件
      const updateComponentRecursive = (components: ComponentSchema[]): boolean => {
        for (const component of components) {
          if (component.id === id) {
            Object.assign(component, updates)
            return true
          }
          if (component.children) {
            const updated = updateComponentRecursive(component.children)
            if (updated) return true
          }
        }
        return false
      }

      updateComponentRecursive(this.pageSchema.components)
      this.saveHistory()
    },

    // 复制组件
    copyComponent(component: ComponentSchema): void {
      // 深拷贝组件
      const copied: ComponentSchema = JSON.parse(JSON.stringify(component))
      copied.id = generateId()
      this.clipboard = [copied]
    },

    // 粘贴组件
    pasteComponent(): void {
      if (this.clipboard.length === 0) return

      const copied: ComponentSchema = JSON.parse(JSON.stringify(this.clipboard[0]))
      copied.id = generateId()
      this.pageSchema.components.push(copied)
      this.saveHistory()
      this.selectedId = copied.id
    },

    // 选择组件
    selectComponent(id: string | null): void {
      this.selectedId = id
    },

    // 保存历史记录
    saveHistory(): void {
      // 限制历史记录长度
      if (this.history.currentIndex < this.history.stack.length - 1) {
        this.history.stack = this.history.stack.slice(0, this.history.currentIndex + 1)
      }

      // 深拷贝当前状态
      const snapshot: PageSchema = JSON.parse(JSON.stringify(this.pageSchema))
      this.history.stack.push(snapshot)

      // 保持历史记录在最大长度以内
      if (this.history.stack.length > this.history.maxSize) {
        this.history.stack.shift()
      } else {
        this.history.currentIndex++
      }
    },

    // 撤销
    undo(): void {
      if (this.history.currentIndex > 0) {
        this.history.currentIndex--
        const previousState: PageSchema = JSON.parse(JSON.stringify(this.history.stack[this.history.currentIndex]))
        // 逐个属性更新，确保Vue响应式系统能正确追踪变化
        Object.assign(this.pageSchema, previousState)
      }
    },

    // 重做
    redo(): void {
      if (this.history.currentIndex < this.history.stack.length - 1) {
        this.history.currentIndex++
        const nextState: PageSchema = JSON.parse(JSON.stringify(this.history.stack[this.history.currentIndex]))
        Object.assign(this.pageSchema, nextState)
      }
    },

    // 导入Schema
    importSchema(schema: PageSchema): void {
      this.pageSchema = schema
      this.saveHistory()
    },

    // 导出Schema
    exportSchema(): PageSchema {
      return JSON.parse(JSON.stringify(this.pageSchema))
    }
  }
})
