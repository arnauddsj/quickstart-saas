# Billing

Plans are one table in code, subscriptions hang off organizations, and the server checks
the plan before doing premium work.

Code: `server/src/config/plans.ts` (`PLANS`, `planGuard`, `planLimit`,
`planFromPriceId`), `services/stripe.ts` (`getOrCreateSubscription`,
`createCheckoutSession`, `createPortalSession`, `applyStripeSubscription`),
`routes/stripeWebhook.ts`, `trpc/router/billing.ts`, `db/schema/app.ts`
(`subscription`), `client/src/pages/settings/Billing.vue`. Specs:
`server/src/__tests__/plans.spec.ts`, `server/src/__tests__/integration/billing.int.spec.ts`.

## `PLANS` is the only place a limit is written

`config/plans.ts` holds every plan with its label, Stripe price id, numeric `limits` and
boolean `features`. `planGuard(plan, feature)` throws `FORBIDDEN` naming the plan;
`planLimit(plan, limit)` returns the number; a handler enforcing it counts under a lock
on the subscription row, as [reference-feature.md](reference-feature.md) shows. A handler
that needs a limit reads it from here, never from a literal, and the client shows the plan
it is told rather than deciding anything. The `projects` limit and `exports` feature are placeholders every new project
renames on day one, which is why they are the only two.

## Subscriptions belong to organizations

`subscription` has one row per organization (`organizationId` is unique, cascade on
delete). `getOrCreateSubscription(orgId)` inserts a `FREE` row on first touch with
`onConflictDoNothing` so two concurrent first reads do not race into a duplicate. The
Stripe customer is created lazily on the first checkout and stored on the same row, with
the idempotency key `customer-<orgId>` so two first checkouts in a row get one customer
(Stripe keeps the key for 24 hours; after that the stored id is already there).

Deleting an organization cancels its Stripe subscription first, whichever path deletes
it: see [account-lifecycle.md](account-lifecycle.md).

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

**Checkout refuses an organization that already has a live subscription.** When the row
has a `stripeSubscriptionId` and its status is `active`, `trialing` or `past_due`,
`createCheckoutSession` throws `PRECONDITION_FAILED` before calling Stripe; those
customers change plan or fix a card in the portal. Otherwise two tabs or a retried request
open two sessions, and completing both bills twice while the row records one. A cancelled
subscription can check out again and reuses its customer. The page hides the button in the
same cases, but the server is what decides.

The Billing page reads `org.current` and shows members a sentence ("Only owners and
admins of this organization can change its plan") instead of buttons the server would
refuse with `FORBIDDEN`. The page hides; the procedure still decides.

## The webhook is the source of truth, and it asks Stripe

Stripe does not deliver events in order and may deliver one twice. The webhook therefore
never applies the snapshot inside the event: for `checkout.session.completed` and every
`customer.subscription.*` event it calls `stripe.subscriptions.retrieve(id)` and applies
what Stripe holds now. A late "active" event after a cancellation then applies the
cancellation, and a replay applies the same state again.

`applyStripeSubscription` maps the first line item's price id to a plan through
`planFromPriceId` (unknown id or a status other than `active`/`trialing` means `FREE`) and
upserts the row. It changes nothing when:

- the subscription has no `organizationId` metadata;
- the organization no longer exists. The event is acknowledged with 200; inserting would
  fail the foreign key and Stripe would retry for days;
- the row holds a different subscription that is still paying and the incoming one is not.
  An old subscription's cancellation cannot downgrade the one that replaced it.

The checkout return page never writes the plan; if the webhook is late the page shows
`FREE` for a few seconds, which is honest.

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
