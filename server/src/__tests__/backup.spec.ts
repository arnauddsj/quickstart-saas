import { describe, expect, it } from 'vitest'
import { backupName, backupsToPrune, compareCounts, parseCounts } from '../scripts/setup/backup.js'

describe('backup helpers', () => {
  it('names dumps so that sorting by name sorts by time', () => {
    expect(backupName('acme', new Date('2026-09-19T09:05:07Z'))).toBe('acme-20260919-090507.dump')
  })

  it('parses psql rows and ignores noise', () => {
    expect(parseCounts('public.user|3\npgboss.job|0\n\nBEGIN\n')).toEqual({
      'public.user': 3,
      'pgboss.job': 0,
    })
  })

  it('reports tables whose counts differ or are missing on either side', () => {
    expect(
      compareCounts({ 'public.a': 1, 'public.b': 2 }, { 'public.a': 1, 'public.c': 0 }),
    ).toEqual([
      { table: 'public.b', expected: 2, restored: null },
      { table: 'public.c', expected: null, restored: 0 },
    ])
  })

  it('prunes the oldest dumps of this database only, and nothing when keep is 0', () => {
    const files = [
      '/b/acme-20260919-090000.dump',
      '/b/acme-20260917-090000.dump',
      '/b/acme-20260918-090000.dump',
      '/b/acme-20260918-090000.dump.json',
      '/b/other-20260101-000000.dump',
    ]
    expect(backupsToPrune(files, 'acme', 2)).toEqual(['/b/acme-20260917-090000.dump'])
    expect(backupsToPrune(files, 'acme', 0)).toEqual([])
  })
})
