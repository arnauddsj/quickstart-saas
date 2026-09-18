// docs/admin.md
import { TRPCError } from '@trpc/server'
import { count, desc, eq, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '../../auth/index.js'
import { db } from '../../db/client.js'
import { errorLog, organization, session, user } from '../../db/schema/index.js'
import { cleanupBeforeUserDelete } from '../../services/account.js'
import { adminStats, recentSignups, userActivity, userOrganizations } from '../../services/admin.js'
import { adminProcedure, router } from '../index.js'

const roleSchema = z.enum(['admin', 'member'])
const iso = (d: Date | null | undefined) => d?.toISOString() ?? null

export const adminRouter = router({
  stats: adminProcedure.query(async () => ({
    ...(await adminStats()),
    recentSignups: await recentSignups(8),
  })),

  listUsers: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        search: z.string().trim().optional(),
      }),
    )
    .query(async ({ input }) => {
      const where = input.search
        ? or(ilike(user.email, `%${input.search}%`), ilike(user.name, `%${input.search}%`))
        : undefined
      const [rows, [total]] = await Promise.all([
        db
          .select({
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            name: user.name,
            role: user.role,
            banned: user.banned,
            createdAt: user.createdAt,
            lastLoginAt: userActivity.lastLoginAt,
            lastActiveAt: userActivity.lastActiveAt,
            sessionCount: userActivity.sessionCount,
            organizationCount: userOrganizations.organizationCount,
          })
          .from(user)
          .leftJoin(userActivity, eq(userActivity.userId, user.id))
          .leftJoin(userOrganizations, eq(userOrganizations.userId, user.id))
          .where(where)
          .orderBy(desc(user.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(user).where(where),
      ])
      return {
        users: rows.map((r) => ({
          ...r,
          role: r.role ?? 'member',
          banned: r.banned ?? false,
          createdAt: r.createdAt.toISOString(),
          lastLoginAt: iso(r.lastLoginAt),
          lastActiveAt: iso(r.lastActiveAt),
          sessionCount: Number(r.sessionCount ?? 0),
          organizationCount: Number(r.organizationCount ?? 0),
        })),
        total: total?.value ?? 0,
      }
    }),

  setRole: adminProcedure
    .input(z.object({ userId: z.string(), role: roleSchema }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot remove your own admin role' })
      }
      await db.update(user).set({ role: input.role }).where(eq(user.id, input.userId))
      return { ok: true }
    }),

  setBanned: adminProcedure
    .input(
      z.object({ userId: z.string(), banned: z.boolean(), reason: z.string().max(500).optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot ban yourself' })
      await db
        .update(user)
        .set({
          banned: input.banned,
          banReason: input.banned ? (input.reason ?? null) : null,
          banExpires: null,
        })
        .where(eq(user.id, input.userId))
      if (input.banned) await db.delete(session).where(eq(session.userId, input.userId))
      return { ok: true }
    }),

  setEmail: adminProcedure
    .input(z.object({ userId: z.string(), email: z.email() }))
    .mutation(async ({ input }) => {
      const email = input.email.trim().toLowerCase()
      const taken = await db.query.user.findFirst({
        where: eq(user.email, email),
        columns: { id: true },
      })
      if (taken && taken.id !== input.userId) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Another account already uses this email',
        })
      }
      await db.update(user).set({ email, emailVerified: false }).where(eq(user.id, input.userId))
      await auth.api.sendVerificationEmail({ body: { email, callbackURL: '/' } })
      return { ok: true }
    }),

  revokeSessions: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const deleted = await db
        .delete(session)
        .where(eq(session.userId, input.userId))
        .returning({ id: session.id })
      return { revoked: deleted.length }
    }),

  removeUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot delete yourself' })
      await cleanupBeforeUserDelete(input.userId)
      await db.delete(user).where(eq(user.id, input.userId))
      return { ok: true }
    }),

  listOrganizations: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
        })
        .from(organization)
        .orderBy(desc(organization.createdAt))
        .limit(input.limit)
        .offset(input.offset)
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    }),

  listErrors: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(errorLog)
        .orderBy(desc(errorLog.createdAt))
        .limit(input.limit)
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    }),
})
