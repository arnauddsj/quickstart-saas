# Changelog

Releases of the starter itself. A product cloned from it records the version and commit
it started from in `.starter.json`; [docs/starter-updates.md](docs/starter-updates.md)
explains how to bring later releases into it. Each release lists under **Apply to existing
products** the changes a product should take even if it skips the rest.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- GlitchTip event scrubbing removes query strings and fragments from URLs embedded in
  exception messages, stack frames, breadcrumbs, and diagnostic context.

### Added

- Optional local GlitchTip: `docker compose --profile glitchtip up -d` starts it on
  `127.0.0.1:8100` with its own Postgres, mail through Mailpit. Plain `docker compose up -d`
  is unchanged. Its MCP server is enabled for agents
  ([docs/development.md](docs/development.md)).
- `pnpm db:seed [--reset]` fills the development database with deterministic fake data:
  an admin, a PRO and a FREE workspace, members, an invitation, projects, notifications
  and 90 days of activity. One seeder per feature in `server/src/scripts/seed/`; a new
  table gets a seeder ([docs/seeding.md](docs/seeding.md)).

## [2.3.0] - 2026-09-19

### Added

- `pnpm init-project` sets the product name, support email, workspace label and teams
  mode, and writes the root `.env`, `server/.env` (random `AUTH_SECRET`, free ports) and
  `.starter.json`. `pnpm check-ready` lists what is still a placeholder, and
  `--env <file>` checks a production environment.
- `pnpm db:backup`, `pnpm db:restore` and `pnpm db:restore-check` for the Compose
  Postgres, with retention by count.
- Workspace settings: rename, leave, transfer ownership, delete. Account settings: list
  sessions and sign out other devices.
- Billing page: waits for Stripe to confirm a checkout, shows usage against each plan
  limit, and asks a past-due workspace to fix its card.
- This changelog and the starter update process.

### Changed

- A `past_due` subscription keeps its paid plan while Stripe retries the payment; the
  workspace drops to FREE when Stripe cancels it or marks it unpaid.
- Vite and Playwright read `CLIENT_PORT` from the root `.env`.

### Apply to existing products

- The `past_due` policy (`server/src/services/stripe.ts`), so a failed card renewal no
  longer removes access on the first failed attempt.

## [2.2.0] - 2026-09-19

Commit `0f75cbc`.

### Added

- Admin product analytics: activity, usage events, retention, activation, plan fit.

### Fixed

- Deleting a workspace through better-auth cancels its Stripe subscription first.
- The Stripe webhook applies the subscription as Stripe holds it, so late events cannot
  restore cancelled access.
- Checkout refuses a workspace that already has a live subscription.
- Plan limits hold under concurrent requests.
- `/get-session` is exempt from the Fastify rate limit; `TRUST_PROXY` is applied.
- Migrations run under an advisory lock; the first admin is claimed atomically.
- Compose no longer shares one database volume between products.

### Changed

- **Breaking:** production Compose requires `POSTGRES_PASSWORD`, publishes no Postgres
  port and starts Mailpit only under `--profile local-mail`; production SMTP needs
  `SMTP_HOST`.

### Apply to existing products

All of the fixes above. Before deploying the Compose change to a running installation,
read [docs/deployment.md](docs/deployment.md): set `POSTGRES_PASSWORD` to the current
database password and `COMPOSE_PROJECT_NAME=quickstart` if its volume is
`quickstart_postgres_data`.

## [2.1.0] - 2026-09-19

Commits `964fe75` to `af523ed`.

### Added

- Error reporting to self-hosted GlitchTip with a database watchdog.
- One email template registry for SMTP and Loops.
- The Projects reference feature, in-app notifications, branding and solo mode.

### Changed

- **Breaking:** email templates and error reporting replaced the earlier ad hoc versions.

## [2.0.0] - 2026-09-18

Commits `9594653` and `4c9e0c1`: the starter rebuilt on Node 24, Fastify 5, tRPC 11,
better-auth, Drizzle, Vue 3.5 and Vite 8, with the `docs/` system.
