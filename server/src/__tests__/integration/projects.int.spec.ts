// docs/reference-feature.md
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { PLANS } from '../../config/plans.js'
import { addMember, callerFor, db, resetDatabase, schema, seedOrg, seedUser } from './helpers.js'

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
  const carol = await seedUser({ email: 'carol@test.io', name: 'Carol' })
  const bob = await seedUser({ email: 'bob@test.io' })
  const orgA = await seedOrg({ name: 'A' })
  const orgB = await seedOrg({ name: 'B' })
  await addMember(orgA.id, alice.id, 'owner')
  await addMember(orgA.id, carol.id, 'member')
  await addMember(orgB.id, bob.id, 'owner')
  return {
    alice: callerFor(alice, { activeOrganizationId: orgA.id }),
    carol: callerFor(carol, { activeOrganizationId: orgA.id }),
    bob: callerFor(bob, { activeOrganizationId: orgB.id }),
    orgA,
  }
}

beforeEach(resetDatabase)

describe('projects stay inside their workspace', () => {
  it('lists only the active workspace projects', async () => {
    const { alice, bob } = await world()
    await alice.project.create({ name: 'Alpha' })
    await bob.project.create({ name: 'Bravo' })
    expect((await alice.project.list()).projects.map((p) => p.name)).toEqual(['Alpha'])
    expect((await bob.project.list()).projects.map((p) => p.name)).toEqual(['Bravo'])
  })

  it('cannot rename or delete another workspace project, even with its id', async () => {
    const { alice, bob } = await world()
    const alpha = await alice.project.create({ name: 'Alpha' })
    expect(await code(bob.project.rename({ id: alpha.id, name: 'Stolen' }))).toBe('NOT_FOUND')
    expect(await code(bob.project.delete({ id: alpha.id }))).toBe('NOT_FOUND')
    expect((await alice.project.list()).projects[0]?.name).toBe('Alpha')
  })

  it('lets members rename but only owners and admins delete', async () => {
    const { alice, carol } = await world()
    const alpha = await alice.project.create({ name: 'Alpha' })
    expect((await carol.project.rename({ id: alpha.id, name: 'Renamed' })).name).toBe('Renamed')
    expect(await code(carol.project.delete({ id: alpha.id }))).toBe('FORBIDDEN')
    expect(await alice.project.delete({ id: alpha.id })).toEqual({ id: alpha.id })
  })
})

describe('who created a project', () => {
  it('records the creator and keeps the project when that account is deleted', async () => {
    const { alice, carol } = await world()
    await carol.project.create({ name: 'By Carol' })
    expect((await alice.project.list()).projects[0]?.createdBy).toBe('Carol')

    await db.delete(schema.user).where(eq(schema.user.email, 'carol@test.io'))
    const [kept] = (await alice.project.list()).projects
    expect(kept?.name).toBe('By Carol')
    expect(kept?.createdBy).toBeNull()
  })
})

describe('the plan limits projects', () => {
  it('refuses the project past the FREE limit and allows more on PRO', async () => {
    const { alice, orgA } = await world()
    const max = PLANS.FREE.limits.projects
    for (let i = 0; i < max; i++) await alice.project.create({ name: `P${i}` })
    expect(await code(alice.project.create({ name: 'One too many' }))).toBe('FORBIDDEN')
    expect((await alice.project.list()).limit).toBe(max)

    await db
      .insert(schema.subscription)
      .values({ organizationId: orgA.id, plan: 'PRO' })
      .onConflictDoUpdate({ target: schema.subscription.organizationId, set: { plan: 'PRO' } })
    expect((await alice.project.create({ name: 'On PRO' })).name).toBe('On PRO')
  })
})
