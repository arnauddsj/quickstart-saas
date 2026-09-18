import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as StripeService from '../../services/stripe.js'
import {
  addMember,
  callerFor,
  db,
  resetDatabase,
  rowCount,
  schema,
  seedInvitation,
  seedOrg,
  seedSession,
  seedUser,
} from './helpers.js'

const fakeStripe = vi.hoisted(() => ({
  subscriptions: { cancel: vi.fn(async () => ({})) },
  customers: { del: vi.fn(async () => ({})) },
}))

vi.mock('../../services/stripe.js', async (importOriginal) => ({
  ...(await importOriginal<typeof StripeService>()),
  stripe: fakeStripe,
}))

const { cleanupBeforeUserDelete, exportUserData } = await import('../../services/account.js')

beforeEach(async () => {
  await resetDatabase()
  fakeStripe.subscriptions.cancel.mockClear()
  fakeStripe.customers.del.mockClear()
})

describe('GDPR export', () => {
  it("returns the caller's rows and nothing that belongs to someone else", async () => {
    const alice = await seedUser({ email: 'alice@test.io', name: 'Alice' })
    const bob = await seedUser({ email: 'bob@test.io', name: 'Bob' })
    const orgA = await seedOrg({ name: 'Alice Org' })
    const orgB = await seedOrg({ name: 'Bob Org' })
    await addMember(orgA.id, alice.id, 'owner')
    await addMember(orgB.id, bob.id, 'owner')
    await seedSession(alice.id, { ipAddress: '203.0.113.1' })
    await seedSession(bob.id, { ipAddress: '203.0.113.2' })
    await seedSession(bob.id)
    await seedInvitation(orgB.id, 'alice@test.io', bob.id)
    await seedInvitation(orgA.id, 'bob@test.io', alice.id)
    await db
      .insert(schema.subscription)
      .values([{ organizationId: orgA.id }, { organizationId: orgB.id }])
    await db.insert(schema.userConsent).values({ userId: alice.id, record: { analytics: false } })

    const data = await exportUserData(alice.id)

    expect(data.user).toMatchObject({ id: alice.id, email: 'alice@test.io', name: 'Alice' })
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0]?.ipAddress).toBe('203.0.113.1')
    expect(data.memberships.map((m) => m.organizationName)).toEqual(['Alice Org'])
    expect(data.invitations.map((i) => i.organizationId)).toEqual([orgB.id])
    expect(data.subscriptions.map((s) => s.organizationId)).toEqual([orgA.id])
    expect(data.consent).toEqual({ analytics: false })

    const text = JSON.stringify(data)
    expect(text).not.toContain('bob@test.io')
    expect(text).not.toContain('203.0.113.2')
    expect(text).not.toContain(bob.id)
  })
})

describe('deletion cleanup', () => {
  async function scenario() {
    const alice = await seedUser()
    const dave = await seedUser()
    const soleOwned = await seedOrg({ name: 'Sole' })
    const coOwned = await seedOrg({ name: 'Co' })
    const memberOf = await seedOrg({ name: 'Member' })
    await addMember(soleOwned.id, alice.id, 'owner')
    await addMember(coOwned.id, alice.id, 'owner')
    await addMember(coOwned.id, dave.id, 'owner')
    await addMember(memberOf.id, alice.id, 'member')
    await addMember(memberOf.id, dave.id, 'owner')
    await db.insert(schema.subscription).values({
      organizationId: soleOwned.id,
      plan: 'PRO',
      stripeCustomerId: 'cus_sole',
      stripeSubscriptionId: 'sub_sole',
    })
    await seedSession(alice.id)
    await db.insert(schema.userConsent).values({ userId: alice.id, record: {} })
    return { alice, dave, soleOwned, coOwned, memberOf }
  }

  it('deletes the sole-owned organization after cancelling its Stripe subscription, keeps the others', async () => {
    const { alice, soleOwned, coOwned, memberOf } = await scenario()
    await cleanupBeforeUserDelete(alice.id)

    expect(fakeStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_sole')
    expect(fakeStripe.customers.del).toHaveBeenCalledWith('cus_sole')
    expect(
      await db.query.organization.findFirst({ where: eq(schema.organization.id, soleOwned.id) }),
    ).toBeUndefined()
    expect(await rowCount(schema.subscription)).toBe(0)
    expect(await rowCount(schema.organization, eq(schema.organization.id, coOwned.id))).toBe(1)
    expect(await rowCount(schema.organization, eq(schema.organization.id, memberOf.id))).toBe(1)
  })

  it('lets the user row cascade to sessions, memberships and consent once cleanup ran', async () => {
    const { alice, dave, coOwned } = await scenario()
    await cleanupBeforeUserDelete(alice.id)
    await db.delete(schema.user).where(eq(schema.user.id, alice.id))

    expect(await rowCount(schema.session)).toBe(0)
    expect(await rowCount(schema.userConsent)).toBe(0)
    expect(await rowCount(schema.member, eq(schema.member.userId, alice.id))).toBe(0)
    expect(await rowCount(schema.member, eq(schema.member.organizationId, coOwned.id))).toBe(1)
    expect(await rowCount(schema.member, eq(schema.member.userId, dave.id))).toBe(2)
  })

  it('aborts and keeps the organization when Stripe refuses the cancellation', async () => {
    const { alice, soleOwned } = await scenario()
    fakeStripe.subscriptions.cancel.mockRejectedValueOnce(new Error('stripe down'))

    await expect(cleanupBeforeUserDelete(alice.id)).rejects.toThrow('stripe down')
    expect(await rowCount(schema.organization, eq(schema.organization.id, soleOwned.id))).toBe(1)
    expect(await rowCount(schema.subscription)).toBe(1)
  })
})

describe('consent record', () => {
  it('round-trips on the account and answers null when signed out', async () => {
    const alice = await seedUser()
    const asAlice = callerFor(alice)

    expect(await asAlice.user.getConsent()).toBeNull()
    await asAlice.user.setConsent({ analytics: true, v: '2026-09' })
    await asAlice.user.setConsent({ analytics: false, v: '2026-09' })
    expect((await asAlice.user.getConsent())?.record).toEqual({ analytics: false, v: '2026-09' })
    expect(await rowCount(schema.userConsent)).toBe(1)
    expect(await callerFor(null).user.getConsent()).toBeNull()
  })
})
