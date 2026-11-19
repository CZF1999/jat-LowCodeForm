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
/** Bordered units only — stems/answer rows use line spans so questions can span pages. */
export const ATOMIC_BLOCK_SELECTOR =
  '.option, .topic-type, .ks-box, .zq-box, .answer-table, .exam-scope'

/** Media / table boxes that must not be sliced through the middle. */
export const MEDIA_BLOCK_SELECTOR = 'img, figure, table'

/**
 * Annotation chrome boxes protected as atomic units (borders stay intact).
 * Text inside these is still skipped by collectTextLineSpans via SKIP_TEXT_CLOSEST.
 */
export const ANNOTATION_BOX_SELECTOR = '.callout-box, .textbox'

/** Any selector whose box is collected as an unbreakable protected span. */
export const UNBREAKABLE_BOX_SELECTOR = [
  ATOMIC_BLOCK_SELECTOR,
  MEDIA_BLOCK_SELECTOR,
  ANNOTATION_BOX_SELECTOR,
].join(', ')

/** Safety pad so subpixel / scale rounding does not miss an ink line or border. */
const SPAN_PAD_PX = 2
/** Extra pad for bordered atomic/media boxes so top/bottom borders are not left on the previous page. */
const BOX_SPAN_PAD_PX = 5
/** Minimum half-leading pad for text lines (ink box is often shorter than line-height). */
const TEXT_LINE_PAD_MIN_PX = 6
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const PAGE_MARGIN_MM = 8
const PAGE_LABEL_HEIGHT_MM = 6

/** Freeze A4 page step in CSS px from capture width (do not recompute after spacers). */
export function measurePageStepCssPx(
  cssWidth: number,
  contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2,
  contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2,
): number {
  const w = Math.max(cssWidth, 1)
  return contentHeightMm / (contentWidthMm / w)
}

/** Vertical pad for a text line from parent line-height (≈ half leading). */
export function textLinePadPx(parent: HTMLElement | null): number {
  if (!parent || typeof window === 'undefined') {
    return Math.max(SPAN_PAD_PX, TEXT_LINE_PAD_MIN_PX)
  }
  const style = window.getComputedStyle(parent)
  const lhRaw = style.lineHeight
  const lh = parseFloat(lhRaw)
  if (lhRaw === 'normal' || !Number.isFinite(lh)) {
    const fs = parseFloat(style.fontSize) || 14
    return Math.max(SPAN_PAD_PX, TEXT_LINE_PAD_MIN_PX, Math.ceil(fs * 0.5))
  }
  return Math.max(SPAN_PAD_PX, TEXT_LINE_PAD_MIN_PX, Math.ceil(lh * 0.5))
}

function collectSelectorSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
  selector: string,
): VerticalSpan[] {
  const originRect = origin.getBoundingClientRect()
  const spans: VerticalSpan[] = []
  contentRoot.querySelectorAll(selector).forEach((node) => {
    const el = node as HTMLElement
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    spans.push({
      top: rect.top - originRect.top - BOX_SPAN_PAD_PX,
      bottom: rect.bottom - originRect.top + BOX_SPAN_PAD_PX,
    })
  })
  return mergeSpans(spans)
}

/**
 * Merge only near-duplicate rects (same line reported twice). Adjacent visual
 * lines stay separate so page cuts can land on each line top.
 */
export function mergeNearDuplicateSpans(
  spans: VerticalSpan[],
  epsilon = 1.5,
): VerticalSpan[] {
  if (spans.length === 0) return []
  const sorted = spans
    .map((s) => ({
      top: Math.min(s.top, s.bottom),
      bottom: Math.max(s.top, s.bottom),
    }))
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom)

  const out: VerticalSpan[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    const sameLine =
      Math.abs(cur.top - last.top) <= epsilon &&
      Math.abs(cur.bottom - last.bottom) <= epsilon
    if (sameLine) {
      last.top = Math.min(last.top, cur.top)
      last.bottom = Math.max(last.bottom, cur.bottom)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/**
 * Collect visual text-line boxes from paper content (CSS px, relative to `origin`).
 * Prefer `origin` = capture wrap so coordinates match the screenshot bitmap.
 * Skips text inside annotation chrome and inside unbreakable boxes.
 * Adjacent lines are NOT merged — only duplicate rects collapse.
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
    if (parent?.closest(SKIP_TEXT_CLOSEST) || parent?.closest(UNBREAKABLE_BOX_SELECTOR)) {
      current = walker.nextNode()
      continue
    }

    const pad = textLinePadPx(parent)
    const range = document.createRange()
    range.selectNodeContents(text)
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue
      spans.push({
        top: rect.top - originRect.top - pad,
        bottom: rect.bottom - originRect.top + pad,
      })
    }
    current = walker.nextNode()
  }

  return mergeNearDuplicateSpans(spans)
}

/** Full element boxes for bordered / titled units that must not be sliced. */
export function collectAtomicBlockSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
): VerticalSpan[] {
  return collectSelectorSpans(contentRoot, origin, ATOMIC_BLOCK_SELECTOR)
}

/** Image / figure / table border boxes. */
export function collectMediaBlockSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
): VerticalSpan[] {
  return collectSelectorSpans(contentRoot, origin, MEDIA_BLOCK_SELECTOR)
}

