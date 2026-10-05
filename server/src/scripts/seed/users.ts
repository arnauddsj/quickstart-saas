// docs/seeding.md
import { user } from '../../db/schema/index.js'
import { daysAgo, uid, type Seeder } from './context.js'

export const KNOWN_USERS = [
  { email: 'admin@example.com', name: 'Ada Admin', role: 'admin', signedUpDaysAgo: 90 },
  { email: 'owner@example.com', name: 'Olive Owner', role: 'member', signedUpDaysAgo: 85 },
  { email: 'member@example.com', name: 'Max Member', role: 'member', signedUpDaysAgo: 80 },
] as const

const FAKE_USERS = 12

export const users: Seeder = {
  name: 'users',
  async run(tx, ctx) {
    const rows = [
      ...KNOWN_USERS.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: daysAgo(ctx, u.signedUpDaysAgo),
      })),
      ...Array.from({ length: FAKE_USERS }, () => {
        const firstName = ctx.faker.person.firstName()
        const lastName = ctx.faker.person.lastName()
        return {
          email: ctx.faker.internet
            .email({ firstName, lastName, provider: 'example.org' })
            .toLowerCase(),
          name: `${firstName} ${lastName}`,
          role: 'member',
          createdAt: daysAgo(ctx, ctx.faker.number.int({ min: 1, max: 78 })),
        }
      }),
    ].map((u) => ({ ...u, id: uid(), emailVerified: true, updatedAt: u.createdAt }))

    ctx.users = await tx.insert(user).values(rows).returning()
    return ctx.users.length
  },
}
