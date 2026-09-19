import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyStripeSubscription,
  createCheckoutSession,
  getOrCreateSubscription,
  stripe,
} from '../../services/stripe.js'
import { db, resetDatabase, rowCount, schema, seedOrg } from './helpers.js'
import type { App } from './helpers.js'

const PERIOD_END = 1_900_000_000

function fakeSubscription(
  organizationId: string | undefined,
  over: { status?: Stripe.Subscription.Status; price?: string; id?: string } = {},
): Stripe.Subscription {
  return {
    id: over.id ?? 'sub_test_1',
    object: 'subscription',
    status: over.status ?? 'active',
    customer: 'cus_test_1',
    cancel_at_period_end: false,
    metadata: organizationId ? { organizationId } : {},
    items: {
      object: 'list',
      data: [{ price: { id: over.price ?? 'price_pro_test' }, current_period_end: PERIOD_END }],
    },
  } as unknown as Stripe.Subscription
}

const planOf = async (organizationId: string) =>
  (
    await db.query.subscription.findFirst({
      where: eq(schema.subscription.organizationId, organizationId),
    })
  )?.plan

beforeEach(resetDatabase)

describe('subscription rows', () => {
  it('creates exactly one FREE row even when first reads race', async () => {
    const org = await seedOrg()
    const rows = await Promise.all(Array.from({ length: 5 }, () => getOrCreateSubscription(org.id)))
    expect(new Set(rows.map((r) => r.id)).size).toBe(1)
    expect(rows[0]?.plan).toBe('FREE')
    expect(await rowCount(schema.subscription)).toBe(1)
  })

  it('maps an active subscription on the Pro price to PRO and stores the Stripe ids', async () => {
    const org = await seedOrg()
    await applyStripeSubscription(fakeSubscription(org.id))
    const row = await db.query.subscription.findFirst({
      where: eq(schema.subscription.organizationId, org.id),
    })
    expect(row).toMatchObject({
      plan: 'PRO',
      status: 'active',
      stripeCustomerId: 'cus_test_1',
      stripeSubscriptionId: 'sub_test_1',
    })
    expect(row?.currentPeriodEnd?.getTime()).toBe(PERIOD_END * 1000)
  })

  it('treats trialing as paid and canceled or unknown prices as FREE', async () => {
    const org = await seedOrg()
    await applyStripeSubscription(fakeSubscription(org.id, { status: 'trialing' }))
    expect(await planOf(org.id)).toBe('PRO')
    await applyStripeSubscription(fakeSubscription(org.id, { status: 'canceled' }))
    expect(await planOf(org.id)).toBe('FREE')
    await applyStripeSubscription(fakeSubscription(org.id, { price: 'price_unknown' }))
    expect(await planOf(org.id)).toBe('FREE')
    expect(await rowCount(schema.subscription)).toBe(1)
  })

  it('ignores a subscription without organization metadata', async () => {
    await applyStripeSubscription(fakeSubscription(undefined))
    expect(await rowCount(schema.subscription)).toBe(0)
  })

  it('ignores a subscription whose organization is gone', async () => {
    const org = await seedOrg()
    await db.delete(schema.organization).where(eq(schema.organization.id, org.id))
    await applyStripeSubscription(fakeSubscription(org.id))
    expect(await rowCount(schema.subscription)).toBe(0)
  })

  it("does not let an old subscription's cancellation downgrade a newer paid one", async () => {
    const org = await seedOrg()
    await applyStripeSubscription(fakeSubscription(org.id, { id: 'sub_old' }))
    await applyStripeSubscription(fakeSubscription(org.id, { id: 'sub_old', status: 'canceled' }))
    await applyStripeSubscription(fakeSubscription(org.id, { id: 'sub_new' }))
    await applyStripeSubscription(fakeSubscription(org.id, { id: 'sub_old', status: 'canceled' }))

    const row = await db.query.subscription.findFirst({
      where: eq(schema.subscription.organizationId, org.id),
    })
    expect(row).toMatchObject({ plan: 'PRO', stripeSubscriptionId: 'sub_new' })
  })
})

