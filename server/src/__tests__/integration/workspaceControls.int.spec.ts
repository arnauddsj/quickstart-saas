import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { authPost, db, resetDatabase, schema, signIn, userByEmail } from './helpers.js'
import type { App } from './helpers.js'
import { clearMail } from './mailbox.js'

vi.mock('../../email/index.js', async () => (await import('./mailbox.js')).emailModule)

let app: App

beforeAll(async () => {
  const { buildApp } = await import('../../app.js')
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await resetDatabase()
  clearMail()
})

async function team() {
  const owner = await signIn(app, 'owner@test.io')
  const created = await authPost(app, '/organization/create', owner, {
    name: 'Acme',
    slug: `acme-${Date.now()}`,
  })
  const org = created.json() as { id: string }
  const mate = await signIn(app, 'mate@test.io')
  const mateUser = await userByEmail('mate@test.io')
  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    userId: mateUser!.id,
    role: 'member',
    createdAt: new Date(),
  })
  await authPost(app, '/organization/set-active', mate, { organizationId: org.id })
  return { owner, mate, org }
}

const roleOf = async (email: string, organizationId: string) => {
  const u = await userByEmail(email)
  const [m] = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(and(eq(schema.member.userId, u!.id), eq(schema.member.organizationId, organizationId)))
  return m?.role
}

const memberId = async (email: string) => {
  const u = await userByEmail(email)
  const [m] = await db.select().from(schema.member).where(eq(schema.member.userId, u!.id))
  return m!.id
}

describe('workspace controls the settings page relies on', () => {
  it('lets owners and admins rename, and refuses members', async () => {
    const { owner, mate, org } = await team()
    const rename = (cookie: string, name: string) =>
      authPost(app, '/organization/update', cookie, { organizationId: org.id, data: { name } })

    expect((await rename(mate, 'Mine')).statusCode).toBe(403)
    expect((await rename(owner, 'Acme 2')).statusCode).toBe(200)
    const row = await db.query.organization.findFirst({
      where: eq(schema.organization.id, org.id),
    })
    expect(row?.name).toBe('Acme 2')
  })

  it('lets a member leave, and never leaves a workspace without an owner', async () => {
    const { owner, mate, org } = await team()
    const soleOwnerLeaves = await authPost(app, '/organization/leave', owner, {
      organizationId: org.id,
    })
    expect(soleOwnerLeaves.json()).toMatchObject({
      code: 'YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER',
    })
    expect(
      (await authPost(app, '/organization/leave', mate, { organizationId: org.id })).statusCode,
    ).toBe(200)
    expect(await roleOf('mate@test.io', org.id)).toBeUndefined()
  })

  it('transfers ownership: promote the member, then step down to admin', async () => {
    const { owner, org } = await team()
    const setRole = (memberId: string, role: string) =>
      authPost(app, '/organization/update-member-role', owner, {
        organizationId: org.id,
        memberId,
        role,
      })

    expect((await setRole(await memberId('mate@test.io'), 'owner')).statusCode).toBe(200)
    expect((await setRole(await memberId('owner@test.io'), 'admin')).statusCode).toBe(200)
    expect(await roleOf('mate@test.io', org.id)).toBe('owner')
    expect(await roleOf('owner@test.io', org.id)).toBe('admin')
  })

  it('refuses an admin who tries to take ownership or delete the workspace', async () => {
    const { owner, mate, org } = await team()
    await authPost(app, '/organization/update-member-role', owner, {
      organizationId: org.id,
      memberId: await memberId('mate@test.io'),
      role: 'admin',
    })

    const takeOver = await authPost(app, '/organization/update-member-role', mate, {
      organizationId: org.id,
      memberId: await memberId('mate@test.io'),
      role: 'owner',
    })
    const remove = await authPost(app, '/organization/delete', mate, { organizationId: org.id })
    expect(takeOver.statusCode).toBe(403)
    expect(remove.statusCode).toBe(403)
    expect(await roleOf('owner@test.io', org.id)).toBe('owner')
  })
})

describe('account sessions', () => {
  it('lists every session and signs out all but the current one', async () => {
    const here = await signIn(app, 'owner@test.io')
    const phone = await signIn(app, 'owner@test.io')
    const list = async (cookie: string) =>
      (
        await app.inject({ method: 'GET', url: '/api/auth/list-sessions', headers: { cookie } })
      ).json() as { token: string }[]

    expect(await list(here)).toHaveLength(2)
    expect((await authPost(app, '/revoke-other-sessions', here, {})).statusCode).toBe(200)
    expect(await list(here)).toHaveLength(1)
    const stale = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: phone },
    })
    expect(stale.json()).toBeNull()
  })
})
