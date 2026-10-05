// docs/deployment.md
import type { FastifyInstance } from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { bossStarted } from '../jobs/boss.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health/ready', async (_request, reply) => {
    try {
      await db.execute(sql`select 1`)
      return { status: 'ok' }
    } catch {
      return reply.status(503).send({ status: 'unavailable' })
    }
  })

  app.get('/health', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {
      database: 'ok',
      jobs: bossStarted() ? 'ok' : 'fail',
    }
    try {
      await db.execute(sql`select 1`)
    } catch {
      checks.database = 'fail'
    }
    const ok = Object.values(checks).every((v) => v === 'ok')
    return reply
      .status(ok ? 200 : 503)
      .send({ status: ok ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() })
  })
}
