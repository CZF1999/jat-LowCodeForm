import { describe, expect, it } from 'vitest'
import { computeSliceEnds, mergeSpans } from './exportAnnotatedPdf'

describe('mergeSpans', () => {
  it('merges overlapping ranges', () => {
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
  })
})

describe('computeSliceEnds', () => {
  it('returns full height when content fits one page', () => {
    expect(computeSliceEnds(800, 1000, [], 1)).toEqual([800])
  })

  it('avoids cutting through a protected span', () => {
    const ends = computeSliceEnds(
      2000,
      900,
      [{ top: 850, bottom: 950 }],
      1,
    )
    expect(ends[0]).toBe(850)
    expect(ends[ends.length - 1]).toBe(2000)
    for (const end of ends.slice(0, -1)) {
      expect(end <= 850 || end >= 950).toBe(true)
    }
  })

  it('hard-cuts when a protected block is taller than a page', () => {
    const ends = computeSliceEnds(
      3000,
      500,
      [{ top: 10, bottom: 2000 }],
      1,
    )
    // First page ends just above the tall block; later pages must hard-cut inside it.
    expect(ends[0]).toBe(10)
    expect(ends.some((end, i) => i > 0 && end > 10 && end < 2000)).toBe(true)
    expect(ends[ends.length - 1]).toBe(3000)
  })
})
