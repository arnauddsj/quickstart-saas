import { TRPCError } from '@trpc/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db/client.js', () => ({ pool: {}, db: {} }))

const { STRIPE_CONFIGURED, createCheckoutSession, createPortalSession } =
  await import('../services/stripe.js')

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'OK'
  } catch (err) {
    return err instanceof TRPCError ? `${err.code}: ${err.message}` : String(err)
  }
}

describe('billing without Stripe keys', () => {
  it('treats the placeholder key as not configured', () => {
    expect(STRIPE_CONFIGURED).toBe(false)
  })

  it('refuses checkout and portal with a clear message before calling Stripe', async () => {
    const expected = 'PRECONDITION_FAILED: Billing is not configured on this server'
    expect(
      await code(
        createCheckoutSession({ organizationId: 'o1', plan: 'PRO', customerEmail: 'a@b.io' }),
      ),
    ).toBe(expected)
    expect(await code(createPortalSession('o1'))).toBe(expected)
  })
})
