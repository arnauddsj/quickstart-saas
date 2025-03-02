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
import { configureRateLimit } from './services/rateLimit'
import { AuditLogService } from './services/auditLog'

dotenv.config()

const server = fastify({
  maxParamLength: 5000,
  logger: {
    level: CONFIG.IS_PRODUCTION ? 'info' : 'debug',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort,
        }
      }
    }
  }
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

// Register cookie plugin
server.register(fastifyCookie)

server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError(opts) {
      const { error, path, type, ctx } = opts
      
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
        type,
        error: error.message,
        stack: error.stack,
        userId: ctx?.user?.id
      })
    },
  },
})

async function connectWithRetry(retries = 5, delay = 5000) {
  while (retries > 0) {
    try {
      await AppDataSource.initialize()
      logger.info("Data Source has been initialized!")
      await AppDataSource.runMigrations()
      logger.info("Migrations have been run successfully!")
      return
    } catch (err) {
      logger.error('Failed to connect to the database or run migrations. Retrying...', {
        error: err instanceof Error ? err.message : 'Unknown error',
        retryCount: retries
      })
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
      max: 3, // Slightly larger pool for multiple job types
      application_name: 'pgboss-worker',
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
    
    // Initialize all services that use PgBoss
    // Create queues before scheduling
    await boss.createQueue('auth/cleanup-tokens')
    
    // Initialize token cleanup service
    await initializeTokenCleanup(boss)
    
    // Initialize the audit log service
    await AuditLogService.initialize(boss)
    
    // Connect to the main database
    await connectWithRetry()
    
    // Configure rate limiting
    await configureRateLimit(server)
    
    // Add health check endpoint
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    })
    
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