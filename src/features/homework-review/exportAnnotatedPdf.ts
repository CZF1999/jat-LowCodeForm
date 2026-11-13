import { jsPDF } from 'jspdf'
import { domToCanvas } from 'modern-screenshot'
import { bakeRangeMarks, type BakeMarkItem, type BakeRangeMarksHandle } from './bakeRangeMarks'
import { useAnnotationStore } from './useAnnotationStore'

export interface AnnotatedSurfaceExportApi {
  getExportRoot: () => HTMLElement | null
  prepareExport: () => Promise<void> | void
  restoreExport: () => void
  /** HTML/Vue content root for baking range marks into text nodes. */
  getContentRoot?: () => HTMLElement | null
  /** Recompute absolute overlays after export layout changes. */
  relayoutForExport?: () => void
}

const ROOT_OVERFLOW_KEY = 'data-export-overflow'
const ROOT_HEIGHT_KEY = 'data-export-height'
const STAGE_MIN_HEIGHT_KEY = 'data-export-min-height'

/** Expand scroll parent so the stage is not clipped while capturing. */
export function beginExportRootLayout(root: HTMLElement | null) {
  if (!root) return
  root.setAttribute(ROOT_OVERFLOW_KEY, root.style.overflow)
  root.setAttribute(ROOT_HEIGHT_KEY, root.style.height)
  root.style.overflow = 'visible'
  root.style.height = 'auto'
}

/** Grow stage min-height so overflowing callout/textbox chrome stays inside the capture box. */
export function expandStageForOverflow(stage: HTMLElement | null) {
  if (!stage) return
  const stageRect = stage.getBoundingClientRect()
  let maxBottom = Math.max(stage.scrollHeight, stage.offsetHeight)
  stage
    .querySelectorAll('.callout-box, .textbox, .stamp, .tip-handle, .pin, .highlight, .underline')
    .forEach((node) => {
      const r = (node as HTMLElement).getBoundingClientRect()
      maxBottom = Math.max(maxBottom, r.bottom - stageRect.top + 8)
    })
  stage.setAttribute(STAGE_MIN_HEIGHT_KEY, stage.style.minHeight)
  if (maxBottom > stage.offsetHeight + 0.5) {
    stage.style.minHeight = `${Math.ceil(maxBottom)}px`
  }
}

export function endExportRootLayout(root: HTMLElement | null, stage: HTMLElement | null) {
  if (root) {
    root.style.overflow = root.getAttribute(ROOT_OVERFLOW_KEY) ?? ''
    root.style.height = root.getAttribute(ROOT_HEIGHT_KEY) ?? ''
    root.removeAttribute(ROOT_OVERFLOW_KEY)
    root.removeAttribute(ROOT_HEIGHT_KEY)
  }
  if (stage) {
    stage.style.minHeight = stage.getAttribute(STAGE_MIN_HEIGHT_KEY) ?? ''
    stage.removeAttribute(STAGE_MIN_HEIGHT_KEY)
  }
}

export interface VerticalSpan {
  top: number
  bottom: number
}

/** Skip text inside annotation chrome / overlay when collecting paper text lines. */
const SKIP_TEXT_CLOSEST =
  '.callout-box, .textbox, .stamp, .tip-handle, .pin, .mark-layer, .callout-layer, .marker-layer'

/**
 * Unbreakable paper blocks (include padding/border). Topic sections may still
 * span pages — we do NOT protect whole `.topic-block` / `#box_*`.
 */
export const ATOMIC_BLOCK_SELECTOR =
  '.option, .topic-type, .ks-box, .zq-box, .answer-table, .exam-scope'

/** Safety pad so subpixel / scale rounding does not miss an ink line or border. */
const SPAN_PAD_PX = 2
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const PAGE_MARGIN_MM = 8

/**
 * Collect visual text-line boxes from paper content (CSS px, relative to `origin`).
 * Prefer `origin` = capture wrap so coordinates match the screenshot bitmap.
 * Skips text inside annotation chrome and inside atomic bordered blocks.
 */
