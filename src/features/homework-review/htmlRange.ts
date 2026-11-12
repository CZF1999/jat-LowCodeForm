import type { HtmlAnchor } from './types'

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
