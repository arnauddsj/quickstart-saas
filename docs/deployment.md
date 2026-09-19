# Deployment

What happens on container start, how long shutdown may take, which health endpoint the
platform should poll, and the settings that live in Coolify rather than in the repo.

Code: `server/Dockerfile`, `client/Dockerfile`, `client/nginx.conf.template`,
`docker-compose.prod.yaml`, `server/src/index.ts`, `server/src/app.ts`,
`server/src/routes/health.ts`, `.github/workflows/ci.yml`.

## Both images build from the repository root

`docker build -f server/Dockerfile .` and `docker build -f client/Dockerfile .` need the
root as context because the workspace lockfile and `tsconfig.base.json` live there. The
server image is two stages: install and `tsc -b`, then `pnpm deploy --prod` into a pruned
tree copied onto `node:24-alpine` as the unprivileged `node` user. `drizzle/` is copied
next to `dist/` because boot applies migrations from it.

The client image copies `server/src` and `server/tsconfig.json` into the build stage so
`vue-tsc -b` runs inside the image. **A green client image therefore proves the type
contract**, unlike a sibling project whose image skips typechecking and whose author had
to write a warning not to stub `AppRouter = any`.

## nginx serves the SPA and proxies the API

`nginx.conf.template` is rendered by the nginx image's `envsubst` at start with
`API_UPSTREAM` (default `server:3000`). `NGINX_ENVSUBST_FILTER=API_UPSTREAM` limits
substitution to that one name; without it `$host` and `$uri` are blanked and the SPA
fallback silently breaks. `/trpc/`, `/api/auth/`, `/webhooks/` and `/health/` are proxied
with `Host $host` preserved so better-auth issues cookies for the public origin.

**nginx owns the client address.** `set_real_ip_from` trusts `X-Forwarded-For` only from
private networks (the platform proxy in front of the container), `real_ip_recursive`
walks past those hops, and the API is sent a single `X-Forwarded-For: $remote_addr`.
Before this, nginx appended the client's own header (`$proxy_add_x_forwarded_for`) and
both Fastify and better-auth read the first entry, so a request with
`X-Forwarded-For: 10.0.0.1` reset the magic-link rate limit at will. The API side is
`TRUST_PROXY` (default `loopback,uniquelocal`), which only honours forwarded headers
from private addresses; the server port must never be published directly.

**nginx also sets the browser security headers** for the SPA: `X-Frame-Options DENY`,
`X-Content-Type-Options nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a
`Content-Security-Policy` with `script-src 'self'`, `connect-src 'self'` and
`frame-ancestors 'none'`. Helmet only covers API responses; `index.html` had no
headers at all until these were added. `style-src` allows `'unsafe-inline'` because Vue
and reka-ui set inline styles. A script or image host added to the app must be added to
the policy in `nginx.conf.template`, or it is blocked silently in production only.
`GLITCHTIP_ORIGIN` is substituted into `connect-src` in both copies of the policy (the
`/index.html` block repeats every header because nginx drops inherited `add_header`s);
without it the browser SDK's requests are blocked.

## The production overlay publishes only the client

`docker-compose.prod.yaml` reuses the development file's `postgres` and adds the images.
It removes Postgres's host port (`ports: !reset []`), so the database is reachable only on
the Compose network, and it requires `POSTGRES_PASSWORD`: the development default,
`quickstart`, is public. Mailpit starts only under the `local-mail` profile, and the server
gets no `SMTP_HOST` default, so production mail goes through Loops or a real relay.
Docker's published ports bypass host firewalls such as ufw, which is why a firewall is not
the fix.

`POSTGRES_PASSWORD` sets the password only when the volume is first created. An
installation that ran on the old default keeps it: set `POSTGRES_PASSWORD=quickstart`
to boot, then change it with `ALTER USER` and update the variable.

**The Compose project, and so the volume, is named after the directory.** The files used
to fix `name: quickstart` and the volume name `quickstart_postgres_data`, so two products
on one host shared a database. An installation created before that change keeps its data
by setting `COMPOSE_PROJECT_NAME=quickstart`; without it Compose creates a new, empty
volume.

## Boot order is migrate, jobs, listen

`index.ts` runs `runMigrations()`, then `startBoss()`, then `app.listen()`, then starts
the watchdog. `instrument.ts` is loaded before all of it by `node --import`. A migration
failure exits before the port opens; the platform sees a container that never becomes
healthy, not an error page. Read the log for `migration failed`.

## Health has two tiers

| Path            | Checks                       | Poll it from                                      |
| --------------- | ---------------------------- | ------------------------------------------------- |
| `/health/ready` | `select 1`                   | the Docker `HEALTHCHECK`, Coolify, load balancers |
| `/health`       | database and pg-boss started | dashboards and humans                             |

`/health/ready` deliberately ignores pg-boss so a slow worker start does not delay
traffic; `/health` returns 503 with a `checks` object when either is down.

## Shutdown fits inside Docker's 10 seconds

On `SIGTERM` the server closes Fastify, stops pg-boss with a 5-second graceful timeout,
ends the pool and exits 0. A hard `process.exit(1)` fires after 8 seconds so the sequence
always finishes under the 10-second stop grace period Coolify does not let you raise.
`docker-compose.prod.yaml` sets `stop_grace_period: 10s` to match.

## Running the production stack locally

```bash
PUBLIC_URL=http://localhost:8080 CLIENT_PORT=8080 AUTH_SECRET=$(openssl rand -hex 32) \
STRIPE_SECRET_KEY=sk_test_x STRIPE_WEBHOOK_SECRET=whsec_x COOKIE_SECURE=false \
POSTGRES_PASSWORD=local SMTP_HOST=mailpit \
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml --profile local-mail up -d --build
curl -s localhost:8080/health/ready
```

`CLIENT_PORT` defaults to 80; the recipe uses 8080 because 80 is usually taken on a
laptop. `--profile local-mail` with `SMTP_HOST=mailpit` brings Mailpit back so the magic
link can be read locally.

`COOKIE_SECURE=false` is accepted in production only because `PUBLIC_URL` is plain
`http://localhost`; `parseEnv` refuses it for any other origin. Behind Coolify's proxy
with HTTPS it must be `true`. The server trusts `X-Forwarded-Proto` and `X-Forwarded-For`
only from peers matching `TRUST_PROXY`; the default covers the nginx container on the
Compose network.

