<!-- 阅卷详情（Demo 只读 Vue 试卷正文，不含题号导航） -->
<script setup lang="ts">
import { computed } from 'vue'
import type { PaperDetail } from '../paperTypes'
import { chineseNum, resolveQuesType } from '../quesTypeMap'

const props = defineProps<{
  paper: PaperDetail
}>()

const groups = computed(() => props.paper.yjtxxx || [])

const totalGot = computed(() =>
  groups.value.reduce((sum, g) => sum + Number(g.dgtmlxdf || 0), 0),
)

function sectionIndex(i: number) {
  return chineseNum[i + 1] || String(i + 1)
}
</script>

<template>
  <div class="exam-content">
    <div class="title-content">
      <h1>{{ paper.ksmc || '在线作业答卷' }}</h1>
    </div>
    <div class="exam-meta">
      <div>
        <span>考试时长：{{ paper.sc ?? 0 }}分钟</span>
        <span>|</span>
        <span>考试总分：{{ paper.sjzf ?? 0 }}</span>
      </div>
      <div class="meta-row">
        <span>警号：{{ paper.ryjh || '—' }}</span>
        <span>|</span>
        <span>姓名：{{ paper.ryxm || '—' }}</span>
        <span>|</span>
        <span>所属单位：{{ paper.bmmc || '—' }}</span>
      </div>
    </div>

    <div class="exam-scope">
      <el-descriptions direction="vertical" :column="groups.length + 1" border>
        <el-descriptions-item
          v-for="item in groups"
          :key="item.tmlxdm"
          label-class-name="num-label"
          :content-style="{ textAlign: 'center' }"
          :label="`${resolveQuesType(item.tmlxdm).lxmc}(${item.dgtmlxzf}分)`"
        >
          {{ item.dgtmlxdf }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="`总分(${paper.sjzf}分)`"
          label-class-name="num-label"
          :content-style="{ textAlign: 'center' }"
        >
          {{ totalGot }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="topic-content">
      <div v-for="(item, index) in groups" :key="`${item.tmlxdm}_${index}`">
        <component
          :is="resolveQuesType(item.tmlxdm).quesName"
          :topic-data="item"
          :index="sectionIndex(index)"
          :title="resolveQuesType(item.tmlxdm).lxmc"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-content {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px 24px;
}

.title-content {
  text-align: center;
}

.title-content h1 {
  margin: 8px 0 12px;
  font-size: 22px;
  color: #1f2937;
}

.exam-meta {
  margin-bottom: 16px;
  text-align: center;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.exam-meta span {
  padding: 0 6px;
}

.meta-row {
  margin-top: 8px;
}

.exam-scope {
  margin-bottom: 16px;
  overflow-x: auto;
}

.exam-scope :deep(.el-descriptions__table) {
  width: 100%;
  table-layout: auto;
}

.exam-scope :deep(.el-descriptions__label),
.exam-scope :deep(.num-label) {
  background: #eff1f4;
  text-align: center;
  white-space: nowrap;
  font-size: 12px;
  padding: 8px 6px;
  line-height: 1.4;
}

.exam-scope :deep(.el-descriptions__content) {
  white-space: nowrap;
  text-align: center;
}

.topic-content {
  width: 100%;
}
</style>
