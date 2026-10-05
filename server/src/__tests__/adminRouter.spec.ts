import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cleanup = vi.fn(async () => {})
const deletedUsers: string[] = []
const sendVerificationEmail = vi.fn(async () => ({}))
const updates: Record<string, unknown>[] = []

vi.mock('../services/account.js', () => ({ cleanupBeforeUserDelete: cleanup }))
vi.mock('../services/admin.js', () => ({
  adminStats: async () => ({}),
  recentSignups: async () => [],
  userActivity: {},
  userOrganizations: {},
}))
vi.mock('../auth/index.js', () => ({
  auth: { api: { getSession: vi.fn(), sendVerificationEmail } },
  emailProvider: {},
}))
vi.mock('../db/client.js', () => ({
  pool: {},
  db: {
    query: { member: { findFirst: vi.fn() }, user: { findFirst: async () => undefined } },
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: async () => {
          updates.push(v)
        },
      }),
    }),
    delete: () => ({
      where: (cond: { queryChunks?: unknown[] }) => {
        const p = Promise.resolve([])
        deletedUsers.push(String(cond.queryChunks?.length ?? 0))
        return Object.assign(p, { returning: async () => [] })
      },
    }),
  },
}))

const { appRouter } = await import('../trpc/router/index.js')
const { createCallerFactory } = await import('../trpc/index.js')
const caller = createCallerFactory(appRouter)
const admin = {
  id: 'a1',
  email: 'a@test',
  name: 'A',
  role: 'admin',
  banned: false,
  createdAt: new Date(),
} as never
const member = { ...(admin as object), id: 'm1', role: 'member' } as never
const session = { id: 's1', activeOrganizationId: null } as never
const as = (u: unknown) => caller({ req: {} as never, res: {} as never, user: u as never, session })

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'OK'
  } catch (err) {
    return err instanceof TRPCError ? err.code : 'OTHER'
  }
}

describe('admin router', () => {
  beforeEach(() => {
    cleanup.mockClear()
    deletedUsers.length = 0
    sendVerificationEmail.mockClear()
    updates.length = 0
  })

  it('rejects members on every admin procedure', async () => {
    expect(await code(as(member).admin.stats())).toBe('FORBIDDEN')
    expect(await code(as(member).admin.setEmail({ userId: 'x', email: 'x@test.io' }))).toBe(
      'FORBIDDEN',
    )
    expect(await code(as(member).admin.revokeSessions({ userId: 'x' }))).toBe('FORBIDDEN')
    expect(await code(as(member).admin.removeUser({ userId: 'x' }))).toBe('FORBIDDEN')
  })

  it('removeUser runs the organization and Stripe cleanup before deleting the row', async () => {
    await as(admin).admin.removeUser({ userId: 'u9' })
    expect(cleanup).toHaveBeenCalledWith('u9')
    expect(deletedUsers).toHaveLength(1)
  })

  it('removeUser refuses self-deletion', async () => {
    expect(await code(as(admin).admin.removeUser({ userId: 'a1' }))).toBe('FORBIDDEN')
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('setEmail lowercases, marks unverified and sends the verification to the new address', async () => {
    await as(admin).admin.setEmail({ userId: 'u9', email: 'New@Test.io' })
    expect(updates[0]).toEqual({ email: 'new@test.io', emailVerified: false })
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      body: { email: 'new@test.io', callbackURL: '/' },
    })
  })

  it('setEmail validates the address', async () => {
    expect(await code(as(admin).admin.setEmail({ userId: 'u9', email: 'nope' }))).toBe(
      'BAD_REQUEST',
    )
  })
})
