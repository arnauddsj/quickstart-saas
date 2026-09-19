# Backups and restore

How to take a dump of the Compose Postgres, restore it, and prove that a dump restores
before the day it is needed.

Code: `server/src/scripts/db-backup.ts`, `server/src/scripts/setup/backup.ts`
(`COUNT_QUERY`, `backupName`, `compareCounts`, `backupsToPrune`). Spec:
`server/src/__tests__/backup.spec.ts`.

## The three commands

```bash
pnpm db:backup [--keep 14] [--dir backups] [--container <name>]
pnpm db:restore <file> --into <database> [--force]
pnpm db:restore-check <file>
```

All three run the Postgres tools inside the database container, through
`docker compose exec postgres` or, with `--container`, `docker exec <name>`. The host needs
Docker and Node, not `pg_dump`, and the tools always match the server version. User and
database come from `POSTGRES_USER` and `POSTGRES_DB` in the environment or the root `.env`
(defaults `admin` and `quickstart`). Relative paths are resolved from where you ran
`pnpm`. `backups/` is gitignored.

**`db:backup` writes a custom-format dump and a row count for every table, from one
snapshot.** It opens a `repeatable read` transaction in `psql`, exports its snapshot, runs
`pg_dump --snapshot` against it, and counts every table in the same transaction. The
counts go to `<file>.json` next to the dump. Counting in a separate step would race with
pg-boss and session writes, and every drill on a live database would then report
differences. `--keep n` deletes the oldest dumps of the same database beyond `n`; the
default, 0, keeps everything.

**`db:restore` creates the target database and restores into it.** It refuses an existing
database unless `--force`, which drops it first with `dropdb --force`, disconnecting
anyone still on it. To replace the live database, stop the `server` container first so it
does not reconnect halfway through.

**`db:restore-check` is the drill.** It restores the dump into a scratch
`restore_check_<timestamp>` database, counts every table, compares the counts with the
`.json` file and drops the scratch database whether or not the check passes. It exits 1
and lists the tables that differ. A dump without its `.json` cannot be checked.

## Production

A dump on the same disk as the database protects against a bad migration or a mistaken
`delete`, not against losing the host. Copy dumps off the machine (object storage,
another host) as part of the same job.

| What               | Policy                                                                |
| ------------------ | --------------------------------------------------------------------- |
| Frequency          | daily, plus by hand before a risky migration                          |
| Kept on the host   | `--keep 14`                                                           |
| Kept off the host  | 14 daily and 8 weekly, set as the storage bucket's lifecycle rule     |
| Drill              | `db:restore-check` on the newest dump every month, and after upgrades |
| Recovery objective | lose at most one day of data; restore in under an hour                |

On a host that runs the Compose files directly, schedule it with cron from the checkout,
with the same `COMPOSE_FILE` the stack uses:

```bash
0 3 * * * cd /srv/acme && COMPOSE_FILE=docker-compose.yaml:docker-compose.prod.yaml pnpm db:backup --keep 14
```

Under Coolify the stack runs under Coolify's own project name, so pass the container:
`pnpm db:backup --container <postgres container>` from a checkout on the host. If the
host has no Node, the dump alone is
`docker exec <container> pg_dump -U admin -Fc <database> > <file>`; it restores with
`db:restore` but carries no counts for the drill. When Coolify's own scheduled backups
cover the database they can replace the cron line; drill them with `db:restore --into`
and compare the row counts by hand, since they carry no `.json`.
