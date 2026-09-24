# Development

Running it locally, what `docker compose up` does and does not start, and the trap of a
port already taken by another project's Postgres.

Code: `docker-compose.yaml`, `package.json` (root scripts), `server/package.json`,
`client/package.json`, `client/vite.config.ts`, `server/.env.example`,
`playwright.config.ts`, `e2e/login.spec.ts`.

## First run

```bash
nvm use                               # or any Node 24; .nvmrc says 24
corepack enable                       # pnpm 11.27 from the packageManager field
pnpm install
pnpm init-project                     # brand, root .env, server/.env; see new-project.md
docker compose up -d                  # postgres:17 + mailpit, nothing else (GlitchTip is opt-in, below)
pnpm dev                              # server on :3000 (migrates first), client on :5173
```

Open `http://localhost:5173`, request a link, read it at `http://localhost:8025`. Make
yourself admin with `pnpm make-admin you@example.com` and reload, or run
`pnpm db:seed --reset` and sign in as `admin@example.com` to start from fake data; see
[seeding.md](seeding.md).

## `docker compose up` starts only the dependencies

The default compose file has `postgres` and `mailpit`. The application containers live in
`docker-compose.prod.yaml`, an overlay applied explicitly. The two files are separate
because Compose interpolates `${VAR:?}` for every service in a file, even one a profile
would skip, so production's required secrets would have blocked `docker compose up` in
development.

## Each clone is its own Compose project

The compose file sets no project name and no volume name, so both come from the directory:
a clone in `acme/` gets the `acme` project and the `acme_postgres_data` volume. Ports are
published on `127.0.0.1` only. A checkout created before this change has its data in
`quickstart_postgres_data`; put `COMPOSE_PROJECT_NAME=quickstart` in the root `.env` to
keep using it.

## Ports collide with other projects, and the fix is the root `.env`

Every project on a laptop wants 5432, 1025, 8025 and 5173. The compose file reads
`POSTGRES_PORT`, `MAILPIT_SMTP_PORT` and `MAILPIT_UI_PORT` from the root `.env`
(gitignored), and Vite and Playwright read `CLIENT_PORT` from it. `pnpm init-project`
picks free ports and writes both env files consistently; by hand, set the root `.env` when
`docker compose up` reports a bound port and mirror it in `server/.env` (`DATABASE_URL`,
`SMTP_PORT`, `PUBLIC_URL`, `CORS_ORIGINS`). The container-side ports never change.

## `server/.env` is the one place the API port is set

`PORT` in `server/.env` decides where the API listens, and `client/vite.config.ts` and
`playwright.config.ts` both read it (`loadEnv` / `parseEnv`) to find the API; Playwright
also reads `MAILPIT_UI_PORT` from the root `.env`. They used to default to 3000 on their
own, so moving the API to 3001 left the Vite proxy pointing at nothing: sign-in failed
with a 502 and a generic "Could not send magic link", and nothing appeared in the
server's log because no request ever reached it. `API_URL` and `CLIENT_PORT` in the
shell still override both when needed. `PUBLIC_URL` and `CORS_ORIGINS` must name the port
Vite actually serves (5173 unless `CLIENT_PORT` says otherwise).

## What `pnpm dev` runs

`pnpm -r --parallel dev`: the server is `node --env-file-if-exists=.env --import tsx
--watch src/index.ts`, which applies migrations, starts pg-boss and listens; the client
is `vite`. The Vite dev server proxies `/trpc` and `/api/auth` to the API port above with
`changeOrigin: false` so auth cookies are issued for the Vite origin; see
[auth.md](auth.md).

**Where an error shows up depends on where it stopped.** The server logs every request it
receives with its status code. A request that never reached it (API down, wrong port)
appears only in the Vite terminal as `http proxy error`, and in the browser as a 502.

## The checks, in the order CI runs them

| Command                 | What it proves                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`             | ESLint flat config over both packages, Vue templates included                                                         |
| `pnpm format:check`     | Prettier                                                                                                              |
| `pnpm typecheck`        | `tsc -b` on the server, then `vue-tsc -b` on the client through the project reference                                 |
| `pnpm test`             | vitest in both packages, no database needed                                                                           |
| `pnpm test:integration` | server specs against a throwaway database on the compose Postgres, see [testing.md](testing.md)                       |
| `pnpm test:e2e`         | Playwright: request a magic link, read it from Mailpit's API, follow it to the dashboard. Needs the compose services. |

A pre-commit hook (`simple-git-hooks` + `lint-staged`) runs ESLint and Prettier on
staged files; `pnpm install` installs it.

## Local error tracking is opt-in

`docker compose --profile glitchtip up -d` adds a GlitchTip (`glitchtip/glitchtip:6`, one
all-in-one container, no Valkey) and its own Postgres. The profile keeps
`docker compose up -d` at postgres and mailpit, and GlitchTip never shares the app
database, so `db:seed --reset` and the integration specs cannot touch it. Its mail goes to
Mailpit. It listens on `127.0.0.1:8100`; `GLITCHTIP_PORT` in the root `.env` moves it.

1. Open `http://localhost:8100`, register (the first user), create an organization and a
   project.
2. Copy the DSN from the project's Client Keys into `SENTRY_DSN` in `server/.env` and
   `VITE_SENTRY_DSN` in the client env. Set `SENTRY_ENVIRONMENT=local`.
3. Restart `pnpm dev`. Errors appear in the project's Issues list; what is sent and what
   alerts is in [error-reporting.md](error-reporting.md).

Its MCP server is on at `http://localhost:8100/mcp`, so an agent can read issues:
`claude mcp add --transport http glitchtip http://localhost:8100/mcp`, then sign in
through `/mcp`.

Alert rules are not set up locally. The DSN is generated by GlitchTip, so it cannot be
committed. If Compose reports a project name you do not recognise, set
`COMPOSE_PROJECT_NAME` in the root `.env` so the profile joins your running stack.

## Rehearsing a migration

`pnpm db:generate` after editing `db/schema/app.ts`, read the SQL under
`server/drizzle/`, then `pnpm db:migrate` against the compose database. Boot does the
same thing; see [database-and-migrations.md](database-and-migrations.md).

## Troubleshooting

| Symptom                                               | Cause                                                 | Fix                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Dashboard bounces back to login, no error             | cookie issued for the wrong origin                    | `PUBLIC_URL` must be the browser's origin; Vite proxy must keep `changeOrigin: false` |
| `Drizzle schema mismatch` at boot                     | `db/schema/auth.ts` out of date                       | `pnpm auth:schema`, then `pnpm db:generate`                                           |
| `Queue … does not exist`                              | worker registered before `createQueue`                | see [background-jobs.md](background-jobs.md)                                          |
| `AUTH_SECRET must be set in production` locally       | `NODE_ENV=production` leaked into the shell           | unset it; dev defaults only apply outside production                                  |
| `TS2339` in the client after a server change          | the contract is doing its job                         | fix the call site, see [type-contract.md](type-contract.md)                           |
| "Could not send magic link", 502 in the network tab   | the API is not on the port Vite proxies to            | check `PORT` in `server/.env` and that the server is running; see the Vite terminal   |
| Toasts render as plain text at the bottom of the page | `vue-sonner/style.css` not imported                   | it is imported in `client/src/main.ts`; keep it when touching the toaster             |
| 429 on sign-in against a production-mode server       | better-auth's magic-link limit, 5 an hour per address | wait, or `delete from rate_limit` on that database                                    |
