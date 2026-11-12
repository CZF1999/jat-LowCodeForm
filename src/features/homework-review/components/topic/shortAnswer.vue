<!-- 简答题（只读 Demo） -->
<script setup lang="ts">
import { computed } from 'vue'
import type { TmItem, YjtGroup } from '../../paperTypes'

const props = withDefaults(
  defineProps<{
    topicData: YjtGroup | TmItem
    index?: string
    title?: string
    isAltZt?: boolean
  }>(),
  {
    index: '一',
    title: '',
    isAltZt: false,
  },
)

function getRight(item: TmItem) {
  return (item.jdtxx || []).map((ref) => ref.ckda).filter(Boolean).join('；') || '—'
}

const group = computed(() => props.topicData as YjtGroup)
const subItem = computed(() => props.topicData as TmItem)
</script>

<template>
  <div class="topic-block">
    <div v-if="!isAltZt" class="topic-type">
      {{ index }}、{{ title }}（每题{{ group.fs }}分，共{{ group.dgtmlxzf }}分）
    </div>

    <div v-if="!isAltZt" class="topic-body">
      <div
        v-for="(item, tmIndex) in group.tmxx"
        :id="'box_' + item.tmid"
        :key="item.tmid"
        class="tm-card"
      >
        <p class="stem">{{ tmIndex + 1 }}. {{ item.tm }}</p>
        <div class="answer-block">
          <div class="row">
            <span class="label">考生答案</span>
            <div class="ks-box">{{ item.zgtda || '未作答' }}</div>
          </div>
          <div class="row">
            <span class="label">参考答案</span>
            <div class="zq-box">{{ getRight(item) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="topic-body">
      <p class="stem">({{ index }}). {{ subItem.tm }}</p>
      <div class="answer-block">
        <div class="row">
          <span class="label">考生答案</span>
          <div class="ks-box">{{ subItem.zgtda || '未作答' }}</div>
        </div>
        <div class="row">
          <span class="label">参考答案</span>
          <div class="zq-box">{{ getRight(subItem) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topic-type {
  margin: 16px 0;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.tm-card {
  margin-bottom: 16px;
}

.stem {
  margin: 0 0 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  line-height: 1.6;
}

.answer-block {
  margin: 12px;
}

.row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  margin-bottom: 12px;
  align-items: start;
  font-size: 14px;
  color: #666;
}

.ks-box {
  background: #eff1f4;
  border-radius: 2px;
  padding: 8px 12px;
  color: #333;
  white-space: pre-wrap;
}

.zq-box {
  background: rgba(13, 155, 126, 0.1);
  border: 1px solid #0d9b7e;
  border-radius: 2px;
  padding: 8px 12px;
  color: #0d9b7e;
  white-space: pre-wrap;
}
</style>
