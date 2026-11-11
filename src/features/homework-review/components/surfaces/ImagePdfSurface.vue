<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import AnnotationCallouts from '../layers/AnnotationCallouts.vue'
import AnnotationCanvas from '../layers/AnnotationCanvas.vue'
import AnnotationMarkers from '../layers/AnnotationMarkers.vue'
import AnnotationPins from '../layers/AnnotationPins.vue'
import { useAnnotationStore } from '../../useAnnotationStore'
import { useSpatialIndex } from '../../useSpatialIndex'
import samplePage from '../../assets/sample-page.svg'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const store = useAnnotationStore()
const stageRef = ref<HTMLElement | null>(null)
const baseCanvasRef = ref<HTMLCanvasElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const stageSize = ref({ width: 720, height: 960 })
const drawing = ref(false)
const draftPoints = ref<Array<{ x: number; y: number }>>([])

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

function toNorm(event: PointerEvent) {
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  }
}

const GUTTER = 64

function measureFromImage() {
  const img = imgRef.value
  if (!img) return
  const maxW = Math.min(820, (stageRef.value?.parentElement?.clientWidth || 820) - GUTTER * 2)
  const ratio = img.naturalHeight / img.naturalWidth || 4 / 3
  stageSize.value = {
    width: Math.max(320, maxW) + GUTTER * 2,
    height: Math.round(Math.max(320, maxW) * ratio),
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
  stageSize.value = {
    width: viewport.width + GUTTER * 2,
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

onMounted(() => {
  void setupSurface()
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

watch(() => store.surface.value, () => {
  void setupSurface()
})
</script>

<template>
  <div class="surface">
    <div
      ref="stageRef"
      class="stage"
      :class="`tool-${store.tool.value}`"
      :style="{ width: `${stageSize.width}px`, height: `${stageSize.height}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="page-frame" :style="{ left: `${GUTTER}px`, right: `${GUTTER}px` }">
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
      </div>

      <AnnotationCanvas
        :width="stageSize.width"
        :height="stageSize.height"
        :annotations="pageAnnotations"
        :selected-id="store.selectedId.value"
      />
      <AnnotationPins
        :pins="pagePins"
        :visible-ids="visibleIds"
        :selected-id="store.selectedId.value"
        :width="stageSize.width"
        :height="stageSize.height"
        @select="store.select"
      />
      <AnnotationMarkers
        :stamps="pageStamps"
        :textboxes="pageTextboxes"
        :selected-id="store.selectedId.value"
        :width="stageSize.width"
        :height="stageSize.height"
        @select="store.select"
      />
      <AnnotationCallouts
        :callouts="pageCallouts"
        :selected-id="store.selectedId.value"
        :width="stageSize.width"
        :height="stageSize.height"
        :draft-tip="store.calloutDraftTip.value"
        :draft-preview="store.calloutPreview.value"
        @select="store.select"
      />
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

.stage {
  position: relative;
  margin: 0 auto;
  background: #f8fafc;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  touch-action: none;
  user-select: none;
}

.page-frame {
  position: absolute;
  top: 0;
  bottom: 0;
  background: #fff;
  overflow: hidden;
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
