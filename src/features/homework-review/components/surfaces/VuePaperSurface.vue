<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AnnotationCallouts from '../layers/AnnotationCallouts.vue'
import AnnotationCanvas from '../layers/AnnotationCanvas.vue'
import AnnotationMarkers from '../layers/AnnotationMarkers.vue'
import AnnotationPins from '../layers/AnnotationPins.vue'
import PaperMarkingView from '../PaperMarkingView.vue'
import {
  beginExportRootLayout,
  endExportRootLayout,
  expandStageForOverflow,
  type AnnotatedSurfaceExportApi,
} from '../../exportAnnotatedPdf'
import {
  PAPER_CONTENT_WIDTH_WIDE,
  PAPER_GUTTER_X,
  PAPER_STAGE_WIDTH_WIDE,
} from '../../paperLayout'
import { useAnswerContent } from '../../useAnswerContent'
import { useHtmlAnnotationStage } from '../../useHtmlAnnotationStage'

const answerContent = useAnswerContent()
const stage = useHtmlAnnotationStage([
  () => answerContent.paper.value?.sjid,
  () => answerContent.paperMode.value,
])
const paperStyle = {
  '--paper-content-width': `${PAPER_CONTENT_WIDTH_WIDE}px`,
  '--paper-gutter-x': `${PAPER_GUTTER_X}px`,
  '--paper-stage-width': `${PAPER_STAGE_WIDTH_WIDE}px`,
}
const {
  store,
  rootRef,
  stageRef,
  contentBoxRef,
  contentRef,
  size,
  positionedPins,
  positionedStamps,
  positionedTextboxes,
  positionedCallouts,
  underlineRects,
  highlightRects,
  previewRects,
  visibleIds,
  canvasAnnotations,
  draftPoints,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  layoutAll,
} = stage

const exportMode = ref(false)

watch(
  () => answerContent.contentHash.value,
  (hash) => {
    if (hash) store.contentHash.value = hash
  },
  { immediate: true },
)

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

function getContentRoot() {
  return contentRef.value
}

function relayoutForExport() {
  layoutAll()
}

defineExpose<AnnotatedSurfaceExportApi>({
  getExportRoot,
  getContentRoot,
  relayoutForExport,
  prepareExport,
  restoreExport,
})
</script>

<template>
  <div ref="rootRef" class="html-surface" :class="{ 'is-exporting': exportMode }">
    <div
      ref="stageRef"
      class="stage"
      :class="[`tool-${store.tool.value}`, { 'is-exporting': exportMode }]"
      :style="paperStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div ref="contentBoxRef" class="content-shell">
        <div ref="contentRef" class="content" contenteditable="false">
          <PaperMarkingView v-if="answerContent.paper.value" :paper="answerContent.paper.value" />
        </div>

        <div class="overlay-root" :style="{ width: `${size.width}px`, height: `${size.height}px` }">
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
            :draft-points="draftPoints"
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
            :stamps="positionedStamps"
            :textboxes="positionedTextboxes"
            :selected-id="store.selectedId.value"
            :width="size.width"
            :height="size.height"
            :tool="store.tool.value"
            :export-mode="exportMode"
            @select="store.select"
            @move-stamp="store.updateStampPosition"
            @move-textbox="store.updateTextboxPosition"
          />

          <AnnotationCallouts
            :callouts="positionedCallouts"
            :selected-id="store.selectedId.value"
            :width="size.width"
            :height="size.height"
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
    <p v-show="!exportMode" class="hint">
      Vue 试卷：内容区固定宽度；图章/短文本/引注只存相对试卷坐标。选中工具可拖改位；划词依赖文本节点稳定。
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
  width: var(--paper-stage-width);
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
  touch-action: none;
  padding-left: var(--paper-gutter-x);
  padding-right: var(--paper-gutter-x);
  box-sizing: border-box;
  overflow: visible;
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

.content-shell {
  position: relative;
  width: var(--paper-content-width);
}

.content {
  padding: 16px 8px 48px;
  color: #1f2937;
  line-height: 1.7;
}

.overlay-root {
  position: absolute;
  left: 0;
  top: 0;
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
  max-width: 980px;
  margin: 12px auto 0;
  color: #64748b;
  font-size: 13px;
}

.html-surface.is-exporting {
  overflow: visible;
  height: auto;
}

.stage.is-exporting {
  box-shadow: none;
  border-radius: 0;
}

.stage.is-baking-marks :deep(.mark-layer .highlight),
.stage.is-baking-marks :deep(.mark-layer .underline) {
  visibility: hidden;
}
</style>
