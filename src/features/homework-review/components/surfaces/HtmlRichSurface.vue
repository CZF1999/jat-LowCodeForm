<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import sampleHtml from '../../mocks/sample-answer.html?raw'
import AnnotationCallouts from '../layers/AnnotationCallouts.vue'
import AnnotationCanvas from '../layers/AnnotationCanvas.vue'
import AnnotationMarkers from '../layers/AnnotationMarkers.vue'
import AnnotationPins from '../layers/AnnotationPins.vue'
import {
  caretOffsetFromPoint,
  offsetToRange,
  rangeToOffsets,
  stageRelativeFromClientRect,
} from '../../htmlRange'
import { useAnnotationStore } from '../../useAnnotationStore'
import { useSpatialIndex } from '../../useSpatialIndex'
import type { HighlightRect, PinAnnotation, UnderlineRect } from '../../types'

const store = useAnnotationStore()
const rootRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const size = ref({ width: 720, height: 900 })
const positionedPins = shallowRef<PinAnnotation[]>([])
const underlineRects = shallowRef<UnderlineRect[]>([])
const highlightRects = shallowRef<HighlightRect[]>([])
const previewRects = shallowRef<Array<Omit<UnderlineRect, 'id' | 'color'> & { color?: string }>>([])

const drawingRange = ref(false)
const drawingStroke = ref(false)
const draftStart = ref<number | null>(null)
const draftEnd = ref<number | null>(null)
const draftPoints = ref<Array<{ x: number; y: number }>>([])

const htmlPins = computed(() => store.pins.value.filter((pin) => pin.surface === 'html'))
const htmlStamps = computed(() => store.stamps.value.filter((item) => item.surface === 'html'))
const htmlTextboxes = computed(() => store.textboxes.value.filter((item) => item.surface === 'html'))
const htmlCallouts = computed(() => store.callouts.value.filter((item) => item.surface === 'html'))
const htmlUnderlines = computed(() => store.underlines.value)
const htmlHighlights = computed(() => store.highlights.value)
const htmlStrokes = computed(() => store.strokes.value.filter((item) => item.surface === 'html'))
const canvasAnnotations = computed(() => [...htmlStrokes.value])

const { visibleIds, syncVisible } = useSpatialIndex(positionedPins)

function measureStage() {
  const stage = stageRef.value
  if (!stage) return
  size.value = {
    width: Math.max(stage.clientWidth, 1),
    height: Math.max(stage.scrollHeight, stage.clientHeight, 1),
  }
}

function toNorm(event: PointerEvent) {
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  const height = Math.max(size.value.height, 1)
  const width = Math.max(size.value.width, 1)
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / height)),
  }
}

function layoutPins() {
  const root = contentRef.value
  const stage = stageRef.value
  if (!root || !stage) return
  measureStage()

  positionedPins.value = htmlPins.value.map((pin) => {
    if (pin.htmlAnchor) {
      const range = offsetToRange(root, pin.htmlAnchor.start, pin.htmlAnchor.end)
      if (range) {
        const rect = range.getBoundingClientRect()
        const rel = stageRelativeFromClientRect(stage, rect)
        return { ...pin, x: rel.x, y: rel.y }
      }
    }
    return { ...pin, x: pin.x ?? 0.5, y: pin.y ?? 0.5 }
  })
}

function layoutRangeMarks(
  items: Array<{ id: string; htmlAnchor: { start: number; end: number }; color?: string }>,
  mode: 'underline' | 'highlight',
) {
  const root = contentRef.value
  const stage = stageRef.value
  if (!root || !stage) return [] as Array<UnderlineRect | HighlightRect>
  const next: Array<UnderlineRect | HighlightRect> = []
  for (const item of items) {
    const range = offsetToRange(root, item.htmlAnchor.start, item.htmlAnchor.end)
    if (!range) continue
    const rects = Array.from(range.getClientRects())
    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue
      const rel = stageRelativeFromClientRect(stage, rect)
      if (mode === 'underline') {
        next.push({
          id: `${item.id}_${next.length}`,
          left: rel.left,
          top: rel.top + rel.height - 2,
          width: rel.width,
          height: 2,
          color: item.color || '#ef4444',
        })
      } else {
        next.push({
          id: `${item.id}_${next.length}`,
          left: rel.left,
          top: rel.top,
          width: rel.width,
          height: rel.height,
          color: item.color || '#facc15',
        })
      }
    }
  }
  return next
}

function layoutAll() {
  layoutPins()
  underlineRects.value = layoutRangeMarks(htmlUnderlines.value, 'underline') as UnderlineRect[]
  highlightRects.value = layoutRangeMarks(htmlHighlights.value, 'highlight') as HighlightRect[]
}

