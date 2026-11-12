import { describe, expect, it } from 'vitest'
import { anchorsOverlap } from './htmlAnchorOverlap'

describe('anchorsOverlap', () => {
  it('detects identical ranges', () => {
    expect(anchorsOverlap({ start: 10, end: 20 }, { start: 10, end: 20 })).toBe(true)
  })

  it('allows ranges that only touch at an endpoint', () => {
    expect(anchorsOverlap({ start: 10, end: 20 }, { start: 20, end: 30 })).toBe(false)
    expect(anchorsOverlap({ start: 20, end: 30 }, { start: 10, end: 20 })).toBe(false)
  })

  it('detects partial overlap', () => {
    expect(anchorsOverlap({ start: 10, end: 20 }, { start: 15, end: 25 })).toBe(true)
    expect(anchorsOverlap({ start: 15, end: 25 }, { start: 10, end: 20 })).toBe(true)
  })

  it('normalizes reversed start/end', () => {
    expect(anchorsOverlap({ start: 20, end: 10 }, { start: 12, end: 18 })).toBe(true)
  })
})
