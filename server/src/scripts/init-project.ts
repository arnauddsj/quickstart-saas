// docs/new-project.md
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { freePorts, initProject } from './setup/project.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    'support-email': { type: 'string' },
    accent: { type: 'string', default: '#18181b' },
    workspace: { type: 'string', default: 'workspace' },
    workspaces: { type: 'string' },
    solo: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
})

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = async (question: string, given?: string) => {
  if (given) return given
  const answer = (await rl.question(`${question}: `)).trim()
  if (!answer) throw new Error(`${question} is required`)
  return answer
}

try {
  const name = await ask('Product name', values.name)
  const supportEmail = await ask('Support email', values['support-email'])
  const workspaceOne = values.workspace
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const result = initProject(
    root,
    {
      name,
      supportEmail,
      accentColor: values.accent,
      workspaceOne,
      workspaceMany: values.workspaces ?? `${workspaceOne}s`,
      teams: !values.solo,
    },
    { ports: await freePorts(), commit, force: values.force },
  )
  const { ports } = result
  console.log(`Initialized ${result.slug}:`)
  for (const path of result.written) console.log(`  wrote ${path.slice(root.length)}`)
  console.log(
    `  ports: api ${ports.api}, client ${ports.client}, postgres ${ports.postgres}, smtp ${ports.smtp}, mail ${ports.mailUi}`,
  )
  console.log('Next: docker compose up -d && pnpm dev, then pnpm check-ready for what is left.')
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  rl.close()
}
