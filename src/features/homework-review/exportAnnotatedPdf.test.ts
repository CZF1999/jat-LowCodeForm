import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ATOMIC_BLOCK_SELECTOR,
  collectAnnotationBoxSpans,
  collectAtomicBlockSpans,
  collectMediaBlockSpans,
  collectProtectedSpans,
  collectTextLineSpans,
  computePushSpacerHeight,
  computeSliceEnds,
  bandPixelRange,
  fitPageBandToA4,
  insertPageSpacersForBreaks,
  measurePageStepCssPx,
  mergeNearDuplicateSpans,
  mergeSpans,
  PAGE_SPACER_ATTR,
  packFixedPageEnds,
  packPageEnds,
  removePageSpacers,
  shouldInsertPushSpacer,
  formatPageLabel,
  snapCutsOutsideProtectedSpans,
  snapCutsOutsideTextLines,
  textLinePadPx,
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

  it('gives an oversized block its own page band when it starts at page top', () => {
    const ends = computeSliceEnds(500, 100, [{ top: 0, bottom: 250 }], 1)
    expect(ends[0]).toBe(250)
    expect(ends[ends.length - 1]).toBe(500)
  })

  it('never cuts through an oversized protected block interior', () => {
    const ends = computeSliceEnds(3000, 500, [{ top: 10, bottom: 2000 }], 1)
    expect(ends[0]).toBe(10)
    expect(ends.some((end) => end > 10 && end < 2000)).toBe(false)
    expect(ends).toContain(2000)
    expect(ends[ends.length - 1]).toBe(3000)
  })
})

describe('fitPageBandToA4', () => {
  it('keeps 1:1 when the band fits', () => {
    expect(fitPageBandToA4(180, 200, 194, 281)).toEqual({ drawW: 180, drawH: 200 })
  })

  it('scales down oversized height without cropping', () => {
    const { drawW, drawH } = fitPageBandToA4(194, 400, 194, 281)
    expect(drawH).toBeCloseTo(281, 5)
    expect(drawW).toBeCloseTo(194 * (281 / 400), 5)
    expect(drawW).toBeLessThanOrEqual(194 + 1e-6)
    expect(drawH).toBeLessThanOrEqual(281 + 1e-6)
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

  it('collects one span per visual text line from getClientRects without merging neighbors', () => {
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

    const pad = textLinePadPx(content)
    const spans = collectTextLineSpans(content, wrap)
    expect(spans.length).toBeGreaterThanOrEqual(2)
    // rects at y=100/130 relative to wrap top 20 → local 80/110, ± by pad.
    expect(spans[0]).toMatchObject({ top: 80 - pad, bottom: 98 + pad })
    expect(spans[1]).toMatchObject({ top: 110 - pad, bottom: 128 + pad })
    expect(spans[0].quote).toContain('#0')
    expect(spans[1].quote).toContain('#1')
    // Adjacent lines must stay separate even if pads overlap.
    expect(spans[0].bottom).toBeGreaterThan(spans[1].top)

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

    const pad = textLinePadPx(paper)
    const spans = collectTextLineSpans(content, wrap)
    expect(spans.length).toBe(1)
    expect(spans[0]).toMatchObject({ top: 50 - pad, bottom: 66 + pad })
    expect(spans[0].quote).toContain('试卷正文')
    expect(spans[0].quote).toContain('#0')

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
      { top: 95, bottom: 145 },
      { top: 155, bottom: 205 },
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

    const pad = textLinePadPx(stem)
    const spans = collectProtectedSpans(content, wrap)
    expect(spans.some((s) => s.top === 50 - pad && s.bottom === 66 + pad)).toBe(true)
    expect(spans.some((s) => s.top === 95 && s.bottom === 145)).toBe(true)

    Range.prototype.getClientRects = original
    wrap.remove()
  })

  it('keeps .stem / .answer-row / .tm-card out of atomic selector (question may span pages)', () => {
    expect(ATOMIC_BLOCK_SELECTOR).not.toMatch(/stem/)
    expect(ATOMIC_BLOCK_SELECTOR).not.toMatch(/answer-row/)
    expect(ATOMIC_BLOCK_SELECTOR).not.toMatch(/tm-card/)
    expect(ATOMIC_BLOCK_SELECTOR).toMatch(/\.option/)
  })

  it('collects .stem and .answer-row text as line spans so lines stay uncut', () => {
    const original = Range.prototype.getClientRects
    Range.prototype.getClientRects = function getClientRects() {
      return [domRect(0, 40, 200, 16)] as unknown as DOMRectList
    }

    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const stem = document.createElement('p')
    stem.className = 'stem'
    stem.textContent = '题干按行保护'
    const answer = document.createElement('div')
    answer.className = 'answer-row'
    answer.textContent = '正确答案：B'
    content.append(stem, answer)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })

    expect(collectAtomicBlockSpans(content, wrap)).toEqual([])
    const lines = collectTextLineSpans(content, wrap)
    expect(lines.length).toBeGreaterThanOrEqual(1)

    Range.prototype.getClientRects = original
    wrap.remove()
  })

  it('collects img media boxes into protected spans', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const img = document.createElement('img')
    content.appendChild(img)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })
    Object.defineProperty(img, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 200, 300, 180),
    })

    expect(collectMediaBlockSpans(content, wrap)).toEqual([{ top: 195, bottom: 385 }])
    expect(collectProtectedSpans(content, wrap).some((s) => s.top === 195 && s.bottom === 385)).toBe(
      true,
    )

    wrap.remove()
  })

  it('collects callout boxes from capture wrap overlays', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const callout = document.createElement('div')
    callout.className = 'callout-box'
    wrap.append(content, callout)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })
    Object.defineProperty(callout, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(20, 300, 160, 80),
    })

    expect(collectAnnotationBoxSpans(wrap, wrap)).toEqual([{ top: 295, bottom: 385 }])
    expect(collectProtectedSpans(content, wrap).some((s) => s.top === 295 && s.bottom === 385)).toBe(
      true,
    )

    wrap.remove()
  })
})

