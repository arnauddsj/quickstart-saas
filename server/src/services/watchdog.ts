// docs/error-reporting.md
import * as Sentry from '@sentry/node'
import pg from 'pg'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { reportError } from './reportError.js'

export const CHECK_INTERVAL_MS = 60_000
export const PROBE_TIMEOUT_MS = 5_000
export const DB_FAILURES_TO_ALERT = 2
export const HEARTBEAT_STALE_MS = 15 * 60_000

type Condition = 'db' | 'worker'
type Latch = { down: boolean; failures: number; since: number | null }
export type WatchState = Record<Condition, Latch> & { graceFrom: number }
export type Emit = { condition: Condition; kind: 'down' | 'recovered'; since: number; now: number }

const up = (): Latch => ({ down: false, failures: 0, since: null })
export const initialState = (now: number): WatchState => ({
  db: up(),
  worker: up(),
  graceFrom: now,
})

export function nextState(
  state: WatchState,
  probe: { dbUp: boolean; lastHeartbeatAt: number },
  now: number,
): { state: WatchState; emits: Emit[] } {
  const emits: Emit[] = []
  let { db, worker, graceFrom } = state

  if (!probe.dbUp) {
    const since = db.since ?? now
    db = { ...db, failures: db.failures + 1, since }
    if (!db.down && db.failures >= DB_FAILURES_TO_ALERT) {
      db = { ...db, down: true }
      emits.push({ condition: 'db', kind: 'down', since, now })
    }
  } else {
    if (db.down && db.since !== null) {
      emits.push({ condition: 'db', kind: 'recovered', since: db.since, now })
      graceFrom = now
    }
    db = up()

    const lastSeen = Math.max(probe.lastHeartbeatAt, graceFrom)
    const stale = now - lastSeen > HEARTBEAT_STALE_MS
    if (stale && !worker.down) {
      worker = { down: true, failures: 0, since: lastSeen }
      emits.push({ condition: 'worker', kind: 'down', since: lastSeen, now })
    } else if (!stale && worker.down && worker.since !== null) {
      emits.push({ condition: 'worker', kind: 'recovered', since: worker.since, now })
      worker = up()
    }
  }
  return { state: { db, worker, graceFrom }, emits }
}

const MESSAGES = {
  db: { down: 'Database unavailable', recovered: 'Database recovered' },
  worker: { down: 'Job worker stalled', recovered: 'Job worker recovered' },
} as const

function emit(e: Emit) {
  const type = `watchdog.${e.condition}`
  const context = {
    since: new Date(e.since).toISOString(),
    durationSeconds: Math.round((e.now - e.since) / 1000),
  }
  if (e.kind === 'down') {
    reportError({
      severity: 'CRITICAL',
      type,
      message: MESSAGES[e.condition].down,
      fingerprint: [String(e.since)],
      context,
    })
    return
  }
  logger.info({ type, context }, MESSAGES[e.condition].recovered)
  Sentry.withScope((scope) => {
    scope.setLevel('info')
    scope.setTag('type', `${type}.recovered`)
    scope.setFingerprint([`${type}.recovered`, String(e.since)])
    scope.setContext('details', context)
    Sentry.captureMessage(MESSAGES[e.condition].recovered)
  })
}

async function probeDb(): Promise<boolean> {
  const client = new pg.Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    query_timeout: PROBE_TIMEOUT_MS,
  })
  client.on('error', () => {})
  try {
    await client.connect()
    await client.query('select 1')
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => {})
  }
}

let state = initialState(Date.now())
let lastHeartbeatAt = 0
let timer: NodeJS.Timeout | undefined

export const recordHeartbeat = () => {
  lastHeartbeatAt = Date.now()
}

async function tick() {
  const dbUp = await probeDb()
  const result = nextState(state, { dbUp, lastHeartbeatAt }, Date.now())
  state = result.state
  result.emits.forEach(emit)
}

export function startWatchdog() {
  state = initialState(Date.now())
  timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  timer.unref()
}

export function stopWatchdog() {
  clearInterval(timer)
}