## Error tracking lives in GlitchTip

GlitchTip runs outside this repo on shared infrastructure, on a different host from the
apps, so that it can report an app host going away. Per app:

1. **Project.** Create one GlitchTip project for client and server together. Set
   `SENTRY_DSN` on the server service and `VITE_SENTRY_DSN` as a client build variable,
   both to its DSN. Set `SENTRY_ENVIRONMENT` per deployment.
2. **Retention.** Set the event retention to match `errorTracking.retentionDays` in
   `client/src/data/legal.ts` (default 90), because the privacy page promises it.
3. **Alerts.** Add an alert rule on new issues with two recipients: a Discord webhook
   and email.
4. **Uptime.** Add an uptime monitor on `https://<public host>/health/ready`, alerting to
   the same recipients.
5. **Browser access.**
   - Set `GLITCHTIP_ORIGIN` (e.g. `https://glitchtip.example.com`) on the client service
     for the CSP.
   - Set `VITE_GLITCHTIP_URL` to the project's issue list for the admin link.
6. **Source maps.**
   - Create an auth token with `project:releases`.
   - Set `SENTRY_URL`, `SENTRY_ORG` and `SENTRY_PROJECT` as client build variables.
   - Provide `SENTRY_AUTH_TOKEN` as a Docker build secret; Compose reads it from the
     environment.

   With the token set, Vite emits hidden source maps. `@sentry/vite-plugin` uploads them
   tagged with the release and deletes them. The Dockerfile then fails the build if any
   `.map` is left, so maps never ship in the nginx image. Without the token, no maps are
   generated.

The release is `SOURCE_COMMIT`, which Coolify provides. It becomes `VITE_SENTRY_RELEASE`
in the client build and `SENTRY_RELEASE` on the server. The server needs no upload:
`tsc` emits source maps next to `dist/` and node runs with `--enable-source-maps`.

## What lives in Coolify, not in the repo

- The environment variables marked REQUIRED in `server/.env.example`.
- The health check path: `/health/ready` on port 3000 for the server service.
- A Stripe webhook endpoint pointing at `https://<public host>/webhooks/stripe`.
- The GlitchTip variables and build secret above.
- Scheduled tasks, if any; the template needs none because pg-boss schedules in-process.

CI (`.github/workflows/ci.yml`) builds both images on every push to prove they build; it
does not deploy. Coolify deploys from git push.
