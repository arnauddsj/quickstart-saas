// docs/seeding.md
import { parseArgs } from 'node:util'
import { IS_PROD } from '../config/env.js'
import { pool } from '../db/client.js'
import { KNOWN_USERS, runSeed, SeedRefused } from './seed/index.js'

const { values } = parseArgs({ options: { reset: { type: 'boolean', default: false } } })

if (IS_PROD) {
  console.error('db:seed refuses to run with NODE_ENV=production')
  process.exitCode = 1
} else {
  try {
    const summary = await runSeed({ reset: values.reset })
    for (const s of summary) console.log(`${s.name.padEnd(14)} ${s.rows} rows`)
    console.log(`\nsign in with a magic link as:`)
    for (const u of KNOWN_USERS) console.log(`  ${u.email}`)
  } catch (err) {
    if (!(err instanceof SeedRefused)) throw err
    console.error(`db:seed: ${err.message}`)
    process.exitCode = 1
  }
}
await pool.end()
