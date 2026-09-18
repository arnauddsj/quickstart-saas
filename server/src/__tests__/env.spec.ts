import { describe, expect, it } from 'vitest'
import { parseEnv } from '../config/env.js'

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' }

describe('parseEnv', () => {
  it('applies development defaults', () => {
    const env = parseEnv(base)
    expect(env.PORT).toBe(3000)
    expect(env.PUBLIC_URL).toBe('http://localhost:5173')
    expect(env.EMAIL_PROVIDER).toBe('smtp')
    expect(env.COOKIE_SECURE).toBe(false)
    expect(env.TRUST_PROXY).toBe('loopback,uniquelocal')
  })

  it('parses COOKIE_SECURE as a real boolean', () => {
    expect(parseEnv({ ...base, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false)
    expect(parseEnv({ ...base, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true)
    expect(parseEnv({ ...base, COOKIE_SECURE: '1' }).COOKIE_SECURE).toBe(true)
  })

  it('splits and trims CORS_ORIGINS', () => {
    expect(
      parseEnv({ ...base, CORS_ORIGINS: 'http://a.test, http://b.test ,' }).CORS_ORIGINS,
    ).toEqual(['http://a.test', 'http://b.test'])
  })

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'not a url' })).toThrow(/Invalid environment/)
  })

  it('treats empty strings as unset, which is what Compose passes for optional variables', () => {
    const env = parseEnv({ ...base, SENTRY_DSN: '', LOOPS_API_KEY: '', EMAIL_FROM: '' })
    expect(env.SENTRY_DSN).toBeUndefined()
    expect(env.LOOPS_API_KEY).toBeUndefined()
    expect(env.EMAIL_FROM).toBe('noreply@example.com')
  })

  it('allows an insecure cookie in production only on plain http://localhost', () => {
    const prod = {
      ...base,
      NODE_ENV: 'production',
      AUTH_SECRET: 'x'.repeat(32),
      COOKIE_SECURE: 'false',
      STRIPE_SECRET_KEY: 'sk',
      STRIPE_WEBHOOK_SECRET: 'wh',
    }
    expect(parseEnv({ ...prod, PUBLIC_URL: 'http://localhost:8080' }).COOKIE_SECURE).toBe(false)
    expect(() => parseEnv({ ...prod, PUBLIC_URL: 'http://app.example.com' })).toThrow(
      /COOKIE_SECURE must be true in production/,
    )
  })

  it('requires COOKIE_SECURE in production', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        PUBLIC_URL: 'https://app.example.com',
        AUTH_SECRET: 'x'.repeat(32),
        COOKIE_SECURE: 'false',
        STRIPE_SECRET_KEY: 'sk',
        STRIPE_WEBHOOK_SECRET: 'wh',
      }),
    ).toThrow(/COOKIE_SECURE must be true in production/)
  })

  it('requires Loops credentials when EMAIL_PROVIDER=loops', () => {
    expect(() => parseEnv({ ...base, EMAIL_PROVIDER: 'loops' })).toThrow(/LOOPS_API_KEY/)
    expect(
      parseEnv({
        ...base,
        EMAIL_PROVIDER: 'loops',
        LOOPS_API_KEY: 'k',
        LOOPS_MAGIC_LINK_TEMPLATE_ID: 't',
      }).EMAIL_PROVIDER,
    ).toBe('loops')
  })
})