/** Callout / textbox chrome boxes (keep borders intact across page cuts). */
export function collectAnnotationBoxSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
): VerticalSpan[] {
  return collectSelectorSpans(contentRoot, origin, ANNOTATION_BOX_SELECTOR)
}

/**
 * Protected Y spans for PDF slicing: unbreakable boxes + text lines outside them.
 * Annotation chrome is scanned on `origin` (capture wrap / stage) because callouts
 * usually sit as overlays outside the paper content root.
 */
export function collectProtectedSpans(
  contentRoot: HTMLElement,
  origin: HTMLElement,
): VerticalSpan[] {
  const boxes = mergeSpans([
    ...collectAtomicBlockSpans(contentRoot, origin),
    ...collectMediaBlockSpans(contentRoot, origin),
    ...collectAnnotationBoxSpans(origin, origin),
  ])
  const lines = collectTextLineSpans(contentRoot, origin)
  // Do not mergeSpans boxes with lines — overlapping pads would glue lines together.
  return [...boxes, ...lines].sort((a, b) => a.top - b.top || a.bottom - b.bottom)
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
 * Never hard-cuts through a protected block: keep-together at block top, or give
 * an oversized block its own page band ending at block bottom (scale-fit later).
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
      if (above > cursor + 1) {
        // Keep-together: end the page before the protected block.
        cut = above
      } else {
        // Block starts at (or above) cursor and is taller than the page —
        // dedicate this page band to the whole block; never slice its interior.
        cut = below
      }
    }

    if (cut <= cursor + 1) {
      // Last resort: jump to next protected boundary below cursor — never invent
      // a mid-span hard cut when a protected range still covers the ideal seam.
      const nextBoundary = protectedScaled
        .map((s) => s.bottom)
        .filter((b) => b > cursor + 1)
        .sort((a, b) => a - b)[0]
      cut = Math.min(nextBoundary ?? cursor + maxPageHeight, contentHeight)
      if (cut <= cursor + 1) {
        cut = Math.min(cursor + maxPageHeight, contentHeight)
      }
    }

    // Integer CSS px seams avoid subpixel clip through glyph ink.
    cut = Math.min(contentHeight, Math.max(cursor + 1, Math.round(cut)))

    ends.push(cut)
    cursor = cut
  }

  return ends
}

/**
 * Fit a page-band size into the A4 content box (mm). Scales down when the band
 * is taller/wider than the printable area; never crops.
 */
export function fitPageBandToA4(
  bandWidthMm: number,
  bandHeightMm: number,
  contentWidthMm: number,
  contentHeightMm: number,
): { drawW: number; drawH: number } {
  const w = Math.max(bandWidthMm, 0.01)
  const h = Math.max(bandHeightMm, 0.01)
  const scale = Math.min(1, contentWidthMm / w, contentHeightMm / h)
  return {
    drawW: w * scale,
    drawH: h * scale,
  }
}

/** CSS-px page ends from protected spans (no bitmap scale). */
export function packPageEnds(
  cssHeight: number,
  maxPageCssPx: number,
  protectedCss: VerticalSpan[],
): number[] {
  return computeSliceEnds(cssHeight, maxPageCssPx, protectedCss, 1)
}

/**
 * If a cut falls inside any protected span (text line or bordered box like
 * `.option`), snap it to that span's top so glyphs/borders are never bisected.
 */
