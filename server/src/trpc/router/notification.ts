// docs/notifications.md
import { and, count, desc, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { notification } from '../../db/schema/index.js'
import { protectedProcedure, router } from '../index.js'

const LIST_SIZE = 20

const visibleTo = (userId: string, activeOrganizationId: string | null | undefined) =>
  and(
    eq(notification.userId, userId),
    activeOrganizationId
      ? or(
          isNull(notification.organizationId),
          eq(notification.organizationId, activeOrganizationId),
        )
      : isNull(notification.organizationId),
  )

export const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const where = visibleTo(ctx.user.id, ctx.session.activeOrganizationId)
    const [rows, [unread]] = await Promise.all([
      db
        .select()
        .from(notification)
        .where(where)
        .orderBy(desc(notification.createdAt))
        .limit(LIST_SIZE),
      db
        .select({ n: count() })
        .from(notification)
        .where(and(where, isNull(notification.readAt))),
    ])
    return {
      unread: unread?.n ?? 0,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        read: r.readAt !== null,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notification.id, input.id),
            eq(notification.userId, ctx.user.id),
            isNull(notification.readAt),
          ),
        )
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(visibleTo(ctx.user.id, ctx.session.activeOrganizationId), isNull(notification.readAt)),
      )
  }),
})
