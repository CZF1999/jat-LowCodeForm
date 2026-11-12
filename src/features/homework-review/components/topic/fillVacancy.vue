<!-- 填空题（只读 Demo） -->
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

function splitStudentAnswer(zgtda: string | undefined, blankCount: number) {
  const raw = (zgtda || '').trim()
  if (!raw || raw === '未作答') {
    return Array.from({ length: Math.max(blankCount, 1) }, () => '未作答')
  }
  const parts = raw.split('&')
  while (parts.length < blankCount) parts.push('未作答')
  return parts
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
        <table class="answer-table">
          <tr>
            <td class="label zq">正确答案：</td>
            <td v-for="(blank, bIndex) in item.tktxx || []" :key="`zq_${bIndex}`">
              {{ blank.zqda || '—' }}
            </td>
          </tr>
          <tr>
            <td class="label ks">考生答案：</td>
            <td
              v-for="(ans, aIndex) in splitStudentAnswer(item.zgtda, (item.tktxx || []).length)"
              :key="`ks_${aIndex}`"
            >
              {{ ans }}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div v-else class="topic-body">
      <p class="stem">({{ index }}). {{ subItem.tm }}</p>
      <table class="answer-table">
        <tr>
          <td class="label zq">正确答案：</td>
          <td v-for="(blank, bIndex) in subItem.tktxx || []" :key="`zq_${bIndex}`">
            {{ blank.zqda || '—' }}
          </td>
        </tr>
        <tr>
          <td class="label ks">考生答案：</td>
          <td
            v-for="(ans, aIndex) in splitStudentAnswer(subItem.zgtda, (subItem.tktxx || []).length)"
            :key="`ks_${aIndex}`"
          >
            {{ ans }}
          </td>
        </tr>
      </table>
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

.answer-table {
  margin: 8px 12px 16px;
  border-collapse: collapse;
}

.answer-table td {
  border: 1px solid #ebeef5;
  padding: 4px 10px;
  line-height: 24px;
  min-width: 80px;
  word-break: break-all;
}

.answer-table td.label {
  background: #fafafa;
  white-space: nowrap;
}

.zq {
  color: #009865;
}

.ks {
  color: #167cf3;
}
</style>
