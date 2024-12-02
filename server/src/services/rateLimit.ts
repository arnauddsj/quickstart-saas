import PgBoss from 'pg-boss'
import { FastifyInstance } from 'fastify'
import { CONFIG } from '../config'

interface RateLimitJob {
  data: {
    attempts: number;
  };
}

interface MagicLinkBody {
  email?: string;
}

export class RateLimitService {
  private static boss: PgBoss

  static async initialize(connectionString: string) {
    this.boss = new PgBoss(connectionString)
    await this.boss.start()
  }

  static async checkRateLimit(key: string): Promise<{ allowed: boolean; resetTime?: Date }> {
    const windowMs = 60 * 60 * 1000 // 1 hour in milliseconds
    const maxAttempts = CONFIG.IS_PRODUCTION ? 3 : 100

    try {
      // Try to create a singleton job - it will fail if one exists
      const job = await this.boss.send({
        name: `ratelimit:${key}`,
        data: { attempts: 1 },
        options: {
          singletonKey: key,
          singletonSeconds: 3600, // 1 hour
          retentionSeconds: 3600,
        },
      })

      if (job) {
        // First attempt for this key
        return { allowed: true }
      }

      // Job exists, increment the counter
      const currentJob = await this.boss.getJobById(`ratelimit:${key}`, job) as RateLimitJob
      const attempts = (currentJob?.data?.attempts || 0) + 1

      if (attempts > maxAttempts) {
        return {
          allowed: false,
          resetTime: new Date(Date.now() + windowMs),
        }
      }

      // Update attempts count
      await this.boss.complete(`ratelimit:${key}`, job)
      return { allowed: true }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      // Fail open in case of errors
      return { allowed: true }
    }
  }
}

export async function configureRateLimit(app: FastifyInstance) {
  // Initialize rate limit service
  await RateLimitService.initialize(CONFIG.DATABASE_URL)

  app.addHook('preHandler', async (request, reply) => {
    // Only rate limit specific endpoints
    if (request.url.includes('/trpc/auth.sendMagicLink')) {
      const email = (request.body as MagicLinkBody)?.email
      const key = email ? `${request.ip}-${email}` : request.ip

      const { allowed, resetTime } = await RateLimitService.checkRateLimit(key)

      if (!allowed) {
        reply.status(429).send({
          code: 429,
          error: 'Too Many Requests',
          message: `Too many attempts. Please try again after ${resetTime?.toISOString()}`,
        })
      }
    }
  })
}