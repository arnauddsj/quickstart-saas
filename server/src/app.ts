// docs/deployment.md
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify'
import fastify from 'fastify'
import { registerAuthRoutes } from './auth/fastify.js'
import { env } from './config/env.js'
import { healthRoutes } from './routes/health.js'
import { stripeWebhookRoutes } from './routes/stripeWebhook.js'
import { reportError } from './services/errorLog.js'
import { createContext } from './trpc/index.js'
import { appRouter, type AppRouter } from './trpc/router/index.js'
import { logger } from './utils/logger.js'

export async function buildApp() {
  const app = fastify({
    loggerInstance: logger,
    routerOptions: { maxParamLength: 5000 },
    trustProxy: true,
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true })
  await app.register(cookie)
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => {
      const error = new Error(`Rate limit exceeded, retry in ${context.after}`) as Error & {
        statusCode: number
      }
      error.statusCode = 429
      return error
    },
  })

  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS')
      return
    if (!request.url.startsWith('/trpc/')) return
    const origin = request.headers.origin
    if (origin && !env.CORS_ORIGINS.includes(origin)) {
      return reply.status(403).send({ error: 'Invalid origin' })
    }
  })

  await app.register(registerAuthRoutes)
  await app.register(healthRoutes)
  await app.register(stripeWebhookRoutes)
  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ error, path, ctx }) {
        if (error.code !== 'INTERNAL_SERVER_ERROR') return
        void reportError({
          severity: 'ERROR',
          type: `trpc.${path ?? 'unknown'}`,
          message: error.message,
          error: error.cause ?? error,
          userId: ctx?.user?.id ?? null,
        })
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
  })

  return app
}
