<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ImagePdfSurface from './surfaces/ImagePdfSurface.vue'
import HtmlRichSurface from './surfaces/HtmlRichSurface.vue'
import VuePaperSurface from './surfaces/VuePaperSurface.vue'
import CommentPopover from './layers/CommentPopover.vue'
import {
  exportAnnotatedPdf,
  type AnnotatedSurfaceExportApi,
} from '../exportAnnotatedPdf'
import { useAnswerContent } from '../useAnswerContent'
import { useAnnotationStore } from '../useAnnotationStore'
import {
  HIGHLIGHT_PRESET_COLORS,
  STAMP_SYMBOL_LABEL,
  type Annotation,
  type ReviewTool,
  type StampSymbol,
  type SurfaceMode,
} from '../types'

const store = useAnnotationStore()
const answerContent = useAnswerContent()
const vueSurfaceRef = ref<AnnotatedSurfaceExportApi | null>(null)
const htmlSurfaceRef = ref<AnnotatedSurfaceExportApi | null>(null)
const imagePdfSurfaceRef = ref<AnnotatedSurfaceExportApi | null>(null)
const exportingPdf = ref(false)

const list = computed(() => store.surfaceAnnotations.value.slice().reverse())

const windowedList = computed(() => list.value.slice(0, 80))

const stampSymbols: StampSymbol[] = ['correct', 'wrong', 'half', 'uncertain']

const htmlOnlyTools = new Set<ReviewTool>(['highlight', 'underline'])

function kindLabel(item: Annotation): string {
  if (item.kind === 'stamp') return STAMP_SYMBOL_LABEL[item.symbol]
  if (item.kind === 'textbox') return '文'
  if (item.kind === 'callout') return '引'
  if (item.kind === 'highlight') return '亮'
  if (item.kind === 'underline') return '线'
  if (item.kind === 'stroke') return '笔'
  if (item.kind === 'pin') return '钉'
  return '?'
}

function listSummary(item: Annotation): string {
  if (item.kind === 'textbox' || item.kind === 'callout') {
    return item.text || item.comment || item.id
  }
  if (item.kind === 'highlight' || item.kind === 'underline') {
    return item.comment || item.htmlAnchor.quote || item.id
  }
  if (item.kind === 'stamp') return item.comment || STAMP_SYMBOL_LABEL[item.symbol]
  return item.comment || item.id
}

function onSurface(mode: SurfaceMode) {
  store.setSurface(mode)
}

function onTool(next: ReviewTool) {
  if (htmlOnlyTools.has(next) && store.surface.value !== 'html') {
    ElMessage.info('高亮 / 下划线仅电子答卷（HTML）可用')
    return
  }
  store.setTool(next)
  if (next === 'callout' && store.calloutDraftTip.value) {
    ElMessage.info('已有未完成引注：再点页边落框，或按 Esc 取消')
  }
}

function onStamp(symbol: StampSymbol) {
  store.setStampSymbol(symbol)
}

function onHighlightColor(color: string) {
  if (store.surface.value !== 'html') {
    ElMessage.info('高亮 / 下划线仅电子答卷（HTML）可用')
    return
  }
  store.setHighlightColor(color)
}

function isToolDisabled(next: ReviewTool): boolean {
  return htmlOnlyTools.has(next) && store.surface.value !== 'html'
}

function exportJson() {
  const text = store.exportJson()
  void navigator.clipboard.writeText(text).then(
    () => ElMessage.success('批注 JSON 已复制到剪贴板'),
    () => {
      console.log(text)
      ElMessage.info('复制失败，已输出到控制台')
    },
  )
}

