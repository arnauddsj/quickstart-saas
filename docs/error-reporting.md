# Error reporting

What reaches Discord, what only reaches the database, and why the difference is a rule
rather than a judgement call at each site.

Code: `server/src/services/errorLog.ts` (`reportError`), `services/discord.ts`
(`postToDiscord`), `db/schema/app.ts` (`errorLog`, `ERROR_SEVERITIES`), `app.ts` (the
tRPC `onError` hook), `index.ts` (`unhandledRejection`), `jobs/errorLogCleanup.ts`,
`trpc/router/admin.ts` (`listErrors`).

## Severity is the routing rule

| Severity          | Table | Discord | Meant for                          |
| ----------------- | ----- | ------- | ---------------------------------- |
| `INFO`, `WARNING` | yes   | no      | things an admin reads when curious |
| `ERROR`           | yes   | yes     | a request failed for a user        |
| `CRITICAL`        | yes   | yes     | the process is unhealthy           |

`reportError` decides from `severity` alone. A call site never posts to Discord directly,
so the question "does this page someone?" has one answer per severity and not one per
file. `postToDiscord` is a no-op without `DISCORD_WEBHOOK_URL`, so the template works with
no webhook configured.

## Messages are entity-free; details go in `context`

`reportError` dedupes on `type` plus the first 100 characters of `message` for 30 seconds.
A message that embeds an id (`Failed to sync org 8f3…`) defeats the dedupe and pages once
per row during an outage. Put ids, emails and counts in `context` and keep the message
constant per failure kind. `type` is dotted and stable: `trpc.<path>`, `stripe.webhook`,
`process.unhandledRejection`.

## What is wired automatically

The tRPC `onError` hook in `app.ts` reports `INTERNAL_SERVER_ERROR` only; `UNAUTHORIZED`,
`FORBIDDEN`, `BAD_REQUEST` and the other expected codes are user errors and never logged
here. `process.on('unhandledRejection')` reports `CRITICAL`. pg-boss errors are logged by
pino and not reported, because a flapping database would produce hundreds a minute.

## The table is trimmed, never archived

`errorLogCleanup` deletes rows older than 30 days at 04:00 UTC. `admin.listErrors` shows
the newest 50 to 200. Anything worth keeping longer belongs in an audit under
`.claude/audits/`.

## `reportError` never throws

An insert failure is logged with pino and swallowed, and the Discord post is wrapped the
same way. Error reporting that can itself fail a request turns one incident into two.
