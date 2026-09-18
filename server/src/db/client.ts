// docs/database-and-migrations.md
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { env } from '../config/env.js'
import * as schema from './schema/index.js'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 })
export const db = drizzle(pool, { schema, casing: 'snake_case' })
export type Db = typeof db
