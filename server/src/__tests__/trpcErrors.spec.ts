import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db/client.js', () => ({ pool: {}, db: {} }))
vi.mock('../auth/index.js', () => ({
  auth: { api: { getSession: async () => null } },
  emailProvider: {},
}))

async function respond(env: 'test' | 'production', path: string, input?: unknown) {
  vi.resetModules()
  if (env === 'production') {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_SECRET', 'x'.repeat(40))
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_x')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
    vi.stubEnv('COOKIE_SECURE', 'true')
    vi.stubEnv('SMTP_HOST', 'smtp.example.com')
  }
  const { z } = await import('zod')
  const { fetchRequestHandler } = await import('@trpc/server/adapters/fetch')
  const { router, publicProcedure } = await import('../trpc/index.js')
  const testRouter = router({
    boom: publicProcedure.query(() => {
      throw new Error('connection string postgres://secret@db/prod')
    }),
    strict: publicProcedure.input(z.object({ n: z.number() })).query(({ input }) => input.n),
  })
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`
  const res = await fetchRequestHandler({
    endpoint: '/trpc',
    req: new Request(`http://localhost/trpc/${path}${query}`),
    router: testRouter,
    createContext: () => ({ req: {} as never, res: {} as never, user: null, session: null }),
  })
  return (await res.json()) as {
    error: { message: string; data: { zodError: unknown; stack?: string } }
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('tRPC error formatter', () => {
  it('hides the message of an internal error in production', async () => {
    const body = await respond('production', 'boom')
    expect(body.error.message).toBe('Internal server error')
    expect(JSON.stringify(body)).not.toContain('postgres://')
  })

  it('hides validation details in production', async () => {
    const body = await respond('production', 'strict', { n: 'nope' })
    expect(body.error.data.zodError).toBeNull()
  })

  it('exposes the message and field errors outside production', async () => {
    expect((await respond('test', 'boom')).error.message).toContain('postgres://')
    const body = await respond('test', 'strict', { n: 'nope' })
    expect(body.error.data.zodError).toMatchObject({ fieldErrors: { n: expect.any(Array) } })
  })
})
