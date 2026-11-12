import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  boxMetrics,
  caretOffsetFromPoint,
  clientRectsForRange,
  offsetToRange,
  rangeToOffsets,
  stageRelativeFromClientRect,
} from './htmlRange'
import { useAnnotationStore } from './useAnnotationStore'
import { useSpatialIndex } from './useSpatialIndex'
import type {
  CalloutAnnotation,
  HighlightRect,
  PinAnnotation,
  StampAnnotation,
  TextboxAnnotation,
  UnderlineRect,
} from './types'

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

/** Shared HTML-surface annotation stage; coords are relative to content box. */
export function useHtmlAnnotationStage(extraWatchSources: Array<() => unknown> = []) {
  const store = useAnnotationStore()
  const rootRef = ref<HTMLElement | null>(null)
  const stageRef = ref<HTMLElement | null>(null)
  /** Outer shell that owns overlay size (excludes stage gutter padding). */
  const contentBoxRef = ref<HTMLElement | null>(null)
  /** Text root for TreeWalker / HtmlAnchor. */
  const contentRef = ref<HTMLElement | null>(null)
  const size = ref({ width: 720, height: 900 })
  const positionedPins = shallowRef<PinAnnotation[]>([])
  const positionedStamps = shallowRef<StampAnnotation[]>([])
  const positionedTextboxes = shallowRef<TextboxAnnotation[]>([])
  const positionedCallouts = shallowRef<CalloutAnnotation[]>([])
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

  function measureContent() {
    const box = contentBoxRef.value
    if (!box) return
    const { width, height } = boxMetrics(box)
    size.value = { width, height }
  }

  function toNorm(event: PointerEvent) {
    const box = contentBoxRef.value
    if (!box) return { x: 0, y: 0 }
    measureContent()
    const { rect } = boxMetrics(box)
    const width = Math.max(size.value.width, 1)
    const height = Math.max(size.value.height, 1)
    return {
      x: clamp01((event.clientX - rect.left) / width),
      y: clamp01((event.clientY - rect.top) / height),
    }
  }

  function resolvePointFromAnchor(
    anchor: { start: number; end: number } | undefined,
    fallbackX: number,
    fallbackY: number,
  ) {
    const root = contentRef.value
    const box = contentBoxRef.value
    if (!root || !box || !anchor) return { x: fallbackX, y: fallbackY }
    const range = offsetToRange(root, anchor.start, Math.max(anchor.end, anchor.start + 1))
    if (!range) return { x: fallbackX, y: fallbackY }
    const rect = range.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return { x: fallbackX, y: fallbackY }
    const rel = stageRelativeFromClientRect(box, rect)
    return { x: clamp01(rel.x), y: clamp01(rel.y) }
  }

  function layoutPins() {
    const root = contentRef.value
    const box = contentBoxRef.value
    if (!root || !box) return
    measureContent()

    positionedPins.value = htmlPins.value.map((pin) => {
      if (pin.htmlAnchor) {
        const point = resolvePointFromAnchor(pin.htmlAnchor, pin.x ?? 0.5, pin.y ?? 0.5)
        return { ...pin, x: point.x, y: point.y }
      }
      return { ...pin, x: pin.x ?? 0.5, y: pin.y ?? 0.5 }
    })
  }

  /** Paint always uses stored coords (paper-relative); no text-anchor reflow for point marks. */
  function layoutPointAnnotations() {
    positionedStamps.value = htmlStamps.value.map((item) => ({ ...item }))
    positionedTextboxes.value = htmlTextboxes.value.map((item) => ({ ...item }))
    positionedCallouts.value = htmlCallouts.value.map((item) => ({ ...item }))
  }

  function layoutRangeMarks(
    items: Array<{ id: string; htmlAnchor: { start: number; end: number }; color?: string }>,
    mode: 'underline' | 'highlight',
  ) {
    const root = contentRef.value
    const box = contentBoxRef.value
    if (!root || !box) return [] as Array<UnderlineRect | HighlightRect>
    const next: Array<UnderlineRect | HighlightRect> = []
    for (const item of items) {
      const range = offsetToRange(root, item.htmlAnchor.start, item.htmlAnchor.end)
      if (!range) continue
      const rects = clientRectsForRange(root, range)
      for (const rect of rects) {
        if (rect.width <= 0 || rect.height <= 0) continue
        const rel = stageRelativeFromClientRect(box, rect)
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
    layoutPointAnnotations()
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
    const box = contentBoxRef.value
    if (!root || !box) {
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
    previewRects.value = clientRectsForRange(root, range).map((rect) => {
        const rel = stageRelativeFromClientRect(box, rect)
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
      console.log('offset', offset)
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
    console.log('offset', offset)
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
      const result = store.addHighlight({
        htmlAnchor: anchor,
        comment: '',
        color: store.highlightColor.value,
      })
      if (!result.created) {
        ElMessage.info('该区域已有高亮')
      }
    } else if (store.tool.value === 'underline') {
      const result = store.addUnderline({
        htmlAnchor: anchor,
        comment: '',
        color: '#ef4444',
      })
      if (!result.created) {
        ElMessage.info('该区域已有下划线')
      }
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

  function onResize() {
    layoutAll()
    void refreshVisible()
  }

  onMounted(() => {
    layoutAll()
    void refreshVisible()
    rootRef.value?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
  })

  onUnmounted(() => {
    rootRef.value?.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
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
      ...extraWatchSources,
    ],
    async () => {
      await nextTick()
      layoutAll()
      await refreshVisible()
    },
    { immediate: true },
  )

  return {
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
    layoutAll,
    refreshVisible,
  }
}

export type HtmlAnnotationStage = ReturnType<typeof useHtmlAnnotationStage>
export type StageElRef = Ref<HTMLElement | null>
