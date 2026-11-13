import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  collectTextLineSpans,
  computeSliceEnds,
  mergeSpans,
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
    // Ideal cut 900 lands inside the line [880, 920] → move cut to line top.
    const ends = computeSliceEnds(2000, 900, [{ top: 880, bottom: 920 }], 1)
    expect(ends[0]).toBe(880)
    expect(ends[ends.length - 1]).toBe(2000)
  })

  it('can cut in the gap between adjacent text lines', () => {
    const ends = computeSliceEnds(
      2500,
      900,
      [
        { top: 100, bottom: 400 },
        { top: 400, bottom: 950 },
        { top: 950, bottom: 980 },
      ],
      1,
    )
    // Ideal 900 is inside the second line → cut at that line's top (400).
    expect(ends[0]).toBe(400)
  })

  it('hard-cuts when a single protected line is taller than a page', () => {
    const ends = computeSliceEnds(3000, 500, [{ top: 10, bottom: 2000 }], 1)
    expect(ends[0]).toBe(10)
    expect(ends.some((end, i) => i > 0 && end > 10 && end < 2000)).toBe(true)
    expect(ends[ends.length - 1]).toBe(3000)
  })
})

describe('collectTextLineSpans', () => {
  let restoreGetClientRects: (() => void) | undefined

  beforeEach(() => {
    const original = Range.prototype.getClientRects
    Range.prototype.getClientRects = function getClientRects(this: Range) {
      const text = this.toString()
      // Simulate two wrapped lines for long text; one line otherwise.
      if (text.length > 12) {
        // Leave a gap between lines so they do not merge.
        return [
          domRect(0, 100, 200, 18),
          domRect(0, 120, 160, 18),
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
    const stage = document.createElement('div')
    const content = document.createElement('div')
    content.className = 'content'
    content.textContent = '这是一段会折成两行的足够长的题干文字内容'
    stage.appendChild(content)
    document.body.appendChild(stage)

    Object.defineProperty(stage, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })

    const spans = collectTextLineSpans(content, stage)
    expect(spans.length).toBeGreaterThanOrEqual(2)
    // Lines should remain separable (not one giant block).
    expect(spans.every((s) => s.bottom - s.top < 40)).toBe(true)

    stage.remove()
  })

  it('skips annotation chrome text', () => {
    const stage = document.createElement('div')
    const content = document.createElement('div')
    const paper = document.createElement('p')
    paper.textContent = '试卷正文'
    const callout = document.createElement('div')
    callout.className = 'callout-box'
    callout.textContent = '引注不应参与行保护'
    content.append(paper, callout)
    stage.appendChild(content)
    document.body.appendChild(stage)

    Object.defineProperty(stage, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })

    const spans = collectTextLineSpans(content, stage)
    // Only paper text (short → one mocked line), not callout.
    expect(spans.length).toBe(1)

    stage.remove()
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
