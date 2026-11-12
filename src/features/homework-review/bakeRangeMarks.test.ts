import { describe, expect, it } from 'vitest'
import { bakeRangeMarks } from './bakeRangeMarks'
import { textNodes } from './htmlRange'

describe('bakeRangeMarks', () => {
  it('wraps highlight slices and restores original text', () => {
    const root = document.createElement('div')
    root.textContent = 'ABCDEFGHIJ'
    const handle = bakeRangeMarks(root, [
      { kind: 'highlight', start: 2, end: 5, color: '#facc15' },
    ])

    const baked = root.querySelector('[data-export-bake="highlight"]')
    expect(baked?.textContent).toBe('CDE')
    expect(root.textContent).toBe('ABCDEFGHIJ')

    handle.restore()
    expect(root.querySelector('[data-export-bake]')).toBeNull()
    expect(root.textContent).toBe('ABCDEFGHIJ')
    expect(textNodes(root).length).toBe(1)
  })

  it('supports underline across multiple text nodes', () => {
    const root = document.createElement('div')
    root.appendChild(document.createTextNode('你好'))
    const em = document.createElement('em')
    em.textContent = '世界'
    root.appendChild(em)

    const handle = bakeRangeMarks(root, [
      { kind: 'underline', start: 1, end: 3, color: '#ef4444' },
    ])

    const baked = [...root.querySelectorAll('[data-export-bake="underline"]')]
    expect(baked.map((el) => el.textContent).join('')).toBe('好世')
    handle.restore()
    expect(root.textContent).toBe('你好世界')
  })
})
