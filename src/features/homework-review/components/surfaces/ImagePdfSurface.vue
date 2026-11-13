<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import AnnotationCallouts from '../layers/AnnotationCallouts.vue'
import AnnotationCanvas from '../layers/AnnotationCanvas.vue'
import AnnotationMarkers from '../layers/AnnotationMarkers.vue'
import AnnotationPins from '../layers/AnnotationPins.vue'
import {
  beginExportRootLayout,
  endExportRootLayout,
  expandStageForOverflow,
} from '../../exportAnnotatedPdf'
import { useAnnotationStore } from '../../useAnnotationStore'
import { useSpatialIndex } from '../../useSpatialIndex'
import samplePage from '../../assets/sample-page.svg'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const store = useAnnotationStore()
const rootRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const pageFrameRef = ref<HTMLElement | null>(null)
const baseCanvasRef = ref<HTMLCanvasElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
/** Page content size (excludes gutter). Annotations normalize to this box. */
const pageSize = ref({ width: 720, height: 960 })
const drawing = ref(false)
const draftPoints = ref<Array<{ x: number; y: number }>>([])
const exportMode = ref(false)

const GUTTER = 64

const stageOuter = computed(() => ({
  width: pageSize.value.width + GUTTER * 2,
  height: pageSize.value.height,
}))

const pagePins = computed(() =>
  store.pins.value.filter(
    (pin) => pin.surface === store.surface.value && (pin.pageIndex ?? 0) === 0,
  ),
)

const pageStamps = computed(() =>
  store.stamps.value.filter(
    (item) => item.surface === store.surface.value && (item.pageIndex ?? 0) === 0,
  ),
)

const pageTextboxes = computed(() =>
  store.textboxes.value.filter(
    (item) => item.surface === store.surface.value && (item.pageIndex ?? 0) === 0,
  ),
)

const pageCallouts = computed(() =>
  store.callouts.value.filter(
    (item) => item.surface === store.surface.value && (item.pageIndex ?? 0) === 0,
  ),
)

const pageAnnotations = computed(() =>
  store.surfaceAnnotations.value.filter(
    (item) => (item.pageIndex ?? 0) === 0 && (item.kind === 'stroke' || item.kind === 'pin'),
  ),
)

const { visibleIds, syncVisible } = useSpatialIndex(pagePins)

async function refreshVisible() {
  await syncVisible(
    { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    store.selectedId.value,
    64,
  )
}

watch([pagePins, () => store.selectedId.value], () => {
  void refreshVisible()
})

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

/** Normalize against page-frame (content), not outer stage with gutters. */
function toNorm(event: PointerEvent) {
  const box = pageFrameRef.value
  if (!box) return { x: 0, y: 0 }
  const rect = box.getBoundingClientRect()
  const width = Math.max(pageSize.value.width, box.clientWidth, 1)
  const height = Math.max(pageSize.value.height, box.clientHeight, 1)
  return {
    x: clamp01((event.clientX - rect.left) / width),
    y: clamp01((event.clientY - rect.top) / height),
  }
}

function measureFromImage() {
  const img = imgRef.value
  if (!img) return
  const parentW = stageRef.value?.parentElement?.clientWidth || 820
  const maxW = Math.min(820, parentW - GUTTER * 2)
  const ratio = img.naturalHeight / img.naturalWidth || 4 / 3
  const w = Math.max(320, maxW)
  pageSize.value = {
    width: w,
    height: Math.round(w * ratio),
  }
}

async function renderPdfPage() {
  const url = `${import.meta.env.BASE_URL}homework-review/sample.pdf`
  const loadingTask = pdfjs.getDocument(url)
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1.4 })
  const canvas = baseCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = viewport.width
  canvas.height = viewport.height
  pageSize.value = {
    width: viewport.width,
    height: viewport.height,
  }
  await page.render({ canvasContext: ctx, viewport }).promise
}

async function setupSurface() {
  await nextTick()
  if (store.surface.value === 'pdf') {
    await renderPdfPage()
  } else {
    measureFromImage()
  }
  await refreshVisible()
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') store.cancelCalloutDraft()
}

function onPointerDown(event: PointerEvent) {
  const point = toNorm(event)
  const tool = store.tool.value

  if (tool === 'stamp') {
    store.addStamp({
      surface: store.surface.value,
      pageIndex: 0,
      x: point.x,
      y: point.y,
      symbol: store.stampSymbol.value,
      comment: '',
    })
    return
  }

  if (tool === 'textbox') {
    store.addTextbox({
      surface: store.surface.value,
      pageIndex: 0,
      x: point.x,
      y: point.y,
      text: '',
      comment: '',
    })
    return
  }

  if (tool === 'callout') {
    if (!store.calloutDraftTip.value) {
      store.beginCallout(point)
    } else {
      store.finishCallout(point, {
        surface: store.surface.value,
        pageIndex: 0,
        text: '',
      })
    }
    return
  }

  if (tool === 'pen') {
    drawing.value = true
    draftPoints.value = [point]
    stageRef.value?.setPointerCapture(event.pointerId)
  }
}

