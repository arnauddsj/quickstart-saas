import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { applyStripeSubscription, getOrCreateSubscription, stripe } from '../../services/stripe.js'
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

  it('applies a signed update, and a replay changes nothing', async () => {
    const org = await seedOrg()
    const payload = event('customer.subscription.updated', fakeSubscription(org.id))
    const header = sign(payload)

    expect((await send(payload, header)).json()).toEqual({ received: true })
    expect(await planOf(org.id)).toBe('PRO')
    expect((await send(payload, header)).statusCode).toBe(200)
    expect(await rowCount(schema.subscription)).toBe(1)
  })

  it('downgrades to FREE on a signed deletion', async () => {
    const org = await seedOrg()
    const up = event('customer.subscription.updated', fakeSubscription(org.id))
    await send(up, sign(up))
    const down = event(
      'customer.subscription.deleted',
      fakeSubscription(org.id, { status: 'canceled' }),
      'evt_2',
    )
    expect((await send(down, sign(down))).statusCode).toBe(200)
    expect(await planOf(org.id)).toBe('FREE')
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
