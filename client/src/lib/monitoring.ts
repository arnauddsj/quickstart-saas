// docs/error-reporting.md
import * as Sentry from '@sentry/vue'
import { TRPCClientError } from '@trpc/client'
import type { App } from 'vue'
import { scrubBreadcrumb, scrubEvent } from './scrub'

const reported = new WeakSet<object>()

export function initMonitoring(app: App) {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    attachProps: false,
    maxBreadcrumbs: 50,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
}

export function setMonitoringUser(id: string | null) {
  Sentry.setUser(id ? { id } : null)
  if (!id) Sentry.getCurrentScope().clearBreadcrumbs()
}

type CaptureExtra = { tags?: Record<string, string>; fingerprint?: string[] }

export function captureClientError(error: unknown, type: string, extra: CaptureExtra = {}) {
  if (error instanceof Object) {
    if (reported.has(error)) return
    reported.add(error)
  }
  Sentry.captureException(error, {
    tags: { type, ...extra.tags },
    fingerprint: extra.fingerprint,
  })
}

export function reportQueryFailure(error: unknown, kind: 'query' | 'mutation') {
  if (error instanceof TRPCClientError) {
    const status = Number(error.data?.httpStatus ?? 0)
    Sentry.addBreadcrumb({
      category: `trpc.${kind}`,
      level: status >= 500 ? 'error' : 'warning',
      message: String(error.data?.path ?? 'unknown'),
      data: { status, code: error.data?.code },
    })
    return
  }
  captureClientError(error, `client.${kind}`)
}

export async function runAction<T>(name: string, fn: (actionId: string) => Promise<T>) {
  const actionId = crypto.randomUUID()
  Sentry.addBreadcrumb({ category: 'action', message: name, data: { actionId } })
  try {
    return await fn(actionId)
  } catch (error) {
    const tags = { action: name, action_id: actionId }
    if (error instanceof TRPCClientError) {
      if (Number(error.data?.httpStatus ?? 0) >= 500) {
        const type = `trpc.${error.data?.path}`
        captureClientError(error, type, { tags, fingerprint: [type] })
      }
    } else {
      captureClientError(error, 'client.action', { tags })
    }
    throw error
  }
}

export const actionHeaders = (actionId: string) => ({ 'x-action-id': actionId })