export function snapCutsOutsideProtectedSpans(
  ends: number[],
  protectedSpans: VerticalSpan[],
  contentHeight: number,
): number[] {
  if (ends.length === 0) return ends
  const spans = protectedSpans
    .map((s) => ({
      top: Math.min(s.top, s.bottom),
      bottom: Math.max(s.top, s.bottom),
    }))
    .sort((a, b) => a.top - b.top)

  const out: number[] = []
  let prev = 0
  for (const raw of ends) {
    let cut = raw
    if (cut < contentHeight - 0.5) {
      const hit = spans.find((s) => cut > s.top + 0.5 && cut < s.bottom - 0.5)
      if (hit && hit.top > prev + 1) {
        cut = hit.top
      }
    }
    cut = Math.min(contentHeight, Math.max(prev + 1, Math.round(cut)))
    if (out.length === 0 || cut > out[out.length - 1]) {
      out.push(cut)
    }
    prev = cut
  }
  if (out.length === 0 || Math.abs(out[out.length - 1] - contentHeight) > 0.5) {
    out.push(contentHeight)
  } else {
    out[out.length - 1] = contentHeight
  }
  return out
}

/** @deprecated Prefer snapCutsOutsideProtectedSpans (boxes + lines). */
export function snapCutsOutsideTextLines(
  ends: number[],
  textLineSpans: VerticalSpan[],
  contentHeight: number,
): number[] {
  return snapCutsOutsideProtectedSpans(ends, textLineSpans, contentHeight)
}

/** Page footer label, e.g. 第 2 / 5 页 */
export function formatPageLabel(pageIndex1Based: number, totalPages: number): string {
  return `第 ${pageIndex1Based} / ${totalPages} 页`
}

/** Rasterize a Chinese-capable page label (jsPDF default fonts lack CJK). */
export function renderPageLabelCanvas(label: string, widthPx: number, heightPx = 36): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(widthPx))
  c.height = Math.max(1, Math.round(heightPx))
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#666666'
    ctx.font = '14px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, c.width / 2, c.height / 2)
  }
  return c
}

/** Map a CSS-Y band to canvas pixel rows (inclusive start, exclusive end). */
export function bandPixelRange(
  cssY0: number,
  cssY1: number,
  cssToCanvasScale: number,
  fullCanvasHeight: number,
): { y0: number; y1: number; h: number } {
  const y0 = Math.max(0, Math.round(cssY0 * cssToCanvasScale))
  const y1 = Math.min(fullCanvasHeight, Math.round(cssY1 * cssToCanvasScale))
  return { y0, y1, h: Math.max(1, y1 - y0) }
}

/** Crop a CSS-Y band from a full-document canvas (pixel-aligned with pack seams). */
export function cropCanvasBand(
  full: HTMLCanvasElement,
  cssY0: number,
  cssY1: number,
  cssToCanvasScale: number,
): HTMLCanvasElement {
  const { y0, h } = bandPixelRange(cssY0, cssY1, cssToCanvasScale, full.height)
  const page = document.createElement('canvas')
  page.width = full.width
  page.height = h
  const ctx = page.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建分页画布')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, page.width, page.height)
  ctx.drawImage(full, 0, y0, full.width, h, 0, 0, full.width, h)
  return page
}

/** Fixed-step page ends (used after spacers have pushed breaks into gaps). */
export function packFixedPageEnds(cssHeight: number, maxPageCssPx: number): number[] {
  if (cssHeight <= 0) return [0]
  if (maxPageCssPx <= 0) return [cssHeight]
  const ends: number[] = []
  let y = maxPageCssPx
  while (y < cssHeight - 0.5) {
    ends.push(y)
    y += maxPageCssPx
  }
  ends.push(cssHeight)
  return ends
}

export const PAGE_SPACER_ATTR = 'data-export-page-spacer'

/** Height to push a straddling block so its top lands on the next page. */
export function computePushSpacerHeight(pageEnd: number, blockTop: number): number {
  return Math.max(0, pageEnd - blockTop)
}

/** Whether this protected span should get a push-spacer at the given page seam. */
export function shouldInsertPushSpacer(
  cursor: number,
  pageEnd: number,
  span: VerticalSpan,
): boolean {
  const straddles = pageEnd > span.top + 0.5 && pageEnd < span.bottom - 0.5
  const canPush = span.top > cursor + 1
  return straddles && canPush
}

function createPageSpacer(heightPx: number): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute(PAGE_SPACER_ATTR, '1')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = [
    'display:block',
    'width:100%',
    `height:${Math.ceil(heightPx)}px`,
    'margin:0',
    'padding:0',
    'border:0',
    'pointer-events:none',
    'flex-shrink:0',
  ].join(';')
  return el
}

function measureOriginHeight(origin: HTMLElement): number {
  return Math.max(origin.scrollHeight, origin.clientHeight, 1)
}

/**
 * Find a DOM node to insert a spacer before, matching a protected Y span.
 * Prefers unbreakable boxes; falls back to a block-level ancestor of a text line.
 */
