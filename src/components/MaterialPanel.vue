<template>
  <div class="material-panel">
    <h3>物料库</h3>

    <div class="material-categories">
      <el-tabs v-model="activeCategory">
        <el-tab-pane label="表单组件" name="form">
          <draggable
            :list="formMaterials"
            :group="{ name: 'components', pull: 'clone', put: false }"
            :sort="false"
            :clone="cloneMaterial"
            item-key="type"
            class="material-list"
          >
            <template #item="{ element }">
              <div class="material-item">
                <div class="material-icon">
                  <el-icon :size="24">
                    <component :is="getIcon(element.type)" />
                  </el-icon>
                </div>
                <div class="material-name">{{ element.name }}</div>
              </div>
            </template>
          </draggable>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import draggable from 'vuedraggable'
import {
  Edit, Document, Grid, Operation, Calendar, Clock,
  Star, CircleCheck, ArrowDown, Minus, Upload, Tickets
} from '@element-plus/icons-vue'
import { getMaterials } from '../materials'

const materials = getMaterials()

const formMaterials = computed(() => {
  return materials.filter(material => material.category === 'form')
})

const activeCategory = computed(() => 'form')

function generateId() {
  return 'component_' + Date.now() + '_' + Math.floor(Math.random() * 10000)
}

const cloneMaterial = (material) => {
  return {
    type: material.type,
    label: material.name,
    props: { ...material.defaultProps },
    styles: { ...material.defaultStyles },
    events: {},
    children: material.isContainer ? [] : undefined,
    id: generateId(),
    titlePosition: 'left'
  }
}

const iconMap = {
  input: Edit,
  textarea: Document,
  number: Tickets,
  radio: CircleCheck,
  checkbox: Operation,
  select: ArrowDown,
  date: Calendar,
  time: Clock,
  switch: Operation,
  slider: Operation,
  rate: Star,
  upload: Upload,
  divider: Minus,
  'static-text': Document,
  subform: Grid
}

const getIcon = (type) => {
  return iconMap[type] || Document
}
</script>

<style scoped>
.material-panel {
  width: 200px;
  padding: 16px;
  border-right: 1px solid #e0e0e0;
  background-color: #f5f7fa;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.material-panel h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  color: #333;
}

.material-categories {
  margin-top: 16px;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
  box-sizing: border-box;
  width: 100%;
}

.material-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #ffffff;
  cursor: grab;
  transition: all 0.2s ease;
  box-sizing: border-box;
  min-width: 0;
}

.material-item:hover {
  border-color: #409EFF;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.material-icon {
  margin-bottom: 8px;
  color: #409EFF;
}

.material-name {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 8px;
}
</style>
