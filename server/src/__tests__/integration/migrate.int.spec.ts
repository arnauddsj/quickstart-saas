import { describe, expect, it } from 'vitest'
import { pool } from '../../db/client.js'
import { MIGRATION_LOCK_ID, runMigrations } from '../../db/migrate.js'

describe('runMigrations', () => {
  it('waits for the advisory lock another booting instance holds', async () => {
    const other = await pool.connect()
    await other.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID])
    let done = false
    const run = runMigrations().then(() => {
      done = true
    })
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(done).toBe(false)
    } finally {
      await other.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
      other.release()
    }
    await run
    expect(done).toBe(true)
  })

  it('lets concurrent runs all finish', async () => {
    await expect(Promise.all([runMigrations(), runMigrations()])).resolves.toBeDefined()
  })
})
