import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Email
  MAILHOG_HOST: z.string().default('mailhog'),
  MAILHOG_PORT: z.coerce.number().default(1025),

  // Security
  JWT_SECRET: z.string().min(32).default(() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production')
    }
    return 'development_jwt_secret_at_least_32_chars_long'
  }),
  COOKIE_NAME: z.string().default('auth_session'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SERVER_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().transform(val => val.split(',')).default('http://localhost:5173'),

  // Session
  SESSION_DURATION: z.coerce.number().default(7 * 24 * 60 * 60), // 7 days in seconds
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(): Env {
  try {
    const parsed = envSchema.parse(process.env)

    // Additional validation for production environment
    if (parsed.NODE_ENV === 'production') {
      if (!parsed.COOKIE_SECURE) {
        throw new Error('COOKIE_SECURE must be true in production')
      }
      
      if (parsed.COOKIE_DOMAIN === 'localhost') {
        throw new Error('COOKIE_DOMAIN must be set in production')
      }
      
      if (parsed.JWT_SECRET === 'development_jwt_secret_at_least_32_chars_long') {
        throw new Error('Default JWT_SECRET cannot be used in production')
      }
    }

    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      console.error(JSON.stringify(error.format(), null, 2))
      process.exit(1)
    }
    throw error
  }
}