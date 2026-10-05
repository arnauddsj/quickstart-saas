// docs/deployment.md
import * as Sentry from '@sentry/node'
import { buildApp } from './app.js'
import { env } from './config/env.js'
import { pool } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { startBoss, stopBoss } from './jobs/boss.js'
import { reportError } from './services/reportError.js'
import { startWatchdog, stopWatchdog } from './services/watchdog.js'
import { logger } from './utils/logger.js'

const SHUTDOWN_BUDGET_MS = 8_000

async function main() {
  await runMigrations()
  await startBoss()
  const app = await buildApp()
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  startWatchdog()

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutdown started')
    setTimeout(() => {
      logger.error('shutdown budget exceeded, exiting hard')
      process.exit(1)
    }, SHUTDOWN_BUDGET_MS).unref()
    stopWatchdog()
    await app.close()
    await stopBoss()
    await pool.end()
    logger.info('shutdown complete')
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

const FLUSH_BUDGET_MS = 2_000

async function die(type: string, err: unknown): Promise<never> {
  logger.fatal({ err, type }, 'fatal error, exiting')
  reportError({ severity: 'CRITICAL', type, message: 'Fatal process error', error: err })
  await Sentry.flush(FLUSH_BUDGET_MS)
  process.exit(1)
}

process.on('unhandledRejection', (reason) => {
  reportError({
    severity: 'CRITICAL',
    type: 'process.unhandledRejection',
    message: 'Unhandled promise rejection',
    error: reason,
    context: reason instanceof Error ? undefined : { reason: String(reason) },
  })
})

process.on('uncaughtException', (err) => void die('process.uncaughtException', err))

main().catch((err) => die('process.boot', err))