export function collectTextLineSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
): VerticalSpan[] {
  const originRect = origin.getBoundingClientRect()
  const spans: VerticalSpan[] = []
  const walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()

  while (current) {
    const text = current as Text
    const raw = text.data
    if (!raw || !raw.trim()) {
      current = walker.nextNode()
      continue
    }
    const parent = text.parentElement
    if (parent?.closest(SKIP_TEXT_CLOSEST) || parent?.closest(ATOMIC_BLOCK_SELECTOR)) {
      current = walker.nextNode()
      continue
    }

    const range = document.createRange()
    range.selectNodeContents(text)
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue
      spans.push({
        top: rect.top - originRect.top - SPAN_PAD_PX,
        bottom: rect.bottom - originRect.top + SPAN_PAD_PX,
      })
    }
    current = walker.nextNode()
  }

  return mergeSpans(spans)
}

/** Full element boxes for bordered / titled units that must not be sliced. */
export function collectAtomicBlockSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
): VerticalSpan[] {
  const originRect = origin.getBoundingClientRect()
  const spans: VerticalSpan[] = []
  contentRoot.querySelectorAll(ATOMIC_BLOCK_SELECTOR).forEach((node) => {
    const el = node as HTMLElement
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    spans.push({
      top: rect.top - originRect.top - SPAN_PAD_PX,
      bottom: rect.bottom - originRect.top + SPAN_PAD_PX,
    })
  })
  return mergeSpans(spans)
}

/**
 * Protected Y spans for PDF slicing: atomic bordered blocks + text lines outside them.
 */
export function collectProtectedSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
): VerticalSpan[] {
  return mergeSpans([
    ...collectAtomicBlockSpans(contentRoot, origin),
    ...collectTextLineSpans(contentRoot, origin),
  ])
}

/** Merge only strictly overlapping ranges; touching endpoints stay separate for cut gaps. */
export function mergeSpans(spans: VerticalSpan[]): VerticalSpan[] {
  if (spans.length === 0) return []
  const sorted = spans
    .map((s) => ({
      top: Math.min(s.top, s.bottom),
      bottom: Math.max(s.top, s.bottom),
    }))
    .sort((a, b) => a.top - b.top)

  const out: VerticalSpan[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    if (cur.top < last.bottom) {
      last.bottom = Math.max(last.bottom, cur.bottom)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/**
 * Pack page end Y positions (exclusive) so cuts avoid protected span interiors.
 * When `cssToImageScale === 1`, units are CSS px (preferred for per-page capture).
 */
export function computeSliceEnds(
  contentHeight: number,
  maxPageHeight: number,
  protectedCss: VerticalSpan[],
  cssToImageScale: number,
): number[] {
  if (contentHeight <= 0) return [0]
  if (maxPageHeight <= 0) return [contentHeight]

  const protectedScaled = protectedCss.map((s) => ({
    top: s.top * cssToImageScale,
    bottom: s.bottom * cssToImageScale,
  }))

  const ends: number[] = []
  let cursor = 0

  while (cursor < contentHeight - 0.5) {
    let ideal = Math.min(cursor + maxPageHeight, contentHeight)
    if (ideal >= contentHeight - 0.5) {
      ends.push(contentHeight)
      break
    }

    let cut = ideal
    const blocking = protectedScaled.find((s) => cut > s.top + 0.5 && cut < s.bottom - 0.5)
    if (blocking) {
      const above = blocking.top
      const below = Math.min(blocking.bottom, contentHeight)
      if (above > cursor + 8) {
        cut = above
      } else if (below - cursor <= maxPageHeight + 0.5) {
        cut = below
      } else if (above > cursor + 1) {
        cut = above
      } else {
        cut = ideal
      }
    }

    if (cut <= cursor + 1) {
      cut = Math.min(cursor + maxPageHeight, contentHeight)
    }

    ends.push(cut)
    cursor = cut
  }

  return ends
}

/** CSS-px page ends from protected spans (no bitmap scale). */
export function packPageEnds(
  cssHeight: number,
  maxPageCssPx: number,
  protectedCss: VerticalSpan[],
): number[] {
  return computeSliceEnds(cssHeight, maxPageCssPx, protectedCss, 1)
}

function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(() => step(left - 1))
    }
    step(count)
  })
}

