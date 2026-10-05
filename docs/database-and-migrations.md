# Database and migrations

Two schema files, one generated and one written by hand, and a migration loop that can be
rehearsed locally before a deploy applies it.

Code: `server/src/db/client.ts` (`db`, `pool`), `db/schema/auth.ts` (generated),
`db/schema/app.ts` (`subscription`, `userConsent`, `PLAN_NAMES`),
`db/schema/index.ts`, `db/migrate.ts` (`runMigrations`, `MIGRATION_LOCK_ID`), `server/drizzle.config.ts`,
`server/drizzle/*.sql`.

## `auth.ts` is generated; never edit it by hand

`pnpm auth:schema` runs the better-auth CLI (`npx auth generate`) against `auth/index.ts`
and overwrites `db/schema/auth.ts` with the tables its plugins need: `user`, `session`,
`account`, `verification`, `organization`, `member`, `invitation`, `rate_limit`. Adding or
removing a plugin, or enabling a plugin option that adds columns, means regenerating.

An edit made by hand is lost on the next regeneration, and until then the file disagrees
with what better-auth expects at runtime; it logs `Drizzle schema mismatch` at boot and
carries on with missing columns. Application tables go in `app.ts`, which references the
generated tables by import (`subscription.organizationId → organization.id`).

## The naming is `snake_case`, set once

`drizzle(pool, { casing: 'snake_case' })` in `client.ts` and `casing: 'snake_case'` in
`drizzle.config.ts` turn `organizationId` into `organization_id` without per-column names.
The generated `auth.ts` spells its column names explicitly, so both conventions agree.
Do not add a column with an explicit camelCase name; the query builder and the migration
would disagree.

## Generate, read the SQL, commit, and boot applies it

```bash
pnpm db:generate          # drizzle-kit generate → server/drizzle/NNNN_<name>.sql + meta/
pnpm db:migrate           # applies pending files to DATABASE_URL, same code as boot
```

`runMigrations()` in `db/migrate.ts` is called first thing in `index.ts`, before pg-boss
starts and before the server listens. The same function is the CLI, so a migration can be
run locally against the compose Postgres before it is committed. **Read the generated SQL
before committing it.** drizzle-kit produces `ALTER TABLE … DROP COLUMN` when a column is
renamed rather than a rename, and a destructive statement in a file that boot applies
unattended is how data disappears.

A migration that fails at boot leaves `listen()` unreached: the container restarts, the
health check never passes, and the platform shows a 502 rather than an error page. Check
the container log for `migration failed` first.

## The migrations folder resolves relative to the module

`migrate.ts` builds `migrationsFolder` from `import.meta.url`, two directories up, so the
same code finds `server/drizzle/` when run from `src/` under tsx and from `dist/` under
Node in the image. The Dockerfile copies `drizzle/` next to `dist/` for that reason.

## Replicas take turns through an advisory lock

Drizzle's migrator does not lock. `runMigrations()` takes the session-level
`pg_advisory_lock(MIGRATION_LOCK_ID)` on a dedicated connection first, so two containers
booting together (two replicas, or the old and new instance overlapping in a deploy)
apply migrations one after the other; the second finds nothing left to do. The lock is
released in a `finally`, and Postgres drops it anyway if the process dies.
`migrate.int.spec.ts` holds the lock from another connection and checks that
`runMigrations()` waits.

## The rejected alternative

TypeORM with `synchronize: true`, which the old template ran unconditionally in every
environment with zero migration files. Drizzle keeps the schema in plain TypeScript with
no decorators or `reflect-metadata`, which is also what lets the server run under `tsx` and
plain `tsc` without CommonJS.
