import { beforeEach, describe, expect, it, vi } from 'vitest'

const selectRows = vi.fn<() => unknown[]>()
const deleted: string[] = []
const subscriptionByOrg = new Map<
  string,
  { stripeSubscriptionId: string | null; stripeCustomerId: string | null }
>()

vi.mock('../db/client.js', () => {
  const chain = () => ({
    from: () => ({
      where: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }),
      innerJoin: () => ({ where: () => Promise.resolve([]) }),
    }),
  })
  return {
    pool: {},
    db: {
      select: () => {
        const rows = selectRows()
        const result = Promise.resolve(rows)
        return { from: () => ({ where: () => result, innerJoin: () => ({ where: () => result }) }) }
      },
      delete: () => ({
        where: (cond: { queryChunks?: unknown[] }) => {
          deleted.push(JSON.stringify(cond.queryChunks?.length ?? 0))
          return Promise.resolve()
        },
      }),
      query: {
        subscription: {
          findFirst: async ({ where }: { where: { queryChunks: unknown[] } }) => {
            const id = String((where.queryChunks[3] as { value?: string } | undefined)?.value ?? '')
            return subscriptionByOrg.get(id) ?? undefined
          },
        },
        user: { findFirst: async () => undefined },
        userConsent: { findFirst: async () => undefined },
      },
      insert: chain,
    },
  }
})

const cancel = vi.fn(async () => ({}))
const del = vi.fn(async () => ({}))
vi.mock('./stripe.js', () => ({ stripe: { subscriptions: { cancel }, customers: { del } } }))
vi.mock('../services/stripe.js', () => ({
  stripe: { subscriptions: { cancel }, customers: { del } },
}))

const anonymizeUsage = vi.fn(async (_userId: string) => {})
vi.mock('../services/usage.js', () => ({ anonymizeUsage }))

const { organizationsOwnedSolelyBy, cleanupBeforeUserDelete } =
  await import('../services/account.js')

describe('account deletion cleanup', () => {
  beforeEach(() => {
    selectRows.mockReset()
    deleted.length = 0
    subscriptionByOrg.clear()
    cancel.mockClear()
    del.mockClear()
    anonymizeUsage.mockClear()
  })

  it('returns nothing for a user who owns no organization', async () => {
    selectRows.mockReturnValueOnce([])
    expect(await organizationsOwnedSolelyBy('u1')).toEqual([])
  })

  it('keeps an organization that has another owner', async () => {
    selectRows
      .mockReturnValueOnce([{ organizationId: 'org1' }])
      .mockReturnValueOnce([{ organizationId: 'org1' }])
    expect(await organizationsOwnedSolelyBy('u1')).toEqual([])
  })

  it('lists organizations where the user is the only owner', async () => {
    selectRows
      .mockReturnValueOnce([{ organizationId: 'org1' }, { organizationId: 'org2' }])
      .mockReturnValueOnce([{ organizationId: 'org2' }])
    expect(await organizationsOwnedSolelyBy('u1')).toEqual(['org1'])
  })

  it('cancels the Stripe subscription and deletes the organization of a sole owner', async () => {
    selectRows.mockReturnValueOnce([{ organizationId: 'org1' }]).mockReturnValueOnce([])
    subscriptionByOrg.set('org1', { stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_1' })
    await cleanupBeforeUserDelete('u1')
    expect(cancel).toHaveBeenCalledWith('sub_1')
    expect(del).toHaveBeenCalledWith('cus_1')
    expect(deleted).toHaveLength(1)
    expect(anonymizeUsage).toHaveBeenCalledWith('u1')
  })

  it('refuses to delete when Stripe cancellation fails, so no orphaned paid subscription survives', async () => {
    selectRows.mockReturnValueOnce([{ organizationId: 'org1' }]).mockReturnValueOnce([])
    subscriptionByOrg.set('org1', { stripeSubscriptionId: 'sub_1', stripeCustomerId: null })
    cancel.mockRejectedValueOnce(new Error('stripe down'))
    await expect(cleanupBeforeUserDelete('u1')).rejects.toThrow('stripe down')
    expect(deleted).toHaveLength(0)
    expect(anonymizeUsage).not.toHaveBeenCalled()
  })
})
