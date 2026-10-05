# SaaS starter audit — 2026-09-19

## Verdict

A substantial foundation, with authentication, tenant isolation, invitations, account
export/deletion, billing, notifications, analytics, error reporting, CI and tests already
present. Before cloning it into more products, fix the billing lifecycle, clone isolation
and production defaults. The most valuable additions are repeatable initialization,
backup/restore, and complete account/workspace management. Avoid turning the starter
into an application containing every possible SaaS feature.

Reviewed the current working tree, including existing uncommitted analytics work.
Application code was not changed. Temporary diagnostic tests were removed after running.

| Dimension       | Assessment                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Security        | Needs changes: production service exposure, admin bootstrap and proxy configuration                       |
| Correctness     | Needs changes: billing lifecycle, event ordering and concurrent quotas                                    |
| Performance     | Reasonable for a small starter; list/pagination and job recovery patterns need extending as products grow |
| Maintainability | Strong typed boundaries and documentation; initialization and documentation consistency need attention    |

## Invariant ledger

| Invariant                                      | Where enforced                                               | Mechanism                   | If violated                                     |
| ---------------------------------------------- | ------------------------------------------------------------ | --------------------------- | ----------------------------------------------- |
| Organization data belongs to the active member | `trpc/index.ts:orgProcedure`, project filters                | middleware, test            | Cross-tenant access                             |
| One local subscription row per organization    | `db/schema/app.ts:subscription.organizationId`               | DB constraint, test         | Conflicting local entitlements                  |
| One billable subscription per organization     | No server checkout guard                                     | convention                  | Duplicate paid subscriptions                    |
| Deleting a workspace cancels external billing  | User deletion only; direct organization deletion has no hook | convention                  | Billing can continue after data disappears      |
| Latest billing state wins                      | Unconditional upsert in `applyStripeSubscription`            | convention                  | Stale events overwrite current access           |
| A quota check and resource creation are atomic | Separate count and insert in `project.create`                | convention                  | Concurrent requests exceed the limit            |
| New clones have isolated database storage      | Fixed Compose project and volume names                       | convention                  | New products reuse another product's data       |
| Session checks are never rate limited          | Better-auth exception only; Fastify has a global limiter     | middleware, incomplete test | Shared-IP traffic can block session checks      |
| Exactly one intended administrator bootstraps  | User count checked before account insertion                  | convention                  | Wrong first user or simultaneous administrators |

## Findings

### P1 — Direct workspace deletion skips Stripe cancellation

**Evidence:** `server/src/auth/index.ts:122` enables the organization plugin without
`beforeDeleteOrganization` or `disableOrganizationDeletion`. The installed plugin exposes
`POST /api/auth/organization/delete`. Cancellation exists only in
`server/src/services/account.ts:cleanupBeforeUserDelete`.

**Reproduction:** In a throwaway database, signed in an owner, attached a PRO subscription
with Stripe identifiers, and called the direct organization deletion endpoint. Response
was 200; organization and local subscription rows disappeared; the mocked Stripe
cancellation method received zero calls. No external Stripe requests were made.

**Blast radius:** Any owner can invoke the endpoint even without a delete button. Their
external subscription can remain billable while the application loses its record.

**Fix:** Route both deletion paths through the same billing cleanup, or disable direct
organization deletion until that flow exists. **Fix risk:** Medium; cancellation retries,
partial failures and cascade behavior need integration coverage.

### P1 — New clones share an explicitly named database volume

**Evidence:** `docker-compose.yaml:2` and `docker-compose.prod.yaml:5` fix the project name
to `quickstart`; `docker-compose.yaml:34` fixes the volume to `quickstart_postgres_data`.

**Reproduction:** `docker compose -p review_a config --format json` and the same command
with `review_b` both resolved `volumes.postgres_data.name` to
`quickstart_postgres_data`. These were configuration reads, not deployments.

