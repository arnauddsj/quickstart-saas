// docs/billing.md
import { planGuard } from '../../config/plans.js'
import {
  createCheckoutSession,
  createPortalSession,
  getOrCreateSubscription,
} from '../../services/stripe.js'
import { track } from '../../services/usage.js'
import { orgAdminProcedure, orgProcedure, router } from '../index.js'

export const billingRouter = router({
  getSubscription: orgProcedure.query(async ({ ctx }) => {
    const sub = await getOrCreateSubscription(ctx.organizationId)
    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      hasStripeCustomer: Boolean(sub.stripeCustomerId),
    }
  }),

  createCheckout: orgAdminProcedure.mutation(async ({ ctx }) => {
    const url = await createCheckoutSession({
      organizationId: ctx.organizationId,
      plan: 'PRO',
      customerEmail: ctx.user.email,
    })
    await track(ctx.user.id, ctx.organizationId, 'billing.checkout_started')
    return { url }
  }),

  createPortal: orgAdminProcedure.mutation(async ({ ctx }) => ({
    url: await createPortalSession(ctx.organizationId),
  })),

  exportData: orgProcedure.query(async ({ ctx }) => {
    const sub = await getOrCreateSubscription(ctx.organizationId)
    planGuard(sub.plan, 'exports')
    return { exportedAt: new Date().toISOString(), rows: [] as never[] }
  }),
})
