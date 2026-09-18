// docs/organizations.md
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { invitation, member, organization, user } from '../../db/schema/index.js'
import { getOrCreateSubscription } from '../../services/stripe.js'
import { orgAdminProcedure, orgProcedure, router } from '../index.js'

export const orgRouter = router({
  current: orgProcedure.query(async ({ ctx }) => {
    const [org, sub] = await Promise.all([
      db.query.organization.findFirst({ where: eq(organization.id, ctx.organizationId) }),
      getOrCreateSubscription(ctx.organizationId),
    ])
    return {
      id: ctx.organizationId,
      name: org?.name ?? '',
      slug: org?.slug ?? '',
      myRole: ctx.membership.role,
      plan: sub.plan,
    }
  }),

  members: orgProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        email: user.email,
        name: user.name,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, ctx.organizationId))
      .orderBy(member.createdAt)
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  }),

  invitations: orgAdminProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      })
      .from(invitation)
      .where(eq(invitation.organizationId, ctx.organizationId))
      .orderBy(desc(invitation.expiresAt))
    return rows.map((r) => ({ ...r, expiresAt: r.expiresAt.toISOString() }))
  }),
})
