// docs/account-lifecycle.md
import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  invitation,
  member,
  organization,
  session,
  subscription,
  user,
  userConsent,
} from '../db/schema/index.js'
import { logger } from '../utils/logger.js'
import { reportError } from './reportError.js'
import { stripe } from './stripe.js'
import { anonymizeUsage } from './usage.js'

export async function organizationsOwnedSolelyBy(userId: string): Promise<string[]> {
  const owned = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, 'owner')))
  if (owned.length === 0) return []
  const ids = owned.map((o) => o.organizationId)
  const otherOwners = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(
      and(inArray(member.organizationId, ids), eq(member.role, 'owner'), ne(member.userId, userId)),
    )
  const shared = new Set(otherOwners.map((o) => o.organizationId))
  return ids.filter((id) => !shared.has(id))
}

export async function cancelOrganizationBilling(
  organizationId: string,
  userId: string,
): Promise<void> {
  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.organizationId, organizationId),
  })
  if (sub?.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId)
    } catch (err) {
      reportError({
        severity: 'ERROR',
        type: 'account.stripe_cancel',
        message: 'Stripe cancel failed during deletion',
        error: err,
        userId,
        organizationId,
      })
      throw err
    }
  }
  if (sub?.stripeCustomerId) {
    try {
      await stripe.customers.del(sub.stripeCustomerId)
    } catch (err) {
      reportError({
        severity: 'WARNING',
        type: 'account.stripe_customer_delete',
        message: 'Stripe customer delete failed during deletion',
        error: err,
        userId,
        organizationId,
      })
    }
  }
}

export async function cleanupBeforeUserDelete(userId: string): Promise<void> {
  const orgIds = await organizationsOwnedSolelyBy(userId)
  for (const organizationId of orgIds) {
    await cancelOrganizationBilling(organizationId, userId)
    await db.delete(organization).where(eq(organization.id, organizationId))
  }
  await anonymizeUsage(userId)
  logger.info({ userId, deletedOrganizations: orgIds.length }, 'account deletion cleanup')
}

export async function exportUserData(userId: string) {
  const [me, sessions, memberships, invitations, consent] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId) }),
    db
      .select({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, userId)),
    db
      .select({
        organizationId: member.organizationId,
        organizationName: organization.name,
        role: member.role,
        since: member.createdAt,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, userId)),
    me_invitations(userId),
    db.query.userConsent.findFirst({ where: eq(userConsent.userId, userId) }),
  ])
  if (!me) throw new Error('user not found')
  const orgIds = memberships.map((m) => m.organizationId)
  const subscriptions =
    orgIds.length === 0
      ? []
      : await db
          .select({
            organizationId: subscription.organizationId,
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
          })
          .from(subscription)
          .where(inArray(subscription.organizationId, orgIds))
  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: me.id,
      email: me.email,
      name: me.name,
      image: me.image,
      createdAt: me.createdAt,
      updatedAt: me.updatedAt,
      role: me.role,
    },
    sessions,
    memberships,
    invitations,
    subscriptions,
    consent: consent?.record ?? null,
  }
}

async function me_invitations(userId: string) {
  const me = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { email: true } })
  if (!me) return []
  return db
    .select({
      organizationId: invitation.organizationId,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(eq(invitation.email, me.email))
}
