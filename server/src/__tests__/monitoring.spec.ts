import * as Sentry from '@sentry/node'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../db/client.js', () => ({
  pool: {},
  db: {
    query: {
      member: {
        findFirst: async () => {
          throw new Error('membership lookup failed')
        },
      },
    },
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
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const who = headers.get('x-test-user')
        if (!who) return null
        await new Promise((r) => setTimeout(r, who === 'u_slow' ? 50 : 0))
        return {
          user: { id: who, banned: false, role: 'member' },
          session: { activeOrganizationId: `org_of_${who}` },
        }
      },
    },
    handler: async () => new Response(null, { status: 404 }),
  },
  emailProvider: {},
}))

const events: Sentry.ErrorEvent[] = []

Sentry.init({
  dsn: 'https://public@glitchtip.invalid/1',
  beforeSend: (event) => {
    events.push(event)
    return null
  },
})

const { buildApp } = await import('../app.js')
let app: Awaited<ReturnType<typeof buildApp>>
let base: string

beforeAll(async () => {
  app = await buildApp()
  base = await app.listen({ port: 0, host: '127.0.0.1' })
})

afterAll(async () => {
  await app.close()
})

const call = (user: string, requestId: string) =>
  fetch(`${base}/trpc/billing.createPortal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': user, 'x-request-id': requestId },
    body: '{}',
  })

describe('error events under concurrent requests', () => {
  it('carry the user, organization and request id of their own request', async () => {
    const slow = '11111111-1111-4111-8111-111111111111'
    const fast = '22222222-2222-4222-8222-222222222222'
    const [a, b] = await Promise.all([call('u_slow', slow), call('u_fast', fast)])
    expect([a.status, b.status]).toEqual([500, 500])
    expect(a.headers.get('x-request-id')).toBe(slow)

    const byUser = Object.fromEntries(events.map((e) => [e.user?.id, e.tags]))
    expect(byUser.u_slow).toMatchObject({ request_id: slow, organization_id: 'org_of_u_slow' })
    expect(byUser.u_fast).toMatchObject({ request_id: fast, organization_id: 'org_of_u_fast' })
  })
})
