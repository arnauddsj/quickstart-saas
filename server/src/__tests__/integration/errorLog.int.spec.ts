import { beforeEach, describe, expect, it } from 'vitest'
import { deleteExpiredErrorLogs } from '../../jobs/errorLogCleanup.js'
import { reportError } from '../../services/errorLog.js'
import { daysAgo, db, resetDatabase, schema, seedOrg, seedUser } from './helpers.js'

beforeEach(resetDatabase)

describe('error log', () => {
  it('stores a report with its context, user, organization and stack', async () => {
    const user = await seedUser()
    const org = await seedOrg()
    await reportError({
      severity: 'WARNING',
      type: 'integration.stored',
      message: 'Something odd',
      error: new Error('boom'),
      context: { attempt: 2 },
      userId: user.id,
      organizationId: org.id,
    })

    const [row] = await db.select().from(schema.errorLog)
    expect(row).toMatchObject({
      severity: 'WARNING',
      type: 'integration.stored',
      message: 'Something odd',
      context: { attempt: 2 },
      userId: user.id,
      organizationId: org.id,
    })
    expect(row?.stack).toContain('boom')
  })

  it('keeps rows younger than 30 days and deletes older ones', async () => {
    await db.insert(schema.errorLog).values([
      { severity: 'ERROR', type: 'old', message: 'old', createdAt: daysAgo(31) },
      { severity: 'ERROR', type: 'recent', message: 'recent', createdAt: daysAgo(29) },
    ])

    expect(await deleteExpiredErrorLogs()).toBe(1)
    const rows = await db.select({ type: schema.errorLog.type }).from(schema.errorLog)
    expect(rows).toEqual([{ type: 'recent' }])
  })
})
