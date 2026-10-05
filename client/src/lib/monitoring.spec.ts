import { TRPCClientError } from '@trpc/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}))
vi.mock('@sentry/vue', () => sentry)

const { reportQueryFailure, runAction } = await import('./monitoring')

function trpcError(httpStatus: number, path = 'billing.createCheckout') {
  const err = new TRPCClientError('failed')
  Object.assign(err, { data: { httpStatus, path, code: 'X' } })
  return err
}

beforeEach(() => vi.clearAllMocks())

describe('reportQueryFailure', () => {
  it('only leaves a breadcrumb for tRPC errors, which the server reports itself', () => {
    reportQueryFailure(trpcError(500), 'mutation')
    reportQueryFailure(trpcError(403), 'query')
    expect(sentry.captureException).not.toHaveBeenCalled()
    expect(sentry.addBreadcrumb.mock.calls.map(([b]) => b.level)).toEqual(['error', 'warning'])
  })

  it('captures client-side failures', () => {
    const err = new TypeError('x is undefined')
    reportQueryFailure(err, 'query')
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { type: 'client.query' },
      fingerprint: undefined,
    })
  })
})

describe('runAction', () => {
  it('links a server failure to the server issue by fingerprint and action id', async () => {
    const err = trpcError(500)
    let seen = ''
    await expect(
      runAction('billing.checkout', async (id) => {
        seen = id
        throw err
      }),
    ).rejects.toBe(err)
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { type: 'trpc.billing.createCheckout', action: 'billing.checkout', action_id: seen },
      fingerprint: ['trpc.billing.createCheckout'],
    })
  })

  it('does not report expected rejections, and never reports the same error twice', async () => {
    await expect(runAction('a', () => Promise.reject(trpcError(400)))).rejects.toBeDefined()
    const bug = new Error('bug')
    await expect(runAction('b', () => Promise.reject(bug))).rejects.toBe(bug)
    reportQueryFailure(bug, 'mutation')
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
  })
})
