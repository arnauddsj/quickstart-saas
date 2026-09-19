// docs/notifications.md
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteExpiredNotifications, notify, notifyWorkspace } from '../../services/notify.js'
import {
  addMember,
  callerFor,
  daysAgo,
  db,
  resetDatabase,
  schema,
  seedOrg,
  seedUser,
} from './helpers.js'

beforeEach(resetDatabase)

async function world() {
  const alice = await seedUser({ email: 'alice@test.io' })
  const carol = await seedUser({ email: 'carol@test.io' })
  const orgA = await seedOrg({ name: 'A' })
  const orgB = await seedOrg({ name: 'B' })
  await addMember(orgA.id, alice.id, 'owner')
  await addMember(orgA.id, carol.id, 'member')
  await addMember(orgB.id, alice.id, 'owner')
  return { alice, carol, orgA, orgB }
}

describe('who sees a notification', () => {
  it('shows a user only their own, for the active workspace or no workspace', async () => {
    const { alice, carol, orgA, orgB } = await world()
    await notify(alice.id, { type: 't', title: 'personal' })
    await notify(alice.id, { type: 't', title: 'in A', organizationId: orgA.id })
    await notify(alice.id, { type: 't', title: 'in B', organizationId: orgB.id })
    await notify(carol.id, { type: 't', title: 'carol only', organizationId: orgA.id })

    const inA = await callerFor(alice, { activeOrganizationId: orgA.id }).notification.list()
    expect(inA.items.map((n) => n.title).sort()).toEqual(['in A', 'personal'])
    expect(inA.unread).toBe(2)
    const inB = await callerFor(alice, { activeOrganizationId: orgB.id }).notification.list()
    expect(inB.items.map((n) => n.title).sort()).toEqual(['in B', 'personal'])
  })

  it('marks read only the caller notifications', async () => {
    const { alice, carol, orgA } = await world()
    await notify(carol.id, { type: 't', title: 'carol', organizationId: orgA.id })
    const [carolRow] = await db.select().from(schema.notification)
    await callerFor(alice, { activeOrganizationId: orgA.id }).notification.markRead({
      id: carolRow!.id,
    })
    const asCarol = callerFor(carol, { activeOrganizationId: orgA.id }).notification
    expect((await asCarol.list()).unread).toBe(1)
    await asCarol.markRead({ id: carolRow!.id })
    expect((await asCarol.list()).unread).toBe(0)
  })

  it('marks all read in the active workspace only', async () => {
    const { alice, orgA, orgB } = await world()
    await notify(alice.id, { type: 't', title: 'in A', organizationId: orgA.id })
    await notify(alice.id, { type: 't', title: 'in B', organizationId: orgB.id })
    await callerFor(alice, { activeOrganizationId: orgA.id }).notification.markAllRead()
    expect(
      (await callerFor(alice, { activeOrganizationId: orgB.id }).notification.list()).unread,
    ).toBe(1)
  })
})

describe('example triggers', () => {
  it('notifies the other members when a project is created, not the creator', async () => {
    const { alice, carol, orgA } = await world()
    await callerFor(alice, { activeOrganizationId: orgA.id }).project.create({ name: 'Alpha' })
    const forCarol = await callerFor(carol, { activeOrganizationId: orgA.id }).notification.list()
    expect(forCarol.items.map((n) => [n.type, n.link])).toEqual([['project.created', '/projects']])
    expect(forCarol.items[0]?.title).toContain('Alpha')
    const forAlice = await callerFor(alice, { activeOrganizationId: orgA.id }).notification.list()
    expect(forAlice.items).toEqual([])
  })

  it('notifyWorkspace reaches every member but the excluded one', async () => {
    const { alice, orgA } = await world()
    expect(await notifyWorkspace(orgA.id, { type: 't', title: 'x' })).toBe(2)
    expect(
      await notifyWorkspace(orgA.id, { type: 't', title: 'x' }, { exceptUserId: alice.id }),
    ).toBe(1)
  })
})

describe('retention', () => {
  it('deletes notifications older than 90 days', async () => {
    const { alice } = await world()
    await db.insert(schema.notification).values([
      { userId: alice.id, type: 't', title: 'old', createdAt: daysAgo(91) },
      { userId: alice.id, type: 't', title: 'recent', createdAt: daysAgo(89) },
    ])
    expect(await deleteExpiredNotifications()).toBe(1)
    const left = await db.select({ title: schema.notification.title }).from(schema.notification)
    expect(left).toEqual([{ title: 'recent' }])
  })
})
