import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirst = vi.fn()
vi.mock('../db/client.js', () => ({
  db: { query: { member: { findFirst } } },
  pool: {},
}))
vi.mock('../auth/index.js', () => ({ auth: { api: { getSession: vi.fn() } }, emailProvider: {} }))

const {
  createCallerFactory,
  router,
  protectedProcedure,
  adminProcedure,
  orgProcedure,
  orgAdminProcedure,
} = await import('../trpc/index.js')

const testRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.user.id),
  adminOnly: adminProcedure.query(() => 'admin'),
  orgOnly: orgProcedure.query(({ ctx }) => ctx.organizationId),
  orgAdminOnly: orgAdminProcedure.query(({ ctx }) => ctx.membership.role),
})
const createCaller = createCallerFactory(testRouter)

const user = (over: Partial<{ role: string; banned: boolean }> = {}) =>
  ({
    id: 'u1',
    email: 'u@test',
    name: 'U',
    role: 'member',
    banned: false,
    createdAt: new Date(),
    ...over,
  }) as never
const session = (activeOrganizationId: string | null = 'org1') =>
  ({ id: 's1', activeOrganizationId }) as never
const ctx = (u: unknown, s: unknown) => ({
  req: {} as never,
  res: {} as never,
  user: u as never,
  session: s as never,
})

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'OK'
  } catch (err) {
    return err instanceof TRPCError ? err.code : 'OTHER'
  }
}

describe('procedure tiers', () => {
  beforeEach(() => findFirst.mockReset())

  it('protectedProcedure rejects anonymous and banned users', async () => {
    expect(await code(createCaller(ctx(null, null)).me())).toBe('UNAUTHORIZED')
    expect(await code(createCaller(ctx(user({ banned: true }), session())).me())).toBe('FORBIDDEN')
    expect(await createCaller(ctx(user(), session())).me()).toBe('u1')
  })

  it('adminProcedure rejects members', async () => {
    expect(await code(createCaller(ctx(user(), session())).adminOnly())).toBe('FORBIDDEN')
    expect(await createCaller(ctx(user({ role: 'admin' }), session())).adminOnly()).toBe('admin')
  })

  it('orgProcedure needs an active organization and a membership row', async () => {
    expect(await code(createCaller(ctx(user(), session(null))).orgOnly())).toBe(
      'PRECONDITION_FAILED',
    )
    findFirst.mockResolvedValueOnce(undefined)
    expect(await code(createCaller(ctx(user(), session())).orgOnly())).toBe('FORBIDDEN')
    findFirst.mockResolvedValueOnce({ role: 'member' })
    expect(await createCaller(ctx(user(), session())).orgOnly()).toBe('org1')
  })

  it('orgAdminProcedure needs owner or admin membership', async () => {
    findFirst.mockResolvedValueOnce({ role: 'member' })
    expect(await code(createCaller(ctx(user(), session())).orgAdminOnly())).toBe('FORBIDDEN')
    findFirst.mockResolvedValueOnce({ role: 'owner' })
    expect(await createCaller(ctx(user(), session())).orgAdminOnly()).toBe('owner')
  })
})
