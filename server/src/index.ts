import fastify from 'fastify'
import cors from '@fastify/cors'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter, createContext } from './trpc'
import type { AppRouter } from './trpc/router'
import fastifyCookie from '@fastify/cookie'
import { AppDataSource } from './data-source'
import dotenv from 'dotenv'

// Load environment variables
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
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Replace cookie-parser with fastify cookie plugin
server.register(fastifyCookie)

server.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError(opts) {
      const { error, type, path, input, ctx, req } = opts
      console.error('TRPC Error:', {
        type,
        path,
        input,
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
    await connectWithRetry()
    await server.listen({ port: 3000, host: '0.0.0.0' })
    console.log(`Server listening on http://localhost:3000`)
  } catch (err) {
    console.error('Failed to start the server:', err)
    if (err instanceof Error) {
      console.error('Error message:', err.message)
      console.error('Stack trace:', err.stack)
    }
    server.log.error(err)
    process.exit(1)
  }
}

main()

// Export type router type signature for client usage
export type { AppRouter }