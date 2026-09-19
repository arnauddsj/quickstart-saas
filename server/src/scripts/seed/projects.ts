// docs/seeding.md
import { project } from '../../db/schema/index.js'
import { planLimit } from '../../config/plans.js'
import { between, type Seeder } from './context.js'

const PRO_PROJECTS = 8

export const projects: Seeder = {
  name: 'projects',
  async run(tx, ctx) {
    const rows = ctx.orgs.flatMap((org) => {
      const count =
        org.plan === 'FREE' ? Math.min(2, planLimit('FREE', 'projects') - 1) : PRO_PROJECTS
      return Array.from({ length: count }, () => {
        const creator = ctx.faker.helpers.arrayElement(org.members).user
        const createdAt = between(ctx, creator.createdAt)
        return {
          organizationId: org.id,
          createdById: creator.id,
          name: ctx.faker.commerce.productName(),
          createdAt,
          updatedAt: createdAt,
        }
      })
    })
    if (rows.length === 0) return 0
    ctx.projects = await tx.insert(project).values(rows).returning()
    return ctx.projects.length
  },
}
