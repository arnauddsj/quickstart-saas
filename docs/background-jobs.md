# Background jobs

One pg-boss instance, started after migrations, with queues created before anything
works on them.

Code: `server/src/jobs/boss.ts` (`boss`, `startBoss`, `stopBoss`, `bossStarted`),
`jobs/errorLogCleanup.ts` (`registerErrorLogCleanup`, `ERROR_LOG_CLEANUP_QUEUE`),
`routes/health.ts`, `index.ts`.

## There is exactly one instance

`boss` in `jobs/boss.ts` is the only `PgBoss` object in the process. It owns a pool of 3
connections in the `pgboss` schema of the same database. The old template built a second
instance inside a rate-limit service, which doubled the connection count and made the two
disagree about which queues existed. Import `boss`; never construct another.

`startBoss()` runs after `runMigrations()` and before `listen()` in `index.ts`, so a
request can never enqueue onto a boss that has not started. `bossStarted()` feeds the
`jobs` check in `/health`.

## `createQueue` before `work` or `schedule`

pg-boss 10 and later require a queue to exist before a worker or a schedule refers to it,
and the call is idempotent. Every job module therefore starts with
`await boss.createQueue(NAME)`, then `boss.work`, then `boss.schedule` when it is periodic.
Skipping the first call throws `Queue … does not exist` on the second, at boot.

## Adding a job

1. Create `jobs/<name>.ts` exporting a `register<Name>(boss)` function that creates the
   queue, registers the worker and, if periodic, the cron schedule. Cron runs in UTC.
2. Call it from `startBoss()`.
3. Enqueue from anywhere with `boss.send(QUEUE, data)`; the handler receives an array of
   jobs in v12, so read `jobs[0].data` or loop.

`errorLogCleanup.ts` is the worked example: one queue, one worker deleting `error_log`
rows older than 30 days, one `0 4 * * *` schedule.

## Why pg-boss and not BullMQ

BullMQ needs Redis, which means one more service to run, back up and secure, and a
`ioredis` version pin that has broken a deploy before in a sibling project. pg-boss uses
the Postgres the template already has, survives restarts, and is enough until a queue
needs sub-second latency or tens of thousands of jobs a minute. Swap then, not before.

## Shutdown stops the worker before the pool

`stopBoss()` runs `boss.stop({ graceful: true, timeout: 5000 })`, giving an in-flight job
five seconds to finish before the `pool.end()` in `index.ts` closes the database. The
whole sequence has to fit the 8-second budget in [deployment.md](deployment.md).
