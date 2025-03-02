import { initTRPC, TRPCError } from '@trpc/server'
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify"
import { ZodError } from 'zod'
import { verifyAndGetUser } from '../services/auth'
import { CONFIG } from '../config'
import { handleError } from '../utils/errorHandler'

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
    // Only log unexpected errors, not authentication-related ones
    if (!(error instanceof TRPCError) || error.code !== 'UNAUTHORIZED') {
      console.error('Error verifying token:', error)
    }
    res.clearCookie(CONFIG.COOKIE_NAME)
    return { req, res, user: null }
  }
}

export const createTRPCContext = (opts: CreateFastifyContextOptions) => {
  return createContext(opts)
}

export const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    const sanitizedError = handleError(error)
    
    if (error.code === 'BAD_REQUEST' && error.cause instanceof ZodError) {
      return {
        ...shape,
        message: 'Invalid input provided',
        data: {
          ...shape.data,
          fieldErrors: CONFIG.IS_PRODUCTION 
            ? 'Validation failed'
            : error.cause.flatten().fieldErrors,
        },
      }
    }

    return {
      ...shape,
      message: sanitizedError.message,
    }
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

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN', 
      message: 'Access denied: Admin privileges required' 
    })
  }
  return next({ ctx })
})

export { default as appRouter, AppRouter } from './router'