import { describe, expect, it } from 'vitest'
import {
  validateComponentSchema,
  validatePageSchema,
  validateSchemaVersion,
} from './validator'
import type { ComponentSchema, PageSchema } from './types'

function makeComponent(overrides: Partial<ComponentSchema> = {}): ComponentSchema {
  return {
    id: 'c1',
    type: 'input',
    label: '姓名',
    props: {},
    styles: {},
    events: {},
    ...overrides,
  }
}

function makePage(overrides: Partial<PageSchema> = {}): PageSchema {
  return {
    version: '1.0.0',
    info: {
      name: 'Demo',
      description: '',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    },
    settings: {
      title: 'Page',
      backgroundColor: '#ffffff',
      width: '1200px',
      height: '800px',
      meta: {},
    },
    components: [makeComponent()],
    ...overrides,
  }
}

describe('validateSchemaVersion', () => {
  it('accepts semver x.y.z', () => {
    expect(validateSchemaVersion('1.0.0')).toBe(true)
    expect(validateSchemaVersion('0.1.0')).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(validateSchemaVersion('1.0')).toBe(false)
    expect(validateSchemaVersion('v1.0.0')).toBe(false)
    expect(validateSchemaVersion('')).toBe(false)
  })
})

describe('validateComponentSchema', () => {
  it('passes a valid component', () => {
    const result = validateComponentSchema(makeComponent())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('requires id and type', () => {
    const result = validateComponentSchema(
      makeComponent({ id: '', type: '' }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Component must have an id')
    expect(result.errors).toContain('Component must have a type')
  })

  it('validates nested children', () => {
    const result = validateComponentSchema(
      makeComponent({
        children: [makeComponent({ id: '', type: 'input' })],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Child component at index 0'))).toBe(true)
  })
})

describe('validatePageSchema', () => {
  it('passes a valid page schema', () => {
    const result = validatePageSchema(makePage())
    expect(result.valid).toBe(true)
  })

  it('requires version and info.name', () => {
    const result = validatePageSchema(
      makePage({
        version: '',
        info: {
          name: '',
          description: '',
          created: '',
          updated: '',
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Page schema must have a version')
    expect(result.errors).toContain('Page info must have a name')
  })
})
