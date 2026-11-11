<script setup lang="ts">
import { computed } from 'vue'
import {
  STAMP_SYMBOL_LABEL,
  type StampAnnotation,
  type TextboxAnnotation,
} from '../../types'

const props = defineProps<{
  stamps: StampAnnotation[]
  textboxes: TextboxAnnotation[]
  selectedId: string | null
  width: number
  height: number
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const placedStamps = computed(() =>
  props.stamps.filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)),
)

const placedTextboxes = computed(() =>
  props.textboxes.filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)),
)

function stampStyle(item: StampAnnotation) {
  return {
    left: `${item.x * props.width}px`,
    top: `${item.y * props.height}px`,
    color: item.color || '#16a34a',
  }
}

function textboxStyle(item: TextboxAnnotation) {
  return {
    left: `${item.x * props.width}px`,
    top: `${item.y * props.height}px`,
    borderColor: item.color || '#b45309',
  }
}
</script>

<template>
  <div class="marker-layer">
    <button
      v-for="item in placedStamps"
      :key="item.id"
      type="button"
      class="stamp"
      :class="{ 'is-selected': item.id === selectedId }"
      :style="stampStyle(item)"
      :title="item.comment || STAMP_SYMBOL_LABEL[item.symbol]"
      @click.stop="emit('select', item.id)"
    >
      {{ STAMP_SYMBOL_LABEL[item.symbol] }}
    </button>

    <button
      v-for="item in placedTextboxes"
      :key="item.id"
      type="button"
      class="textbox"
      :class="{ 'is-selected': item.id === selectedId }"
      :style="textboxStyle(item)"
      :title="item.text || item.comment || '短文本'"
      @click.stop="emit('select', item.id)"
    >
      {{ item.text || '短文本…' }}
    </button>
  </div>
</template>

<style scoped>
.marker-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.stamp,
.textbox {
  pointer-events: auto;
  position: absolute;
  cursor: pointer;
  padding: 0;
  font: inherit;
}

.stamp {
  width: 32px;
  height: 32px;
  margin: -16px 0 0 -16px;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
}

.stamp.is-selected {
  transform: scale(1.15);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35);
}

.textbox {
  max-width: 160px;
  margin: -4px 0 0 0;
  transform: translate(-50%, -100%);
  border: 1px solid #b45309;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
}

.textbox.is-selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
}
</style>
