// docs/seeding.md
import { invitation, member, organization, subscription } from '../../db/schema/index.js'
import type { PlanName } from '../../config/plans.js'
import { uid, type SeedContext, type SeedOrg, type SeedUser, type Seeder } from './context.js'

type Plan = { name: string; plan: PlanName; members: { user: SeedUser; role: string }[] }

function teamPlans(ctx: SeedContext): Plan[] {
  const [admin, owner, known, ...rest] = ctx.users as [SeedUser, SeedUser, SeedUser, ...SeedUser[]]
  const acme = rest.slice(0, 8)
  const globex = rest.slice(8)
  return [
    {
      name: 'Acme',
      plan: 'PRO',
      members: [
        { user: admin, role: 'owner' },
        { user: known, role: 'member' },
        ...acme.map((user, i) => ({ user, role: i < 2 ? 'admin' : 'member' })),
      ],
    },
    {
      name: 'Globex',
      plan: 'FREE',
      members: [
        { user: owner, role: 'owner' },
        ...globex.map((user) => ({ user, role: 'member' })),
      ],
    },
  ]
}

function soloPlans(ctx: SeedContext): Plan[] {
  return ctx.users.map((user, i) => ({
    name: user.name,
    plan: i === 0 ? 'PRO' : 'FREE',
    members: [{ user, role: 'owner' }],
  }))
}

const slug = (name: string, i: number) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${i + 1}`

export const organizations: Seeder = {
  name: 'organizations',
  async run(tx, ctx) {
    const plans = ctx.teams ? teamPlans(ctx) : soloPlans(ctx)
    let rows = 0

    for (const [i, p] of plans.entries()) {
      const owner = p.members[0]!.user
      const [org] = await tx
        .insert(organization)
        .values({ id: uid(), name: p.name, slug: slug(p.name, i), createdAt: owner.createdAt })
        .returning()
      const seeded: SeedOrg = { ...org!, plan: p.plan, members: p.members }
      ctx.orgs.push(seeded)

      await tx.insert(member).values(
        p.members.map((m) => ({
          id: uid(),
          organizationId: seeded.id,
          userId: m.user.id,
          role: m.role,
          createdAt: m.user.createdAt > seeded.createdAt ? m.user.createdAt : seeded.createdAt,
        })),
      )
      await tx.insert(subscription).values({
        organizationId: seeded.id,
        plan: p.plan,
        status: 'active',
        ...(p.plan === 'FREE'
          ? {}
          : {
              stripeCustomerId: `cus_seed_${seeded.slug}`,
              stripeSubscriptionId: `sub_seed_${seeded.slug}`,
              currentPeriodEnd: new Date(ctx.now.getTime() + 30 * 24 * 60 * 60 * 1000),
            }),
      })
      rows += 2 + p.members.length
    }

    if (ctx.teams) {
      const acme = ctx.orgs[0]!
      await tx.insert(invitation).values({
        id: uid(),
        organizationId: acme.id,
        email: ctx.faker.internet.email({ provider: 'example.org' }).toLowerCase(),
        role: 'member',
        status: 'pending',
        expiresAt: new Date(ctx.now.getTime() + 48 * 60 * 60 * 1000),
        inviterId: acme.members[0]!.user.id,
      })
      rows += 1
    }
    return rows
  },
}
