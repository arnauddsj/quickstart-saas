import { initTRPC } from '@trpc/server'
import { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify"
import { ZodError } from 'zod'

export const createContext = async ({ req, res }: CreateFastifyContextOptions) => {
  return { req, res }
}

export const t = initTRPC.context<typeof createContext>().create({
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


export const router = t.router
export const publicProcedure = t.procedure

export { default as appRouter, AppRouter } from './router'