async function refreshVisible() {
  await syncVisible(
    { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    store.selectedId.value,
    64,
  )
}

function updatePreview(start: number, end: number, color: string) {
  const root = contentRef.value
  const stage = stageRef.value
  if (!root || !stage) {
    previewRects.value = []
    return
  }
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  if (to <= from) {
    previewRects.value = []
    return
  }
  const range = offsetToRange(root, from, to)
  if (!range) {
    previewRects.value = []
    return
  }
  const isHighlight = store.tool.value === 'highlight'
  previewRects.value = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => {
      const rel = stageRelativeFromClientRect(stage, rect)
      return isHighlight
        ? {
            left: rel.left,
            top: rel.top,
            width: rel.width,
            height: rel.height,
            color,
          }
        : {
            left: rel.left,
            top: rel.top + rel.height - 2,
            width: rel.width,
            height: 2,
            color,
          }
    })
}

function placeStampOrText(event: PointerEvent) {
  const point = toNorm(event)
  if (store.tool.value === 'stamp') {
    store.addStamp({
      surface: 'html',
      x: point.x,
      y: point.y,
      symbol: store.stampSymbol.value,
      comment: '',
    })
    return
  }
  if (store.tool.value === 'textbox') {
    store.addTextbox({
      surface: 'html',
      x: point.x,
      y: point.y,
      text: '',
      comment: '',
    })
  }
}

function placeCallout(event: PointerEvent) {
  const point = toNorm(event)
  if (!store.calloutDraftTip.value) {
    store.beginCallout(point)
    return
  }
  store.finishCallout(point, {
    surface: 'html',
    text: '',
  })
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') store.cancelCalloutDraft()
}

function onPointerDown(event: PointerEvent) {
  const tool = store.tool.value
  if (tool === 'stamp' || tool === 'textbox') {
    placeStampOrText(event)
    event.preventDefault()
    return
  }

  if (tool === 'callout') {
    placeCallout(event)
    event.preventDefault()
    return
  }

  if (tool === 'pen') {
    drawingStroke.value = true
    draftPoints.value = [toNorm(event)]
    stageRef.value?.setPointerCapture(event.pointerId)
    event.preventDefault()
    return
  }

  if (tool === 'highlight' || tool === 'underline') {
    const root = contentRef.value
    if (!root) return
    const offset = caretOffsetFromPoint(root, event.clientX, event.clientY)
    if (offset == null) return
    drawingRange.value = true
    draftStart.value = offset
    draftEnd.value = offset
    previewRects.value = []
    stageRef.value?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
}

function onPointerMove(event: PointerEvent) {
  if (store.tool.value === 'callout' && store.calloutDraftTip.value) {
    store.updateCalloutPreview(toNorm(event))
  }
  if (drawingStroke.value && store.tool.value === 'pen') {
    draftPoints.value = [...draftPoints.value, toNorm(event)]
    return
  }
  if (!drawingRange.value) return
  if (store.tool.value !== 'highlight' && store.tool.value !== 'underline') return
  const root = contentRef.value
  if (!root || draftStart.value == null) return
  const offset = caretOffsetFromPoint(root, event.clientX, event.clientY)
  if (offset == null) return
  draftEnd.value = offset
  updatePreview(
    draftStart.value,
    offset,
    store.tool.value === 'highlight' ? store.highlightColor.value : '#ef4444',
  )
}

function finishRangeMark() {
  const root = contentRef.value
  if (!root || draftStart.value == null || draftEnd.value == null) {
    previewRects.value = []
    return
  }
  const start = Math.min(draftStart.value, draftEnd.value)
  const end = Math.max(draftStart.value, draftEnd.value)
  draftStart.value = null
  draftEnd.value = null
  previewRects.value = []
  if (end - start < 1) return
  const range = offsetToRange(root, start, end)
  if (!range) return
  const anchor = rangeToOffsets(root, range)
  if (!anchor) return
  if (store.tool.value === 'highlight') {
    store.addHighlight({
      htmlAnchor: anchor,
      comment: '',
      color: store.highlightColor.value,
    })
  } else if (store.tool.value === 'underline') {
    store.addUnderline({ htmlAnchor: anchor, comment: '', color: '#ef4444' })
  }
}

function onPointerUp(event: PointerEvent) {
  if (drawingStroke.value) {
    drawingStroke.value = false
    stageRef.value?.releasePointerCapture(event.pointerId)
    if (draftPoints.value.length > 1) {
      store.addStroke({
        surface: 'html',
        points: draftPoints.value,
      })
    }
    draftPoints.value = []
    return
  }

  if (!drawingRange.value) return
  drawingRange.value = false
  stageRef.value?.releasePointerCapture(event.pointerId)
  finishRangeMark()
}

function onScroll() {
  layoutAll()
  void refreshVisible()
}

onMounted(() => {
  layoutAll()
  void refreshVisible()
  rootRef.value?.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  rootRef.value?.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  window.removeEventListener('keydown', onKeyDown)
})

watch(
  [
    htmlPins,
    htmlUnderlines,
    htmlHighlights,
    htmlStamps,
    htmlTextboxes,
    htmlCallouts,
    htmlStrokes,
    () => store.selectedId.value,
  ],
  async () => {
    await nextTick()
    layoutAll()
    await refreshVisible()
  },
  { immediate: true },
)
</script>

<template>
  <div ref="rootRef" class="html-surface">
    <div
      ref="stageRef"
      class="stage"
      :class="`tool-${store.tool.value}`"
      :style="{ minHeight: `${size.height}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        ref="contentRef"
        class="content"
        contenteditable="false"
        v-html="sampleHtml"
      />

      <div class="mark-layer" aria-hidden="true">
        <span
          v-for="rect in highlightRects"
          :key="rect.id"
          class="highlight"
          :style="{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: rect.color,
          }"
        />
        <span
          v-for="rect in underlineRects"
          :key="rect.id"
          class="underline"
          :style="{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: rect.color,
          }"
        />
        <span
          v-for="(rect, index) in previewRects"
          :key="`preview_${index}`"
          :class="store.tool.value === 'highlight' ? 'highlight is-preview' : 'underline is-preview'"
          :style="{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: rect.color || '#ef4444',
          }"
        />
      </div>

      <AnnotationCanvas
        :width="size.width"
        :height="size.height"
        :annotations="canvasAnnotations"
        :selected-id="store.selectedId.value"
      />

      <AnnotationPins
        :pins="positionedPins"
        :visible-ids="visibleIds"
        :selected-id="store.selectedId.value"
        :width="size.width"
        :height="size.height"
        @select="store.select"
      />

      <AnnotationMarkers
        :stamps="htmlStamps"
        :textboxes="htmlTextboxes"
        :selected-id="store.selectedId.value"
        :width="size.width"
        :height="size.height"
        @select="store.select"
      />

      <AnnotationCallouts
        :callouts="htmlCallouts"
        :selected-id="store.selectedId.value"
        :width="size.width"
        :height="size.height"
        :draft-tip="store.calloutDraftTip.value"
        :draft-preview="store.calloutPreview.value"
        @select="store.select"
      />
    </div>
    <p class="hint">
      图章 / 短文本：单击落下。引注：先点问题位置，再点页边落长文本。高亮 / 下划线：拖过文字。画笔：自由圈画。Esc 取消未完成引注。
    </p>
  </div>
