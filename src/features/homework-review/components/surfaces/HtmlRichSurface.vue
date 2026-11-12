<script setup lang="ts">
import { watch } from 'vue'
import AnnotationCallouts from '../layers/AnnotationCallouts.vue'
import AnnotationCanvas from '../layers/AnnotationCanvas.vue'
import AnnotationMarkers from '../layers/AnnotationMarkers.vue'
import AnnotationPins from '../layers/AnnotationPins.vue'
import { PAPER_CONTENT_WIDTH, PAPER_GUTTER_X, PAPER_STAGE_WIDTH } from '../../paperLayout'
import { useAnswerContent } from '../../useAnswerContent'
import { useHtmlAnnotationStage } from '../../useHtmlAnnotationStage'

const answerContent = useAnswerContent()
const stage = useHtmlAnnotationStage([() => answerContent.contentHtml.value])
const paperStyle = {
  '--paper-content-width': `${PAPER_CONTENT_WIDTH}px`,
  '--paper-gutter-x': `${PAPER_GUTTER_X}px`,
  '--paper-stage-width': `${PAPER_STAGE_WIDTH}px`,
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
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = stage

watch(
  () => answerContent.contentHash.value,
  (hash) => {
    if (hash) store.contentHash.value = hash
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
      :style="paperStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div ref="contentBoxRef" class="content-shell">
        <div
          ref="contentRef"
          class="content"
          contenteditable="false"
          v-html="answerContent.contentHtml.value"
        />

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
            :draft-tip="store.calloutDraftTip.value"
            :draft-preview="store.calloutPreview.value"
            @select="store.select"
            @move-tip="store.updateCalloutTip"
            @move-box="store.updateCalloutBox"
          />
        </div>
      </div>
    </div>
    <p class="hint">
      HTML 试卷：内容区固定宽度；图章/短文本/引注只存相对试卷坐标。选中工具可拖改位；高亮/下划线拖选。Esc 取消引注。
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
  padding: 28px 16px 48px;
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

.content :deep(.page) {
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

.content :deep(h4) {
  margin: 16px 0 8px;
  font-size: 15px;
}

.content :deep(.paper-header) {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.content :deep(.tm-group) {
  margin-bottom: 28px;
}

.content :deep(.tm-item) {
  margin: 12px 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e2e8f0;
}

.content :deep(.tm-item.is-sub) {
  margin-left: 16px;
  padding-left: 12px;
  border-left: 2px solid #e2e8f0;
  border-bottom: none;
}

.content :deep(.stem) {
  margin: 0 0 8px;
  white-space: pre-wrap;
}

.content :deep(.options),
.content :deep(.blanks) {
  margin: 8px 0;
  padding-left: 1.2em;
}

.content :deep(.opt.is-correct) {
  color: #15803d;
}

.content :deep(.opt.is-picked) {
  font-weight: 600;
}

.content :deep(.opt-mark) {
  margin-left: 8px;
  font-size: 12px;
  color: #64748b;
}

.content :deep(.student-answer),
.content :deep(.meta-line) {
  margin: 6px 0;
  color: #334155;
}

.content :deep(.ref-answer) {
  margin: 8px 0;
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 6px;
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
