<!-- 阅卷详情（Demo 只读 Vue 试卷壳） -->
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

function handleItemBoxClick(tmid: number) {
  document.querySelector(`#box_${tmid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="exam-detail">
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

    <aside class="exam-nav">
      <div v-for="(item, gIndex) in groups" :key="`nav_${item.tmlxdm}_${gIndex}`" class="nav-group">
        <div class="item-list">
          {{ resolveQuesType(item.tmlxdm).lxmc }}
          <span class="item-num">（每题{{ item.fs }}分，共{{ item.dgtmlxzf }}分）</span>
        </div>
        <div>
          <button
            v-for="(tm, index) in item.tmxx"
            :key="tm.tmid"
            type="button"
            class="tm-box"
            :class="{ 'no-df': tm.df == null }"
            @click="handleItemBoxClick(tm.tmid)"
          >
            {{ index + 1 }}
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.exam-detail {
  display: flex;
  gap: 16px;
  width: 100%;
  box-sizing: border-box;
}

.exam-content {
  flex: 1;
  min-width: 0;
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
}

.exam-scope :deep(.num-label) {
  background: #eff1f4;
  text-align: center;
}

.topic-content {
  width: 100%;
}

.exam-nav {
  flex-shrink: 0;
  width: 200px;
  padding: 12px;
  background: #fff;
  border: 1px solid #a9adb5;
  border-radius: 4px;
  align-self: flex-start;
  position: sticky;
  top: 8px;
  max-height: 70vh;
  overflow: auto;
}

.nav-group {
  margin-bottom: 12px;
}

.item-list {
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.item-num {
  font-size: 13px;
  color: #999;
}

.tm-box {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 4px;
  border-radius: 2px;
  background: rgba(13, 155, 126, 0.1);
  border: 1px solid #0d9b7e;
  color: #009865;
  font-size: 13px;
}

.tm-box.no-df {
  border-color: rgb(155, 13, 13);
}
</style>