function onPointerMove(event: PointerEvent) {
  if (store.tool.value === 'callout' && store.calloutDraftTip.value) {
    store.updateCalloutPreview(toNorm(event))
  }
  if (!drawing.value) return
  draftPoints.value = [...draftPoints.value, toNorm(event)]
}

function onPointerUp(event: PointerEvent) {
  if (!drawing.value) return
  drawing.value = false
  stageRef.value?.releasePointerCapture(event.pointerId)
  if (draftPoints.value.length > 1) {
    store.addStroke({
      surface: store.surface.value,
      pageIndex: 0,
      points: draftPoints.value,
    })
  }
  draftPoints.value = []
}

function onWindowResize() {
  if (store.surface.value === 'image') measureFromImage()
}

onMounted(() => {
  void setupSurface()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onWindowResize)
})

watch(() => store.surface.value, () => {
  void setupSurface()
})

async function prepareExport() {
  store.select(null)
  store.cancelCalloutDraft()
  exportMode.value = true
  beginExportRootLayout(rootRef.value)
  await nextTick()
  expandStageForOverflow(stageRef.value)
  await nextTick()
}

function restoreExport() {
  exportMode.value = false
  endExportRootLayout(rootRef.value, stageRef.value)
}

function getExportRoot() {
  return stageRef.value
}

defineExpose({
  getExportRoot,
  prepareExport,
  restoreExport,
})
</script>

<template>
  <div ref="rootRef" class="surface" :class="{ 'is-exporting': exportMode }">
    <div
      ref="stageRef"
      class="stage"
      :class="[`tool-${store.tool.value}`, { 'is-exporting': exportMode }]"
      :style="{ width: `${stageOuter.width}px`, height: `${stageOuter.height}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        ref="pageFrameRef"
        class="page-frame"
        :style="{
          left: `${GUTTER}px`,
          width: `${pageSize.width}px`,
          height: `${pageSize.height}px`,
        }"
      >
        <img
          v-show="store.surface.value === 'image'"
          ref="imgRef"
          class="base"
          :src="samplePage"
          alt="学生答卷图片"
          draggable="false"
          @load="measureFromImage"
        />
        <canvas
          v-show="store.surface.value === 'pdf'"
          ref="baseCanvasRef"
          class="base"
        />

        <div class="overlay-root">
          <AnnotationCanvas
            :width="pageSize.width"
            :height="pageSize.height"
            :annotations="pageAnnotations"
            :selected-id="store.selectedId.value"
            :draft-points="draftPoints"
          />
          <AnnotationPins
            :pins="pagePins"
            :visible-ids="visibleIds"
            :selected-id="store.selectedId.value"
            :width="pageSize.width"
            :height="pageSize.height"
            @select="store.select"
          />
          <AnnotationMarkers
            :stamps="pageStamps"
            :textboxes="pageTextboxes"
            :selected-id="store.selectedId.value"
            :width="pageSize.width"
            :height="pageSize.height"
            :tool="store.tool.value"
            :export-mode="exportMode"
            @select="store.select"
            @move-stamp="store.updateStampPosition"
            @move-textbox="store.updateTextboxPosition"
          />
          <AnnotationCallouts
            :callouts="pageCallouts"
            :selected-id="store.selectedId.value"
            :width="pageSize.width"
            :height="pageSize.height"
            :tool="store.tool.value"
            :draft-tip="exportMode ? null : store.calloutDraftTip.value"
            :draft-preview="exportMode ? null : store.calloutPreview.value"
            :export-mode="exportMode"
            @select="store.select"
            @move-tip="store.updateCalloutTip"
            @move-box="store.updateCalloutBox"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.surface {
  overflow: auto;
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
}

.surface.is-exporting {
  overflow: visible;
  height: auto;
}

.stage {
  position: relative;
  margin: 0 auto;
  background: #f8fafc;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  touch-action: none;
  user-select: none;
  overflow: visible;
}

.stage.is-exporting {
  box-shadow: none;
}

.page-frame {
  position: absolute;
  top: 0;
  background: #fff;
  overflow: visible;
}

.overlay-root {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
}

.overlay-root :deep(.stamp),
.overlay-root :deep(.textbox),
.overlay-root :deep(.callout-box),
.overlay-root :deep(.tip-handle),
.overlay-root :deep(.pin) {
  pointer-events: auto;
}

.stage.tool-pen,
.stage.tool-stamp,
.stage.tool-textbox,
.stage.tool-callout {
  cursor: crosshair;
}

.base {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
</style>