describe('packPageEnds keep-together with media-sized blocks', () => {
  it('cuts at protected block top when ideal lands inside img-sized span', () => {
    const ends = packPageEnds(2000, 900, [{ top: 820, bottom: 1100 }])
    expect(ends[0]).toBe(820)
    // After keep-together, subsequent pages may advance past the block without
    // needing an end exactly at bottom — just never cut the interior.
    expect(ends.some((end) => end > 820 && end < 1100)).toBe(false)
    expect(ends[ends.length - 1]).toBe(2000)
  })
})

describe('snapCutsOutsideProtectedSpans / bandPixelRange / page label', () => {
  it('snaps a mid-line cut up to the line top', () => {
    const ends = snapCutsOutsideTextLines(
      [900, 2000],
      [{ top: 880, bottom: 920 }],
      2000,
    )
    expect(ends[0]).toBe(880)
    expect(ends[ends.length - 1]).toBe(2000)
  })

  it('snaps a cut inside an option box up to the box top', () => {
    const ends = snapCutsOutsideProtectedSpans(
      [900, 2000],
      [{ top: 850, bottom: 920 }],
      2000,
    )
    expect(ends[0]).toBe(850)
    expect(ends[ends.length - 1]).toBe(2000)
  })

  it('packPageEnds + snap never leaves a cut inside a text line', () => {
    const lines = [
      { top: 100, bottom: 130 },
      { top: 850, bottom: 890 },
    ]
    const packed = packPageEnds(2000, 900, lines)
    const snapped = snapCutsOutsideProtectedSpans(packed, lines, 2000)
    for (const cut of snapped) {
      if (cut >= 2000 - 0.5) continue
      for (const line of lines) {
        expect(cut > line.top + 0.5 && cut < line.bottom - 0.5).toBe(false)
      }
    }
  })

  it('bandPixelRange maps CSS seams to canvas rows', () => {
    expect(bandPixelRange(40, 60, 2, 200)).toEqual({ y0: 80, y1: 120, h: 40 })
    expect(bandPixelRange(0, 10, 1.5, 100).h).toBe(15)
  })

  it('formatPageLabel builds 第 n / N 页', () => {
    expect(formatPageLabel(1, 5)).toBe('第 1 / 5 页')
    expect(formatPageLabel(3, 3)).toBe('第 3 / 3 页')
  })
})

