import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientRectsForRange, filterAnomalousFullWidthRects, offsetToRange } from './htmlRange'

function mockClientRects() {
  const original = Range.prototype.getClientRects
  Range.prototype.getClientRects = function getClientRects(this: Range) {
    const start = this.startContainer
    const end = this.endContainer
    // Text-only piece range → ink-sized box (what we want).
    if (start === end && start.nodeType === Node.TEXT_NODE) {
      const text = (start as Text).data.slice(this.startOffset, this.endOffset)
      const width = Math.max(text.length, 1) * 10
      return [
        {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: width,
          bottom: 16,
          width,
          height: 16,
          toJSON() {
            return this
          },
        },
      ] as unknown as DOMRectList
    }
    // Cross-element range → fake full-width block box (browser quirk).
    return [
      {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 16,
        width: 800,
        height: 16,
        toJSON() {
          return this
        },
      },
    ] as unknown as DOMRectList
  }
  return () => {
    Range.prototype.getClientRects = original
  }
}

describe('clientRectsForRange', () => {
  let restore: (() => void) | undefined

  beforeEach(() => {
    restore = mockClientRects()
  })

  afterEach(() => {
    restore?.()
  })

  it('does not emit full-width rects when selection spans block rows', () => {
    const root = document.createElement('div')
    root.style.width = '800px'
    root.innerHTML = `
      <div class="exam-meta" style="width:800px">
        <div><span>考试时长：45分钟</span><span> | </span><span>考试总分：21</span></div>
        <div class="meta-row"><span>警号：11000000</span><span> | </span><span>姓名：张三总</span></div>
      </div>
    `
    document.body.appendChild(root)

    const fullText = root.textContent ?? ''
    const start = fullText.indexOf('考试时长')
    const end = fullText.indexOf('张三总') + '张三总'.length
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)

    const range = offsetToRange(root, start, end)
    expect(range).not.toBeNull()

    // Native call would include the mocked full-width box.
    const native = Array.from(range!.getClientRects())
    expect(native.some((r) => r.width >= 800)).toBe(true)

    const tight = clientRectsForRange(root, range!)
    expect(tight.length).toBeGreaterThan(0)
    for (const rect of tight) {
      expect(rect.width).toBeLessThan(800 * 0.8)
    }

    root.remove()
  })
})

describe('filterAnomalousFullWidthRects', () => {
  it('drops near-full-width outliers when text-sized rects exist', () => {
    const root = document.createElement('div')
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 100,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON() {
        return this
      },
    } as DOMRect)
    Object.defineProperty(root, 'clientWidth', { value: 1000 })

    const rects = [
      { width: 120, height: 16 } as DOMRect,
      { width: 980, height: 16 } as DOMRect,
      { width: 80, height: 16 } as DOMRect,
    ]
    const filtered = filterAnomalousFullWidthRects(rects, root)
    expect(filtered).toHaveLength(2)
    expect(filtered.every((r) => r.width < 900)).toBe(true)
  })
})
