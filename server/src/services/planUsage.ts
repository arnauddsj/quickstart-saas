// docs/billing.md
import { PLANS, planLimit } from '../config/plans.js'
import type { Limit, PlanName } from '../config/plans.js'
import { usageCounters } from './analytics.js'

export async function planUsage(organizationId: string, plan: PlanName) {
  const limits = Object.keys(PLANS[plan].limits) as Limit[]
  return Promise.all(
    limits.map(async (limit) => {
      const [row] = await usageCounters[limit](organizationId)
      return { limit, used: row?.used ?? 0, max: planLimit(plan, limit) }
    }),
  )
}
