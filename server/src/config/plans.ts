// docs/billing.md
import { TRPCError } from '@trpc/server'
import { env } from './env.js'
import type { PLAN_NAMES } from '../db/schema/app.js'

export type PlanName = (typeof PLAN_NAMES)[number]

export const PLANS = {
  FREE: {
    label: 'Free',
    stripePriceId: null,
    limits: { projects: 3 },
    features: { exports: false },
  },
  PRO: {
    label: 'Pro',
    stripePriceId: env.STRIPE_PRICE_PRO_MONTHLY,
    limits: { projects: 100 },
    features: { exports: true },
  },
} as const satisfies Record<
  PlanName,
  {
    label: string
    stripePriceId: string | null
    limits: Record<string, number>
    features: Record<string, boolean>
  }
>

export type Feature = keyof (typeof PLANS)['FREE']['features']
export type Limit = keyof (typeof PLANS)['FREE']['limits']

export function planGuard(plan: PlanName, feature: Feature): void {
  if (!PLANS[plan].features[feature]) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `The ${PLANS[plan].label} plan does not include ${feature}`,
    })
  }
}

export function planLimit(plan: PlanName, limit: Limit): number {
  return PLANS[plan].limits[limit]
}

export function planFromPriceId(priceId: string | null | undefined): PlanName {
  if (!priceId) return 'FREE'
  const entry = (Object.entries(PLANS) as [PlanName, (typeof PLANS)[PlanName]][]).find(
    ([, p]) => p.stripePriceId === priceId,
  )
  return entry?.[0] ?? 'FREE'
}
