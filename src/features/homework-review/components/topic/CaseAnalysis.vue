<!-- 案例题（只读 Demo，递归子题） -->
<script setup lang="ts">
import type { Component } from 'vue'
import type { TmItem, YjtGroup } from '../../paperTypes'
import { TMLXDM_LABEL } from '../../paperTypes'
import determine from './determine.vue'
import fillVacancy from './fillVacancy.vue'
import multipleChoice from './multipleChoice.vue'
import shortAnswer from './shortAnswer.vue'
import singalRadio from './singalRadio.vue'

const props = withDefaults(
  defineProps<{
    topicData: YjtGroup
    index?: string
    title?: string
  }>(),
  {
    index: '一',
    title: '',
  },
)

const subMap: Record<string, Component> = {
  dxt: singalRadio,
  duoxt: multipleChoice,
  bdxt: multipleChoice,
  pdt: determine,
  tkt: fillVacancy,
  jdt: shortAnswer,
}

function subComponent(item: TmItem): Component {
  return subMap[item.tmlxdm] || shortAnswer
}

function subTitle(item: TmItem): string {
  return TMLXDM_LABEL[item.tmlxdm] || String(item.tmlxdm)
}
</script>

<template>
  <div class="topic-block">
    <div class="topic-type">
      {{ index }}、{{ title }}（每题{{ topicData.fs }}分，共{{ topicData.dgtmlxzf }}分）
    </div>
    <div
      v-for="(item, tmIndex) in topicData.tmxx"
      :id="'box_' + item.tmid"
      :key="item.tmid"
      class="case-card"
    >
      <p class="stem">{{ tmIndex + 1 }}. {{ item.tm }}</p>
      <div class="sub-list">
        <component
          :is="subComponent(sub)"
          v-for="(sub, subIndex) in item.ztmList || []"
          :key="sub.tmid"
          :topic-data="sub"
          :is-alt-zt="true"
          :index="String(subIndex + 1)"
          :title="subTitle(sub)"
        />
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

.case-card {
  margin-bottom: 20px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #e2e8f0;
}

.stem {
  margin: 0 0 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  line-height: 1.6;
}

.sub-list {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 2px solid #e2e8f0;
}
</style>