/** Reset scroll on the stage and overflow ancestors so capture origin is stable. */
export function resetScrollAncestors(from: HTMLElement | null) {
  let el: HTMLElement | null = from
  while (el) {
    if (el.scrollTop || el.scrollLeft) {
      el.scrollTop = 0
      el.scrollLeft = 0
    }
    el = el.parentElement
  }
  window.scrollTo(0, 0)
}

function collectBakeItems(): BakeMarkItem[] {
  const store = useAnnotationStore()
  const items: BakeMarkItem[] = []
  for (const mark of store.highlights.value) {
    if (mark.surface !== 'html') continue
    items.push({
      kind: 'highlight',
      start: mark.htmlAnchor.start,
      end: mark.htmlAnchor.end,
      color: mark.color,
    })
  }
  for (const mark of store.underlines.value) {
    if (mark.surface !== 'html') continue
    items.push({
      kind: 'underline',
      start: mark.htmlAnchor.start,
      end: mark.htmlAnchor.end,
      color: mark.color,
    })
  }
  return items
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Padding needed so absolutely positioned annotation chrome is inside the capture box. */
export function measureCapturePad(stage: HTMLElement): {
  top: number
  right: number
  bottom: number
  left: number
} {
  const stageRect = stage.getBoundingClientRect()
  let minL = 0
  let minT = 0
  let maxR = stage.offsetWidth
  let maxB = Math.max(stage.scrollHeight, stage.offsetHeight)

  stage
    .querySelectorAll('.callout-box, .textbox, .stamp, .tip-handle, .pin, .highlight, .underline')
    .forEach((node) => {
      const r = (node as HTMLElement).getBoundingClientRect()
      minL = Math.min(minL, r.left - stageRect.left)
      minT = Math.min(minT, r.top - stageRect.top)
      maxR = Math.max(maxR, r.right - stageRect.left)
      maxB = Math.max(maxB, r.bottom - stageRect.top)
    })

  return {
    top: Math.max(0, Math.ceil(-minT + 4)),
    left: Math.max(0, Math.ceil(-minL + 4)),
    right: Math.max(0, Math.ceil(maxR - stage.offsetWidth + 4)),
    bottom: Math.max(0, Math.ceil(maxB - Math.max(stage.scrollHeight, stage.offsetHeight) + 4)),
  }
}

function wrapStageForCapture(stage: HTMLElement): {
  wrap: HTMLElement
  unwrap: () => void
} {
  const pad = measureCapturePad(stage)
  const parent = stage.parentElement
  if (!parent) {
    return { wrap: stage, unwrap: () => undefined }
  }

  const wrap = document.createElement('div')
  wrap.dataset.exportCaptureWrap = '1'
  wrap.style.display = 'inline-block'
  wrap.style.boxSizing = 'content-box'
  wrap.style.background = '#ffffff'
  wrap.style.padding = `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`
  parent.insertBefore(wrap, stage)
  wrap.appendChild(stage)

  return {
    wrap,
    unwrap: () => {
      parent.insertBefore(stage, wrap)
      wrap.remove()
    },
  }
}

export interface ExportAnnotatedPdfOptions {
  surface: AnnotatedSurfaceExportApi
  surfaceMode: string
  scale?: number
}

function screenshotFilter(node: Node): boolean {
  if (!(node instanceof Element)) return true
  if (node.classList.contains('hint')) return false
  if (node.classList.contains('is-preview')) return false
  return true
}

/**
 * Clip `source` into a fixed-height viewport and screenshot one CSS page band.
 * Uses translateY so cuts happen between packed ranges — not mid-bitmap slicing.
 */
async function captureCssPageBand(
  source: HTMLElement,
  y0: number,
  y1: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const pageH = Math.max(1, y1 - y0)
  const pageW = Math.max(source.scrollWidth, source.clientWidth, 1)
  const parent = source.parentElement
  if (!parent) {
    throw new Error('导出截图容器缺少父节点')
  }

  const viewport = document.createElement('div')
  viewport.dataset.exportPageViewport = '1'
  viewport.style.cssText = [
    'overflow:hidden',
    'position:relative',
    'background:#ffffff',
    `width:${pageW}px`,
    `height:${pageH}px`,
    'box-sizing:border-box',
  ].join(';')

  const prevTransform = source.style.transform
  const prevWillChange = source.style.willChange

  parent.insertBefore(viewport, source)
  viewport.appendChild(source)
  source.style.transform = `translateY(${-y0}px)`
  source.style.willChange = 'transform'

  try {
    await waitFrames(1)
    return await domToCanvas(viewport, {
      scale,
      width: pageW,
      height: pageH,
      backgroundColor: '#ffffff',
      filter: screenshotFilter,
    })
  } finally {
    source.style.transform = prevTransform
    source.style.willChange = prevWillChange
    parent.insertBefore(source, viewport)
    viewport.remove()
  }
}

/**
 * Prepare export → bake marks → CSS-pack pages at protected gaps →
 * per-page screenshot into A4 PDF → download.
 */
export async function exportAnnotatedPdf(options: ExportAnnotatedPdfOptions): Promise<void> {
  const { surface, surfaceMode } = options
  const scale = options.scale ?? Math.min(2, Math.max(1.5, window.devicePixelRatio || 2))

  await surface.prepareExport()
  await waitFrames(2)

  const root = surface.getExportRoot()
  if (!root) {
    surface.restoreExport()
    throw new Error('导出根节点不存在')
  }

  resetScrollAncestors(root)
  surface.relayoutForExport?.()
  await waitFrames(1)

  let bakeHandle: BakeRangeMarksHandle | null = null
  const contentRoot = surface.getContentRoot?.() ?? null
  if (contentRoot) {
    const bakeItems = collectBakeItems()
    if (bakeItems.length > 0) {
      bakeHandle = bakeRangeMarks(contentRoot, bakeItems)
      root.classList.add('is-baking-marks')
      await waitFrames(1)
    }
  }

  // Re-measure pad after bake (expanded underlines/highlights may change overflow).
  expandStageForOverflow(root)
  const { wrap, unwrap } = wrapStageForCapture(root)
  await waitFrames(1)

  try {
    const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2
    const contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2
    const textRoot = contentRoot ?? root

    const cssWidth = Math.max(wrap.scrollWidth, wrap.clientWidth, 1)
    const cssHeight = Math.max(wrap.scrollHeight, wrap.clientHeight, 1)
    const mmPerCssPx = contentWidthMm / cssWidth
    const maxPageCssPx = contentHeightMm / mmPerCssPx

    // Pack in CSS space first — cuts only at gaps between unbreakable units.
    const protectedSpans = collectProtectedSpans(textRoot, wrap)
    const pageEnds = packPageEnds(cssHeight, maxPageCssPx, protectedSpans)

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    let yStart = 0
    for (let i = 0; i < pageEnds.length; i++) {
      const yEnd = pageEnds[i]
      const pageCssH = Math.max(1, yEnd - yStart)
      const pageCanvas = await captureCssPageBand(wrap, yStart, yEnd, scale)

      const drawW = contentWidthMm
      const drawH = pageCssH * mmPerCssPx
      const dataUrl = pageCanvas.toDataURL('image/jpeg', 0.92)

      if (i > 0) pdf.addPage()
      pdf.addImage(dataUrl, 'JPEG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, drawW, drawH)

      yStart = yEnd
    }

    const blob = pdf.output('blob')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadBlob(blob, `homework-annotated-${surfaceMode}-${stamp}.pdf`)
  } finally {
    bakeHandle?.restore()
    root.classList.remove('is-baking-marks')
    unwrap()
    surface.restoreExport()
  }
}
