// docs/account-lifecycle.md
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { organization, userConsent } from '../../db/schema/index.js'
import { exportUserData, organizationsOwnedSolelyBy } from '../../services/account.js'
import { protectedProcedure, publicProcedure, router } from '../index.js'

const consentRecord = z.record(z.string(), z.unknown())

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name,
    role: ctx.user.role ?? 'member',
    activeOrganizationId: ctx.session.activeOrganizationId ?? null,
    createdAt: ctx.user.createdAt.toISOString(),
  })),

  exportData: protectedProcedure.query(({ ctx }) => exportUserData(ctx.user.id)),

  deletionPreview: protectedProcedure.query(async ({ ctx }) => {
    const ids = await organizationsOwnedSolelyBy(ctx.user.id)
    if (ids.length === 0) return { organizationsToDelete: [] as { id: string; name: string }[] }
    const rows = await db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
    return { organizationsToDelete: rows.filter((r) => ids.includes(r.id)) }
  }),

  getConsent: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null
    const row = await db.query.userConsent.findFirst({ where: eq(userConsent.userId, ctx.user.id) })
    return row
      ? { record: row.record as Record<string, unknown>, updatedAt: row.updatedAt.toISOString() }
      : null
  }),

  setConsent: protectedProcedure.input(consentRecord).mutation(async ({ ctx, input }) => {
    await db
      .insert(userConsent)
      .values({ userId: ctx.user.id, record: input, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userConsent.userId,
        set: { record: input, updatedAt: new Date() },
      })
    return { ok: true }
  }),
})
