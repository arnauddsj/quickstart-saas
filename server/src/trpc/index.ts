// docs/auth.md
import * as Sentry from '@sentry/node'
import { initTRPC, TRPCError } from '@trpc/server'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { and, eq } from 'drizzle-orm'
import { ZodError } from 'zod'
import { auth } from '../auth/index.js'
import { IS_PROD } from '../config/env.js'
import { db } from '../db/client.js'
import { member } from '../db/schema/index.js'
import { recordActivity } from '../services/usage.js'

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (result) Sentry.getIsolationScope().setUser({ id: result.user.id })
  return { req, res, user: result?.user ?? null, session: result?.session ?? null }
}

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message:
        IS_PROD && error.code === 'INTERNAL_SERVER_ERROR' ? 'Internal server error' : shape.message,
      data: {
        ...shape.data,
        zodError:
          !IS_PROD && error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    }
  },
})

export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || !ctx.session)
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  if (ctx.user.banned) throw new TRPCError({ code: 'FORBIDDEN', message: 'Account suspended' })
  void recordActivity(ctx.user, ctx.session.activeOrganizationId)
  return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } })
})

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' })
  return next()
})

export const ORG_ADMIN_ROLES = ['owner', 'admin'] as const

export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const organizationId = ctx.session.activeOrganizationId
  if (!organizationId)
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No active organization' })
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, organizationId), eq(member.userId, ctx.user.id)),
  })
  if (!membership)
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this organization' })
  Sentry.getIsolationScope().setTag('organization_id', organizationId)
  return next({ ctx: { ...ctx, organizationId, membership } })
})

export const orgAdminProcedure = orgProcedure.use(({ ctx, next }) => {
  if (!(ORG_ADMIN_ROLES as readonly string[]).includes(ctx.membership.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization admin only' })
  }
  return next()
})
