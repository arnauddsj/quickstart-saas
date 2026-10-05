import { TRPCError } from '@trpc/server'
import { describe, expect, it } from 'vitest'
import { PLANS, planFromPriceId, planGuard, planLimit } from '../config/plans.js'

describe('plans', () => {
  it('planGuard throws FORBIDDEN for a feature the plan lacks', () => {
    expect(() => planGuard('FREE', 'exports')).toThrowError(TRPCError)
    try {
      planGuard('FREE', 'exports')
    } catch (err) {
      expect((err as TRPCError).code).toBe('FORBIDDEN')
    }
  })

  it('planGuard passes for an included feature', () => {
    expect(() => planGuard('PRO', 'exports')).not.toThrow()
  })

  it('planLimit returns the configured number', () => {
    expect(planLimit('FREE', 'projects')).toBe(3)
    expect(planLimit('PRO', 'projects')).toBe(100)
  })

  it('every paid plan has a Stripe price id and FREE has none', () => {
    expect(PLANS.FREE.stripePriceId).toBeNull()
    expect(PLANS.PRO.stripePriceId).toBeTruthy()
  })

  it('planFromPriceId maps known ids and falls back to FREE', () => {
    expect(planFromPriceId(PLANS.PRO.stripePriceId)).toBe('PRO')
    expect(planFromPriceId('price_unknown')).toBe('FREE')
    expect(planFromPriceId(null)).toBe('FREE')
    expect(planFromPriceId(undefined)).toBe('FREE')
    expect(planFromPriceId('')).toBe('FREE')
  })
})
