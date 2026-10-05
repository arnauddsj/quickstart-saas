// docs/new-project.md
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { checkProductionEnv, checkProject } from './setup/readiness.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const { values } = parseArgs({ options: { env: { type: 'string' } } })

const checks = [
  ...checkProject(root),
  ...(values.env ? checkProductionEnv(readFileSync(values.env, 'utf8'), values.env) : []),
]
for (const c of checks) {
  console.log(
    `${c.ok ? 'ok  ' : 'TODO'}  ${c.id.padEnd(22)} ${c.ok ? '' : `${c.message} (${c.where})`}`,
  )
}
const left = checks.filter((c) => !c.ok).length
console.log(left === 0 ? '\nReady.' : `\n${left} item(s) left.`)
process.exitCode = left === 0 ? 0 : 1
