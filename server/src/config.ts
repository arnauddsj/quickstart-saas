import { validateEnv } from './utils/validateEnv'

const env = validateEnv()

export const CONFIG = {
  // Database
  DATABASE_URL: env.DATABASE_URL,

  // Email
  MAILHOG_HOST: env.MAILHOG_HOST,
  MAILHOG_PORT: env.MAILHOG_PORT,

  // Security
  JWT_SECRET: env.JWT_SECRET,
  COOKIE_NAME: env.COOKIE_NAME,
  COOKIE_DOMAIN: env.COOKIE_DOMAIN,
  COOKIE_SECURE: env.COOKIE_SECURE,

  // Environment
  NODE_ENV: env.NODE_ENV,
  SERVER_URL: env.SERVER_URL,
  CORS_ORIGINS: env.CORS_ORIGINS,
  IS_PRODUCTION: env.NODE_ENV === 'production',
  IS_DEVELOPMENT: env.NODE_ENV === 'development',
  IS_TEST: env.NODE_ENV === 'test',

  // Session
  SESSION_DURATION: env.SESSION_DURATION,
} as const

export type Config = typeof CONFIG