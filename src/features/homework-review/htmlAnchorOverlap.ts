import type { HtmlAnchor } from './types'

/** True when character ranges share at least one character. Touching endpoints do not overlap. */
export function anchorsOverlap(
  a: Pick<HtmlAnchor, 'start' | 'end'>,
  b: Pick<HtmlAnchor, 'start' | 'end'>,
): boolean {
  const aStart = Math.min(a.start, a.end)
  const aEnd = Math.max(a.start, a.end)
  const bStart = Math.min(b.start, b.end)
  const bEnd = Math.max(b.start, b.end)
  return aStart < bEnd && bStart < aEnd
}
