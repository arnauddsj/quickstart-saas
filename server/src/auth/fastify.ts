// docs/auth.md
import type { FastifyInstance } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { env } from '../config/env.js'
import { auth } from './index.js'

export async function registerAuthRoutes(app: FastifyInstance) {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, env.PUBLIC_URL)
      const headers = fromNodeHeaders(request.headers)
      const body = request.body ? JSON.stringify(request.body) : undefined
      const response = await auth.handler(
        new Request(url, { method: request.method, headers, body }),
      )

      reply.status(response.status)
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') reply.header(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length > 0) reply.header('set-cookie', cookies)
      return reply.send(response.body ? await response.text() : null)
    },
  })
}