export function findAnchorForProtectedSpan(
  contentRoot: HTMLElement,
  origin: HTMLElement,
  span: VerticalSpan,
): HTMLElement | null {
  const originRect = origin.getBoundingClientRect()
  const candidates = new Set<HTMLElement>()
  contentRoot.querySelectorAll(UNBREAKABLE_BOX_SELECTOR).forEach((n) => {
    candidates.add(n as HTMLElement)
  })
  origin.querySelectorAll(ANNOTATION_BOX_SELECTOR).forEach((n) => {
    candidates.add(n as HTMLElement)
  })

  let best: HTMLElement | null = null
  let bestDelta = Infinity
  for (const el of candidates) {
    if (el.hasAttribute(PAGE_SPACER_ATTR)) continue
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue
    const top = r.top - originRect.top - BOX_SPAN_PAD_PX
    const bottom = r.bottom - originRect.top + BOX_SPAN_PAD_PX
    const overlaps =
      top < span.bottom - 0.5 && bottom > span.top + 0.5 &&
      Math.abs(top - span.top) <= BOX_SPAN_PAD_PX + 4
    if (!overlaps) continue
    const delta = Math.abs(top - span.top) + Math.abs(bottom - span.bottom)
    if (delta < bestDelta) {
      bestDelta = delta
      best = el
    }
  }
  if (best) return best

  // Text-line fallback: climb to a block-ish ancestor inside contentRoot.
  const walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    const text = current as Text
    if (!text.data?.trim()) {
      current = walker.nextNode()
      continue
    }
    const parent = text.parentElement
    if (parent?.closest(SKIP_TEXT_CLOSEST) || parent?.closest(UNBREAKABLE_BOX_SELECTOR)) {
      current = walker.nextNode()
      continue
    }
    const range = document.createRange()
    range.selectNodeContents(text)
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue
      const top = rect.top - originRect.top - SPAN_PAD_PX
      const bottom = rect.bottom - originRect.top + SPAN_PAD_PX
      if (Math.abs(top - span.top) > SPAN_PAD_PX + 4) continue
      if (Math.abs(bottom - span.bottom) > SPAN_PAD_PX + 4) continue
      let anchor: HTMLElement | null = parent
      while (anchor && anchor !== contentRoot) {
        const display = window.getComputedStyle(anchor).display
        if (
          display === 'block' ||
          display === 'list-item' ||
          display === 'table' ||
          display === 'flex' ||
          display === 'grid' ||
          anchor.tagName === 'P' ||
          anchor.tagName === 'LI' ||
          anchor.tagName === 'DIV'
        ) {
          return anchor
        }
        anchor = anchor.parentElement
      }
      return parent
    }
    current = walker.nextNode()
  }
  return null
}

export interface InsertPageSpacersOptions {
  contentRoot: HTMLElement
  origin: HTMLElement
  maxPageCssPx: number
  relayout?: () => void
  maxIterations?: number
}

/**
 * Insert fixed-height spacers before small unbreakable units that would be
 * sliced by a page seam, pushing them onto the next page (granularity B).
 * Returns the number of spacers inserted.
 */
export function insertPageSpacersForBreaks(options: InsertPageSpacersOptions): number {
  const { contentRoot, origin, maxPageCssPx, relayout } = options
  const maxIterations = options.maxIterations ?? 200
  if (maxPageCssPx <= 0) return 0

  let inserted = 0
  let cursor = 0
  let iterations = 0

  while (iterations++ < maxIterations) {
    const cssHeight = measureOriginHeight(origin)
    if (cursor >= cssHeight - 0.5) break

    const pageEnd = cursor + maxPageCssPx
    if (pageEnd >= cssHeight - 0.5) break

    const protectedSpans = collectProtectedSpans(contentRoot, origin)
    const blocking = protectedSpans.find(
      (s) => pageEnd > s.top + 0.5 && pageEnd < s.bottom - 0.5,
    )

    if (!blocking || !shouldInsertPushSpacer(cursor, pageEnd, blocking)) {
      cursor = pageEnd
      continue
    }

    const height = computePushSpacerHeight(pageEnd, blocking.top)
    if (height < 1) {
      cursor = pageEnd
      continue
    }

    const anchor = findAnchorForProtectedSpan(contentRoot, origin, blocking)
    if (!anchor || !anchor.parentElement) {
      // No DOM anchor (e.g. bare text line) — leave seam to packPageEnds line tops.
      cursor = pageEnd
      continue
    }

    const originRect = origin.getBoundingClientRect()
    const anchorTop = anchor.getBoundingClientRect().top - originRect.top
    // Multi-line block whose top is above the straddling line: pushing the whole
    // block would yank earlier lines off this page. Defer to packPageEnds.
    if (anchorTop < blocking.top - 8) {
      cursor = pageEnd
      continue
    }

    const prev = anchor.previousElementSibling as HTMLElement | null
    if (prev?.hasAttribute(PAGE_SPACER_ATTR)) {
      // Already pushed this block once; further seams use packPageEnds at line tops.
      cursor = pageEnd
      continue
    }

    const spacer = createPageSpacer(height)
    anchor.parentElement.insertBefore(spacer, anchor)
    inserted += 1
    relayout?.()
    // Block top should now sit near pageEnd; continue from the next page.
    cursor = pageEnd
  }

  return inserted
}

