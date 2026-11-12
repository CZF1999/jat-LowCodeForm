<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { CalloutAnnotation, CalloutDraftTip, ReviewTool } from '../../types'

const props = defineProps<{
  callouts: CalloutAnnotation[]
  selectedId: string | null
  width: number
  height: number
  tool: ReviewTool
  draftTip?: CalloutDraftTip | null
  draftPreview?: CalloutDraftTip | null
}>()

const emit = defineEmits<{
  select: [id: string]
  'move-tip': [id: string, tipX: number, tipY: number]
  'move-box': [id: string, boxX: number, boxY: number]
}>()

const DEFAULT_BOX_WIDTH = 200
const DRAG_THRESHOLD_PX = 3

interface CalloutLayout {
  id: string
  tipX: number
  tipY: number
  tipXNorm: number
  tipYNorm: number
  boxXNorm: number
  boxYNorm: number
  boxLeft: number
  boxTop: number
  boxWidth: number
  lineEndX: number
  lineEndY: number
  arrowPoints: string
  text: string
  color: string
  selected: boolean
}

type DragTarget = 'tip' | 'box'

interface DragState {
  target: DragTarget
  id: string
  pointerId: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  moved: boolean
}

const drag = ref<DragState | null>(null)
const grabbingKey = ref<string | null>(null)

const canDrag = computed(() => props.tool === 'select')

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

function layoutOne(
  tipXNorm: number,
  tipYNorm: number,
  boxXNorm: number,
  boxYNorm: number,
  boxWidthPx: number,
  id: string,
  text: string,
  color: string,
  selected: boolean,
): CalloutLayout {
  const tipX = tipXNorm * props.width
  const tipY = tipYNorm * props.height
  const boxWidth = Math.min(boxWidthPx, Math.max(120, props.width * 0.35))
  const boxLeft = boxXNorm * props.width - boxWidth / 2
  const boxTop = boxYNorm * props.height
  const boxCenterX = boxLeft + boxWidth / 2
  const boxCenterY = boxTop + 24

  let lineEndX = boxLeft
  let lineEndY = boxCenterY
  if (tipX > boxLeft + boxWidth) {
    lineEndX = boxLeft + boxWidth
  } else if (tipX >= boxLeft && tipX <= boxLeft + boxWidth) {
    lineEndX = boxCenterX
    lineEndY = tipY < boxTop ? boxTop : boxTop + 48
  }

  const arrowPoints = arrowHead(lineEndX, lineEndY, tipX, tipY)

  return {
    id,
    tipX,
    tipY,
    tipXNorm,
    tipYNorm,
    boxXNorm,
    boxYNorm,
    boxLeft,
    boxTop,
    boxWidth,
    lineEndX,
    lineEndY,
    arrowPoints,
    text,
    color,
    selected,
  }
}

function arrowHead(fromX: number, fromY: number, toX: number, toY: number): string {
  const dx = toX - fromX
  const dy = toY - fromY
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const size = 8
  const leftX = toX - ux * size - uy * size * 0.55
  const leftY = toY - uy * size + ux * size * 0.55
  const rightX = toX - ux * size + uy * size * 0.55
  const rightY = toY - uy * size - ux * size * 0.55
  return `${toX},${toY} ${leftX},${leftY} ${rightX},${rightY}`
}

const layouts = computed(() =>
  props.callouts.map((item) =>
    layoutOne(
      item.tipX,
      item.tipY,
      item.boxX,
      item.boxY,
      item.boxWidth ?? DEFAULT_BOX_WIDTH,
      item.id,
      item.text,
      item.color || '#2563eb',
      item.id === props.selectedId,
    ),
  ),
)

const draftLayout = computed(() => {
  if (!props.draftTip || !props.draftPreview) return null
  return layoutOne(
    props.draftTip.x,
    props.draftTip.y,
    props.draftPreview.x,
    props.draftPreview.y,
    DEFAULT_BOX_WIDTH,
    '__draft__',
    '',
    '#94a3b8',
    false,
  )
})

function detachWindowDrag() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

onUnmounted(() => {
  detachWindowDrag()
  drag.value = null
  grabbingKey.value = null
})

