// docs/seeding.md
import { notification } from '../../db/schema/index.js'
import { brand } from '../../config/brand.js'
import type { Seeder } from './context.js'

const UNREAD = 2

export const notifications: Seeder = {
  name: 'notifications',
  async run(tx, ctx) {
    const rows = ctx.users.flatMap((user) => {
      const welcome = {
        userId: user.id,
        type: 'account.welcome',
        title: `Welcome to ${brand.name}`,
        body: 'Your account is ready.',
        readAt: user.createdAt,
        createdAt: user.createdAt,
      }
      const orgIds = new Set(
        ctx.orgs.filter((o) => o.members.some((m) => m.user.id === user.id)).map((o) => o.id),
      )
      const created = ctx.projects
        .filter((p) => orgIds.has(p.organizationId) && p.createdById !== user.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map((p, i) => {
          const creator = ctx.users.find((u) => u.id === p.createdById)
          return {
            userId: user.id,
            organizationId: p.organizationId,
            type: 'project.created',
            title: `${creator?.name ?? 'Someone'} created ${p.name}`,
            link: '/projects',
            readAt: i < UNREAD ? null : p.createdAt,
            createdAt: p.createdAt,
          }
        })
      return [welcome, ...created]
    })
    await tx.insert(notification).values(rows)
    return rows.length
  },
}
