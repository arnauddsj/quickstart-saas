import { describe, expect, it } from 'vitest'
import {
  CHECK_INTERVAL_MS,
  HEARTBEAT_STALE_MS,
  initialState,
  nextState,
  type Emit,
  type WatchState,
} from '../services/watchdog.js'

const T0 = Date.parse('2026-09-18T12:00:00Z')

function run(probes: { dbUp: boolean; heartbeat?: number }[], start = initialState(T0)) {
  let state: WatchState = start
  const emits: Emit[] = []
  probes.forEach((p, i) => {
    const now = T0 + (i + 1) * CHECK_INTERVAL_MS
    const result = nextState(state, { dbUp: p.dbUp, lastHeartbeatAt: p.heartbeat ?? now }, now)
    state = result.state
    emits.push(...result.emits)
  })
  return { state, emits: emits.map((e) => `${e.condition}:${e.kind}`), raw: emits }
}

describe('watchdog database latch', () => {
  it('ignores a single failed probe', () => {
    expect(run([{ dbUp: false }, { dbUp: true }]).emits).toEqual([])
  })

  it('alerts once on a sustained outage and once on recovery', () => {
    const { emits, raw } = run([
      { dbUp: false },
      { dbUp: false },
      { dbUp: false },
      { dbUp: false },
      { dbUp: true },
      { dbUp: true },
    ])
    expect(emits).toEqual(['db:down', 'db:recovered'])
    expect(raw[0]?.since).toBe(T0 + CHECK_INTERVAL_MS)
    expect(raw[1]?.since).toBe(raw[0]?.since)
  })

  it('alerts again after a restart during an outage (in-memory latch)', () => {
    const before = run([{ dbUp: false }, { dbUp: false }])
    const after = run([{ dbUp: false }, { dbUp: false }], initialState(T0))
    expect(before.emits).toEqual(['db:down'])
    expect(after.emits).toEqual(['db:down'])
  })
})

describe('watchdog worker heartbeat', () => {
  const stale = T0 - HEARTBEAT_STALE_MS

  it('gives a fresh process its grace period before expecting a heartbeat', () => {
    expect(run([{ dbUp: true, heartbeat: 0 }]).emits).toEqual([])
  })

  it('alerts once when heartbeats stop and once when they resume', () => {
    const { emits } = run(
      [{ dbUp: true, heartbeat: stale }, { dbUp: true, heartbeat: stale }, { dbUp: true }],
      initialState(stale),
    )
    expect(emits).toEqual(['worker:down', 'worker:recovered'])
  })

  it('does not blame the worker for heartbeats missed during a database outage', () => {
    const probes = [
      ...Array.from({ length: 20 }, () => ({ dbUp: false, heartbeat: T0 })),
      { dbUp: true, heartbeat: T0 },
    ]
    expect(run(probes).emits).toEqual(['db:down', 'db:recovered'])
  })
})