/** Remove all export page spacers under `root`. Returns how many were removed. */
export function removePageSpacers(root: HTMLElement | null): number {
  if (!root) return 0
  const nodes = Array.from(root.querySelectorAll(`[${PAGE_SPACER_ATTR}]`))
  for (const node of nodes) node.remove()
  return nodes.length
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
 * Prepare export → bake → spacer push-breaks → pack page seams →
 * one full-document screenshot → pixel-crop bands into A4 PDF.
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

  const textRoot = contentRoot ?? root

  try {
    const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2
    // Reserve footer strip for page labels so content bands never cover them.
    const contentHeightMm =
      A4_HEIGHT_MM - PAGE_MARGIN_MM * 2 - PAGE_LABEL_HEIGHT_MM

    const cssWidth = Math.max(wrap.scrollWidth, wrap.clientWidth, 1)
    // Freeze page step BEFORE spacers so insert seams and packPageEnds stay aligned.
    const maxPageCssPx = measurePageStepCssPx(cssWidth, contentWidthMm, contentHeightMm)
    const mmPerCssPx = contentWidthMm / cssWidth

    // Push straddling small blocks onto the next page with fixed-height spacers.
    insertPageSpacersForBreaks({
      contentRoot: textRoot,
      origin: wrap,
      maxPageCssPx,
      relayout: () => {
        surface.relayoutForExport?.()
        expandStageForOverflow(root)
      },
    })
    await waitFrames(1)

    // Spacers only grow height — keep frozen maxPageCssPx (do not recompute from width).
    const cssHeight = Math.max(wrap.scrollHeight, wrap.clientHeight, 1)

    const protectedSpans = collectProtectedSpans(textRoot, wrap)
    const packedEnds = packPageEnds(cssHeight, maxPageCssPx, protectedSpans)
    // Snap out of option boxes and text lines so borders/glyphs are not bisected.
    const pageEnds = snapCutsOutsideProtectedSpans(packedEnds, protectedSpans, cssHeight)
    const totalPages = pageEnds.length

    // One full-document shot; page bands are pixel crops so seams match ink.
    const fullCanvas = await domToCanvas(wrap, {
      scale,
      width: cssWidth,
      height: cssHeight,
      backgroundColor: '#ffffff',
      filter: screenshotFilter,
    })
    const cssToCanvasScale = fullCanvas.height / Math.max(cssHeight, 1)

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
      const pageCanvas = cropCanvasBand(fullCanvas, yStart, yEnd, cssToCanvasScale)

      const bandW = contentWidthMm
      const bandH = pageCssH * mmPerCssPx
      const { drawW, drawH } = fitPageBandToA4(
        bandW,
        bandH,
        contentWidthMm,
        contentHeightMm,
      )
      const dataUrl = pageCanvas.toDataURL('image/jpeg', 0.92)

      if (i > 0) pdf.addPage()
      pdf.addImage(dataUrl, 'JPEG', PAGE_MARGIN_MM, PAGE_MARGIN_MM, drawW, drawH)

      const label = formatPageLabel(i + 1, totalPages)
      const labelCanvas = renderPageLabelCanvas(label, Math.max(120, fullCanvas.width * 0.35))
      pdf.addImage(
        labelCanvas.toDataURL('image/png'),
        'PNG',
        PAGE_MARGIN_MM,
        A4_HEIGHT_MM - PAGE_MARGIN_MM - PAGE_LABEL_HEIGHT_MM,
        contentWidthMm,
        PAGE_LABEL_HEIGHT_MM,
      )

      yStart = yEnd
    }

    const blob = pdf.output('blob')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadBlob(blob, `homework-annotated-${surfaceMode}-${stamp}.pdf`)
  } finally {
    removePageSpacers(wrap)
    removePageSpacers(root)
    bakeHandle?.restore()
    root.classList.remove('is-baking-marks')
    unwrap()
    surface.restoreExport()
  }
}

