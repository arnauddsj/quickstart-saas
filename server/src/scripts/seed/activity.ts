// docs/seeding.md
import { activityDay, session, usageEvent } from '../../db/schema/index.js'
import { between, daysAgo, uid, type Seeder } from './context.js'

const utcDay = (d: Date) => d.toISOString().slice(0, 10)

export const activity: Seeder = {
  name: 'activity',
  async run(tx, ctx) {
    const orgOf = (userId: string) =>
      ctx.orgs.find((o) => o.members.some((m) => m.user.id === userId))?.id ?? null

    const sessions = ctx.users.map((user) => {
      const seen = between(
        ctx,
        daysAgo(ctx, 20) > user.createdAt ? daysAgo(ctx, 20) : user.createdAt,
      )
      return {
        id: uid(),
        userId: user.id,
        token: uid(),
        createdAt: seen,
        updatedAt: seen,
        expiresAt: new Date(seen.getTime() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: ctx.faker.internet.ipv4(),
        userAgent: ctx.faker.internet.userAgent(),
      }
    })

    const days = ctx.users.flatMap((user) => {
      const rows = []
      for (let d = new Date(user.createdAt); d <= ctx.now; d = new Date(d.getTime() + 86_400_000)) {
        const first = utcDay(d) === utcDay(user.createdAt)
        if (first || ctx.faker.datatype.boolean({ probability: 0.35 })) {
          rows.push({
            subjectId: user.id,
            day: utcDay(d),
            signedUpOn: utcDay(user.createdAt),
            organizationId: orgOf(user.id),
          })
        }
      }
      return rows
    })

    const events = ctx.projects.map((p) => ({
      subjectId: p.createdById!,
      organizationId: p.organizationId,
      type: 'project.created',
      createdAt: p.createdAt,
    }))

    await tx.insert(session).values(sessions)
    await tx.insert(activityDay).values(days).onConflictDoNothing()
    if (events.length > 0) await tx.insert(usageEvent).values(events)
    return sessions.length + days.length + events.length
  },
}
