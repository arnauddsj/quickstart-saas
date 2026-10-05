// docs/configuration.md
import { z } from 'zod'

const isProd = process.env.NODE_ENV === 'production'

const devDefault =
  <T>(name: string, value: T) =>
  () => {
    if (isProd) throw new Error(`${name} must be set in production`)
    return value
  }

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  PUBLIC_URL: z.url().default('http://localhost:5173'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  AUTH_SECRET: z
    .string()
    .min(32)
    .default(devDefault('AUTH_SECRET', 'dev_auth_secret_change_me_at_least_32_chars')),
  COOKIE_SECURE: z.stringbool().default(false),
  EMAIL_PROVIDER: z.enum(['smtp', 'loops']).default('smtp'),
  EMAIL_FROM: z.email().default('noreply@example.com'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  LOOPS_API_KEY: z.string().optional(),
  LOOPS_TEMPLATE_IDS: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().default(devDefault('STRIPE_SECRET_KEY', 'sk_test_placeholder')),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .default(devDefault('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder')),
  STRIPE_PRICE_PRO_MONTHLY: z.string().default('price_pro_monthly_placeholder'),
  SENTRY_DSN: z.url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  TRUST_PROXY: z.string().default('loopback,uniquelocal'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default(isProd ? 'info' : 'debug'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const withoutEmpty = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === '' ? undefined : value]),
  )
  const result = schema.safeParse(withoutEmpty)
  if (!result.success) throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  const env = result.data
  const plainLocalhost = /^http:\/\/localhost(:\d+)?$/.test(env.PUBLIC_URL)
  if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE && !plainLocalhost) {
    throw new Error(
      'COOKIE_SECURE must be true in production unless PUBLIC_URL is http://localhost',
    )
  }
  if (env.NODE_ENV === 'production' && env.EMAIL_PROVIDER === 'smtp' && !withoutEmpty.SMTP_HOST) {
    throw new Error('EMAIL_PROVIDER=smtp needs SMTP_HOST in production')
  }
  if (
    env.EMAIL_PROVIDER === 'loops' &&
    !(env.LOOPS_API_KEY && /(^|,)\s*magicLink\s*=/.test(env.LOOPS_TEMPLATE_IDS ?? ''))
  ) {
    throw new Error(
      'EMAIL_PROVIDER=loops needs LOOPS_API_KEY and a magicLink id in LOOPS_TEMPLATE_IDS',
    )
  }
  return env
}

export const env = parseEnv()
export const IS_PROD = env.NODE_ENV === 'production'
