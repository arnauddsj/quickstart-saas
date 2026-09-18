// docs/testing.md
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const STALE_AFTER_MS = 60 * 60 * 1000

async function withAdmin<T>(url: URL, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const client = new pg.Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export default async function setup() {
  const url = new URL(process.env.QS_TEST_DATABASE_URL ?? '')
  const name = url.pathname.slice(1)
  if (!/^quickstart_test_\d+$/.test(name)) throw new Error(`refusing to manage database "${name}"`)

  await withAdmin(url, async (client) => {
    const { rows } = await client.query<{ datname: string }>(
      "select datname from pg_database where datname like 'quickstart_test_%'",
    )
    for (const { datname } of rows) {
      const createdAt = Number(datname.slice('quickstart_test_'.length))
      if (Date.now() - createdAt > STALE_AFTER_MS) {
        await client.query(`drop database if exists "${datname}" with (force)`)
      }
    }
    await client.query(`drop database if exists "${name}" with (force)`)
    await client.query(`create database "${name}"`)
  })

  const pool = new pg.Pool({ connectionString: url.toString(), max: 1 })
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url)),
  })
  await pool.end()

  return async () => {
    await withAdmin(url, (client) => client.query(`drop database if exists "${name}" with (force)`))
  }
}
