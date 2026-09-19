# Quickstart SaaS

A starter for a SaaS product: passwordless sign-in, organizations with invitations, an
admin area, Stripe plans, background jobs, transactional email, and the documentation
system that keeps an AI-driven codebase honest. Vue 3 client, Fastify + tRPC server,
Postgres.

## Quick start

```bash
nvm use                               # Node 24
corepack enable && pnpm install
cp server/.env.example server/.env
docker compose up -d                  # postgres + mailpit
pnpm dev
```

- App: http://localhost:5173
- API: http://localhost:3000 (`/health`)
- Mail: http://localhost:8025 (every magic link lands here)

The first account to sign in becomes the admin (`/admin`). Fallback: `pnpm make-admin you@example.com`.

## Production

Two images built from the repository root, orchestrated by
`docker-compose.prod.yaml` or Coolify:

```bash
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```

Required variables are listed in `server/.env.example`, plus `POSTGRES_PASSWORD`; Compose
refuses to start without them. Only the client port is published; see
[`docs/deployment.md`](docs/deployment.md).

## Where things are explained

- [`CLAUDE.md`](CLAUDE.md): the rules to know before touching anything, for humans and
  agents alike.
- [`docs/`](docs/README.md): how each part works and why it is shaped that way.
- [`.claude/TODO.md`](.claude/TODO.md): what is not done yet.
