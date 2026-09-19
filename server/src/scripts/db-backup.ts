// docs/backups.md
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs, parseEnv } from 'node:util'
import {
  COUNT_QUERY,
  backupName,
  backupsToPrune,
  compareCounts,
  parseCounts,
} from './setup/backup.js'
import type { Counts } from './setup/backup.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const cwd = process.env.INIT_CWD ?? process.cwd()

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string', default: join(root, 'backups') },
    keep: { type: 'string', default: '0' },
    into: { type: 'string' },
    force: { type: 'boolean', default: false },
    container: { type: 'string' },
  },
})
const [command, file] = positionals

const composeEnv = existsSync(join(root, '.env'))
  ? parseEnv(await readFile(join(root, '.env'), 'utf8'))
  : {}
const setting = (key: string, fallback: string) => process.env[key] || composeEnv[key] || fallback
const pgUser = setting('POSTGRES_USER', 'admin')
const pgDatabase = setting('POSTGRES_DB', 'quickstart')

function inPostgres(args: string[]): ChildProcess {
  const exec = values.container
    ? ['exec', '-i', values.container, ...args]
    : ['compose', 'exec', '-T', 'postgres', ...args]
  return spawn('docker', exec, { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] })
}

function finished(child: ChildProcess, what: string): Promise<void> {
  return new Promise((done, fail) => {
    child.once('error', fail)
    child.once('close', (code) =>
      code === 0 ? done() : fail(new Error(`${what} exited with ${code}`)),
    )
  })
}

async function run(args: string[], input?: string): Promise<string> {
  const child = inPostgres(args)
  let output = ''
  child.stdout!.on('data', (chunk: Buffer) => (output += chunk.toString()))
  if (input) createReadStream(input).pipe(child.stdin!)
  else child.stdin!.end()
  await finished(child, args[0]!)
  return output
}

const countsOf = async (database: string) =>
  parseCounts(await run(['psql', '-U', pgUser, '-d', database, '-qAt', '-c', COUNT_QUERY]))

async function backup(): Promise<void> {
  const dir = resolve(cwd, values.dir)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, backupName(pgDatabase, new Date()))

  const session = inPostgres([
    'psql',
    '-U',
    pgUser,
    '-d',
    pgDatabase,
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
  ])
  const closed = finished(session, 'psql')
  const lines = createInterface({ input: session.stdout! })[Symbol.asyncIterator]()
  const nextLine = async () => {
    const { value, done } = await lines.next()
    if (done) throw new Error('psql closed before answering')
    return value as string
  }
  session.stdin!.write('begin isolation level repeatable read;\nselect pg_export_snapshot();\n')
  const snapshot = (await nextLine()).trim()

  const dump = inPostgres([
    'pg_dump',
    '-U',
    pgUser,
    '-d',
    pgDatabase,
    '-Fc',
    `--snapshot=${snapshot}`,
  ])
  dump.stdout!.pipe(createWriteStream(target))
  dump.stdin!.end()
  await finished(dump, 'pg_dump')

  session.stdin!.write(`${COUNT_QUERY}\n\\echo __end__\n`)
  const rows: string[] = []
  for (let line = await nextLine(); line !== '__end__'; line = await nextLine()) rows.push(line)
  session.stdin!.end('commit;\n')
  await closed

  const counts = parseCounts(rows.join('\n'))
  await writeFile(
    `${target}.json`,
    `${JSON.stringify({ database: pgDatabase, snapshot, createdAt: new Date().toISOString(), counts }, null, 2)}\n`,
  )
  console.log(`wrote ${target} (${Object.keys(counts).length} tables)`)

  const keep = Number(values.keep)
  const pruned = backupsToPrune(
    (await readdir(dir)).map((f) => join(dir, f)),
    pgDatabase,
    keep,
  )
  for (const old of pruned) {
    await rm(old)
    await rm(`${old}.json`, { force: true })
    console.log(`pruned ${old}`)
  }
}

async function databaseExists(name: string): Promise<boolean> {
  const out = await run([
    'psql',
    '-U',
    pgUser,
    '-d',
    'postgres',
    '-qAt',
    '-c',
    `select 1 from pg_database where datname = '${name.replace(/'/g, "''")}'`,
  ])
  return out.trim() === '1'
}

async function restoreInto(dump: string, into: string, replace: boolean): Promise<void> {
  if (!/^[a-z0-9_]+$/.test(into)) throw new Error('--into must be lowercase letters, digits or _')
  if (await databaseExists(into)) {
    if (!replace) throw new Error(`database ${into} exists; pass --force to replace it`)
    await run(['dropdb', '-U', pgUser, '--force', into])
  }
  await run(['createdb', '-U', pgUser, into])
  await run(['pg_restore', '-U', pgUser, '-d', into, '--no-owner', '--exit-on-error'], dump)
}

async function restoreCheck(dump: string): Promise<void> {
  const sidecar = JSON.parse(await readFile(`${dump}.json`, 'utf8')) as { counts: Counts }
  const scratch = `restore_check_${Date.now()}`
  try {
    await restoreInto(dump, scratch, false)
    const differences = compareCounts(sidecar.counts, await countsOf(scratch))
    const tables = Object.keys(sidecar.counts).length
    if (differences.length > 0) {
      for (const d of differences) {
        console.error(
          `${d.table}: dumped ${d.expected ?? 'missing'}, restored ${d.restored ?? 'missing'}`,
        )
      }
      throw new Error(`${differences.length} of ${tables} tables differ`)
    }
    console.log(`restore-check ok: ${tables} tables, row counts match (${scratch} dropped)`)
  } finally {
    if (await databaseExists(scratch)) await run(['dropdb', '-U', pgUser, '--force', scratch])
  }
}

try {
  if (command === 'backup') await backup()
  else if (command === 'restore' && file && values.into)
    await restoreInto(resolve(cwd, file), values.into, values.force)
  else if (command === 'restore-check' && file) await restoreCheck(resolve(cwd, file))
  else {
    console.error(
      'usage: db:backup [--dir d] [--keep n] | db:restore <file> --into <db> [--force] | db:restore-check <file>',
    )
    process.exitCode = 1
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
}