describe('page step freeze / text line merge', () => {
  it('measurePageStepCssPx is stable for a given width', () => {
    const step = measurePageStepCssPx(800)
    expect(step).toBeCloseTo((297 - 16) / ((210 - 16) / 800), 5)
    expect(measurePageStepCssPx(800)).toBe(step)
  })

  it('mergeNearDuplicateSpans keeps adjacent lines separate', () => {
    expect(
      mergeNearDuplicateSpans([
        { top: 100, bottom: 130 },
        { top: 120, bottom: 150 },
      ]),
    ).toEqual([
      { top: 100, bottom: 130 },
      { top: 120, bottom: 150 },
    ])
  })

  it('collectProtectedSpans does not glue overlapping padded text lines', () => {
    const original = Range.prototype.getClientRects
    Range.prototype.getClientRects = function getClientRects() {
      return [
        domRect(0, 100, 200, 18),
        domRect(0, 120, 200, 18),
      ] as unknown as DOMRectList
    }

    const wrap = document.createElement('div')
    const content = document.createElement('div')
    content.textContent = 'abcdefghijklmnopq' // >12 chars → two mocked rects
    wrap.appendChild(content)
    document.body.appendChild(wrap)
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })

    const spans = collectProtectedSpans(content, wrap)
    const lineSpans = spans.filter((s) => s.top >= 50)
    expect(lineSpans.length).toBeGreaterThanOrEqual(2)

    Range.prototype.getClientRects = original
    wrap.remove()
  })

  it('mergeNearDuplicateSpans collapses duplicate rects', () => {
    expect(
      mergeNearDuplicateSpans([
        { top: 100, bottom: 120 },
        { top: 100.5, bottom: 120.5 },
      ]),
    ).toEqual([{ top: 100, bottom: 120.5 }])
  })
})

describe('spacer push-breaks', () => {
  it('computes spacer height pageEnd - blockTop (900 - 820 = 80)', () => {
    expect(computePushSpacerHeight(900, 820)).toBe(80)
  })

  it('should insert when seam straddles a block below the page top', () => {
    expect(shouldInsertPushSpacer(0, 900, { top: 820, bottom: 1100 })).toBe(true)
  })

  it('should not insert for oversized block already at page top', () => {
    expect(shouldInsertPushSpacer(0, 100, { top: 0, bottom: 250 })).toBe(false)
  })

  it('packFixedPageEnds steps by page height', () => {
    expect(packFixedPageEnds(2500, 900)).toEqual([900, 1800, 2500])
  })

  it('inserts a spacer before an option that would be sliced and removePageSpacers clears it', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const filler = document.createElement('div')
    filler.style.height = '820px'
    const option = document.createElement('div')
    option.className = 'option'
    option.textContent = 'A. 选项'
    content.append(filler, option)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'scrollHeight', { configurable: true, get: () => 2000 })
    Object.defineProperty(wrap, 'clientHeight', { configurable: true, get: () => 2000 })
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 2000),
    })
    Object.defineProperty(option, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 820, 400, 280),
    })

    const inserted = insertPageSpacersForBreaks({
      contentRoot: content,
      origin: wrap,
      maxPageCssPx: 900,
      maxIterations: 5,
    })
    expect(inserted).toBeGreaterThanOrEqual(1)

    const spacer = content.querySelector(`[${PAGE_SPACER_ATTR}]`) as HTMLElement | null
    expect(spacer).toBeTruthy()
    // Protected span top is rect.top - BOX_SPAN_PAD_PX (5) → 815; 900 - 815 = 85.
    expect(spacer?.style.height).toBe('85px')
    expect(option.previousElementSibling).toBe(spacer)

    expect(removePageSpacers(wrap)).toBeGreaterThanOrEqual(1)
    expect(content.querySelector(`[${PAGE_SPACER_ATTR}]`)).toBeNull()

    wrap.remove()
  })

  it('does not insert spacer when oversized block starts at cursor', () => {
    const wrap = document.createElement('div')
    const content = document.createElement('div')
    const option = document.createElement('div')
    option.className = 'option'
    content.appendChild(option)
    wrap.appendChild(content)
    document.body.appendChild(wrap)

    Object.defineProperty(wrap, 'scrollHeight', { configurable: true, get: () => 500 })
    Object.defineProperty(wrap, 'clientHeight', { configurable: true, get: () => 500 })
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 800, 500),
    })
    Object.defineProperty(option, 'getBoundingClientRect', {
      configurable: true,
      value: () => domRect(0, 0, 400, 250),
    })

    const inserted = insertPageSpacersForBreaks({
      contentRoot: content,
      origin: wrap,
      maxPageCssPx: 100,
      maxIterations: 10,
    })
    expect(inserted).toBe(0)
    expect(content.querySelector(`[${PAGE_SPACER_ATTR}]`)).toBeNull()

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
