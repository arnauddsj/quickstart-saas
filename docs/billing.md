# Billing

Plans are one table in code, subscriptions hang off organizations, and the server checks
the plan before doing premium work.

Code: `server/src/config/plans.ts` (`PLANS`, `planGuard`, `planLimit`,
`planFromPriceId`), `services/stripe.ts` (`getOrCreateSubscription`,
`createCheckoutSession`, `createPortalSession`, `applyStripeSubscription`),
`routes/stripeWebhook.ts`, `trpc/router/billing.ts`, `db/schema/app.ts`
(`subscription`), `client/src/pages/settings/Billing.vue`. Spec:
`server/src/__tests__/plans.spec.ts`.

## `PLANS` is the only place a limit is written

`config/plans.ts` holds every plan with its label, Stripe price id, numeric `limits` and
boolean `features`. `planGuard(plan, feature)` throws `FORBIDDEN` naming the plan;
`planLimit(plan, limit)` returns the number. A handler that needs a limit reads it from
here, never from a literal, and the client shows the plan it is told rather than deciding
anything. The `projects` limit and `exports` feature are placeholders every new project
renames on day one, which is why they are the only two.

## Subscriptions belong to organizations

`subscription` has one row per organization (`organizationId` is unique, cascade on
delete). `getOrCreateSubscription(orgId)` inserts a `FREE` row on first touch with
`onConflictDoNothing` so two concurrent first reads do not race into a duplicate. The
Stripe customer is created lazily on the first checkout and stored on the same row.

Plan names are the `PLAN_NAMES` tuple, a `text` column with an `enum` constraint in
Drizzle, not a Postgres enum and not a TypeScript `enum`: see
[type-contract.md](type-contract.md).

## Without Stripe keys, billing says so instead of failing

A fresh clone has `STRIPE_SECRET_KEY=sk_test_placeholder`. `STRIPE_CONFIGURED` in
`services/stripe.ts` is false for any key ending in `_placeholder`, and checkout and portal
throw `PRECONDITION_FAILED` "Billing is not configured on this server" before calling
Stripe. Before this, the button surfaced Stripe's own "Invalid API Key provided" message.
Reading the plan still works, so every organization shows `FREE`.

## Checkout and portal are organization-admin actions

`billing.createCheckout` and `billing.createPortal` run on `orgAdminProcedure`. Checkout
sets `client_reference_id` and `subscription_data.metadata.organizationId` so the webhook
can find the organization without a lookup table. Success and cancel URLs return to
`${PUBLIC_URL}/settings/billing?status=…`, which the page turns into a toast.

The Billing page reads `org.current` and shows members a sentence ("Only owners and
admins of this organization can change its plan") instead of buttons the server would
refuse with `FORBIDDEN`. The page hides; the procedure still decides.

## The webhook is the source of truth

`applyStripeSubscription` maps the first line item's price id to a plan through
`planFromPriceId` (unknown id or an inactive status means `FREE`) and upserts the row.
It runs for `checkout.session.completed` (after retrieving the subscription),
`customer.subscription.created`, `updated` and `deleted`. The checkout return page never
writes the plan; if the webhook is late the page shows `FREE` for a few seconds, which is
honest.

## The webhook needs the raw body, so it lives in its own plugin

Stripe signs the exact bytes it sent. `stripeWebhookRoutes` is registered as a Fastify
plugin that replaces the `application/json` parser with a buffer parser inside its own
encapsulation scope; the rest of the app keeps normal JSON parsing. Moving the route out
of that plugin breaks signature verification with a misleading "No signatures found"
error. An unsigned request answers 400; a handler failure answers 500 after
`reportError`, so Stripe retries.

## Testing locally

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe   # prints the whsec_ for .env
stripe trigger customer.subscription.updated
```

With the placeholder keys in `.env.example` the server boots but every Stripe call
fails; that is intended for projects that have not set up billing yet.

## The alternative not taken yet

`@better-auth/stripe` ships organization-level subscriptions keyed by a `referenceId` and
would replace `services/stripe.ts` and the webhook. It is listed in
[`.claude/TODO.md`](../.claude/TODO.md) to evaluate; the hand-rolled version is kept
because it is the shape both sibling projects already run.
