import type { ErrorEvent } from '@sentry/vue'
import { describe, expect, it } from 'vitest'
import { scrubBreadcrumb, scrubEvent } from './scrub'

describe('scrubEvent', () => {
  it('keeps diagnostics and removes every secret-bearing field', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: 'GET',
        url: 'https://app.example/api/auth/magic-link/verify?token=MAGIC_SECRET',
        query_string: 'token=MAGIC_SECRET',
        cookies: { 'better-auth.session_token': 'COOKIE_SECRET' },
        data: { password: 'BODY_SECRET' },
        headers: {
          cookie: 'COOKIE_SECRET',
          authorization: 'Bearer AUTH_SECRET',
          'user-agent': 'vitest',
          'x-request-id': 'req-1',
        },
      },
      user: { id: 'u_1', email: 'a@example.com', ip_address: '1.2.3.4' },
      contexts: { details: { eventId: 'evt_1', apiKey: 'KEY_SECRET', nested: { token: 'T' } } },
      breadcrumbs: [{ category: 'fetch', data: { url: '/accept-invitation/x?token=INV_SECRET' } }],
    } as ErrorEvent)

    const text = JSON.stringify(event)
    for (const secret of ['MAGIC_SECRET', 'COOKIE_SECRET', 'BODY_SECRET', 'AUTH_SECRET']) {
      expect(text).not.toContain(secret)
    }
    expect(text).not.toContain('KEY_SECRET')
    expect(text).not.toContain('INV_SECRET')
    expect(text).not.toContain('a@example.com')
    expect(text).not.toContain('1.2.3.4')
    expect(event.request).toEqual({
      method: 'GET',
      url: 'https://app.example/api/auth/magic-link/verify',
      headers: { 'user-agent': 'vitest', 'x-request-id': 'req-1' },
    })
    expect(event.user).toEqual({ id: 'u_1' })
    expect(event.contexts?.details).toMatchObject({ eventId: 'evt_1', apiKey: '[redacted]' })
  })

  it('strips queries from navigation breadcrumbs', () => {
    expect(scrubBreadcrumb({ data: { from: '/a?x=1', to: '/b#frag' } }).data).toEqual({
      from: '/a',
      to: '/b',
    })
  })

  it('removes URL secrets from free-text event fields', () => {
    const event = scrubEvent({
      type: undefined,
      message: 'Failed at /verify#MESSAGE_SECRET',
      logentry: { message: 'Failed at https://app.example/verify?token=LOG_SECRET' },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Request failed: /verify?token=EXCEPTION_SECRET',
            stacktrace: { frames: [{ filename: 'https://app.example/app.js?key=FRAME_SECRET' }] },
          },
        ],
      },
      tags: { route: '/verify?token=TAG_SECRET' },
      contexts: { details: { url: '/verify?token=CONTEXT_SECRET' } },
      breadcrumbs: [
        {
          message: 'Navigated to /verify?token=CRUMB_SECRET',
          data: { note: 'See /verify?token=DATA_SECRET' },
        },
      ],
    } as ErrorEvent)

    expect(JSON.stringify(event)).not.toMatch(
      /(?:MESSAGE|LOG|EXCEPTION|FRAME|TAG|CONTEXT|CRUMB|DATA)_SECRET/,
    )
    expect(event.exception?.values?.[0]?.value).toBe('Request failed: /verify')
    expect(event.message).toBe('Failed at /verify')
    expect(event.breadcrumbs?.[0]?.message).toBe('Navigated to /verify')
  })
})