describe('checkout eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(stripe.customers, 'create').mockResolvedValue({ id: 'cus_new' } as never)
    vi.spyOn(stripe.checkout.sessions, 'create').mockResolvedValue({
      url: 'https://checkout.test/s',
    } as never)
  })

  const checkout = (organizationId: string) =>
    createCheckoutSession({ organizationId, plan: 'PRO', customerEmail: 'owner@test.io' })

  it('refuses a workspace that already pays and never opens a session', async () => {
    const org = await seedOrg()
    await applyStripeSubscription(fakeSubscription(org.id))

    await expect(checkout(org.id)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('refuses while a payment is past due, so the owner fixes the card instead', async () => {
    const org = await seedOrg()
    await applyStripeSubscription(fakeSubscription(org.id, { status: 'past_due' }))
    await expect(checkout(org.id)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })

  it('lets a cancelled workspace subscribe again with its existing customer', async () => {
    const org = await seedOrg()
    await applyStripeSubscription(fakeSubscription(org.id, { status: 'canceled' }))

    expect(await checkout(org.id)).toBe('https://checkout.test/s')
    expect(stripe.customers.create).not.toHaveBeenCalled()
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test_1' }),
    )
  })

  it('creates the first customer with an idempotency key tied to the workspace', async () => {
    const org = await seedOrg()
    await checkout(org.id)
    expect(stripe.customers.create).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: `customer-${org.id}`,
    })
  })
})

describe('Stripe webhook through Fastify', () => {
  let app: App

  beforeAll(async () => {
    const { buildApp } = await import('../../app.js')
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  function send(payload: string, signature?: string) {
    return app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        ...(signature ? { 'stripe-signature': signature } : {}),
      },
      payload,
    })
  }

  function event(type: string, object: Stripe.Subscription, id = 'evt_test_1') {
    return JSON.stringify({ id, object: 'event', type, data: { object } })
  }

  const sign = (payload: string) =>
    stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_integration' })

  const inStripe = new Map<string, Stripe.Subscription>()

  beforeEach(() => {
    inStripe.clear()
    vi.spyOn(stripe.subscriptions, 'retrieve').mockImplementation((async (id: string) => {
      const sub = inStripe.get(id)
      if (!sub) throw new Error(`no subscription ${id} in fake Stripe`)
      return sub
    }) as never)
  })

  function deliver(type: string, object: Stripe.Subscription, id = 'evt_test_1') {
    if (!inStripe.has(object.id)) inStripe.set(object.id, object)
    const payload = event(type, object, id)
    return send(payload, sign(payload))
  }

  it('applies a signed update, and a replay changes nothing', async () => {
    const org = await seedOrg()
    inStripe.set('sub_test_1', fakeSubscription(org.id))
    const payload = event('customer.subscription.updated', fakeSubscription(org.id))
    const header = sign(payload)

    expect((await send(payload, header)).json()).toEqual({ received: true })
    expect(await planOf(org.id)).toBe('PRO')
    expect((await send(payload, header)).statusCode).toBe(200)
    expect(await rowCount(schema.subscription)).toBe(1)
  })

  it('downgrades to FREE on a signed deletion', async () => {
    const org = await seedOrg()
    await deliver('customer.subscription.updated', fakeSubscription(org.id))
    const canceled = fakeSubscription(org.id, { status: 'canceled' })
    inStripe.set(canceled.id, canceled)
    expect((await deliver('customer.subscription.deleted', canceled, 'evt_2')).statusCode).toBe(200)
    expect(await planOf(org.id)).toBe('FREE')
  })

  it("applies Stripe's current state, so a stale event delivered late cannot restore access", async () => {
    const org = await seedOrg()
    const active = fakeSubscription(org.id)
    await deliver('customer.subscription.updated', active, 'evt_1')
    inStripe.set(active.id, fakeSubscription(org.id, { status: 'canceled' }))
    await deliver('customer.subscription.deleted', inStripe.get(active.id)!, 'evt_2')

    expect((await deliver('customer.subscription.updated', active, 'evt_1')).statusCode).toBe(200)
    expect(await planOf(org.id)).toBe('FREE')
  })

  it('acknowledges an event for a deleted workspace instead of failing forever', async () => {
    const org = await seedOrg()
    await db.delete(schema.organization).where(eq(schema.organization.id, org.id))
    expect(
      (await deliver('customer.subscription.updated', fakeSubscription(org.id))).json(),
    ).toEqual({ received: true })
    expect(await rowCount(schema.subscription)).toBe(0)
  })

  it('rejects a tampered body and a missing signature', async () => {
    const org = await seedOrg()
    const payload = event('customer.subscription.updated', fakeSubscription(org.id))
    const header = sign(payload)
    const tampered = payload.replace('price_pro_test', 'price_pro_evil')

    expect((await send(tampered, header)).statusCode).toBe(400)
    expect((await send(payload)).statusCode).toBe(400)
    expect(await rowCount(schema.subscription)).toBe(0)
  })
})
