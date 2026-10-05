# Error reporting

Where errors go, what alerts someone, and how an alert gets its user, organization,
request and action attached.

Code:

- server: `server/src/instrument.ts` (`Sentry.init`), `services/reportError.ts` (`reportError`, `SEVERITIES`), `services/scrub.ts`, `services/watchdog.ts`, `jobs/heartbeat.ts`, `jobs/withReporting.ts`, `app.ts` (request ids, the Fastify error handler, the tRPC `onError` hook), `trpc/index.ts` (user and organization on the scope), `index.ts` (fatal handlers)
- client: `client/src/lib/monitoring.ts` (`initMonitoring`, `runAction`, `reportQueryFailure`), `lib/scrub.ts`

## GlitchTip holds the errors; the app holds none

Events go through the Sentry SDKs (`@sentry/node`, `@sentry/vue`) to a self-hosted
GlitchTip. One instance is shared by every SaaS, with **one GlitchTip project per app**
that the client and server share. Sharing it lets a browser event and the server event
it caused land in the same issue (see below). Environments are separated by
`SENTRY_ENVIRONMENT`.

Alerting is configured in GlitchTip, not in code. Each project has an alert rule on new
issues with two recipients, a Discord webhook and email. There is no transport in the app
and no fallback. With no DSN set, the SDKs are inert: dev, tests and an unconfigured
staging send nothing. To see events locally, run the opt-in GlitchTip profile; see
[development.md](development.md#local-error-tracking-is-opt-in).

The admin nav links to GlitchTip when `VITE_GLITCHTIP_URL` is set. The app has no error
table: `error_log` was dropped in migration `0002` when the tracker moved out.

## Severity is the routing rule

| Severity   | Sentry level | Sent to GlitchTip | Alerts | Meant for                        |
| ---------- | ------------ | ----------------- | ------ | -------------------------------- |
| `INFO`     | `info`       | breadcrumb only   | no     | a diagnostic step in a trail     |
| `WARNING`  | `warning`    | breadcrumb only   | no     | handled failure, fallback worked |
| `ERROR`    | `error`      | yes               | yes    | an action failed for a user      |
| `CRITICAL` | `fatal`      | yes               | yes    | the process or a dependency died |

GlitchTip alert rules cannot filter by level. Anything sent can therefore alert, which is
why WARNING and INFO never leave the process: they go to pino and to the breadcrumb trail
of the next real event. A call site never calls `Sentry.capture*` itself. It calls
`reportError`, and the severity decides.

Critical conditions for this starter:

- the database is unavailable
- the job worker has stalled
- the process hit a fatal error

Classify a 502/503/504 by what it blocked. A retried timeout that succeeded is `WARNING`;
one that blocked sign-in or payment is `ERROR`. 401, 403, 404, 429 and validation errors
are not reported.

## `type` groups; messages are entity-free

The fingerprint is `[type, ...fingerprint]`, so GlitchTip groups on `type` (dotted,
stable: `trpc.<path>`, `stripe.webhook`, `email.magic_link`, `job.<queue>`,
`watchdog.db`) and never on the message. Keep `message` constant per failure kind and
put ids in `context`. Split a type further with `fingerprint` (the Stripe webhook adds
`event.type`) rather than by varying the message.

## What is wired

- The tRPC `onError` reports `INTERNAL_SERVER_ERROR` as `trpc.<path>`, with the user and
  the session's active organization.
- `Sentry.setupFastifyErrorHandler` catches 5xx outside tRPC, including `/api/auth/*`.
- The better-auth email hooks report `email.<kind>` and rethrow.
- `withReporting` wraps pg-boss workers and reports `job.<queue>` before pg-boss retries.
  `boss.on('error')` stays pino-only, because a flapping database would produce hundreds
  of events a minute; the watchdog reports that outage once instead.
- The Stripe webhook reports `stripe.webhook`. Account deletion reports a Stripe cancel
  failure as `ERROR` and a customer-delete failure as `WARNING`.
- `unhandledRejection` is `CRITICAL`. `uncaughtException` and boot failures are
  `CRITICAL`, then `Sentry.flush(2000)` and `exit(1)`: the process never continues in an
  unknown state.
- In the browser, the Vue integration covers component errors, `window.onerror` and
  unhandled rejections.
- A navigation error, or a chunk-load error that survives the one automatic reload, is
  captured.
- Query and mutation failures that are _not_ tRPC errors (code bugs, parse failures) are
  captured. A tRPC error only leaves a breadcrumb, because the server already reported it
  or it was an expected 4xx.

## Who, where, which request, which action

- **User.** On the server, `createContext` sets the user id on the per-request isolation
  scope from the verified session. `orgProcedure` sets `organization_id` only after the
  membership check. The client never supplies either.
- **Isolation.** Isolation depends on `instrument.ts` loading before the app
  (`node --import ./dist/instrument.js`). `monitoring.spec.ts` proves that two concurrent
  users keep their own tags.
- **Request.** Every request gets `x-request-id`: a valid incoming UUID is reused,
  otherwise one is generated. It is echoed back and tagged as `request_id`.
- **Action.** `runAction(name, fn)` in the browser records an `action` breadcrumb and
  hands `fn` a fresh action id. The call site sends it as `x-action-id`: through tRPC
  `context: { actionId }` or better-auth `fetchOptions.headers`. The server tags it as
  `action_id`.
- **Per-operation ids.** Mutations use an unbatched `httpLink`, so each has its own
  request and the id belongs to one operation. Queries stay batched and carry no action.
- **Linked browser events.** When an action's tRPC call fails with a 5xx, the browser
  sends its own event with the same `trpc.<path>` fingerprint. It joins the server's
  issue instead of paging again, and carries the breadcrumb trail that led to the click.
- **Browser identity.** The router guard sets the browser user id after `getSession`.
  Sign-out clears the user and the breadcrumbs.

Wired actions: `billing.checkout`, `organization.invite`, `account.delete`. Wrap a new
business action the same way; generic click breadcrumbs cannot say what the user meant.

## What never leaves the process

`scrub.ts` exists on both sides and runs as `beforeSend` and `beforeBreadcrumb`. It keeps
only these request headers: `user-agent`, `x-request-id` and `x-action-id`. It removes:

- cookies and request bodies
- query strings and fragments from request URLs and URLs embedded in event messages,
  exception values, stack frame filenames, breadcrumbs and diagnostic context, which
  removes magic-link and invitation tokens from those fields
- everything on the user except `id`

It also redacts any context key matching
`token|secret|password|authorization|cookie|key`. `sendDefaultPii` is off, and Vue
component props are not attached. The specs inject dummy secrets and assert that they are
absent.

## The watchdog reports outages once

`services/watchdog.ts` probes the database every 60 s with a fresh connection and a 5 s
timeout. It is independent of the pool, so pool exhaustion cannot hide a probe.

**Database.** Two consecutive failures raise one `CRITICAL watchdog.db` event, with the
outage start in the fingerprint so each outage is a new issue and alerts. The first
success afterwards sends one `info` recovery event, which also alerts because it is a new
issue.

**Worker.** The `worker-heartbeat` job runs every 5 minutes. If none has run for 15
minutes while the database is up, `watchdog.worker` fires, with the same latch and
recovery. The grace period restarts at boot and after a database recovery, so heartbeats
missed during an outage do not blame the worker.

**Limit.** The latch lives in memory because the database may be what is down. A restart
during an outage re-alerts once. `nextState` is pure and covered by `watchdog.spec.ts`.

A host or process that disappears cannot report itself. A GlitchTip uptime monitor on
`/health/ready`, running on GlitchTip's host, covers that; see
[deployment.md](deployment.md#error-tracking-lives-in-glitchtip).

## `reportError` never throws

A failure inside the SDK is logged with pino and swallowed. Error reporting that can
itself fail a request turns one incident into two.
