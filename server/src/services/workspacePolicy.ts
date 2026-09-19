// docs/branding.md
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { member } from '../db/schema/index.js'

export function workspacePolicy(teams: boolean) {
  if (teams) return { allowUserToCreateOrganization: true, invitationLimit: 100 }
  return {
    allowUserToCreateOrganization: async (user: { id: string }) =>
      !(await db.query.member.findFirst({ where: eq(member.userId, user.id) })),
    invitationLimit: 0,
  }
}
