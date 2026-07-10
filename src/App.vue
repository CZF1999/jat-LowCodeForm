<template>
  <div class="app-container">
    <!-- 顶部工具栏 -->
    <header class="toolbar">
      <div class="toolbar-left">
        <h1>低代码编辑器</h1>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="showPreview = true">
          <el-icon><View /></el-icon>
          预览
        </el-button>
        <el-button type="primary" @click="handleExport">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button @click="handleImport">
          <el-icon><Upload /></el-icon>
          导入
        </el-button>
        <el-button @click="editorStore.undo">
          <el-icon><ArrowLeft /></el-icon>
          撤销
        </el-button>
        <el-button type="success" @click="handleExportFormConfig">
          <el-icon><Document /></el-icon>
          导出 JS 配置
        </el-button>
        <el-button type="success" @click="handleExportFormConfigTS">
          <el-icon><Document /></el-icon>
          导出 TS 配置
        </el-button>
        <el-button type="primary" @click="showCodeDialog = true">
          <el-icon><Document /></el-icon>
          生成代码
        </el-button>
        <CodeGenerator
          :components="editorStore.components"
          v-model:showCodeDialog="showCodeDialog"
          :page-settings="editorStore.pageSchema.settings"
        />
      </div>
    </header>
    
    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 左侧物料面板 -->
      <MaterialPanel />
      
      <!-- 中间画布区域 -->
      <div class="canvas-area">
        <div class="canvas-content">
          <CanvasRenderer
          :components="editorStore.components"
          :page-settings="editorStore.pageSchema.settings"
          :selected-id="editorStore.selectedId"
          @select="editorStore.selectComponent"
          @delete="editorStore.deleteComponent"
          @copy="editorStore.copyComponent"
          @update:component="handleUpdateComponent"
        />
        </div>
      </div>
      
      <!-- 右侧属性面板 -->
      <PropertyPanel 
        :component="editorStore.selectedComponent"
        @update:component="handleUpdateComponent"
      />
    </main>
  </div>

  <!-- 预览模态框 -->
  <el-dialog
    v-model="showPreview"
    title="表单预览"
    width="900px"
  >
    <PreviewRenderer 
      :components="editorStore.components"
      :page-settings="editorStore.pageSchema.settings"
    />
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showPreview = false">关闭</el-button>
        <el-button type="primary" @click="handleExportDataStructure">导出数据结构</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Download, Upload, ArrowLeft, ArrowRight, View, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MaterialPanel from './components/MaterialPanel.vue'
import CanvasRenderer from './core/renderer/CanvasRenderer.vue'
import PreviewRenderer from './core/renderer/PreviewRenderer.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import CodeGenerator from './components/CodeGenerator.vue'
import { generateFormConfigJS, generateFormConfigTS } from './core/generator/FormConfigGenerator'
import { useEditorStore } from './stores/editorStore'
import type { ComponentSchema } from './core/schema/types'

const editorStore = useEditorStore()
// 初始化编辑器状态，保存初始状态到历史记录
editorStore.initializeStore()

// 键盘快捷键处理
const isInputFocused = (): boolean => {
  const tag = (document.activeElement as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (document.activeElement as HTMLElement)?.isContentEditable || false
}

const handleKeyDown = (event: KeyboardEvent): void => {
  if (isInputFocused()) return

  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault()
    editorStore.undo()
  }
  if (event.ctrlKey && event.key === 'y') {
    event.preventDefault()
    editorStore.redo()
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (editorStore.selectedId) {
      event.preventDefault()
      editorStore.deleteComponent(editorStore.selectedId)
    }
  }
  if (event.ctrlKey && event.key === 'c') {
    if (editorStore.selectedComponent) {
      event.preventDefault()
      editorStore.copyComponent(editorStore.selectedComponent)
    }
  }
  if (event.ctrlKey && event.key === 'v') {
    event.preventDefault()
    editorStore.pasteComponent()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// 预览状态
const showPreview = ref(false)
// 代码生成弹窗状态
const showCodeDialog = ref(false)

// 导出Schema
const handleExport = (): void => {
  const schema = editorStore.exportSchema()
  const dataStr = JSON.stringify(schema, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'page-schema.json'
  link.click()
  URL.revokeObjectURL(url)
}

// 导入Schema
const handleImport = (): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const schema = JSON.parse(event.target?.result as string)
          editorStore.importSchema(schema)
        } catch (error) {
          console.error('Failed to parse schema:', error)
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

// 处理组件更新
const handleUpdateComponent = (updatedComponent: ComponentSchema): void => {
  const { id, ...updates } = updatedComponent
  editorStore.updateComponent(id, updates)
}

// 表单组件类型列表
const formComponentTypes: string[] = [
  'input', 'textarea', 'number', 'radio', 'checkbox', 'select',
  'date', 'time', 'switch', 'slider', 'rate', 'upload'
]

// 获取数据类型
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

// 导出表单配置 JS
const handleExportFormConfig = (): void => {
  const components = editorStore.components
  if (components.length === 0) {
    ElMessage.warning('请先添加表单组件')
    return
  }
  const jsCode = generateFormConfigJS(components, editorStore.pageSchema.settings)
  const dataBlob = new Blob([jsCode], { type: 'application/javascript' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'form-config.js'
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('JS 配置已导出')
}

// 导出表单配置 TS
const handleExportFormConfigTS = (): void => {
  const components = editorStore.components
  if (components.length === 0) {
    ElMessage.warning('请先添加表单组件')
    return
  }
  const tsCode = generateFormConfigTS(components, editorStore.pageSchema.settings)
  const dataBlob = new Blob([tsCode], { type: 'application/typescript' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'form-config.ts'
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('TS 配置已导出')
}

// 导出数据结构
const handleExportDataStructure = (): void => {
  const components = editorStore.components
  const dataStructure: Record<string, any> = {}

  // 遍历组件，生成数据结构
  components.forEach((component: ComponentSchema) => {
    if (formComponentTypes.includes(component.type)) {
      const fieldName = component.props.fieldName || component.label || component.type
      dataStructure[fieldName] = {
        type: getDataType(component.type),
        required: component.validation?.required || false,
        defaultValue: component.props.defaultValue,
        validation: component.validation
      }
    }
  })

  const dataStr = JSON.stringify(dataStructure, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'form-data-structure.json'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style>
/* 全局样式，消除全屏滚动条 */
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  width: 100%;
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.toolbar-left h1 {
  margin: 0;
  font-size: 18px;
  color: #333333;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  width: 100%;
}

/* 确保左侧物料面板固定宽度且无横向滚动 */
:deep(.material-panel) {
  width: 200px;
  border-right: 1px solid #e0e0e0;
  background-color: #f5f7fa;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
}

/* 中间画布区域 */
.canvas-area {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  background-color: #f0f2f5;
  min-width: 0;
}

/* 画布区域内容容器，添加内部滚动 */
.canvas-content {
  overflow: auto;
  padding-right: 8px;
  min-height: 100%;
  max-height: 100%;
}

/* 确保右侧属性面板固定宽度且无横向滚动 */
:deep(.property-panel) {
  width: 300px;
  border-left: 1px solid #e0e0e0;
  background-color: #ffffff;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
}

/* 代码生成弹窗样式 */
.code-dialog-content {
  max-height: 60vh;
  overflow: auto;
}

.code-block {
  background-color: #f6f8fa;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
