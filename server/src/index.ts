// docs/deployment.md
import { buildApp } from './app.js'
import { env } from './config/env.js'
import { pool } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { startBoss, stopBoss } from './jobs/boss.js'
import { reportError } from './services/errorLog.js'
import { logger } from './utils/logger.js'

const SHUTDOWN_BUDGET_MS = 8_000

async function main() {
  await runMigrations()
  await startBoss()
  const app = await buildApp()
  await app.listen({ port: env.PORT, host: '0.0.0.0' })

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutdown started')
    setTimeout(() => {
      logger.error('shutdown budget exceeded, exiting hard')
      process.exit(1)
    }, SHUTDOWN_BUDGET_MS).unref()
    await app.close()
    await stopBoss()
    await pool.end()
    logger.info('shutdown complete')
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

process.on('unhandledRejection', (reason) => {
  void reportError({
    severity: 'CRITICAL',
    type: 'process.unhandledRejection',
    message: String(reason),
    error: reason,
  })
})

main().catch((err) => {
  logger.fatal({ err }, 'boot failed')
  process.exit(1)
})
