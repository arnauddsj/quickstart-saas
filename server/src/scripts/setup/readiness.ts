// docs/new-project.md
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

export type Check = { id: string; ok: boolean; message: string; where: string }

const PLACEHOLDER_PRICE = 'price_pro_monthly_placeholder'

function read(root: string, path: string): string {
  const file = join(root, path)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

export function checkProject(root: string): Check[] {
  const brand = read(root, 'server/src/config/brand.ts')
  const claude = read(root, 'CLAUDE.md')
  const readme = read(root, 'README.md')
  const legal = read(root, 'client/src/data/legal.ts')
  const terms = read(root, 'client/src/pages/legal/Terms.vue')
  const analytics = read(root, 'server/src/services/analytics.ts')
  const plans = read(root, 'server/src/config/plans.ts')
  const billing = read(root, 'server/src/trpc/router/billing.ts')

  return [
    {
      id: 'initialized',
      ok: existsSync(join(root, 'server/.env')) && existsSync(join(root, '.starter.json')),
      message: 'Run pnpm init-project',
      where: 'server/.env, .starter.json',
    },
    {
      id: 'brand.name',
      ok: !/name: 'Quickstart SaaS'/.test(brand),
      message: 'Name the product',
      where: 'server/src/config/brand.ts',
    },
    {
      id: 'brand.supportEmail',
      ok: !/supportEmail: '[^']*@example\.com'/.test(brand),
      message: 'Set a real support address',
      where: 'server/src/config/brand.ts',
    },
    {
      id: 'claude.statement',
      ok: !claude.includes('Replace this paragraph with the product statement'),
      message: 'Rewrite the product statement',
      where: 'CLAUDE.md',
    },
    {
      id: 'readme.title',
      ok: !/^# Quickstart SaaS$/m.test(readme),
      message: 'Rename the README and describe the product',
      where: 'README.md',
    },
    {
      id: 'reference.projects',
      ok: !existsSync(join(root, 'server/src/trpc/router/project.ts')),
      message: 'Rename or delete the Projects reference feature (docs/reference-feature.md)',
      where: 'server/src/trpc/router/project.ts',
    },
    {
      id: 'analytics.activation',
      ok: !/ACTIVATION_EVENT = 'project\.created'/.test(analytics),
      message: 'Choose the activation event',
      where: 'server/src/services/analytics.ts',
    },
    {
      id: 'plans.placeholders',
      ok: !/exports: (true|false)/.test(plans) && !/exportData:/.test(billing),
      message: 'Replace the placeholder exports feature and delete billing.exportData',
      where: 'server/src/config/plans.ts, server/src/trpc/router/billing.ts',
    },
    {
      id: 'legal.entity',
      ok: !/ACME SAS|000 000 000|privacy@example\.com/.test(legal),
      message: 'Fill the legal entity, registration and contact',
      where: 'client/src/data/legal.ts',
    },
    {
      id: 'legal.terms',
      ok: !terms.includes("Replace this page with the product's real terms"),
      message: 'Write the terms of service',
      where: 'client/src/pages/legal/Terms.vue',
    },
  ]
}

export function checkProductionEnv(source: string, label: string): Check[] {
  const env = parseEnv(source)
  const set = (key: string) => Boolean(env[key]?.trim())
  const loops = env.EMAIL_PROVIDER === 'loops'
  return [
    {
      id: 'env.public_url',
      ok: /^https:\/\//.test(env.PUBLIC_URL ?? ''),
      message: 'PUBLIC_URL must be the https origin browsers use',
      where: label,
    },
    {
      id: 'env.auth_secret',
      ok: (env.AUTH_SECRET?.length ?? 0) >= 32,
      message: 'AUTH_SECRET must be 32+ random characters',
      where: label,
    },
    {
      id: 'env.postgres_password',
      ok: set('POSTGRES_PASSWORD') && env.POSTGRES_PASSWORD !== 'quickstart',
      message: 'POSTGRES_PASSWORD must be set and not the development default',
      where: label,
    },
    {
      id: 'env.email',
      ok: loops
        ? set('LOOPS_API_KEY') && /(^|,)\s*magicLink\s*=/.test(env.LOOPS_TEMPLATE_IDS ?? '')
        : set('SMTP_HOST') && env.SMTP_HOST !== 'mailpit',
      message: loops
        ? 'Loops needs LOOPS_API_KEY and a magicLink id in LOOPS_TEMPLATE_IDS'
        : 'SMTP needs a real SMTP_HOST (not mailpit), or switch EMAIL_PROVIDER to loops',
      where: label,
    },
    {
      id: 'env.stripe',
      ok:
        /^sk_(live|test)_/.test(env.STRIPE_SECRET_KEY ?? '') &&
        /^whsec_/.test(env.STRIPE_WEBHOOK_SECRET ?? '') &&
        set('STRIPE_PRICE_PRO_MONTHLY') &&
        env.STRIPE_PRICE_PRO_MONTHLY !== PLACEHOLDER_PRICE,
      message: 'Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and a real STRIPE_PRICE_PRO_MONTHLY',
      where: label,
    },
    {
      id: 'env.sentry',
      ok: set('SENTRY_DSN'),
      message: 'Set SENTRY_DSN so production errors reach GlitchTip',
      where: label,
    },
  ]
}
