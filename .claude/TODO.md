# Outstanding work

Work that is **not done**. Deliberately separate from [`docs/`](../docs/README.md), which
describes how the app currently works — check there first if you are trying to understand
existing behaviour, and check here before assuming an oddity is new.

Resolved items are deleted, not archived. Where the reasoning still explains why the code
looks the way it does, it was moved into `docs/` or `CLAUDE.md` instead — those are
maintained, this file is not a history.

---

## 1. Before the first real feature in a new project

Start with `pnpm init-project`, then run `pnpm check-ready`: it reports every item below
that lives in the repo and exits 0 once they are done. See
[`docs/new-project.md`](../docs/new-project.md).

- [ ] **Rename or delete the Projects reference feature.** It is a placeholder for the
      product's first real entity and must not ship as "Projects". Follow
      [`docs/reference-feature.md`](../docs/reference-feature.md) § Renaming it, before the
      first deploy so migration `0003` can be regenerated.
- [ ] **Choose the activation event and what to track.** Set `ACTIVATION_EVENT` in
      `server/src/services/analytics.ts` to the action that means "got value", and add
      `track()` calls for the product's key actions. See
      [`docs/analytics.md`](../docs/analytics.md).
- [ ] **Replace the example notifications.** `account.welcome` and `project.created` show
      the pattern; keep, reword or delete them, and add the product's own events. See
      [`docs/notifications.md`](../docs/notifications.md).
- [ ] **Check the brand `init-project` wrote.** `server/src/config/brand.ts`: product
      name, support email, accent color, the workspace label, and `teams: false` for a
      single-user product. See [`docs/branding.md`](../docs/branding.md).
- [ ] **Replace the placeholder plan shape.** `server/src/config/plans.ts` ships with a
      `projects` limit (used by the reference feature) and an `exports` feature so
      `planGuard` has something to exercise. Rename them to the product's real limits and
      delete `billing.exportData`, which exists only to demonstrate the guard.
- [ ] **Create the Loops templates** for the entries in `server/src/email/templates.ts`
      (variables listed in [`docs/email.md`](../docs/email.md)), then set
      `LOOPS_TEMPLATE_IDS` and `EMAIL_PROVIDER=loops` on the host. Until then production
      sends through SMTP with the built-in layout.
- [ ] **Create the Stripe product and price**, set `STRIPE_PRICE_PRO_MONTHLY`, and point a
      webhook at `/webhooks/stripe`. With the placeholder ids every checkout fails.
- [ ] **Rewrite the product statement** at the top of `CLAUDE.md` and `README.md`, and
      set the product name in `README.md` (`brand.ts` covers the app itself).
- [ ] **Fill `client/src/data/legal.ts`** (entity, address, registration, host, contact) and
      rewrite `pages/legal/Terms.vue`; the privacy page is generated from it. Set
      `errorTracking.retentionDays` to the GlitchTip project's event retention. Set
      `VITE_GA4_ID` / `VITE_CLARITY_ID` only once the policy names them.

## 2. Backlog

From the 2026-09-19 audit, deliberately deferred until a product needs them:

- [ ] **Audit trail for sensitive actions.** Actor, workspace, action, target and time for
      role, membership, billing and destructive admin changes, with a searchable view.
      Usage analytics is not an audit history.
- [ ] **A retryable background-job example.** One idempotent job with retries and backoff,
      and a documented way to inspect and retry failed pg-boss jobs.
- [ ] **Recurring features, only once two products need them:** tenant-scoped file
      storage (S3-compatible, signed URLs), a paginated list example (Projects loads every
      row), translation and locale-aware email, marketing pages, and further sign-in
      methods or API keys.

- [ ] **Evaluate `@better-auth/stripe` as a replacement for `services/stripe.ts`.** It
      ships organization-scoped subscriptions keyed by `referenceId`, which would delete
      the hand-rolled checkout, portal and webhook. Kept out for now because the
      hand-rolled shape is what the sibling projects run.
- [ ] **Move to TypeScript 7 when typescript-eslint accepts it.** `typescript-eslint`
      8.70 declares `typescript >=4.8.4 <6.1.0`; check
      `npm view typescript-eslint peerDependencies.typescript` and bump the `~6.0.3` pins
      in all three `package.json` files together.

## 3. Do not "fix" these

Things that look like bugs and are not. Each names why the obvious fix is wrong.

- **better-auth rate limiting is off outside production.** Every local request comes from
  `127.0.0.1`; five magic links locked developers out for an hour. Production keeps it,
  and `rateLimit.int.spec.ts` tests it under production settings.
- **`/get-session` has no rate limit, in better-auth or in Fastify.** The router guard
  calls it on every navigation; limiting it logged active users out. See `docs/auth.md`.

- **`client/src/components/ui/**` is excluded from ESLint and Prettier.** It is
  shadcn-vue output, regenerated by `pnpm ui add`; linting it means re-fixing it after
  every regeneration.
- **`pnpm --filter server typecheck` emits `server/dist/`.** `tsc -b` on a composite
  project cannot run with `--noEmit`; the emitted declarations are what the client's
  project reference consumes. `dist/` is gitignored.
- **`COOKIE_SECURE=false` in the local production-stack recipe.** There is no TLS on
  localhost; a secure cookie would never be sent back. The value must be `true` behind
  HTTPS, and `parseEnv` enforces it when `NODE_ENV=production`.
- **`docker compose up` does not start the server or client.** They live in
  `docker-compose.prod.yaml` on purpose; see `docs/development.md`.
- **`db/schema/auth.ts` spells column names explicitly while `app.ts` does not.** Both
  produce `snake_case`; the generated file is just verbose. Do not "normalise" it.