function onPointerDown(
  event: PointerEvent,
  target: DragTarget,
  item: CalloutLayout,
) {
  event.stopPropagation()
  emit('select', item.id)
  if (!canDrag.value) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId)
  drag.value = {
    target,
    id: item.id,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originX: target === 'tip' ? item.tipXNorm : item.boxXNorm,
    originY: target === 'tip' ? item.tipYNorm : item.boxYNorm,
    moved: false,
  }
  grabbingKey.value = `${target}:${item.id}`
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
  if (state.target === 'tip') emit('move-tip', state.id, x, y)
  else emit('move-box', state.id, x, y)
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
  grabbingKey.value = null
  detachWindowDrag()
}
</script>

<template>
  <div class="callout-layer">
    <svg class="callout-svg" :width="width" :height="height" aria-hidden="true">
      <g v-for="item in layouts" :key="item.id">
        <line
          :x1="item.lineEndX"
          :y1="item.lineEndY"
          :x2="item.tipX"
          :y2="item.tipY"
          :stroke="item.color"
          stroke-width="1.75"
        />
        <polygon :points="item.arrowPoints" :fill="item.color" />
        <circle :cx="item.tipX" :cy="item.tipY" r="3" :fill="item.color" />
      </g>

      <g v-if="draftLayout" class="is-draft">
        <line
          :x1="draftLayout.lineEndX"
          :y1="draftLayout.lineEndY"
          :x2="draftLayout.tipX"
          :y2="draftLayout.tipY"
          :stroke="draftLayout.color"
          stroke-width="1.5"
          stroke-dasharray="5 4"
        />
        <polygon :points="draftLayout.arrowPoints" :fill="draftLayout.color" opacity="0.7" />
        <circle
          :cx="draftLayout.tipX"
          :cy="draftLayout.tipY"
          r="4"
          :fill="draftLayout.color"
        />
      </g>
    </svg>

    <button
      v-for="item in layouts"
      :key="`tip_${item.id}`"
      type="button"
      class="tip-handle"
      :class="{
        'is-selected': item.selected,
        'is-draggable': canDrag,
        'is-grabbing': grabbingKey === `tip:${item.id}`,
      }"
      :style="{
        left: `${item.tipX}px`,
        top: `${item.tipY}px`,
        background: item.color,
      }"
      :title="canDrag ? '拖动尖点' : '选中引注'"
      @pointerdown="onPointerDown($event, 'tip', item)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.stop="emit('select', item.id)"
    />

    <button
      v-for="item in layouts"
      :key="item.id"
      type="button"
      class="callout-box"
      :class="{
        'is-selected': item.selected,
        'is-draggable': canDrag,
        'is-grabbing': grabbingKey === `box:${item.id}`,
      }"
      :style="{
        left: `${item.boxLeft}px`,
        top: `${item.boxTop}px`,
        width: `${item.boxWidth}px`,
        borderColor: item.color,
      }"
      @pointerdown="onPointerDown($event, 'box', item)"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.stop="emit('select', item.id)"
    >
      {{ item.text || '写改进意见…' }}
    </button>
  </div>
</template>

<style scoped>
.callout-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.callout-svg {
  position: absolute;
  inset: 0;
  overflow: visible;
  /* Full-size SVG would otherwise steal hits from stamps/textboxes under this layer. */
  pointer-events: none;
}

.tip-handle {
  pointer-events: auto;
  position: absolute;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border: 2px solid #fff;
  border-radius: 50%;
  padding: 0;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.35);
  cursor: pointer;
  touch-action: none;
}

.tip-handle.is-draggable {
  cursor: grab;
}

.tip-handle.is-grabbing {
  cursor: grabbing;
}

.tip-handle.is-selected {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.45), 0 1px 4px rgba(15, 23, 42, 0.35);
}

.callout-box {
  pointer-events: auto;
  position: absolute;
  min-height: 48px;
  max-height: 160px;
  overflow: auto;
  margin: 0;
  border: 1.5px solid #2563eb;
  border-radius: 8px;
  background: rgba(239, 246, 255, 0.96);
  color: #1e3a8a;
  padding: 8px 10px;
  font: inherit;
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  touch-action: none;
}

.callout-box.is-draggable {
  cursor: grab;
}

.callout-box.is-grabbing {
  cursor: grabbing;
}

.callout-box.is-selected {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35), 0 4px 14px rgba(15, 23, 42, 0.12);
}
</style>
