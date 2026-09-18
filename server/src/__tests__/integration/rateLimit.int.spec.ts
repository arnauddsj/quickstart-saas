import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NODE_ENV = 'production'
})
import type { App } from './helpers.js'
import { ORIGIN, resetDatabase } from './helpers.js'
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

const requestLink = (ip: string, n: number) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/magic-link',
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': ip },
    payload: { email: `limited${n}@test.io`, callbackURL: '/auth/callback' },
  })

describe('better-auth rate limits in production', () => {
  it('runs with production settings', async () => {
    expect((await import('../../config/env.js')).IS_PROD).toBe(true)
  })

  it('never limits the session check, which the router guard calls on every navigation', async () => {
    const statuses = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/get-session',
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
      statuses.add(res.statusCode)
    }
    expect([...statuses]).toEqual([200])
  })

  it('allows five magic links an hour per address, then answers 429', async () => {
    const codes = []
    for (let i = 0; i < 6; i++) codes.push((await requestLink('203.0.113.20', i)).statusCode)
    expect(codes).toEqual([200, 200, 200, 200, 200, 429])
    expect((await requestLink('203.0.113.21', 99)).statusCode).toBe(200)
  })
})