function downloadJson() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `homework-annotations-${store.surface.value}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function activeSurfaceApi(): AnnotatedSurfaceExportApi | null {
  if (store.surface.value === 'html') {
    return answerContent.paperMode.value === 'vue'
      ? vueSurfaceRef.value
      : htmlSurfaceRef.value
  }
  return imagePdfSurfaceRef.value
}

async function exportPdf() {
  const api = activeSurfaceApi()
  if (!api?.getExportRoot()) {
    ElMessage.info('答卷尚未就绪，请稍后再试')
    return
  }
  if (exportingPdf.value) return
  exportingPdf.value = true
  const loading = ElMessage.info({ message: '正在导出 PDF…', duration: 0 })
  try {
    await exportAnnotatedPdf({
      surface: api,
      surfaceMode: store.surface.value,
    })
    ElMessage.success('PDF 已导出')
  } catch (error) {
    console.error(error)
    ElMessage.error('导出 PDF 失败')
  } finally {
    loading.close()
    exportingPdf.value = false
  }
}

async function saveDraft() {
  try {
    const draft = await store.saveToRepository()
    ElMessage.success(`已保存（${new Date(draft.updatedAt).toLocaleTimeString()}）`)
  } catch (error) {
    console.error(error)
    ElMessage.error('保存失败')
  }
}

async function reloadDraft() {
  try {
    const draft = await store.loadFromRepository()
    if (!draft) {
      ElMessage.info('暂无本地草稿')
      return
    }
    ElMessage.success('已从本地回显草稿')
  } catch (error) {
    console.error(error)
    ElMessage.error('加载失败')
  }
}

onMounted(() => {
  store.contentHash.value = answerContent.contentHash.value
  void store.loadFromRepository().then((draft) => {
    if (draft) ElMessage.success('已自动回显上次草稿')
  })
})

function onTogglePaperMode() {
  answerContent.togglePaperMode()
  store.contentHash.value = answerContent.contentHash.value
  ElMessage.info(`已切换为${answerContent.sourceLabel.value}`)
}
</script>

<template>
  <div class="shell">
    <header class="toolbar">
      <div class="group">
        <span class="label">载体</span>
        <button type="button" :class="{ active: store.surface.value === 'image' }" @click="onSurface('image')">图片</button>
        <button type="button" :class="{ active: store.surface.value === 'pdf' }" @click="onSurface('pdf')">PDF</button>
        <button type="button" :class="{ active: store.surface.value === 'html' }" @click="onSurface('html')">HTML</button>
      </div>
      <div class="group">
        <span class="label">工具</span>
        <button type="button" :class="{ active: store.tool.value === 'select' }" @click="onTool('select')">选中</button>
        <button
          v-for="symbol in stampSymbols"
          :key="symbol"
          type="button"
          class="stamp-btn"
          :class="{ active: store.tool.value === 'stamp' && store.stampSymbol.value === symbol }"
          :title="`图章 ${STAMP_SYMBOL_LABEL[symbol]}`"
          @click="onStamp(symbol)"
        >
          {{ STAMP_SYMBOL_LABEL[symbol] }}
        </button>
        <button type="button" :class="{ active: store.tool.value === 'textbox' }" @click="onTool('textbox')">短文本</button>
        <button
          type="button"
          :class="{ active: store.tool.value === 'callout' }"
          :title="store.calloutDraftTip.value ? '再点页边落下长文本框' : '先点问题位置，再点页边'"
          @click="onTool('callout')"
        >
          引注{{ store.calloutDraftTip.value ? '·落框' : '' }}
        </button>
        <button
          type="button"
          :class="{ active: store.tool.value === 'highlight' }"
          :disabled="isToolDisabled('highlight')"
          @click="onTool('highlight')"
        >
          高亮
        </button>
        <span class="swatch-group" title="高亮颜色">
          <button
            v-for="color in HIGHLIGHT_PRESET_COLORS"
            :key="color"
            type="button"
            class="swatch"
            :class="{
              active: store.tool.value === 'highlight' && store.highlightColor.value === color,
            }"
            :style="{ background: color }"
            :disabled="isToolDisabled('highlight')"
            :aria-label="`高亮色 ${color}`"
            @click="onHighlightColor(color)"
          />
        </span>
        <button
          type="button"
          :class="{ active: store.tool.value === 'underline' }"
          :disabled="isToolDisabled('underline')"
          @click="onTool('underline')"
        >
          下划线
        </button>
        <button type="button" :class="{ active: store.tool.value === 'pen' }" @click="onTool('pen')">画笔</button>
      </div>
      <div class="group">
        <button
          v-if="store.surface.value === 'html'"
          type="button"
          :class="{ active: answerContent.paperMode.value === 'vue' }"
          :title="answerContent.compareHint.value"
          @click="onTogglePaperMode"
        >
          试卷：{{ answerContent.sourceLabel.value }}
        </button>
        <button type="button" @click="store.generateStressPins(2000)">生成 2000 钉</button>
        <button type="button" @click="store.clearSurface()">清空当前载体</button>
        <button type="button" class="primary" @click="saveDraft">保存</button>
        <button type="button" @click="reloadDraft">重新加载</button>
        <button type="button" @click="exportJson">复制 JSON</button>
        <button type="button" @click="downloadJson">导出 JSON</button>
        <button
          type="button"
          class="primary"
          :disabled="exportingPdf"
          @click="exportPdf"
        >
          {{ exportingPdf ? '导出中…' : '导出 PDF' }}
        </button>
      </div>
      <p v-if="store.lastSavedAt.value" class="saved">
        上次保存：{{ new Date(store.lastSavedAt.value).toLocaleString() }}
      </p>
    </header>

    <div class="body">
      <main class="main">
        <VuePaperSurface
          v-if="store.surface.value === 'html' && answerContent.paperMode.value === 'vue'"
          ref="vueSurfaceRef"
        />
        <HtmlRichSurface
          v-else-if="store.surface.value === 'html'"
          ref="htmlSurfaceRef"
        />
        <ImagePdfSurface v-else ref="imagePdfSurfaceRef" />
      </main>

      <aside class="side">
        <h3>批注列表（最多显示 80）</h3>
        <p v-if="store.surface.value === 'html'" class="meta compare">
          {{ answerContent.compareHint.value }}
        </p>
        <p class="meta">当前载体共 {{ list.length }} 条</p>
        <ul class="list">
          <li
            v-for="item in windowedList"
            :key="item.id"
            :class="{ active: item.id === store.selectedId.value }"
            @click="store.select(item.id)"
          >
            <strong>{{ kindLabel(item) }}</strong>
            <span>{{ listSummary(item) }}</span>
          </li>
        </ul>

        <CommentPopover
          class="comment"
          :annotation="store.selected.value"
          :focus-token="store.focusCommentToken.value"
          @update:comment="(value) => store.selectedId.value && store.updateComment(store.selectedId.value, value)"
          @update:text="(value) => {
            if (!store.selectedId.value) return
            if (store.selected.value?.kind === 'callout') store.updateCalloutText(store.selectedId.value, value)
            else store.updateTextbox(store.selectedId.value, value)
          }"
          @update:color="(value) => store.selectedId.value && store.updateColor(store.selectedId.value, value)"
          @remove="store.selectedId.value && store.remove(store.selectedId.value)"
          @close="store.select(null)"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #eef2f7;
  color: #0f172a;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #dbe3f0;
}

.group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.label {
  font-size: 12px;
  color: #64748b;
}

.saved {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

button {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font: inherit;
}

.stamp-btn {
  min-width: 34px;
  font-weight: 700;
}

.swatch-group {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  margin-left: 2px;
}

.swatch {
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.swatch.active {
  border-color: #1d4ed8;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);
}

button.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}

button.primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 320px;
}

.main {
  min-width: 0;
  min-height: 0;
}

.side {
  border-left: 1px solid #dbe3f0;
  background: #fff;
  padding: 14px;
  overflow: auto;
}

.meta {
  margin: 4px 0 10px;
  color: #64748b;
  font-size: 12px;
}

.meta.compare {
  line-height: 1.5;
  color: #475569;
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 42vh;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.list li {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  font-size: 13px;
}

.list li.active {
  background: #eff6ff;
}

.comment {
  margin-top: 14px;
}

@media (max-width: 960px) {
  .body {
    grid-template-columns: 1fr;
  }

  .side {
    border-left: none;
    border-top: 1px solid #dbe3f0;
  }
}
</style>
