# Product analytics

First-party usage numbers for the operator: is the product growing, do new users reach
the key action, do they come back, and do the plans fit how people actually use them. It
runs on the app's own database, with no third-party script and no cookie.

Code:

- server: `server/src/services/usage.ts` (`recordActivity`, `track`, `anonymizeUsage`, `deleteExpiredUsage`), `server/src/services/analytics.ts` (`productAnalytics`, `ACTIVATION_EVENT`, `usageCounters`), `db/schema/app.ts` (`activityDay`, `usageEvent`), `server/drizzle/0006_usage-analytics.sql`, `trpc/index.ts` (`protectedProcedure` records activity), `trpc/router/admin.ts` (`analytics`), `jobs/usageRetention.ts`
- client: `client/src/pages/admin/Analytics.vue`, `client/src/components/charts/TrendChart.vue`, the `--chart-*` tokens in `client/src/styles.css`

Spec: `server/src/__tests__/integration/analytics.int.spec.ts`.

## Two tables, written in two ways

- **`activity_day`** has one row per person per UTC day on which they made a signed-in
  request. `protectedProcedure` calls `recordActivity` on every call. An in-memory set
  skips repeat calls within the day, and `ON CONFLICT DO NOTHING` absorbs the rest, so
  the cost is one insert per person per day per process. Each row copies the person's
  sign-up date (`signed_up_on`), which is how cohorts survive anonymization.
- **`usage_event`** has one row per `track(userId, organizationId, 'area.action')`. Call
  it where a meaningful action succeeds. The starter tracks `project.created` and
  `billing.checkout_started`. `track` never throws: a failed write is a WARNING, not a
  broken request.

Creation data also comes straight from the entity tables (`createdAt`, `createdById`,
`organizationId`). That is what `usageCounters` counts for plan fit.

## What the page answers

| Section                            | Definition                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Active users, 7 / 28 days          | distinct people with an `activity_day` row in the window                                                                                 |
| Stickiness                         | average daily active ÷ 28-day active; 20% or more is healthy for a work tool                                                             |
| Activation                         | share of people who signed up 7 to 84 days ago and fired `ACTIVATION_EVENT` within `ACTIVATION_WINDOW_DAYS` of signing up                |
| Sign-ups and active users per week | the last 12 weeks, the current partial week included                                                                                     |
| Retention by sign-up week          | per weekly cohort, the share active in week 1, 2, 4 and 8 after the sign-up week; "—" until that week has passed                         |
| Plans against their limits         | per plan and per limit: median usage, share at 80% or more, share at the limit, and for paid plans the share using more than FREE allows |
| Tracked events per week            | the five most frequent event types                                                                                                       |
| Feature use by plan                | events and distinct people per type over 30 days, split by the workspace's current plan                                                  |

`ACTIVATION_EVENT` is the single action that means "got value". It is `project.created`
until the reference feature is renamed. Change it to the product's own key action; it
is the one number to watch in the first months.

Reading plan fit:

- If FREE workspaces cluster far below their limits, the free plan gives away what
  people would pay for.
- If many sit at the limit and checkouts stay flat, the upgrade is not compelling.
- If PRO workspaces rarely go beyond the FREE limit, PRO is not yet delivering its value.

## Deleting an account anonymizes, not deletes

`cleanupBeforeUserDelete` calls `anonymizeUsage`, which replaces the person's id with one
random `deleted_…` pseudonym in both tables. Historical counts and cohorts stay stable,
and nothing links the rows back to anyone. Deleting a workspace sets `organization_id` to
null for the same reason. The privacy page's "Usage statistics" section discloses this.

## Retention

`usage-retention` runs daily at 04:15 UTC and deletes rows older than
`USAGE_RETENTION_DAYS` (760, about 25 months, the CNIL guidance for audience
measurement). The privacy page reads the same value from `legal.usageStatistics`.

## Charts

`TrendChart` wraps Chart.js through vue-chartjs:

- columns capped at 24px with 4px rounded ends
- 2px lines
- a hover crosshair with one tooltip listing every series
- a hairline grid and a legend only when there are two or more series
- a "Show table" toggle, the accessible alternative

Chart.js is lazy-loaded in its own `vendor-charts` chunk, so only the admin page pays
for it. Series colors come from `--chart-1`…`--chart-5`, validated for color-vision
deficiency and contrast against the card surface in both themes. In light mode three
slots sit below 3:1 contrast, which is why every chart keeps its legend and table view.
Colors follow the entity: event types are sorted by name before being assigned a slot.

## Adding a tracked event or a limit

- **An event:** call `track(ctx.user.id, ctx.organizationId, 'area.action')` after the
  action succeeds. It appears in the events chart and the by-plan table automatically.
- **A limit:** a new key in `PLANS[...].limits` needs a counter in `usageCounters`. The
  type makes a missing one a compile error.
