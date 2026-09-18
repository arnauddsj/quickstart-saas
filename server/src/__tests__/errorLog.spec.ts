import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const inserted = vi.hoisted(() => [] as Record<string, unknown>[])
const insertFails = vi.hoisted(() => ({ value: false }))
const postToDiscord = vi.hoisted(() => vi.fn(async (_input: { severity: string }) => {}))

vi.mock('../db/client.js', () => ({
  pool: {},
  db: {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        if (insertFails.value) throw new Error('database down')
        inserted.push(row)
      },
    }),
  },
}))
vi.mock('../services/discord.js', () => ({ postToDiscord }))

const { reportError } = await import('../services/errorLog.js')

beforeEach(() => {
  inserted.length = 0
  insertFails.value = false
  postToDiscord.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-18T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('reportError', () => {
  it('pages Discord for ERROR and CRITICAL only', async () => {
    await reportError({ severity: 'INFO', type: 'route.info', message: 'i' })
    await reportError({ severity: 'WARNING', type: 'route.warn', message: 'w' })
    await reportError({ severity: 'ERROR', type: 'route.error', message: 'e' })
    await reportError({ severity: 'CRITICAL', type: 'route.critical', message: 'c' })

    expect(inserted.map((r) => r.severity)).toEqual(['INFO', 'WARNING', 'ERROR', 'CRITICAL'])
    expect(postToDiscord.mock.calls.map(([arg]) => arg.severity)).toEqual(['ERROR', 'CRITICAL'])
  })

  it('drops the same type and message within 30 seconds, and records it again after', async () => {
    const report = () => reportError({ severity: 'ERROR', type: 'dedupe.case', message: 'same' })
    await report()
    vi.setSystemTime(new Date('2026-09-18T12:00:29Z'))
    await report()
    expect(inserted).toHaveLength(1)
    expect(postToDiscord).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-09-18T12:00:31Z'))
    await report()
    expect(inserted).toHaveLength(2)
  })

  it('treats a different message under the same type as a new incident', async () => {
    await reportError({ severity: 'WARNING', type: 'dedupe.type', message: 'first' })
    await reportError({ severity: 'WARNING', type: 'dedupe.type', message: 'second' })
    expect(inserted).toHaveLength(2)
  })

  it('never throws when the insert fails, and still pages', async () => {
    insertFails.value = true
    await expect(
      reportError({ severity: 'CRITICAL', type: 'db.down', message: 'x' }),
    ).resolves.toBeUndefined()
    expect(postToDiscord).toHaveBeenCalledTimes(1)
  })

  it('stores the stack of an Error and null for anything else', async () => {
    await reportError({
      severity: 'WARNING',
      type: 'stack.error',
      message: 'a',
      error: new Error('boom'),
    })
    await reportError({ severity: 'WARNING', type: 'stack.string', message: 'b', error: 'plain' })
    expect(String(inserted[0]?.stack)).toContain('boom')
    expect(inserted[1]?.stack).toBeNull()
  })
})
