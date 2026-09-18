// docs/error-reporting.md
import { db } from '../db/client.js'
import { errorLog, type ERROR_SEVERITIES } from '../db/schema/app.js'
import { logger } from '../utils/logger.js'
import { postToDiscord } from './discord.js'

export type Severity = (typeof ERROR_SEVERITIES)[number]

const DEDUPE_WINDOW_MS = 30_000
const recent = new Map<string, number>()

export async function reportError(input: {
  severity: Severity
  type: string
  message: string
  error?: unknown
  context?: Record<string, unknown>
  userId?: string | null
  organizationId?: string | null
}): Promise<void> {
  const key = `${input.type}:${input.message.slice(0, 100)}`
  const now = Date.now()
  const last = recent.get(key)
  if (last && now - last < DEDUPE_WINDOW_MS) return
  recent.set(key, now)
  if (recent.size > 1000) {
    for (const [k, t] of recent) if (now - t > DEDUPE_WINDOW_MS) recent.delete(k)
  }

  const stack = input.error instanceof Error ? (input.error.stack ?? null) : null
  logger[input.severity === 'INFO' ? 'info' : input.severity === 'WARNING' ? 'warn' : 'error'](
    { type: input.type, err: input.error, context: input.context },
    input.message,
  )

  try {
    await db.insert(errorLog).values({
      severity: input.severity,
      type: input.type,
      message: input.message,
      stack,
      context: input.context ?? null,
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
    })
  } catch (err) {
    logger.error({ err }, 'error_log insert failed')
  }

  if (input.severity === 'ERROR' || input.severity === 'CRITICAL') {
    await postToDiscord({
      severity: input.severity,
      type: input.type,
      message: input.message,
      context: input.context,
    })
  }
}
