// docs/seeding.md
import type { Faker } from '@faker-js/faker'
import type { db } from '../../db/client.js'
import type * as schema from '../../db/schema/index.js'
import type { PlanName } from '../../config/plans.js'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type SeedUser = typeof schema.user.$inferSelect
export type SeedOrg = typeof schema.organization.$inferSelect & {
  plan: PlanName
  members: { user: SeedUser; role: string }[]
}
export type SeedProject = typeof schema.project.$inferSelect

export type SeedContext = {
  faker: Faker
  now: Date
  teams: boolean
  users: SeedUser[]
  orgs: SeedOrg[]
  projects: SeedProject[]
}

export type Seeder = { name: string; run: (tx: Tx, ctx: SeedContext) => Promise<number> }

export const uid = () => crypto.randomUUID()

export const daysAgo = (ctx: SeedContext, days: number) =>
  new Date(ctx.now.getTime() - days * 24 * 60 * 60 * 1000)

export const between = (ctx: SeedContext, from: Date, to: Date = ctx.now) =>
  ctx.faker.date.between({ from, to })
