// docs/reference-feature.md
import { TRPCError } from '@trpc/server'
import { and, count, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { assertWithinLimit, planLimit } from '../../config/plans.js'
import { db } from '../../db/client.js'
import { project } from '../../db/schema/index.js'
import { getOrCreateSubscription } from '../../services/stripe.js'
import { orgAdminProcedure, orgProcedure, router } from '../index.js'

const name = z.string().trim().min(1).max(100)

const serialize = (row: typeof project.$inferSelect) => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const inOrg = (organizationId: string, id: string) =>
  and(eq(project.organizationId, organizationId), eq(project.id, id))

export const projectRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const [rows, sub] = await Promise.all([
      db
        .select()
        .from(project)
        .where(eq(project.organizationId, ctx.organizationId))
        .orderBy(desc(project.createdAt)),
      getOrCreateSubscription(ctx.organizationId),
    ])
    return { projects: rows.map(serialize), limit: planLimit(sub.plan, 'projects') }
  }),

  create: orgProcedure.input(z.object({ name })).mutation(async ({ ctx, input }) => {
    const sub = await getOrCreateSubscription(ctx.organizationId)
    const [usage] = await db
      .select({ used: count() })
      .from(project)
      .where(eq(project.organizationId, ctx.organizationId))
    assertWithinLimit(sub.plan, 'projects', usage?.used ?? 0)
    const [row] = await db
      .insert(project)
      .values({ organizationId: ctx.organizationId, name: input.name })
      .returning()
    return serialize(row!)
  }),

  rename: orgProcedure
    .input(z.object({ id: z.string(), name }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .update(project)
        .set({ name: input.name })
        .where(inOrg(ctx.organizationId, input.id))
        .returning()
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      return serialize(row)
    }),

  delete: orgAdminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [row] = await db
      .delete(project)
      .where(inOrg(ctx.organizationId, input.id))
      .returning({ id: project.id })
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
    return { id: row.id }
  }),
})
