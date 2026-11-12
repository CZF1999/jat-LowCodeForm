<!-- 单选题（只读 Demo） -->
<script setup lang="ts">
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

function getRight(item: { xztxx?: Array<{ sfzq: string; xxdm: string }> }) {
  return (item.xztxx || [])
    .filter((opt) => opt.sfzq === '1')
    .map((opt) => opt.xxdm)
    .join(',')
}

const group = props.topicData as YjtGroup
const subItem = props.topicData as TmItem
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
        <div
          v-for="tm in item.xztxx"
          :key="tm.xxdm"
          class="option"
          :class="{ 'is-right': tm.sfzq === '1' }"
        >
          {{ tm.xxdm }}.{{ tm.xxnr }}
        </div>
        <div class="answer-row">
          <span class="zq">正确答案：{{ getRight(item) || '—' }}</span>
          <span class="ks" :class="{ fail: item.kgtda !== getRight(item) }">
            考生答案：{{ item.kgtda || '未作答' }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="topic-body">
      <p class="stem">({{ index }}). {{ subItem.tm }}</p>
      <div
        v-for="tm in subItem.xztxx"
        :key="tm.xxdm"
        class="option"
        :class="{ 'is-right': tm.sfzq === '1' }"
      >
        {{ tm.xxdm }}.{{ tm.xxnr }}
      </div>
      <div class="answer-row">
        <span class="zq">正确答案：{{ getRight(subItem) || '—' }}</span>
        <span class="ks" :class="{ fail: subItem.kgtda !== getRight(subItem) }">
          考生答案：{{ subItem.kgtda || '未作答' }}
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

.option {
  width: min(602px, 100%);
  min-height: 40px;
  margin: 8px 8%;
  padding: 8px 10px;
  box-sizing: border-box;
  background: #eff1f4;
  border: 1px solid #e5e5e5;
  border-radius: 2px;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #333;
}

.option.is-right {
  background: rgba(13, 155, 126, 0.1);
  border-color: #0d9b7e;
  color: #009865;
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