</template>

<style scoped>
.html-surface {
  height: 100%;
  overflow: auto;
  padding: 16px;
  box-sizing: border-box;
}

.stage {
  position: relative;
  max-width: 960px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
  touch-action: none;
  /* margin gutters so callout boxes can sit at the edge */
  padding-left: 64px;
  padding-right: 64px;
  box-sizing: border-box;
}

.stage.tool-pen,
.stage.tool-highlight,
.stage.tool-underline,
.stage.tool-stamp,
.stage.tool-textbox,
.stage.tool-callout {
  user-select: none;
  cursor: crosshair;
}

.content {
  padding: 28px 16px 48px;
  color: #1f2937;
  line-height: 1.7;
}

.content :deep(.page) {
  /* ~A4 可视高度，便于滚动时感知「5 页」 */
  min-height: 980px;
  padding: 8px 0 32px;
  box-sizing: border-box;
  border-bottom: 1px dashed #cbd5e1;
}

.content :deep(.page:last-child) {
  border-bottom: none;
  min-height: 880px;
}

.content :deep(.page-label) {
  margin: 0 0 12px;
  font-size: 12px;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

.content :deep(.end-mark) {
  margin-top: 28px;
  text-align: center;
  color: #64748b;
}

.content :deep(h2) {
  margin: 0 0 12px;
}

.content :deep(h3) {
  margin: 20px 0 8px;
}

.mark-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.underline,
.highlight {
  position: absolute;
  border-radius: 1px;
}

.underline {
  opacity: 0.95;
}

.highlight {
  opacity: 0.35;
  border-radius: 2px;
}

.underline.is-preview,
.highlight.is-preview {
  opacity: 0.45;
}

.hint {
  max-width: 820px;
  margin: 12px auto 0;
  color: #64748b;
  font-size: 13px;
}
</style>
