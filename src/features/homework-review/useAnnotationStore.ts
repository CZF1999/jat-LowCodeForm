import { computed, ref, shallowRef } from 'vue'
import {
  DEMO_CONTENT_HASH,
  DEMO_HOMEWORK_ID,
  loadDraft,
  saveDraft,
} from './annotationRepository'
import { anchorsOverlap } from './htmlAnchorOverlap'
import type {
  Annotation,
  AnnotationDraft,
  CalloutAnnotation,
  CalloutDraftTip,
  HighlightAnnotation,
  HtmlAnchor,
  PinAnnotation,
  ReviewTool,
  StampAnnotation,
  StampSymbol,
  StrokeAnnotation,
  SurfaceMode,
  TextboxAnnotation,
  UnderlineAnnotation,
} from './types'

export type AddRangeMarkResult<T> = {
  annotation: T
  /** False when rejected due to overlap with an existing same-kind mark. */
  created: boolean
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

const annotations = shallowRef<Annotation[]>([])
const selectedId = ref<string | null>(null)
const tool = ref<ReviewTool>('select')
const stampSymbol = ref<StampSymbol>('correct')
const highlightColor = ref('#facc15')
const surface = ref<SurfaceMode>('html')
const scale = ref(1)
const homeworkId = ref(DEMO_HOMEWORK_ID)
const contentHash = ref(DEMO_CONTENT_HASH)
const lastSavedAt = ref<number | null>(null)
/** Signal sidebar comment input to focus after create */
const focusCommentToken = ref(0)
/** First click of callout tool: tip awaiting box placement */
const calloutDraftTip = ref<CalloutDraftTip | null>(null)
const calloutPreview = ref<CalloutDraftTip | null>(null)

export function useAnnotationStore() {
  const selected = computed(() =>
    annotations.value.find((item) => item.id === selectedId.value) ?? null,
  )

  const pins = computed(() =>
    annotations.value.filter((item): item is PinAnnotation => item.kind === 'pin'),
  )

  const stamps = computed(() =>
    annotations.value.filter((item): item is StampAnnotation => item.kind === 'stamp'),
  )

  const textboxes = computed(() =>
    annotations.value.filter((item): item is TextboxAnnotation => item.kind === 'textbox'),
  )

  const callouts = computed(() =>
    annotations.value.filter((item): item is CalloutAnnotation => item.kind === 'callout'),
  )

  const strokes = computed(() =>
    annotations.value.filter((item): item is StrokeAnnotation => item.kind === 'stroke'),
  )

  const underlines = computed(() =>
    annotations.value.filter((item): item is UnderlineAnnotation => item.kind === 'underline'),
  )

  const highlights = computed(() =>
    annotations.value.filter((item): item is HighlightAnnotation => item.kind === 'highlight'),
  )

  const surfaceAnnotations = computed(() =>
    annotations.value.filter((item) => item.surface === surface.value),
  )

  function setSurface(next: SurfaceMode) {
    surface.value = next
    selectedId.value = null
    cancelCalloutDraft()
    if (next !== 'html' && (tool.value === 'highlight' || tool.value === 'underline')) {
      tool.value = 'select'
    }
  }

  function setTool(next: ReviewTool) {
    if (next !== 'callout') cancelCalloutDraft()
    tool.value = next
  }

  function setStampSymbol(next: StampSymbol) {
    cancelCalloutDraft()
    stampSymbol.value = next
    tool.value = 'stamp'
  }

  function setHighlightColor(color: string) {
    cancelCalloutDraft()
    highlightColor.value = color
    tool.value = 'highlight'
  }

  function beginCallout(tip: CalloutDraftTip) {
    calloutDraftTip.value = tip
    calloutPreview.value = tip
  }

  function updateCalloutPreview(point: CalloutDraftTip | null) {
    calloutPreview.value = point
  }

  function cancelCalloutDraft() {
    calloutDraftTip.value = null
    calloutPreview.value = null
  }

  function finishCallout(
    box: CalloutDraftTip,
    partial: Omit<CalloutAnnotation, 'id' | 'kind' | 'createdAt' | 'tipX' | 'tipY' | 'boxX' | 'boxY'> & {
      id?: string
      tipX?: number
      tipY?: number
      boxX?: number
      boxY?: number
      tipHtmlAnchor?: CalloutAnnotation['tipHtmlAnchor']
    },
  ) {
    const tip = calloutDraftTip.value
    if (!tip) return null
    const callout = addCallout({
      ...partial,
      tipX: tip.x,
      tipY: tip.y,
      tipHtmlAnchor: partial.tipHtmlAnchor ?? tip.htmlAnchor,
      boxX: box.x,
      boxY: box.y,
    })
    cancelCalloutDraft()
    return callout
  }

  function select(id: string | null) {
    selectedId.value = id
  }

  function requestCommentFocus() {
    focusCommentToken.value += 1
  }

  function addPin(partial: Omit<PinAnnotation, 'id' | 'kind' | 'createdAt'> & { id?: string }) {
    const pin: PinAnnotation = {
      id: partial.id ?? uid('pin'),
      kind: 'pin',
      createdAt: Date.now(),
      color: partial.color ?? '#3b82f6',
      comment: partial.comment ?? '',
      surface: partial.surface,
      pageIndex: partial.pageIndex,
      x: partial.x,
      y: partial.y,
      htmlAnchor: partial.htmlAnchor,
    }
    annotations.value = [...annotations.value, pin]
    selectedId.value = pin.id
    return pin
  }

  function addStamp(partial: Omit<StampAnnotation, 'id' | 'kind' | 'createdAt'> & { id?: string }) {
    const stamp: StampAnnotation = {
      id: partial.id ?? uid('stamp'),
      kind: 'stamp',
      createdAt: Date.now(),
      color: partial.color ?? stampColor(partial.symbol),
      comment: partial.comment ?? '',
      surface: partial.surface,
      pageIndex: partial.pageIndex,
      x: partial.x,
      y: partial.y,
      symbol: partial.symbol,
      htmlAnchor: partial.htmlAnchor,
    }
    annotations.value = [...annotations.value, stamp]
    selectedId.value = stamp.id
    requestCommentFocus()
    return stamp
  }

  function addTextbox(
    partial: Omit<TextboxAnnotation, 'id' | 'kind' | 'createdAt'> & { id?: string },
  ) {
    const textbox: TextboxAnnotation = {
      id: partial.id ?? uid('textbox'),
      kind: 'textbox',
      createdAt: Date.now(),
      color: partial.color ?? '#b45309',
      comment: partial.comment ?? '',
      surface: partial.surface,
      pageIndex: partial.pageIndex,
      x: partial.x,
      y: partial.y,
      text: partial.text ?? '',
      htmlAnchor: partial.htmlAnchor,
    }
    annotations.value = [...annotations.value, textbox]
    selectedId.value = textbox.id
    requestCommentFocus()
    return textbox
  }

  function addCallout(
    partial: Omit<CalloutAnnotation, 'id' | 'kind' | 'createdAt'> & { id?: string },
  ) {
    const callout: CalloutAnnotation = {
      id: partial.id ?? uid('callout'),
      kind: 'callout',
      createdAt: Date.now(),
      color: partial.color ?? '#2563eb',
      comment: partial.comment ?? '',
      surface: partial.surface,
      pageIndex: partial.pageIndex,
      tipX: partial.tipX,
      tipY: partial.tipY,
      tipHtmlAnchor: partial.tipHtmlAnchor,
      boxX: partial.boxX,
      boxY: partial.boxY,
      text: partial.text ?? '',
      boxWidth: partial.boxWidth ?? 200,
    }
    annotations.value = [...annotations.value, callout]
    selectedId.value = callout.id
    requestCommentFocus()
    return callout
  }

  function addStroke(partial: Omit<StrokeAnnotation, 'id' | 'kind' | 'createdAt'> & { id?: string }) {
    const stroke: StrokeAnnotation = {
      id: partial.id ?? uid('stroke'),
      kind: 'stroke',
      createdAt: Date.now(),
      color: partial.color ?? '#ef4444',
      comment: partial.comment ?? '',
      surface: partial.surface,
      pageIndex: partial.pageIndex,
      points: partial.points,
    }
    annotations.value = [...annotations.value, stroke]
    selectedId.value = stroke.id
    return stroke
  }

  function findOverlappingRangeMark(
    kind: 'highlight' | 'underline',
    anchor: HtmlAnchor,
  ): HighlightAnnotation | UnderlineAnnotation | null {
    const hit = annotations.value.find((item) => {
      if (item.kind !== kind || item.surface !== 'html') return false
      return anchorsOverlap(item.htmlAnchor, anchor)
    })
    return (hit as HighlightAnnotation | UnderlineAnnotation | undefined) ?? null
  }

  function addUnderline(
    partial: Omit<UnderlineAnnotation, 'id' | 'kind' | 'createdAt' | 'surface'> & {
      id?: string
      surface?: 'html'
    },
  ): AddRangeMarkResult<UnderlineAnnotation> {
    const existing = findOverlappingRangeMark('underline', partial.htmlAnchor)
    if (existing && existing.kind === 'underline') {
      selectedId.value = existing.id
      return { annotation: existing, created: false }
    }
    const underline: UnderlineAnnotation = {
      id: partial.id ?? uid('underline'),
      kind: 'underline',
      surface: 'html',
      createdAt: Date.now(),
      color: partial.color ?? '#ef4444',
      comment: partial.comment ?? '',
      htmlAnchor: partial.htmlAnchor,
    }
    annotations.value = [...annotations.value, underline]
    selectedId.value = underline.id
    requestCommentFocus()
    return { annotation: underline, created: true }
  }

  function addHighlight(
    partial: Omit<HighlightAnnotation, 'id' | 'kind' | 'createdAt' | 'surface'> & {
      id?: string
      surface?: 'html'
    },
  ): AddRangeMarkResult<HighlightAnnotation> {
    const existing = findOverlappingRangeMark('highlight', partial.htmlAnchor)
    if (existing && existing.kind === 'highlight') {
      selectedId.value = existing.id
      return { annotation: existing, created: false }
    }
    const highlight: HighlightAnnotation = {
      id: partial.id ?? uid('highlight'),
      kind: 'highlight',
      surface: 'html',
      createdAt: Date.now(),
      color: partial.color ?? highlightColor.value,
      comment: partial.comment ?? '',
      htmlAnchor: partial.htmlAnchor,
    }
    annotations.value = [...annotations.value, highlight]
    selectedId.value = highlight.id
    requestCommentFocus()
    return { annotation: highlight, created: true }
  }

  function updateComment(id: string, comment: string) {
    annotations.value = annotations.value.map((item) =>
      item.id === id ? { ...item, comment } : item,
    )
  }

  function updateColor(id: string, color: string) {
    annotations.value = annotations.value.map((item) =>
      item.id === id ? { ...item, color } : item,
    )
  }

  function updateTextbox(id: string, text: string) {
    annotations.value = annotations.value.map((item) =>
      item.id === id && item.kind === 'textbox' ? { ...item, text } : item,
    )
  }

  function updateCalloutText(id: string, text: string) {
    annotations.value = annotations.value.map((item) =>
      item.id === id && item.kind === 'callout' ? { ...item, text: text.slice(0, 200) } : item,
    )
  }

  function clamp01(n: number) {
    return Math.min(1, Math.max(0, n))
  }

  function updateStampPosition(id: string, x: number, y: number) {
    const nx = clamp01(x)
    const ny = clamp01(y)
    annotations.value = annotations.value.map((item) =>
      item.id === id && item.kind === 'stamp'
        ? { ...item, x: nx, y: ny, htmlAnchor: undefined }
        : item,
    )
  }

  function updateTextboxPosition(id: string, x: number, y: number) {
    const nx = clamp01(x)
    const ny = clamp01(y)
    annotations.value = annotations.value.map((item) =>
      item.id === id && item.kind === 'textbox'
        ? { ...item, x: nx, y: ny, htmlAnchor: undefined }
        : item,
    )
  }

  function updateCalloutTip(id: string, tipX: number, tipY: number) {
    const nx = clamp01(tipX)
    const ny = clamp01(tipY)
    annotations.value = annotations.value.map((item) =>
      item.id === id && item.kind === 'callout'
        ? { ...item, tipX: nx, tipY: ny, tipHtmlAnchor: undefined }
        : item,
    )
  }

  function updateCalloutBox(id: string, boxX: number, boxY: number) {
    const nx = clamp01(boxX)
    const ny = clamp01(boxY)
    annotations.value = annotations.value.map((item) =>
      item.id === id && item.kind === 'callout' ? { ...item, boxX: nx, boxY: ny } : item,
    )
  }

  function remove(id: string) {
    annotations.value = annotations.value.filter((item) => item.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function clearSurface() {
    annotations.value = annotations.value.filter((item) => item.surface !== surface.value)
    selectedId.value = null
    cancelCalloutDraft()
  }

  function clearAll() {
    annotations.value = []
    selectedId.value = null
    cancelCalloutDraft()
  }

  function generateStressPins(count = 2000) {
    const mode = surface.value
    const next: Annotation[] = []
    for (let i = 0; i < count; i++) {
      if (mode === 'html') {
        next.push({
          id: uid('stress'),
          kind: 'pin',
          surface: 'html',
          createdAt: Date.now(),
          color: '#3b82f6',
          comment: `压力钉 #${i + 1}`,
          htmlAnchor: {
            start: (i * 7) % 400,
            end: (i * 7) % 400 + 4,
            quote: `样本${i}`,
          },
          x: (i % 40) / 40,
          y: (Math.floor(i / 40) % 50) / 50,
        })
      } else {
        next.push({
          id: uid('stress'),
          kind: 'pin',
          surface: mode,
          pageIndex: 0,
          createdAt: Date.now(),
          color: '#3b82f6',
          comment: `压力钉 #${i + 1}`,
          x: Math.random(),
          y: Math.random(),
        })
      }
    }
    annotations.value = [
      ...annotations.value.filter((item) => item.surface !== mode),
      ...next,
    ]
  }

  function serialize(): AnnotationDraft {
    return {
      homeworkId: homeworkId.value,
      contentHash: contentHash.value,
      surface: surface.value,
      annotations: annotations.value,
      updatedAt: Date.now(),
    }
  }

  function hydrate(draft: AnnotationDraft) {
    annotations.value = draft.annotations ?? []
    if (draft.surface) surface.value = draft.surface
    if (draft.contentHash) contentHash.value = draft.contentHash
    homeworkId.value = draft.homeworkId || homeworkId.value
    selectedId.value = null
    lastSavedAt.value = draft.updatedAt ?? null
    cancelCalloutDraft()
  }

  async function saveToRepository(): Promise<AnnotationDraft> {
    const draft = serialize()
    await saveDraft(draft)
    lastSavedAt.value = draft.updatedAt
    return draft
  }

  async function loadFromRepository(): Promise<AnnotationDraft | null> {
    const draft = await loadDraft(homeworkId.value)
    if (!draft) return null
    hydrate(draft)
    return draft
  }

  function exportJson(): string {
    return JSON.stringify(serialize(), null, 2)
  }

  return {
    annotations,
    selectedId,
    selected,
    tool,
    stampSymbol,
    highlightColor,
    surface,
    scale,
    homeworkId,
    contentHash,
    lastSavedAt,
    focusCommentToken,
    calloutDraftTip,
    calloutPreview,
    pins,
    stamps,
    textboxes,
    callouts,
    strokes,
    underlines,
    highlights,
    surfaceAnnotations,
    setSurface,
    setTool,
    setStampSymbol,
    setHighlightColor,
    beginCallout,
    updateCalloutPreview,
    cancelCalloutDraft,
    finishCallout,
    select,
    requestCommentFocus,
    addPin,
    addStamp,
    addTextbox,
    addCallout,
    addStroke,
    addUnderline,
    addHighlight,
    updateComment,
    updateColor,
    updateTextbox,
    updateCalloutText,
    updateStampPosition,
    updateTextboxPosition,
    updateCalloutTip,
    updateCalloutBox,
    remove,
    clearSurface,
    clearAll,
    generateStressPins,
    serialize,
    hydrate,
    saveToRepository,
    loadFromRepository,
    exportJson,
  }
}

function stampColor(symbol: StampSymbol): string {
  if (symbol === 'correct') return '#16a34a'
  if (symbol === 'wrong') return '#dc2626'
  if (symbol === 'half') return '#ea580c'
  return '#2563eb'
}
