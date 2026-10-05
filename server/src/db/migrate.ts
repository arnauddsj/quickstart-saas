// docs/database-and-migrations.md
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client.js'
import { logger } from '../utils/logger.js'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

export const MIGRATION_LOCK_ID = 727_146_001

export async function runMigrations(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID])
    try {
      await migrate(db, { migrationsFolder })
    } finally {
      await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
    }
  } finally {
    client.release()
  }
  logger.info({ migrationsFolder }, 'migrations applied')
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      logger.error({ err }, 'migration failed')
      process.exit(1)
    })
}
