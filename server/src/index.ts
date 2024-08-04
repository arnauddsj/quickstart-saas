import fastify from 'fastify'
import cors from '@fastify/cors'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter, createContext } from './trpc'
import type { AppRouter } from './trpc/router'

const server = fastify({
  maxParamLength: 5000,
})

server.register(cors, {
  origin: true,
})

// Add a logging middleware to log all incoming requests
server.addHook('onRequest', (request, reply, done) => {
  console.log('Received request:', {
    method: request.method,
    url: request.url,
    headers: request.headers,
    body: request.body
  })
  done()
})

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

async function main() {
  try {
    await server.listen({ port: 3000 })
    console.log('Server listening on http://localhost:3000')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

main()

// Export type router type signature for client usage
export type { AppRouter }