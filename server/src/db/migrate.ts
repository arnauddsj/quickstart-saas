// docs/database-and-migrations.md
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client.js'
import { logger } from '../utils/logger.js'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder })
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
