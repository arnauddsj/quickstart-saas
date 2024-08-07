export const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  SESSION_DURATION: 7 * 24 * 60 * 60, // 7 days in seconds
  COOKIE_NAME: 'auth_session',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://admin:quickstart@localhost/quickstart',
  SERVER_URL: process.env.SERVER_URL ?? 'http://localhost:3000',
}