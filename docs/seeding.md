# Seeding

How `pnpm db:seed` fills the development database with fake data, which accounts it
creates, and how a feature adds its own seeder.

Code: `server/src/scripts/seed.ts` (CLI), `server/src/scripts/seed/` (one file per
feature, `index.ts` registers them), `server/src/__tests__/integration/seed.int.spec.ts`.

## Running it

```bash
pnpm db:seed            # refuses if the user table has any row
pnpm db:seed --reset    # truncates every public table first, then seeds
```

`--reset` wipes everything, including your own account. Take `pnpm db:backup` first if the
data matters (see [backups.md](backups.md)). The script refuses to run with
`NODE_ENV=production`, and it seeds inside one transaction, so a failing seeder leaves the
database as it was.

The data is deterministic. Faker is seeded with a fixed value, so every run produces the
same names. Dates are relative to now, so the data always looks recent.

## The accounts

| Email                | What it is                                     |
| -------------------- | ---------------------------------------------- |
| `admin@example.com`  | App admin, owner of **Acme** (PRO, 8 projects) |
| `owner@example.com`  | Owner of **Globex** (FREE, 2 of 3 projects)    |
| `member@example.com` | Member of Acme                                 |

Sign in with a magic link and read it in Mailpit. There are also 12 faker users on
`example.org`, spread across both workspaces, and a pending invitation on Acme. Every user
has a session, and has activity days back to sign-up, so the admin overview and analytics
charts have something to draw.

Seeded users skip onboarding. They already have a membership, and the router picks the
first one as the active workspace (see [organizations.md](organizations.md)).

**In solo mode** (`brand.teams === false`), every user owns exactly one workspace. There
are no shared workspaces and no invitations, matching `workspacePolicy`. The admin's
workspace is PRO and every other workspace is FREE.

## Direct inserts skip better-auth

Seeders write rows with Drizzle, not through better-auth. That means no hooks run:
`claimFirstAdmin` does not run, so the seed sets `role: 'admin'` itself, and no welcome
email is sent. It also means ids are `crypto.randomUUID()`, as in `make-admin`. That is the
right trade-off for fixtures. A seeder that needs a hook's side effect writes the row the
hook would have written.

Stripe ids on the PRO subscription are fake (`cus_seed_…`, `sub_seed_…`). The Billing page
shows PRO, but "Manage billing" fails against a real Stripe account.

## Adding a seeder

**A feature that adds a table adds a seeder.** Otherwise the table stays empty in every
developer's database and the feature is only ever tested on the one row someone typed in.

1. Create `server/src/scripts/seed/<feature>.ts` exporting a `Seeder`:
   `{ name, run(tx, ctx) }`, returning the number of rows it inserted.
2. Write with `tx`, never `db`, so the seed stays one transaction.
3. Read what earlier seeders created from `ctx` (`ctx.users`, `ctx.orgs` with their
   `plan` and `members`, `ctx.projects`). Add a field to `SeedContext` in `context.ts` if
   later seeders need your rows.
4. Draw randomness from `ctx.faker` and dates from `ctx.now` (`daysAgo`, `between`). Do
   not use `Math.random()` or `new Date()`, which would break determinism.
5. Respect `PLANS` limits (read them with `planLimit`, never hard-code them) and
   `ctx.teams`.
6. Register it in `SEEDERS` in `seed/index.ts`, after the seeders it reads from.
7. Extend `seed.int.spec.ts` with an assertion that the rows exist.

When a placeholder feature is replaced, such as renaming Projects or changing the example
notifications (see [reference-feature.md](reference-feature.md) and `.claude/TODO.md`), its
seeder is replaced with it.
