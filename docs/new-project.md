# Starting a new project

How a clone becomes a product: one command for identity and local configuration, one
check for everything that is still the starter's placeholder.

Code: `server/src/scripts/init-project.ts`, `server/src/scripts/check-ready.ts`,
`server/src/scripts/setup/project.ts` (`initProject`, `freePorts`, `renderBrand`),
`server/src/scripts/setup/readiness.ts` (`checkProject`, `checkProductionEnv`). Spec:
`server/src/__tests__/initProject.spec.ts`.

## `pnpm init-project` is the first command in a clone

```bash
git clone https://github.com/arnauddsj/quickstart-saas.git acme && cd acme
pnpm install
pnpm init-project --name "Acme" --support-email help@acme.io   # prompts for what is missing
docker compose up -d && pnpm dev
```

| Flag              | Default        | Writes                                               |
| ----------------- | -------------- | ---------------------------------------------------- |
| `--name`          | prompted       | `brand.name`; its slug names the Compose project     |
| `--support-email` | prompted       | `brand.supportEmail`                                 |
| `--accent`        | `#18181b`      | `brand.accentColor`                                  |
| `--workspace`     | `workspace`    | `brand.workspace.one`                                |
| `--workspaces`    | singular + `s` | `brand.workspace.many`                               |
| `--solo`          | off            | `brand.teams: false`, see [branding.md](branding.md) |
| `--force`         | off            | overwrite an initialized project                     |

It writes four files:

- **`server/src/config/brand.ts`** from the answers.
- **Root `.env`**: `COMPOSE_PROJECT_NAME` and `POSTGRES_DB` from the slug, so the clone
  gets its own containers and volume; the Postgres, Mailpit and Vite ports.
- **`server/.env`** from `server/.env.example`: a random 64-character `AUTH_SECRET`, the
  API `PORT`, and `DATABASE_URL`, `PUBLIC_URL`, `CORS_ORIGINS` and `SMTP_PORT` matching
  the root `.env`.
- **`.starter.json`**: the starter repository, the version from `CHANGELOG.md` and the
  commit the clone started from. Commit it; [starter-updates.md](starter-updates.md)
  reads it.

**Ports are chosen, not assumed.** Each default (3000, 5173, 5432, 1025, 8025) is tried
on `127.0.0.1` and the next free one is taken, so a second clone on the same laptop
starts next to the first instead of failing on a bound port.

**It refuses to run twice.** If the root `.env`, `server/.env` or `.starter.json` exists
it stops and changes nothing; `--force` replaces them all, including the secret, which
signs every local session out.

## `pnpm check-ready` lists what is still the starter's

It prints one line per item and exits 1 while any is left, so it can gate a first deploy.

| Id                     | Clears when                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `initialized`          | `server/.env` and `.starter.json` exist                                            |
| `brand.name`           | the name is not "Quickstart SaaS"                                                  |
| `brand.supportEmail`   | the address is not `@example.com`                                                  |
| `claude.statement`     | the product statement at the top of `CLAUDE.md` was rewritten                      |
| `readme.title`         | `README.md` is no longer titled "Quickstart SaaS"                                  |
| `reference.projects`   | `trpc/router/project.ts` is gone, see [reference-feature.md](reference-feature.md) |
| `analytics.activation` | `ACTIVATION_EVENT` is not `project.created`                                        |
| `plans.placeholders`   | the `exports` feature and `billing.exportData` are gone                            |
| `legal.entity`         | `legal.ts` names a real company, registration and contact                          |
| `legal.terms`          | `Terms.vue` no longer asks to be replaced                                          |

`pnpm check-ready --env <file>` also checks a production environment file: an `https`
`PUBLIC_URL`, a 32+ character `AUTH_SECRET`, a `POSTGRES_PASSWORD` that is not the
development default, a working email provider (Loops with a `magicLink` id, or SMTP with a
host other than Mailpit), real Stripe keys and price, and a `SENTRY_DSN`. Point it at the
file the host reads, or export the host's variables to one.

What it cannot check stays in [`.claude/TODO.md`](../.claude/TODO.md) section 1: the
Loops templates and the Stripe product exist on the providers' side, not in the repo.
