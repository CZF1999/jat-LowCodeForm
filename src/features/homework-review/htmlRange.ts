import type { HtmlAnchor } from './types'
// 收集所有文本节点
export function textNodes(root: Node): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}
// 虚拟串偏移 → 浏览器原生 Range
export function offsetToRange(root: HTMLElement, start: number, end: number): Range | null {
  const nodes = textNodes(root)
  let cursor = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  for (const node of nodes) {
    const len = node.data.length
    if (!startNode && cursor + len >= start) {
      startNode = node
      startOffset = Math.max(0, start - cursor)
    }
    if (!endNode && cursor + len >= end) {
      endNode = node
      endOffset = Math.max(0, end - cursor)
      break
    }
    cursor += len
  }

  if (!startNode || !endNode) return null
  const range = document.createRange()
  range.setStart(startNode, Math.min(startOffset, startNode.data.length))
  range.setEnd(endNode, Math.min(endOffset, endNode.data.length))
  return range
}
// 原生 Range → { start, end, quote }
export function rangeToOffsets(root: HTMLElement, range: Range): HtmlAnchor | null {
  const nodes = textNodes(root)
  let cursor = 0
  let start = -1
  let end = -1
  for (const node of nodes) {
    const len = node.data.length
    if (node === range.startContainer) start = cursor + range.startOffset
    if (node === range.endContainer) {
      end = cursor + range.endOffset
      break
    }
    cursor += len
  }
  if (start < 0 || end < 0 || end <= start) return null
  return {
    start,
    end,
    quote: range.toString().slice(0, 40),
  }
}
// 鼠标点 → 全局偏移（caretOffsetFromPoint）
// 浏览器先告诉你「点在哪个 Text 节点的第几个字」，再累加前面节点的长度：
export function caretOffsetFromPoint(root: HTMLElement, clientX: number, clientY: number): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }

  let node: Node | null = null
  let offset = 0

  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY)
    if (!range) return null
    node = range.startContainer
    offset = range.startOffset
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(clientX, clientY)
    if (!pos) return null
    node = pos.offsetNode
    offset = pos.offset
  } else {
    return null
  }

  if (!root.contains(node)) return null

  const nodes = textNodes(root)
  let cursor = 0
  for (const text of nodes) {
    if (text === node) return cursor + offset
    cursor += text.data.length
  }
  return null
}

/** Content-box metrics: same width/height used for normalize and paint. */
export function boxMetrics(box: HTMLElement): {
  rect: DOMRect
  width: number
  height: number
} {
  const rect = box.getBoundingClientRect()
  return {
    rect,
    width: Math.max(box.clientWidth, 1),
    height: Math.max(box.scrollHeight, box.clientHeight, 1),
  }
}

export function stageRelativeFromClientRect(
  box: HTMLElement,
  rect: DOMRect,
): { x: number; y: number; left: number; top: number; width: number; height: number } {
  const { rect: boxRect, width, height } = boxMetrics(box)
  const left = rect.left - boxRect.left
  const top = rect.top - boxRect.top
  return {
    left,
    top,
    width: rect.width,
    height: rect.height,
    x: (left + rect.width / 2) / width,
    y: (top + rect.height / 2) / height,
  }
}

/**
 * Client rects for a selection that only include text ink boxes.
 * Native `range.getClientRects()` also returns border boxes of fully-selected
 * elements (often full-width block divs), which paints "whole line" highlights.
 */
export function clientRectsForRange(root: HTMLElement, range: Range): DOMRect[] {
  const out: DOMRect[] = []
  const nodes = textNodes(root)

  for (const node of nodes) {
    if (!range.intersectsNode(node)) continue
    const len = node.data.length
    if (len <= 0) continue

    let from = 0
    let to = len
    if (node === range.startContainer) {
      from = Math.min(Math.max(0, range.startOffset), len)
    }
    if (node === range.endContainer) {
      to = Math.min(Math.max(0, range.endOffset), len)
    }
    // For nodes strictly between start and end, keep full text.
    // When start/end are not this node, intersectsNode already implies full cover.
    if (node !== range.startContainer && node !== range.endContainer) {
      from = 0
      to = len
    }
    if (from >= to) continue

    const piece = document.createRange()
    piece.setStart(node, from)
    piece.setEnd(node, to)
    for (const rect of Array.from(piece.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue
      out.push(rect)
    }
  }

  return filterAnomalousFullWidthRects(out, root)
}

/** Drop near-full-width outliers that dwarf sibling text rects (browser edge cases). */
export function filterAnomalousFullWidthRects(
  rects: DOMRect[],
  root: HTMLElement,
): DOMRect[] {
  if (rects.length === 0) return rects
  const blockWidth = Math.max(root.getBoundingClientRect().width, root.clientWidth, 1)
  const threshold = blockWidth * 0.95
  const textLike = rects.filter((r) => r.width < threshold)
  if (textLike.length === 0) return rects

  const maxTextW = Math.max(...textLike.map((r) => r.width))
  return rects.filter((r) => {
    if (r.width < threshold) return true
    // Keep only if it is not much wider than real text fragments.
    return r.width <= maxTextW * 1.25
  })
}

/** Snapshot a short text anchor at a pointer for position-based HTML annotations. */
export function anchorAtPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): HtmlAnchor | null {
  const offset = caretOffsetFromPoint(root, clientX, clientY)
  if (offset == null) return null
  const end = offset + 1
  const range = offsetToRange(root, offset, end)
  if (!range) {
    return { start: offset, end: Math.max(offset + 1, offset), quote: '' }
  }
  const anchor = rangeToOffsets(root, range)
  if (anchor) return anchor
  return { start: offset, end: end, quote: range.toString().slice(0, 40) }
}
