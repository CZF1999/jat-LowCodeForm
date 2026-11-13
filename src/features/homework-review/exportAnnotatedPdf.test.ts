import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  collectAtomicBlockSpans,
  collectProtectedSpans,
  collectTextLineSpans,
  computeSliceEnds,
  mergeSpans,
  packPageEnds,
} from './exportAnnotatedPdf'

describe('mergeSpans', () => {
  it('merges overlapping ranges but keeps touching endpoints separate', () => {
    expect(
      mergeSpans([
        { top: 10, bottom: 40 },
        { top: 30, bottom: 60 },
        { top: 100, bottom: 120 },
      ]),
    ).toEqual([
      { top: 10, bottom: 60 },
      { top: 100, bottom: 120 },
    ])
    expect(
      mergeSpans([
        { top: 10, bottom: 40 },
        { top: 40, bottom: 60 },
      ]),
    ).toEqual([
      { top: 10, bottom: 40 },
      { top: 40, bottom: 60 },
    ])
  })
})

describe('computeSliceEnds', () => {
  it('returns full height when content fits one page', () => {
    expect(computeSliceEnds(800, 1000, [], 1)).toEqual([800])
  })

  it('cuts above a text line when ideal cut falls inside the line box', () => {
    const ends = computeSliceEnds(2000, 900, [{ top: 880, bottom: 920 }], 1)
    expect(ends[0]).toBe(880)
    expect(ends[ends.length - 1]).toBe(2000)
  })

  it('maps protected Y with the provided scale (callers pass scaleY)', () => {
    const ends = computeSliceEnds(2000, 900, [{ top: 440, bottom: 460 }], 2)
    expect(ends[0]).toBe(880)
  })

  it('cuts above an option-sized box instead of slicing through its border', () => {
    // Option box [850, 920]; ideal 900 lands inside → cut at box top.
    const ends = computeSliceEnds(2000, 900, [{ top: 850, bottom: 920 }], 1)
    expect(ends[0]).toBe(850)
  })

  it('can cut in the gap between adjacent option boxes', () => {
    const ends = computeSliceEnds(
      2500,
      900,
      [
        { top: 700, bottom: 780 },
        { top: 800, bottom: 880 },
        { top: 900, bottom: 980 },
      ],
      1,
    )
    // Ideal 900 is exactly at third box top — not interior; first cut lands in gap or at 900.
    // Force interior: ideal 920 inside third box → cut at 900.
    const endsInside = computeSliceEnds(
      2500,
      920,
      [
        { top: 700, bottom: 780 },
        { top: 800, bottom: 880 },
        { top: 900, bottom: 980 },
      ],
      1,
    )
    expect(endsInside[0]).toBe(900)
    // Gap between first two is cuttable when ideal lands there.
    expect(ends[0]).toBeLessThanOrEqual(900)
  })

  it('prefers a short page above the block over mid-glyph hard-cut', () => {
    const ends = computeSliceEnds(500, 100, [{ top: 5, bottom: 150 }], 1)
    expect(ends[0]).toBe(5)
  })

  it('hard-cuts when the block starts at page top and is taller than the page', () => {
    const ends = computeSliceEnds(500, 100, [{ top: 0, bottom: 250 }], 1)
    expect(ends[0]).toBe(100)
    expect(ends[ends.length - 1]).toBe(500)
  })

  it('hard-cuts when a single protected line is taller than a page', () => {
    const ends = computeSliceEnds(3000, 500, [{ top: 10, bottom: 2000 }], 1)
    expect(ends[0]).toBe(10)
    expect(ends.some((end, i) => i > 0 && end > 10 && end < 2000)).toBe(true)
    expect(ends[ends.length - 1]).toBe(3000)
  })
})

