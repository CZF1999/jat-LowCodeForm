import { textNodes } from './htmlRange'

export type BakeMarkKind = 'highlight' | 'underline'

export interface BakeMarkItem {
  start: number
  end: number
  color?: string
  kind: BakeMarkKind
}

export interface BakeRangeMarksHandle {
  restore: () => void
}

const BAKE_ATTR = 'data-export-bake'

/** Keep text opaque; only tint the background (absolute mark-layer used opacity on the overlay). */
function colorWithAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const n = Number.parseInt(hex[1], 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(color)
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`
  }
  return color
}

function wrapTextSlice(
  node: Text,
  from: number,
  to: number,
  kind: BakeMarkKind,
  color: string,
): HTMLElement | null {
  const text = node.data
  if (from >= to || from >= text.length) return null
  const safeTo = Math.min(to, text.length)
  const safeFrom = Math.max(0, from)
  if (safeFrom >= safeTo) return null

  const parent = node.parentNode
  if (!parent) return null

  const before = text.slice(0, safeFrom)
  const mid = text.slice(safeFrom, safeTo)
  const after = text.slice(safeTo)

  const span = document.createElement('span')
  span.setAttribute(BAKE_ATTR, kind)
  span.textContent = mid
  if (kind === 'highlight') {
    span.style.backgroundColor = colorWithAlpha(color, 0.35)
    span.style.borderRadius = '2px'
  } else {
    span.style.borderBottom = `2px solid ${color}`
    span.style.paddingBottom = '0'
    span.style.setProperty('box-decoration-break', 'clone')
    span.style.setProperty('-webkit-box-decoration-break', 'clone')
  }

  const frag = document.createDocumentFragment()
  if (before) frag.appendChild(document.createTextNode(before))
  frag.appendChild(span)
  if (after) frag.appendChild(document.createTextNode(after))
  parent.replaceChild(frag, node)
  return span
}

/**
 * Split text nodes by character offsets and wrap slices in temporary spans
 * so highlights/underlines travel with text during screenshot reflow.
 */
export function bakeRangeMarks(
  root: HTMLElement,
  items: BakeMarkItem[],
): BakeRangeMarksHandle {
  const baked: HTMLElement[] = []

  const normalized = items
    .map((item) => ({
      ...item,
      start: Math.min(item.start, item.end),
      end: Math.max(item.start, item.end),
      color: item.color || (item.kind === 'underline' ? '#ef4444' : '#facc15'),
    }))
    .filter((item) => item.end > item.start)
    // Process from end to start so earlier offsets stay valid as we mutate the tree.
    .sort((a, b) => b.start - a.start || b.end - a.end)

  for (const item of normalized) {
    // Re-collect nodes each time because wrapping mutates the tree.
    const nodes = textNodes(root)
    let cursor = 0
    const pieces: Array<{ node: Text; from: number; to: number }> = []

    for (const node of nodes) {
      const len = node.data.length
      const nodeStart = cursor
      const nodeEnd = cursor + len
      const overlapStart = Math.max(item.start, nodeStart)
      const overlapEnd = Math.min(item.end, nodeEnd)
      if (overlapStart < overlapEnd) {
        pieces.push({
          node,
          from: overlapStart - nodeStart,
          to: overlapEnd - nodeStart,
        })
      }
      cursor = nodeEnd
      if (cursor >= item.end) break
    }

    // Wrap from the end of the node list so earlier Text refs remain valid within this item.
    for (let i = pieces.length - 1; i >= 0; i--) {
      const piece = pieces[i]
      const span = wrapTextSlice(piece.node, piece.from, piece.to, item.kind, item.color)
      if (span) baked.push(span)
    }
  }

  return {
    restore() {
      for (let i = baked.length - 1; i >= 0; i--) {
        const span = baked[i]
        const parent = span.parentNode
        if (!parent) continue
        const text = document.createTextNode(span.textContent ?? '')
        parent.replaceChild(text, span)
        parent.normalize()
      }
      // Also sweep any leftover bake spans (defensive for partial wraps).
      root.querySelectorAll(`[${BAKE_ATTR}]`).forEach((node) => {
        const parent = node.parentNode
        if (!parent) return
        parent.replaceChild(document.createTextNode(node.textContent ?? ''), node)
        parent.normalize()
      })
      baked.length = 0
    },
  }
}
