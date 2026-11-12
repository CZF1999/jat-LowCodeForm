<script setup lang="ts">
// 图章
import { computed, onUnmounted, ref } from 'vue'
import {
  STAMP_SYMBOL_LABEL,
  type ReviewTool,
  type StampAnnotation,
  type TextboxAnnotation,
} from '../../types'

const props = defineProps<{
  stamps: StampAnnotation[]
  textboxes: TextboxAnnotation[]
  selectedId: string | null
  width: number
  height: number
  tool: ReviewTool
  /** Expand short text for PDF export (no ellipsis). */
  exportMode?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  'move-stamp': [id: string, x: number, y: number]
  'move-textbox': [id: string, x: number, y: number]
}>()

const DRAG_THRESHOLD_PX = 3

type DragKind = 'stamp' | 'textbox'

interface DragState {
  kind: DragKind
  id: string
  pointerId: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  moved: boolean
}

const drag = ref<DragState | null>(null)
const grabbingId = ref<string | null>(null)

const canDrag = computed(() => props.tool === 'select')

const placedStamps = computed(() =>
  props.stamps.filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)),
)

const placedTextboxes = computed(() =>
  props.textboxes.filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)),
)

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

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

function detachWindowDrag() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

onUnmounted(() => {
  detachWindowDrag()
  drag.value = null
  grabbingId.value = null
})

function onPointerDown(
  event: PointerEvent,
  kind: DragKind,
  id: string,
  originX: number,
  originY: number,
) {
  event.stopPropagation()
  emit('select', id)
  if (!canDrag.value) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId)
  drag.value = {
    kind,
    id,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originX,
    originY,
    moved: false,
  }
  grabbingId.value = id
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(event: PointerEvent) {
  const state = drag.value
  if (!state || event.pointerId !== state.pointerId) return
  const dx = event.clientX - state.startClientX
  const dy = event.clientY - state.startClientY
  if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
  state.moved = true
  const w = Math.max(props.width, 1)
  const h = Math.max(props.height, 1)
  const x = clamp01(state.originX + dx / w)
  const y = clamp01(state.originY + dy / h)
  if (state.kind === 'stamp') emit('move-stamp', state.id, x, y)
  else emit('move-textbox', state.id, x, y)
}

function onPointerUp(event: PointerEvent) {
  const state = drag.value
  if (!state || event.pointerId !== state.pointerId) return
  try {
    ;(event.target as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)
  } catch {
    /* already released */
  }
  drag.value = null
  grabbingId.value = null
  detachWindowDrag()
}
</script>

<template>
  <div class="marker-layer">
    <button
      v-for="item in placedStamps"
      :key="item.id"
      type="button"
      class="stamp"
      :class="{
        'is-selected': item.id === selectedId && !exportMode,
        'is-draggable': canDrag && !exportMode,
        'is-grabbing': grabbingId === item.id,
      }"
      :style="stampStyle(item)"
      :title="item.comment || STAMP_SYMBOL_LABEL[item.symbol]"
      @pointerdown="onPointerDown($event, 'stamp', item.id, item.x, item.y)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.stop="emit('select', item.id)"
    >
      {{ STAMP_SYMBOL_LABEL[item.symbol] }}
    </button>

    <button
      v-for="item in placedTextboxes"
      :key="item.id"
      type="button"
      class="textbox"
      :class="{
        'is-selected': item.id === selectedId && !exportMode,
        'is-draggable': canDrag && !exportMode,
        'is-grabbing': grabbingId === item.id,
        'is-export': exportMode,
      }"
      :style="textboxStyle(item)"
      :title="item.text || item.comment || '短文本'"
      @pointerdown="onPointerDown($event, 'textbox', item.id, item.x, item.y)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
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
  touch-action: none;
}

.stamp.is-draggable,
.textbox.is-draggable {
  cursor: grab;
}

.stamp.is-grabbing,
.textbox.is-grabbing {
  cursor: grabbing;
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

.textbox.is-export {
  max-width: none;
  white-space: pre-wrap;
  overflow: visible;
  text-overflow: clip;
  box-shadow: none;
}
</style>
