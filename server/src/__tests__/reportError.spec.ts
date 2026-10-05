import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => {
  const scope = {
    setLevel: vi.fn(),
    setTag: vi.fn(),
    setFingerprint: vi.fn(),
    setContext: vi.fn(),
    setUser: vi.fn(),
  }
  return {
    scope,
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
  }
})

vi.mock('@sentry/node', () => sentry)

const { reportError } = await import('../services/reportError.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reportError', () => {
  it('sends ERROR and CRITICAL to the tracker and keeps INFO and WARNING local', () => {
    reportError({ severity: 'INFO', type: 'route.info', message: 'i' })
    reportError({ severity: 'WARNING', type: 'route.warn', message: 'w' })
    reportError({ severity: 'ERROR', type: 'route.error', message: 'e' })
    reportError({ severity: 'CRITICAL', type: 'route.critical', message: 'c' })

    expect(sentry.captureMessage.mock.calls.map(([m]) => m)).toEqual(['e', 'c'])
    expect(sentry.scope.setLevel.mock.calls.map(([l]) => l)).toEqual(['error', 'fatal'])
    expect(sentry.addBreadcrumb.mock.calls.map(([b]) => b.level)).toEqual(['info', 'warning'])
  })

  it('captures the Error itself, grouped by type plus the extra fingerprint', () => {
    const err = new Error('boom')
    reportError({
      severity: 'ERROR',
      type: 'stripe.webhook',
      message: 'Failed',
      error: err,
      fingerprint: ['invoice.paid'],
      context: { eventId: 'evt_1' },
      userId: 'u_1',
      organizationId: 'org_1',
    })
    expect(sentry.captureException).toHaveBeenCalledWith(err)
    expect(sentry.captureMessage).not.toHaveBeenCalled()
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith(['stripe.webhook', 'invoice.paid'])
    expect(sentry.scope.setContext).toHaveBeenCalledWith('details', {
      message: 'Failed',
      eventId: 'evt_1',
    })
    expect(sentry.scope.setUser).toHaveBeenCalledWith({ id: 'u_1' })
    expect(sentry.scope.setTag).toHaveBeenCalledWith('organization_id', 'org_1')
  })

  it('never throws when the SDK does', () => {
    sentry.withScope.mockImplementationOnce(() => {
      throw new Error('sdk broke')
    })
    expect(() => reportError({ severity: 'CRITICAL', type: 'db.down', message: 'x' })).not.toThrow()
  })
})
