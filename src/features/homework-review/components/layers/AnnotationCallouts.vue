<script setup lang="ts">
import { computed } from 'vue'
import type { CalloutAnnotation, CalloutDraftTip } from '../../types'

const props = defineProps<{
  callouts: CalloutAnnotation[]
  selectedId: string | null
  width: number
  height: number
  draftTip?: CalloutDraftTip | null
  draftPreview?: CalloutDraftTip | null
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const DEFAULT_BOX_WIDTH = 200

interface CalloutLayout {
  id: string
  tipX: number
  tipY: number
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

  // Attach line to the box edge nearest the tip
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

/** Small triangle at tip, pointing toward tip from line start */
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
      :key="item.id"
      type="button"
      class="callout-box"
      :class="{ 'is-selected': item.selected }"
      :style="{
        left: `${item.boxLeft}px`,
        top: `${item.boxTop}px`,
        width: `${item.boxWidth}px`,
        borderColor: item.color,
      }"
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
}

.callout-box.is-selected {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35), 0 4px 14px rgba(15, 23, 42, 0.12);
}
</style>
