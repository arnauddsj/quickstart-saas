# Configuration

Every variable is validated once, at import time, and a bad one refuses to boot instead of
surfacing later as an empty credential.

Code: `server/src/config/env.ts` (`parseEnv`, `env`, `IS_PROD`), `server/.env.example`,
`docker-compose.prod.yaml`. Spec: `server/src/__tests__/env.spec.ts`.

## Validation happens at import, not at first use

`config/env.ts` parses `process.env` with a zod schema the moment any module imports it.
A missing or malformed variable throws with `z.prettifyError` output naming the field.
This is deliberate: the previous template read `MAILHOG_HOST` and friends lazily, and a
typo produced a connection refused deep inside a request instead of a refusal at boot.

`parseEnv(source)` takes an explicit object so specs can exercise the rules without
touching `process.env`; `vitest.config.ts` still sets the minimum so importing any module
that reaches `env` does not throw.

## Dev defaults throw in production

**A default is only a default when `NODE_ENV` is not `production`.** `AUTH_SECRET`,
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` use `devDefault()`, which returns the
placeholder locally and throws `X must be set in production` otherwise. Two extra checks
run after parsing: `COOKIE_SECURE` must be true in production unless `PUBLIC_URL` is plain
`http://localhost`, and `EMAIL_PROVIDER=loops` needs both Loops ids. `.env.example` marks these REQUIRED, and `docker-compose.prod.yaml`
uses `${VAR:?message}` so Compose fails by name before a container even starts.

## An empty string is unset

Compose passes `${SENTRY_DSN:-}` as an empty string when the host does not set
it, and `z.url().optional()` rejects `""`. `parseEnv` therefore maps every empty value to
`undefined` before validation, so an optional variable left blank in Coolify or in
`.env` behaves as absent. The production stack refused to boot on exactly this before the
mapping existed.

## Booleans are parsed with `z.stringbool`

The old schema used `z.coerce.boolean()`, which turns the string `"false"` into `true`
because a non-empty string is truthy. `COOKIE_SECURE=false` therefore became secure
cookies on plain-HTTP localhost, and the "must be true in production" guard could never
fail. `z.stringbool()` understands `true/false/1/0/yes/no`. Use it for every boolean.

## `PUBLIC_URL` is the only origin

| Variable       | Used by                                                                      | Why it is the same value                                                                                                        |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`   | better-auth `baseURL`, magic-link URLs, Stripe return URLs, invitation links | Browsers only ever talk to one origin: Vite on 5173 in dev, nginx in production. Both proxy `/api/auth` and `/trpc` to the API. |
| `CORS_ORIGINS` | `@fastify/cors`, better-auth `trustedOrigins`                                | Defaults to the same origin; comma-separated when a second front end exists.                                                    |

If `PUBLIC_URL` is wrong, login appears to work: the magic link arrives, the API sets a
cookie, and the cookie lands on a host the browser never visits.

## The full list

| Variable                                     | Default                                  | Notes                                                                                              |
| -------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                   | `development`                            | `production` flips every rule above.                                                               |
| `PORT`                                       | `3000`                                   |                                                                                                    |
| `DATABASE_URL`                               | none, required                           | pg connection string; also read by `drizzle.config.ts`.                                            |
| `PUBLIC_URL`                                 | `http://localhost:5173`                  | See above.                                                                                         |
| `CORS_ORIGINS`                               | `http://localhost:5173`                  | Split on commas, trimmed.                                                                          |
| `AUTH_SECRET`                                | dev placeholder                          | 32+ chars. Rotating it signs everyone out.                                                         |
| `COOKIE_SECURE`                              | `false`                                  | Must be `true` in production.                                                                      |
| `EMAIL_PROVIDER`                             | `smtp`                                   | `smtp` or `loops`; no fallback between them, see [email.md](email.md).                             |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`       | `noreply@localhost`, `localhost`, `1025` | Mailpit locally.                                                                                   |
| `LOOPS_API_KEY`, `LOOPS_TEMPLATE_IDS`        | unset                                    | Required when `EMAIL_PROVIDER=loops`; ids as `magicLink=…,invitation=…`, see [email.md](email.md). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | dev placeholders                         | See [billing.md](billing.md).                                                                      |
| `STRIPE_PRICE_PRO_MONTHLY`                   | placeholder id                           | Not a secret; maps to `PLANS.PRO`.                                                                 |
| `SENTRY_DSN`                                 | unset                                    | GlitchTip project DSN; unset sends nothing. See [error-reporting.md](error-reporting.md).          |
| `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`       | `NODE_ENV`, unset                        | Compose sets the release from `SOURCE_COMMIT`.                                                     |
| `LOG_LEVEL`                                  | `debug` locally, `info` in production    | pino level.                                                                                        |

## Local overrides live in two `.env` files

`server/.env` is read by `node --env-file-if-exists` for `pnpm dev`, `db:migrate` and
`make-admin`. The root `.env` is read by Docker Compose only, for `${POSTGRES_PORT}`,
`${MAILPIT_SMTP_PORT}` and `${MAILPIT_UI_PORT}` when the default ports are taken, and for
the production overlay's secrets. Neither is committed; `server/.env.example` is.
