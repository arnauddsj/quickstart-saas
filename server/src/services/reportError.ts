// docs/error-reporting.md
import * as Sentry from '@sentry/node'
import { logger } from '../utils/logger.js'

export const SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const
export type Severity = (typeof SEVERITIES)[number]

const LEVEL = { INFO: 'info', WARNING: 'warning', ERROR: 'error', CRITICAL: 'fatal' } as const

export function reportError(input: {
  severity: Severity
  type: string
  message: string
  error?: unknown
  context?: Record<string, unknown>
  fingerprint?: string[]
  userId?: string | null
  organizationId?: string | null
}): void {
  try {
    const level = LEVEL[input.severity]
    logger[level === 'fatal' ? 'error' : level === 'warning' ? 'warn' : level](
      { type: input.type, err: input.error, context: input.context },
      input.message,
    )
    if (input.severity === 'INFO' || input.severity === 'WARNING') {
      Sentry.addBreadcrumb({ category: input.type, level, message: input.message })
      return
    }
    Sentry.withScope((scope) => {
      scope.setLevel(level)
      scope.setTag('type', input.type)
      scope.setFingerprint([input.type, ...(input.fingerprint ?? [])])
      scope.setContext('details', { message: input.message, ...input.context })
      if (input.userId) scope.setUser({ id: input.userId })
      if (input.organizationId) scope.setTag('organization_id', input.organizationId)
      if (input.error instanceof Error) Sentry.captureException(input.error)
      else Sentry.captureMessage(input.message)
    })
  } catch (err) {
    logger.warn({ err }, 'reportError failed')
  }
}