**Blast radius:** Products running on the same Docker host can reuse the same data or
collide with the existing stack. Changing ports or using `-p` does not isolate this volume.
Docker documents that explicit volume names are not scoped by the stack name:
[Compose volume names](https://docs.docker.com/reference/compose-file/volumes/#name).

**Fix:** Remove the explicit volume name and derive a unique project name during setup.
**Fix risk:** Medium for existing installations: renaming must preserve or deliberately
migrate existing volumes; do not silently abandon their data.

### P1 — Documented production Compose command retains development exposure

**Evidence:** The README combines the base and production Compose files. The base file
publishes Postgres and both Mailpit ports without a localhost bind and defaults the
Postgres password to `quickstart`. The production overlay does not remove those mappings
or require a database password, and defaults outgoing email to Mailpit.

**Reproduction:** Inspect `docker-compose.yaml:7`, `:11`, `:23` and
`docker-compose.prod.yaml:15`, `:20`. No production deployment was performed.

**Blast radius:** On a host whose firewall permits these ports, the database is reachable
with a known default password and the Mailpit UI can expose captured login links. With
the default sender configuration, real users do not receive their login email.

**Fix:** Make production private by default: no Mailpit service or database host port,
mandatory production database credentials and a real delivery provider. A local production
smoke-test recipe can explicitly opt back into Mailpit. **Fix risk:** Low to medium;
validate the rendered production configuration and existing hosting setup.

### P1 — Stale Stripe events can restore cancelled access

**Evidence:** `server/src/routes/stripeWebhook.ts` passes subscription event snapshots to
`server/src/services/stripe.ts:94`; its upsert unconditionally overwrites the organization's
subscription state. Existing tests cover identical replays, not stale state arriving later.

**Reproduction:** Applied active, cancelled, then the older active subscription snapshot
to the same organization. The resulting plan was PRO again.

**Blast radius:** Access can be incorrectly restored or removed. Events for an old
subscription can also replace a newer subscription's identifiers.

**Fix:** Serialize reconciliation per organization, resolve authoritative Stripe state,
check subscription identity and handle deleted organizations deliberately. Record event
IDs for duplicate processing. Timestamps alone are not a sufficient ordering solution.
[Stripe documents unordered and duplicate delivery](https://docs.stripe.com/webhooks#event-ordering).
**Fix risk:** Medium; test reversed delivery, concurrent processing, old subscription IDs
and events after workspace deletion.

### P1 — Checkout allows another subscription for an already paid organization

**Evidence:** `server/src/services/stripe.ts:57` always creates a subscription Checkout
Session. It does not check existing subscription status or reuse a pending checkout.
`ensureStripeCustomer` also lacks protection against concurrent customer creation.

**Reproduction:** Seeded an existing PRO subscription, called `createCheckoutSession`,
and observed another call to Stripe Checkout creation using a mocked SDK. The UI hides
the upgrade button for PRO, but the server accepts the request. Actual duplicate charges
were not generated or tested.

**Blast radius:** Multiple tabs, retries, or direct API calls can create multiple sessions;
completing them can create multiple billable subscriptions while the app stores only one.

**Fix:** Enforce subscription eligibility server-side, serialize customer creation, and
reuse a pending checkout with appropriate idempotency. Existing subscribers should use
the portal. **Fix risk:** Medium; preserve legitimate re-subscription after cancellation.

### P2 — The reusable quota example is not safe under concurrency

**Evidence:** `server/src/trpc/router/project.ts:46` reads usage, checks the limit and
inserts as separate operations without a transaction/lock.

**Reproduction:** Created two projects on FREE, then submitted eight concurrent creates.
The resulting project count exceeded the FREE limit of three. The diagnostic assertion
passed against real Postgres.

**Blast radius:** Every future feature copied from this example can inherit the same
limit bypass, especially costly generations, exports or uploads.

**Fix:** Serialize per-organization quota consumption in the same transaction as resource
creation, or use an atomic reservation/counter. A transaction alone without suitable
locking/isolation is insufficient. **Fix risk:** Medium; consider lock contention and
rollback behavior.

### P2 — Session checks are still limited by Fastify

**Evidence:** `server/src/auth/index.ts:111` exempts `/get-session` from better-auth's
limiter, but `server/src/app.ts:45` installs a global 300-request/minute limiter.
The existing integration test sends only 40 session requests.

**Reproduction:** The 301st request from one test IP to `/api/auth/get-session` returned 429. This was a local in-process test.

**Blast radius:** Users sharing a public IP can lose the ability to check their sessions
during bursts. The client handles session errors explicitly, so this is not evidence of
an automatic fake logout; it contradicts the stated exemption and can block navigation.

**Fix:** Exempt the route at the Fastify layer too, and test it after exhausting the global
budget. **Fix risk:** Low; retain protection for sign-in and other costly endpoints.

### P2 — Bootstrap and proxy safeguards are incomplete

**Evidence:** `server/src/services/admin.ts:9` grants admin when the user count is zero,
with no atomic claim. Two concurrent role checks both returned `admin` in the diagnostic.
This verifies the check, not a full simultaneous magic-link signup race. First-user-admin
is documented behavior, but requires the intended owner to arrive first.

Separately, `server/src/config/env.ts` defines `TRUST_PROXY`, but
`server/src/app.ts:28` uses `trustProxy: true`. The documented restriction to trusted
network ranges is not applied. The supplied nginx path normalizes forwarded addresses;
exposure through another proxy or directly to the API changes that assumption.

**Fix:** Add an explicit initial-admin bootstrap step/identity and make any automatic
claim atomic. Wire the proxy setting into runtime configuration, testing both Fastify and
better-auth address handling. **Fix risk:** Medium; preserve legitimate proxy chains.

### P2 — Notification failure can report resource creation as failed after commit

**Evidence:** `server/src/trpc/router/project.ts:53` inserts the project, then awaits
`notifyWorkspace`, which can throw. No transaction or durable retry connects those writes.
This finding is from code inspection, not fault-injection reproduction.

**Blast radius:** A temporary notification failure produces a failed create response even
though the project exists; a retry can create another project.

**Fix:** Either transact the project and notification records together, or persist an
outbox/job atomically and deliver asynchronously. Define whether notifications are
required or best effort. **Fix risk:** Medium; avoid silently dropping important messages.

### P2 [known] — Concurrent migration startup is not locked

Already tracked in `.claude/TODO.md`. `server/src/db/migrate.ts:runMigrations` lacks a
shared advisory lock. Address this before running multiple API replicas or overlapping
old/new instances during deployment. No concurrent deployment was performed in this audit.

## Reusable additions, in recommended order

| Addition                                | Current gap                                                                                  | Smallest useful outcome                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project initializer and readiness check | Brand config exists; `.claude/TODO.md` still requires many manual steps                      | One setup command for unique project/database identity, brand and environment files; a check reporting unresolved placeholders and missing provider setup |
| Backup and restore workflow             | No backup/restore procedure found in repository docs or scripts                              | Document host-managed backups or supply a scheduled backup; prove restoration into an isolated database and define retention and recovery expectations    |
| Complete account/workspace controls     | Account profile/email/export/delete exist; workspace page focuses on invitations and members | Add workspace rename, leave, ownership transfer and safe deletion; account session list and revoke-other-sessions UI using existing auth capabilities     |
| Audit trail for sensitive actions       | Usage analytics records selected events; it is not an administrative audit history           | Store actor, workspace, action, target and time for role, membership, billing and destructive admin changes; provide a simple searchable view             |
| Billing UX and recovery                 | FREE/PRO and portal exist; success toast is based on the return URL                          | Show pending synchronization until verified, surface usage/limits and actionable payment-recovery states; choose a clear past-due policy                  |
| Async work recovery pattern             | pg-boss scheduling and failure reporting exist                                               | One example of idempotent work with retries/backoff, plus a documented way to inspect and retry failed jobs                                               |
| Starter update process                  | No documented way to propagate improvements to cloned products                               | Version/changelog and an upstream update procedure so billing/security fixes can be applied to existing products                                          |

Backups could already exist in Coolify or other infrastructure; that external state was
not inspected. The gap is the reusable, verified workflow in this starter.

Add these when they recur across your products, rather than by default:

- File storage: a tenant-scoped S3-compatible upload/download/delete pattern with size/type
  checks, signed URLs and cleanup. Useful for avatars, documents and generated assets.
- A paginated/filterable list example and reusable empty/error/loading states. Admin users
  already demonstrate some pagination; the reference product list loads all projects.
- Translation and locale-aware email if products regularly launch in multiple languages.
- Public landing/pricing/SEO scaffolding if marketing lives in the same repository.
- Google sign-in, passkeys, SSO, API keys, outgoing webhooks, seats or usage billing only
  when the product's audience and integrations require them.

Product copy, pricing, the activation event, domain entities and actual onboarding steps
will still differ for every SaaS. The starter should make those choices easy to locate,
not attempt to invent them.

## Validation and limits

- Read repository docs, known TODOs, application code, tests, Compose and CI configuration.
- Node 24.21.0: existing unit suite passed, 61 server + 40 client tests.
- Real local Postgres, isolated temporary database: 60 existing integration tests plus
  six temporary diagnostic tests passed (66 total). Diagnostic tests assert observed
  problematic behavior; their passing is evidence of the findings, not fixes.
- The initial sandbox run could not bind the monitoring test's localhost socket; the
  complete Node 24 run with local access passed.
- Node 24.21.0: `pnpm typecheck` passed after removal of the temporary diagnostics.
  The review document also passed Prettier formatting.
- Docker volume collision was verified through two configuration renders, without
  starting or modifying stacks.
- No real Stripe charges, production writes or email delivery were performed.
- Browser E2E, image builds, production firewall rules, restore drills and external
  GlitchTip/Loops/Stripe settings were not tested in this review.
- Existing `GATES.md` records still have open Docker/GlitchTip validation items. They were
  preserved. The TODO note saying component tests cover only LoginForm is stale: Account,
  Billing, OrgSwitcher and NotificationBell tests are also present.
