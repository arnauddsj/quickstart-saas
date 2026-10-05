import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addMember,
  callerFor,
  resetDatabase,
  rowCount,
  schema,
  seedInvitation,
  seedOrg,
  seedUser,
} from './helpers.js'

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'OK'
  } catch (err) {
    return err instanceof TRPCError ? err.code : String(err)
  }
}

async function world() {
  const alice = await seedUser({ email: 'alice@test.io' })
  const carol = await seedUser({ email: 'carol@test.io' })
  const bob = await seedUser({ email: 'bob@test.io' })
  const orgA = await seedOrg({ name: 'A' })
  const orgB = await seedOrg({ name: 'B' })
  await addMember(orgA.id, alice.id, 'owner')
  await addMember(orgA.id, carol.id, 'member')
  await addMember(orgB.id, bob.id, 'owner')
  await seedInvitation(orgA.id, 'invited-a@test.io', alice.id)
  await seedInvitation(orgB.id, 'invited-b@test.io', bob.id)
  return { alice, carol, bob, orgA, orgB }
}

beforeEach(resetDatabase)

describe('organization boundary', () => {
  it('lists only the members of the active organization', async () => {
    const { alice, orgA } = await world()
    const members = await callerFor(alice, { activeOrganizationId: orgA.id }).org.members()
    expect(members.map((m) => m.email).sort()).toEqual(['alice@test.io', 'carol@test.io'])
  })

  it('refuses an active organization the caller does not belong to', async () => {
    const { alice, orgB } = await world()
    expect(await code(callerFor(alice, { activeOrganizationId: orgB.id }).org.current())).toBe(
      'FORBIDDEN',
    )
    expect(await code(callerFor(alice, { activeOrganizationId: orgB.id }).org.members())).toBe(
      'FORBIDDEN',
    )
  })

  it('requires an active organization', async () => {
    const { alice } = await world()
    expect(await code(callerFor(alice, { activeOrganizationId: null }).org.current())).toBe(
      'PRECONDITION_FAILED',
    )
  })

  it('keeps invitations and billing actions for organization owners and admins', async () => {
    const { alice, carol, orgA } = await world()
    const asCarol = callerFor(carol, { activeOrganizationId: orgA.id })
    expect(await code(asCarol.org.invitations())).toBe('FORBIDDEN')
    expect(await code(asCarol.billing.createCheckout())).toBe('FORBIDDEN')
    expect(await code(asCarol.billing.createPortal())).toBe('FORBIDDEN')

    const invites = await callerFor(alice, { activeOrganizationId: orgA.id }).org.invitations()
    expect(invites.map((i) => i.email)).toEqual(['invited-a@test.io'])
  })

  it('reads and creates the subscription of the active organization only', async () => {
    const { carol, orgA, orgB } = await world()
    const sub = await callerFor(carol, { activeOrganizationId: orgA.id }).billing.getSubscription()
    expect(sub.plan).toBe('FREE')
    expect(
      await rowCount(schema.subscription, eq(schema.subscription.organizationId, orgA.id)),
    ).toBe(1)
    expect(
      await rowCount(schema.subscription, eq(schema.subscription.organizationId, orgB.id)),
    ).toBe(0)
  })

  it('blocks premium features on the free plan with the plan guard', async () => {
    const { carol, orgA } = await world()
    expect(
      await code(callerFor(carol, { activeOrganizationId: orgA.id }).billing.exportData()),
    ).toBe('FORBIDDEN')
  })
})