describe('packPageEnds', () => {
  it('does not cut through an option box; ends at box top', () => {
    const ends = packPageEnds(
      2000,
      900,
      [
        { top: 100, bottom: 160 },
        { top: 180, bottom: 240 },
        { top: 850, bottom: 920 },
      ],
    )
    expect(ends[0]).toBe(850)
    expect(ends[ends.length - 1]).toBe(2000)
  })

  it('allows a topic section to span pages via gaps between options', () => {
    // Three options in one topic; page capacity fits first two only → cut before 3rd.
    const ends = packPageEnds(
      600,
      250,
      [
        { top: 40, bottom: 100 },
        { top: 120, bottom: 180 },
        { top: 200, bottom: 260 },
      ],
    )
    expect(ends[0]).toBe(200)
    expect(ends.length).toBeGreaterThan(1)
    expect(ends[ends.length - 1]).toBe(600)
  })
})

describe('collectTextLineSpans', () => {
  let restoreGetClientRects: (() => void) | undefined

  beforeEach(() => {
    const original = Range.prototype.getClientRects
    Range.prototype.getClientRects = function getClientRects(this: Range) {
      const text = this.toString()
      if (text.length > 12) {
        return [
          domRect(0, 100, 200, 18),
          domRect(0, 130, 160, 18),
        ] as unknown as DOMRectList
      }
      return [domRect(0, 50, text.length * 10, 16)] as unknown as DOMRectList
    }
    restoreGetClientRects = () => {
      Range.prototype.getClientRects = original
    }
  })

  afterEach(() => {
    restoreGetClientRects?.()
  })

  it('collects one span per visual text line from getClientRects', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    content.className = 'content'
    content.textContent = '这是一段会折成两行的足够长的题干文字内容'
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(10, 20, 800, 2000),
    })

    const spans = collectTextLineSpans(content, wrap)
    expect(spans.length).toBeGreaterThanOrEqual(2)
    expect(spans[0]).toEqual({ top: 78, bottom: 100 })
    expect(spans[1]).toEqual({ top: 108, bottom: 130 })

    wrap.remove()
  })

  it('skips annotation chrome text', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const paper = document.createElement('p')
    paper.textContent = '试卷正文'
    const callout = document.createElement('div')
    callout.className = 'callout-box'
    callout.textContent = '引注不应参与行保护'
    content.append(paper, callout)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })

    const spans = collectTextLineSpans(content, wrap)
    expect(spans.length).toBe(1)
    expect(spans[0]).toEqual({ top: 48, bottom: 68 })

    wrap.remove()
  })

  it('skips text inside atomic option boxes', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const option = document.createElement('div')
    option.className = 'option'
    option.textContent = 'A. 选项文字在原子块内'
    content.appendChild(option)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })

    expect(collectTextLineSpans(content, wrap)).toEqual([])

    wrap.remove()
  })
})

describe('collectAtomicBlockSpans / collectProtectedSpans', () => {
  it('collects full option boxes including border box', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const optA = document.createElement('div')
    optA.className = 'option'
    const optB = document.createElement('div')
    optB.className = 'option'
    content.append(optA, optB)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })
    Object.defineProperty(optA, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 100, 400, 40),
    })
    Object.defineProperty(optB, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 160, 400, 40),
    })

    const spans = collectAtomicBlockSpans(content, wrap)
    expect(spans).toEqual([
      { top: 98, bottom: 142 },
      { top: 158, bottom: 202 },
    ])

    wrap.remove()
  })

  it('merges atomic blocks with outside text lines', () => {
    const original = Range.prototype.getClientRects
    Range.prototype.getClientRects = function getClientRects() {
      return [domRect(0, 50, 100, 16)] as unknown as DOMRectList
    }

    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const stem = document.createElement('p')
    stem.textContent = '题干'
    const option = document.createElement('div')
    option.className = 'option'
    option.textContent = 'A. 选项'
    content.append(stem, option)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })
    Object.defineProperty(option, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 100, 400, 40),
    })

    const spans = collectProtectedSpans(content, wrap)
    expect(spans.some((s) => s.top === 48 && s.bottom === 68)).toBe(true)
    expect(spans.some((s) => s.top === 98 && s.bottom === 142)).toBe(true)

    Range.prototype.getClientRects = original
    wrap.remove()
  })
})

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this
    },
  } as DOMRect
}
