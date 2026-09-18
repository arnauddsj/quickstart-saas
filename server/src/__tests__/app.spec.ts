import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dbUp = vi.hoisted(() => ({ value: true }))

vi.mock('../db/client.js', () => ({
  pool: {},
  db: {
    execute: async () => {
      if (!dbUp.value) throw new Error('connection refused')
      return { rows: [{ '?column?': 1 }] }
    },
    query: { member: { findFirst: async () => undefined } },
  },
}))
vi.mock('../services/admin.js', () => ({
  adminStats: async () => ({}),
  recentSignups: async () => [],
  userActivity: {},
  userOrganizations: {},
}))
vi.mock('../auth/index.js', () => ({
  auth: {
    api: { getSession: async () => null },
    handler: async () => new Response(null, { status: 404 }),
  },
  emailProvider: {},
}))

const { buildApp } = await import('../app.js')

let app: Awaited<ReturnType<typeof buildApp>>

beforeEach(async () => {
  dbUp.value = true
  app = await buildApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

const post = (url: string, headers: Record<string, string> = {}) =>
  app.inject({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json', ...headers },
    payload: {},
  })

describe('Origin check on tRPC mutations', () => {
  it('answers 403 before the procedure runs when the Origin is foreign', async () => {
    const res = await post('/trpc/billing.createPortal', { origin: 'http://evil.example' })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'Invalid origin' })
  })

  it('lets an allowed Origin and a request without Origin through to the procedure', async () => {
    expect(
      (await post('/trpc/billing.createPortal', { origin: 'http://localhost:5173' })).statusCode,
    ).toBe(401)
    expect((await post('/trpc/billing.createPortal')).statusCode).toBe(401)
  })

  it('leaves queries alone whatever the Origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trpc/health',
      headers: { origin: 'http://evil.example' },
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('HTTP surface', () => {
  it('rejects an unsigned Stripe webhook with 400', async () => {
    expect((await post('/webhooks/stripe')).statusCode).toBe(400)
  })

  it('sets the helmet headers on API responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/trpc/health' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  it('reports readiness from the database', async () => {
    expect((await app.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(200)
    dbUp.value = false
    const down = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(down.statusCode).toBe(503)
    expect(down.json()).toEqual({ status: 'unavailable' })
  })

  it('answers 429, not 500, once the per-minute budget is spent', async () => {
    for (let i = 0; i < 300; i++) await app.inject({ method: 'GET', url: '/trpc/health' })
    const limited = await app.inject({ method: 'GET', url: '/trpc/health' })
    expect(limited.statusCode).toBe(429)
    expect(limited.json().message).toMatch(/rate limit exceeded/i)
  })
})
