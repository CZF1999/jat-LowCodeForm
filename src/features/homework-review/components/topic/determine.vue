<!-- 判断题（只读 Demo） -->
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

function formateKsda(kgtda: string) {
  if (kgtda === '1') return '正确'
  if (kgtda === '0') return '错误'
  return kgtda || '未作答'
}

function correctLabel(item: TmItem) {
  const flag = item.pdtxx?.[0]?.sfzq
  if (flag === '1') return '正确'
  if (flag === '0') return '错误'
  return '—'
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
        <el-radio-group :model-value="item.pdtxx?.[0]?.sfzq || ''" disabled class="radios">
          <el-radio label="1">正确</el-radio>
          <el-radio label="0">错误</el-radio>
        </el-radio-group>
        <div class="answer-row">
          <span class="zq">正确答案：{{ correctLabel(item) }}</span>
          <span
            class="ks"
            :class="{ fail: item.kgtda !== item.pdtxx?.[0]?.sfzq }"
          >
            考生答案：{{ formateKsda(item.kgtda) }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="topic-body">
      <p class="stem">({{ index }}). {{ subItem.tm }}</p>
      <el-radio-group :model-value="subItem.pdtxx?.[0]?.sfzq || ''" disabled class="radios">
        <el-radio label="1">正确</el-radio>
        <el-radio label="0">错误</el-radio>
      </el-radio-group>
      <div class="answer-row">
        <span class="zq">正确答案：{{ correctLabel(subItem) }}</span>
        <span
          class="ks"
          :class="{ fail: subItem.kgtda !== subItem.pdtxx?.[0]?.sfzq }"
        >
          考生答案：{{ formateKsda(subItem.kgtda) }}
        </span>
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

.radios {
  margin: 12px 8%;
}

.answer-row {
  margin: 8px 12px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 14px;
}

.zq {
  color: #009865;
}

.ks {
  color: #167cf3;
}

.ks.fail {
  color: #fd5858;
}
</style>
