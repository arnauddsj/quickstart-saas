import { initTRPC, TRPCError } from '@trpc/server'
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify"
import { ZodError } from 'zod'
import { verifyAndGetUser } from '../services/auth'
import { CONFIG } from '../config'

export const createContext = async (opts: CreateFastifyContextOptions) => {
  const { req, res } = opts
  const token = req.cookies[CONFIG.COOKIE_NAME]

  if (!token) {
    return { req, res, user: null }
  }

  try {
    const user = await verifyAndGetUser(token)
    return { req, res, user }
  } catch (error) {
    console.error('Error verifying token:', error)
    res.clearCookie(CONFIG.COOKIE_NAME)
    return { req, res, user: null }
  }
}

export const createTRPCContext = (opts: CreateFastifyContextOptions) => {
  return createContext(opts)
}

export const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    if (error.code === 'BAD_REQUEST' && error.cause instanceof ZodError) {
      return {
        ...shape,
        message: 'Invalid request.',
        data: {
          ...shape.data,
          fieldErrors: error.cause.flatten().fieldErrors,
        },
      }
    }
    return shape
  }
})

export const publicProcedure = t.procedure
export const router = t.router

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export { default as appRouter, AppRouter } from './router'