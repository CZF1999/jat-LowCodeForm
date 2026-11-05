import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrateSchema } from './version'

describe('migrateSchema', () => {
  it('exports current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe('1.0.0')
  })

  it('fills missing version and migrates to current', () => {
    const migrated = migrateSchema({
      components: [],
    })

    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.info).toBeDefined()
    expect(migrated.info.name).toBe('Untitled')
  })

  it('keeps existing info while bumping version', () => {
    const migrated = migrateSchema({
      version: '0.1.0',
      info: {
        name: 'Existing',
        description: 'keep me',
        created: '2020-01-01T00:00:00.000Z',
        updated: '2020-01-01T00:00:00.000Z',
      },
      components: [],
    })

    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.info.name).toBe('Existing')
    expect(migrated.info.description).toBe('keep me')
  })
})
