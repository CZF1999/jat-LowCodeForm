<template>
  <div class="tree-option-editor" :style="{ paddingLeft: depth > 0 ? '24px' : '0' }">
    <div
      v-for="(node, index) in modelValue"
      :key="index"
      class="tree-node"
    >
      <div class="tree-node-row">
        <!-- 展开/折叠子节点 -->
        <el-button
          v-if="node.children && node.children.length > 0"
          class="toggle-btn"
          size="small"
          text
          @click="toggleExpand(index)"
        >
          <el-icon>
            <ArrowRight v-if="!expandedMap.get(index)" />
            <ArrowDown v-else />
          </el-icon>
        </el-button>
        <span v-else class="toggle-placeholder"></span>

        <!-- 标签输入 -->
        <el-input
          v-model="node.label"
          placeholder="选项文本"
          size="small"
          class="node-input"
          @input="emitUpdate"
        />

        <!-- 值输入 -->
        <el-input
          v-model="node.value"
          placeholder="选项值"
          size="small"
          class="node-input"
          @input="emitUpdate"
        />

        <!-- 操作按钮 -->
        <el-button
          size="small"
          type="primary"
          text
          @click="addChild(index)"
          title="添加子节点"
        >
          <el-icon><Plus /></el-icon>
        </el-button>
        <el-button
          size="small"
          type="danger"
          text
          @click="removeNode(index)"
          title="删除节点"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>

      <!-- 递归渲染子节点 -->
      <TreeOptionEditor
        v-if="node.children && node.children.length > 0 && expandedMap.get(index)"
        v-model="node.children"
        :depth="depth + 1"
        @update:model-value="emitUpdate"
      />
    </div>

    <!-- 添加根级节点 -->
    <el-button
      size="small"
      type="primary"
      class="add-root-btn"
      @click="addRootNode"
    >
      <el-icon><Plus /></el-icon>
      {{ depth === 0 ? '添加选项' : '添加子选项' }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Delete, ArrowRight, ArrowDown } from '@element-plus/icons-vue'
import type { CascaderOption } from '../core/schema/types'

const props = defineProps<{
  modelValue: CascaderOption[]
  depth?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CascaderOption[]]
}>()

// 展开/折叠状态映射（key 为节点索引）
const expandedMap = ref<Map<number, boolean>>(new Map())

// 初始化展开状态
const initExpanded = () => {
  props.modelValue.forEach((node, index) => {
    if (node.children && node.children.length > 0) {
      if (!expandedMap.value.has(index)) {
        expandedMap.value.set(index, true)
      }
    }
  })
}
initExpanded()
watch(() => props.modelValue, initExpanded, { deep: true })

const toggleExpand = (index: number) => {
  expandedMap.value.set(index, !expandedMap.value.get(index))
  // 触发响应式更新
  expandedMap.value = new Map(expandedMap.value)
}

const emitUpdate = () => {
  emit('update:modelValue', [...props.modelValue])
}

const addRootNode = () => {
  props.modelValue.push({
    label: '新选项',
    value: '',
    children: []
  })
  emitUpdate()
}

const addChild = (index: number) => {
  const node = props.modelValue[index]
  if (!node.children) {
    node.children = []
  }
  node.children.push({
    label: '新选项',
    value: '',
    children: []
  })
  expandedMap.value.set(index, true)
  expandedMap.value = new Map(expandedMap.value)
  emitUpdate()
}

const removeNode = (index: number) => {
  props.modelValue.splice(index, 1)
  expandedMap.value.delete(index)
  expandedMap.value = new Map(expandedMap.value)
  emitUpdate()
}
</script>

<style scoped>
.tree-option-editor {
  width: 100%;
  box-sizing: border-box;
}

.tree-node {
  margin-bottom: 4px;
}

.tree-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #ffffff;
}

.toggle-btn {
  flex-shrink: 0;
  padding: 2px;
  min-height: auto;
}

.toggle-placeholder {
  display: inline-block;
  width: 24px;
  flex-shrink: 0;
}

.node-input {
  flex: 1;
  min-width: 0;
}

.add-root-btn {
  margin-top: 8px;
  width: 100%;
}
</style>
