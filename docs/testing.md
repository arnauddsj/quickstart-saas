# Testing

Four layers, each proving something the others cannot, and each checked by mutation: a
spec that still passes when the rule it names is deleted is not a test.

Code: `server/vitest.config.ts`, `server/vitest.integration.config.ts`,
`server/src/__tests__/integration/globalSetup.ts`, `integration/helpers.ts`
(`resetDatabase`, `seedUser`, `signIn`, `callerFor`), `integration/mailbox.ts`,
`client/vitest.config.ts`, `client/src/test/stubs.ts` (`overlayStubs`),
`playwright.config.ts`, `.github/workflows/ci.yml`.

## Which layer a change needs

| Layer              | Command                     | Proves                                                                                                                                                                 | Does not prove                       |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Server unit        | `pnpm --filter server test` | pure rules: env parsing, plan guards, error routing and dedupe, procedure tiers, the Fastify surface (Origin check, 429, helmet, readiness) with the database mocked   | anything SQL does                    |
| Server integration | `pnpm test:integration`     | the same code against real Postgres: tenancy, cascades, Stripe upserts and signed webhooks, the GDPR export, admin stats, and the full magic-link flow through Fastify | the browser                          |
| Client unit        | `pnpm --filter client test` | the router guard, consent wiring, Account and OrgSwitcher handlers, the query retry policy                                                                             | real rendering of reka-ui overlays   |
| End to end         | `pnpm test:e2e`             | a real browser through Vite or nginx, Mailpit, and the database                                                                                                        | edge cases; it covers three journeys |

A change to a query, a cascade or anything that reads the session belongs in an
integration spec. A change to a pure function or a guard belongs in a unit spec. A new
page gets a client spec for its handlers, not a snapshot.

## Integration specs run on a database created for the run

`vitest.integration.config.ts` names a database `quickstart_test_<timestamp>` on the server
in `TEST_DATABASE_URL`, falling back to `DATABASE_URL` from `server/.env`, then to the
compose default. `globalSetup.ts` creates it, applies `server/drizzle/*.sql` with the same
migrator boot uses, and drops it when the run ends. It refuses any name that does not match
that pattern, and it drops leftovers older than an hour so a crashed run does not
accumulate databases. The development database is never touched.

**Every test starts from empty tables.** `resetDatabase()` truncates every table in the
`public` schema; call it in `beforeEach`. Files run one after another
(`fileParallelism: false`) because they share the database.

## Email and Stripe never leave the process

`mailbox.ts` replaces the email module: every `EmailProvider` call is recorded with its
recipient and URL, and `lastMail(to, kind)` returns the link a real user would click.
`signIn(app, email)` uses it to go through the real magic-link flow on a Fastify instance
from `buildApp()` and returns the cookie header. Stripe webhooks are signed with the SDK's
`generateTestHeaderString`, so the raw-body parser and the signature check run for real;
Stripe API calls in the deletion cleanup are replaced with `vi.fn()`.

## Client component specs stub the overlays

reka-ui dialogs and dropdowns portal to `document.body` and open on pointer events that
happy-dom does not reproduce faithfully. `overlayStubs` turns them into plain slots and
menu items into `button[data-menu-item]`, so a spec exercises the page's handlers.
**Target menu items by `[data-menu-item]`, not by button text**: the OrgSwitcher trigger
shows the active organization's name, and a spec that clicked "the Acme button" was
clicking the trigger and passed even with the rule it tested removed.

## Check a new spec by breaking the code

Before trusting a spec, delete or invert the line it protects and run it. It must fail.
Every spec in the suite was checked this way when it was written: re-enabling the session
cookie cache fails four auth-flow tests, removing the membership check fails tenancy,
skipping the admin-delete cleanup, the Origin hook, the production error masking, the
dedupe window, the admin route guard or the empty-vendor guard each fails its spec.

## Browser tests run the way a developer runs the app

The first login E2E passed while sign-in was broken for anyone typing `pnpm dev`: every
run passed `API_URL` and `CLIENT_PORT` explicitly, so the one configuration developers
actually use was never exercised, and no spec looked at an error toast. Two rules follow.
`playwright.config.ts` reads the same env files the app reads, so `pnpm test:e2e` needs no
flags; and a browser step asserts where it landed and what it shows, not only that it
did not throw. `toast.spec.ts` forces a failed sign-in and checks the toast is visible and
positioned, which is what catches a missing stylesheet.

A spec that must run under production settings (rate limits, error masking) sets
`process.env.NODE_ENV` inside `vi.hoisted`, before any import evaluates `config/env.ts`.
`vi.stubEnv` at the top of the file is too late: static imports have already run, and
`rateLimit.int.spec.ts` passed vacuously that way until the break-the-code check caught it.

## Output is silent on purpose

Both vitest configs set `LOG_LEVEL=silent`. Several specs exercise failure paths that log
at error level; without it the output hides the one line that matters.
