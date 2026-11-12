import { computed, ref } from 'vue'
import samplePaper from './mocks/sample-paper.json'
import type { PaperDetail } from './paperTypes'
import { hashContent, renderPaperToHtml } from './renderPaperToHtml'

export type PaperMode = 'html' | 'vue'

const paper = ref<PaperDetail>(samplePaper as PaperDetail)
const paperMode = ref<PaperMode>('vue')
const contentHtml = ref('')
const contentHash = ref('')

function refreshFromPaper() {
  const html = renderPaperToHtml(paper.value)
  contentHtml.value = html
  contentHash.value =
    paperMode.value === 'html' ? hashContent(html) : hashContent(JSON.stringify(paper.value))
}

refreshFromPaper()

export function useAnswerContent() {
  const sourceLabel = computed(() => (paperMode.value === 'vue' ? 'Vue 试卷' : 'HTML 试卷'))

  const compareHint = computed(() =>
    paperMode.value === 'vue'
      ? 'Vue：题型组件 + 题号导航，易扩展打分/折叠；划词依赖组件 DOM 文本序列。'
      : 'HTML：JSON 转字符串后 v-html，接入快、利于后端直出 HTML；题型一多难维护。',
  )

  function setPaper(next: PaperDetail) {
    paper.value = next
    refreshFromPaper()
  }

  function setPaperMode(mode: PaperMode) {
    paperMode.value = mode
    refreshFromPaper()
  }

  function useHtmlPaper() {
    setPaperMode('html')
  }

  function useVuePaper() {
    setPaperMode('vue')
  }

  function togglePaperMode() {
    setPaperMode(paperMode.value === 'vue' ? 'html' : 'vue')
  }

  return {
    paper,
    paperMode,
    sourceLabel,
    compareHint,
    contentHtml,
    contentHash,
    setPaper,
    setPaperMode,
    useHtmlPaper,
    useVuePaper,
    togglePaperMode,
  }
}
