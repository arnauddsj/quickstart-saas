// docs/billing.md
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { env } from '../config/env.js'
import { PLANS, planFromPriceId, type PlanName } from '../config/plans.js'
import { db } from '../db/client.js'
import { organization, subscription } from '../db/schema/index.js'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY)

export const STRIPE_CONFIGURED = !env.STRIPE_SECRET_KEY.endsWith('_placeholder')

function assertBillingConfigured() {
  if (!STRIPE_CONFIGURED) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Billing is not configured on this server',
    })
  }
}

const isPaying = (status: string | null) => status === 'active' || status === 'trialing'
const hasLiveSubscription = (status: string | null) => isPaying(status) || status === 'past_due'

export async function getOrCreateSubscription(organizationId: string) {
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
  })
  if (existing) return existing
  const [created] = await db
    .insert(subscription)
    .values({ organizationId })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  const raced = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
  })
  if (!raced) throw new Error(`subscription row missing for organization ${organizationId}`)
  return raced
}

async function ensureStripeCustomer(organizationId: string, email: string): Promise<string> {
  const sub = await getOrCreateSubscription(organizationId)
  if (sub.stripeCustomerId) return sub.stripeCustomerId
  const org = await db.query.organization.findFirst({ where: eq(organization.id, organizationId) })
  const customer = await stripe.customers.create(
    { email, name: org?.name, metadata: { organizationId } },
    { idempotencyKey: `customer-${organizationId}` },
  )
  await db
    .update(subscription)
    .set({ stripeCustomerId: customer.id })
    .where(eq(subscription.organizationId, organizationId))
  return customer.id
}

export async function createCheckoutSession(input: {
  organizationId: string
  plan: Exclude<PlanName, 'FREE'>
  customerEmail: string
}): Promise<string> {
  assertBillingConfigured()
  const current = await getOrCreateSubscription(input.organizationId)
  if (current.stripeSubscriptionId && hasLiveSubscription(current.status)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'This workspace already has a subscription; manage it in the billing portal',
    })
  }
  const priceId = PLANS[input.plan].stripePriceId
  const customer = await ensureStripeCustomer(input.organizationId, input.customerEmail)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: input.organizationId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.PUBLIC_URL}/settings/billing?status=success`,
    cancel_url: `${env.PUBLIC_URL}/settings/billing?status=cancelled`,
    subscription_data: { metadata: { organizationId: input.organizationId } },
  })
  if (!session.url) throw new Error('Stripe returned a checkout session without a url')
  return session.url
}

export async function createPortalSession(organizationId: string): Promise<string> {
  assertBillingConfigured()
  const sub = await getOrCreateSubscription(organizationId)
  if (!sub.stripeCustomerId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No Stripe customer for this organization yet',
    })
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${env.PUBLIC_URL}/settings/billing`,
  })
  return session.url
}

export async function applyStripeSubscription(stripeSub: Stripe.Subscription): Promise<void> {
  const organizationId = stripeSub.metadata.organizationId
  if (!organizationId) return
  const [org, current] = await Promise.all([
    db.query.organization.findFirst({ where: eq(organization.id, organizationId) }),
    db.query.subscription.findFirst({ where: eq(subscription.organizationId, organizationId) }),
  ])
  if (!org) return
  if (
    current?.stripeSubscriptionId &&
    current.stripeSubscriptionId !== stripeSub.id &&
    isPaying(current.status) &&
    !isPaying(stripeSub.status)
  )
    return
  const item = stripeSub.items.data[0]
  const plan = isPaying(stripeSub.status) ? planFromPriceId(item?.price.id) : 'FREE'
  const customerId =
    typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null

  await db
    .insert(subscription)
    .values({
      organizationId,
      plan,
      status: stripeSub.status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSub.id,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscription.organizationId,
      set: {
        plan,
        status: stripeSub.status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    })
}
