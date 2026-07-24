// 编辑器状态管理
import { defineStore } from 'pinia'
import { CURRENT_SCHEMA_VERSION } from '../core/schema/version'
import type { ComponentSchema, PageSchema } from '../core/schema/types'

// 历史记录条目（双栈模式：past 存放可撤销的历史，future 存放可重做的历史）
interface HistoryEntry {
  past: PageSchema[]
  future: PageSchema[]
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

// 深拷贝页面Schema
function cloneSchema(schema: PageSchema): PageSchema {
  return JSON.parse(JSON.stringify(schema))
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
    // 历史记录（双栈模式）
    history: {
      past: [],
      future: [],
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
    },
    // 是否可以撤销（past 长度 > 1 才有"上一个状态"可回退，past[0] 是初始基线）
    canUndo: (state): boolean => state.history.past.length > 1,
    // 是否可以重做
    canRedo: (state): boolean => state.history.future.length > 0
  },

  actions: {
    // 初始化时保存初始状态
    initializeStore(): void {
      // 保存初始状态到 past 栈（作为最老的基线，保证 undo 能回到初始状态）
      const initialSnapshot: PageSchema = cloneSchema(this.pageSchema)
      this.history.past = [initialSnapshot]
      this.history.future = []
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

    // 保存历史记录（双栈模式）
    saveHistory(): void {
      // 将当前状态推入 past 栈
      const snapshot: PageSchema = cloneSchema(this.pageSchema)
      this.history.past.push(snapshot)

      // 新操作使旧的"未来"分支失效，清空 future 栈
      this.history.future = []

      // 保持 past 栈在最大长度以内（移除最老的历史）
      if (this.history.past.length > this.history.maxSize) {
        this.history.past.shift()
      }
    },

    // 撤销
    undo(): void {
      // past 至少需要 2 个条目：初始基线 + 至少一次操作才能撤销
      if (this.history.past.length <= 1) return

      // 将栈顶（当前状态）弹入 future 栈，以便后续重做
      this.history.future.push(this.history.past.pop()!)

      // 次栈顶为上一个状态，peek 后恢复
      const previousState = cloneSchema(this.history.past[this.history.past.length - 1])
      Object.assign(this.pageSchema, previousState)
    },

    // 重做
    redo(): void {
      if (this.history.future.length === 0) return

      // 从 future 栈弹出被撤销的状态，推回 past 栈并恢复
      const nextState = this.history.future.pop()!
      this.history.past.push(nextState)
      Object.assign(this.pageSchema, cloneSchema(nextState))
    },

    // 导入Schema
    importSchema(schema: PageSchema): void {
      this.pageSchema = schema
      this.saveHistory()
    },

    // 导出Schema
    exportSchema(): PageSchema {
      return cloneSchema(this.pageSchema)
    }
  }
})
