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

const PROTECTED_SELECTORS = [
  '.callout-box',
  '.tip-handle',
  '.stamp',
  '.textbox',
  '.pin',
  '.highlight',
  '.underline',
]

const PAD_PX = 4
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const PAGE_MARGIN_MM = 8

/** Collect vertical spans of annotation chrome relative to the stage element (CSS px). */
export function collectProtectedSpans(stage: HTMLElement): VerticalSpan[] {
  const stageRect = stage.getBoundingClientRect()
  const spans: VerticalSpan[] = []

  for (const selector of PROTECTED_SELECTORS) {
    stage.querySelectorAll(selector).forEach((node) => {
      const el = node as HTMLElement
      const r = el.getBoundingClientRect()
      if (r.height <= 0 || r.width <= 0) return
      spans.push({
        top: r.top - stageRect.top - PAD_PX,
        bottom: r.bottom - stageRect.top + PAD_PX,
      })
    })
  }

  return mergeSpans(spans)
}

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
    if (cur.top <= last.bottom) {
      last.bottom = Math.max(last.bottom, cur.bottom)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/**
 * Compute source-image Y cut positions (exclusive ends of each page slice).
 * Cuts avoid interiors of protected spans (CSS px → image px via scale).
 */
export function computeSliceEnds(
  imageHeight: number,
  maxSliceHeight: number,
  protectedCss: VerticalSpan[],
  cssToImageScale: number,
): number[] {
  if (imageHeight <= 0) return [0]
  if (maxSliceHeight <= 0) return [imageHeight]

  const protectedImg = protectedCss.map((s) => ({
    top: s.top * cssToImageScale,
    bottom: s.bottom * cssToImageScale,
  }))

  const ends: number[] = []
  let cursor = 0

  while (cursor < imageHeight - 0.5) {
    let ideal = Math.min(cursor + maxSliceHeight, imageHeight)
    if (ideal >= imageHeight - 0.5) {
      ends.push(imageHeight)
      break
    }

    let cut = ideal
    const blocking = protectedImg.find((s) => cut > s.top + 0.5 && cut < s.bottom - 0.5)
    if (blocking) {
      // Prefer cutting just above the protected block.
      const above = blocking.top
      if (above > cursor + 8) {
        cut = above
      } else {
        // Block taller than remaining page: push whole block to next page if possible,
        // otherwise hard-cut at ideal to avoid infinite loop.
        const below = Math.min(blocking.bottom, imageHeight)
        if (below - cursor <= maxSliceHeight) {
          cut = below
        } else {
          cut = ideal
        }
      }
    }

    if (cut <= cursor + 1) {
      cut = Math.min(cursor + maxSliceHeight, imageHeight)
    }

    ends.push(cut)
    cursor = cut
  }

  return ends
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

/**
 * Prepare export mode → bake range marks into text → rasterize full `.stage`
 * → smart-slice into A4 PDF → download.
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

  let canvas: HTMLCanvasElement
  try {
    // Spans are relative to stage; pad shifts stage inside wrap — adjust Y by pad.top.
    const padTop = Number.parseFloat(wrap.style.paddingTop || '0') || 0
    const protectedSpans = collectProtectedSpans(root).map((s) => ({
      top: s.top + padTop,
      bottom: s.bottom + padTop,
    }))

    canvas = await domToCanvas(wrap, {
      scale,
      backgroundColor: '#ffffff',
      filter: (node) => {
        if (!(node instanceof Element)) return true
        if (node.classList.contains('hint')) return false
        if (node.classList.contains('is-preview')) return false
        return true
      },
    })

    const cssWidth = Math.max(wrap.scrollWidth, wrap.clientWidth, 1)
    const cssToImageScale = canvas.width / cssWidth

    const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2
    const contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2
    const mmPerCssPx = contentWidthMm / cssWidth
    const maxSliceCssPx = contentHeightMm / mmPerCssPx
    const maxSliceImgPx = maxSliceCssPx * cssToImageScale

    const sliceEnds = computeSliceEnds(
      canvas.height,
      maxSliceImgPx,
      protectedSpans,
      cssToImageScale,
    )

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    let yStart = 0
    for (let i = 0; i < sliceEnds.length; i++) {
      const yEnd = sliceEnds[i]
      const sliceH = Math.max(1, Math.round(yEnd - yStart))
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceH
      const ctx = sliceCanvas.getContext('2d')
      if (!ctx) throw new Error('无法创建分页画布')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
      ctx.drawImage(
        canvas,
        0,
        Math.round(yStart),
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH,
      )

      const sliceCssH = sliceH / cssToImageScale
      const drawW = contentWidthMm
      const drawH = sliceCssH * mmPerCssPx
      const dataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92)

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
