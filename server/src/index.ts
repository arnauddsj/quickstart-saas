import fastify from 'fastify'
import cors from '@fastify/cors'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter, createContext } from './trpc'
import type { AppRouter } from './trpc/router'
import fastifyCookie from '@fastify/cookie'
import { AppDataSource } from './data-source'
import dotenv from 'dotenv'
import PgBoss from 'pg-boss'
import { initializeTokenCleanup } from './services/tokenCleanup'
import { CONFIG } from './config'
import { logger } from './utils/logger'

dotenv.config()

const server = fastify({
  maxParamLength: 5000,
})

server.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    var json = JSON.parse(body as string)
    done(null, json)
  } catch (err) {
    err.statusCode = 400
    done(err, undefined)
  }
})

server.register(cors, {
  origin: CONFIG.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie'],
  preflight: true,
})

// Replace cookie-parser with fastify cookie plugin
server.register(fastifyCookie)

server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError(opts) {
      const { error, path } = opts
      
      // Skip logging for expected auth-related errors
      if (
        error.message === 'Not authenticated' || 
        error.message === 'No token found' ||
        error.message === 'Invalid token'
      ) {
        return;
      }

      // Log other errors
      logger.error('TRPC Error:', {
        path,
        error: error.message,
        stack: error.stack
      })
    },
  },
})

async function connectWithRetry(retries = 5, delay = 5000) {
  while (retries > 0) {
    try {
      await AppDataSource.initialize()
      console.log("Data Source has been initialized!")
      await AppDataSource.runMigrations()
      console.log("Migrations have been run successfully!")
      return
    } catch (err) {
      console.error('Failed to connect to the database or run migrations. Retrying...')
      retries--
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Unable to connect to the database or run migrations after multiple attempts')
}

async function main() {
  try {
    const boss = new PgBoss({
      connectionString: CONFIG.DATABASE_URL,
      max: 1, // Limit connection pool size for the job queue
      application_name: 'token-cleanup-worker',
      schema: 'pgboss'
    })

    // Listen for PgBoss errors
    boss.on('error', error => {
      logger.error('PgBoss error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    })

    // Start PgBoss and wait for it to be ready
    await boss.start()
    
    // Create the queue before scheduling
    await boss.createQueue('auth/cleanup-tokens')
    
    // Initialize token cleanup after PgBoss is started
    await initializeTokenCleanup(boss)
    
    // Connect to the main database
    await connectWithRetry()
    
    // Start the server
    await server.listen({ port: 3000, host: '0.0.0.0' })
    logger.info('Server listening on http://localhost:3000')
  } catch (err) {
    logger.error('Failed to start the server:', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    })
    process.exit(1)
  }
}

main()

// Export type router type signature for client usage
export type { AppRouter }