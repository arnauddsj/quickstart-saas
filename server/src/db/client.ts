// docs/database-and-migrations.md
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { env } from '../config/env.js'
import * as schema from './schema/index.js'
import { logger } from '../utils/logger.js'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 })
pool.on('error', (err) => logger.error({ err }, 'idle postgres client error'))
export const db = drizzle(pool, { schema, casing: 'snake_case' })
export type Db = typeof db
