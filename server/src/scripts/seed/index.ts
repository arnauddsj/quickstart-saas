// docs/seeding.md
import { count, sql } from 'drizzle-orm'
import { Faker, base, en } from '@faker-js/faker'
import { db } from '../../db/client.js'
import { user } from '../../db/schema/index.js'
import { brand } from '../../config/brand.js'
import { activity } from './activity.js'
import type { SeedContext, Seeder } from './context.js'
import { notifications } from './notifications.js'
import { organizations } from './organizations.js'
import { projects } from './projects.js'
import { users } from './users.js'

export { KNOWN_USERS } from './users.js'

export const SEEDERS: Seeder[] = [users, organizations, projects, notifications, activity]

export class SeedRefused extends Error {}

export async function runSeed(
  options: { reset?: boolean; teams?: boolean; now?: Date } = {},
): Promise<{ name: string; rows: number }[]> {
  if (!options.reset) {
    const [row] = await db.select({ value: count() }).from(user)
    if ((row?.value ?? 0) > 0) {
      throw new SeedRefused('the database already has users; run with --reset to wipe it first')
    }
  }

  const faker = new Faker({ locale: [en, base] })
  faker.seed(1)
  const ctx: SeedContext = {
    faker,
    now: options.now ?? new Date(),
    teams: options.teams ?? brand.teams,
    users: [],
    orgs: [],
    projects: [],
  }

  return db.transaction(async (tx) => {
    if (options.reset) {
      const { rows } = await tx.execute<{ tablename: string }>(
        sql`select tablename from pg_tables where schemaname = 'public'`,
      )
      if (rows.length > 0) {
        await tx.execute(
          sql.raw(`truncate ${rows.map((r) => `"${r.tablename}"`).join(', ')} cascade`),
        )
      }
    }
    const summary = []
    for (const seeder of SEEDERS) {
      summary.push({ name: seeder.name, rows: await seeder.run(tx, ctx) })
    }
    return summary
  })
}
