<!-- 题号导航：放在试卷 stage 外，不参与 PDF 导出 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { PaperDetail } from '../paperTypes'
import { resolveQuesType } from '../quesTypeMap'

const props = defineProps<{
  paper: PaperDetail
}>()

const groups = computed(() => props.paper.yjtxxx || [])

function handleItemBoxClick(tmid: number) {
  document.querySelector(`#box_${tmid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
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
</template>

<style scoped>
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
  box-sizing: border-box;
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
