# Documentation

**`docs/` is how the app works.** Reference documentation, kept current.

It is deliberately separate from:

- **[`.claude/TODO.md`](../.claude/TODO.md)** — work that is _not done_. Check it before
  assuming an oddity is new.
- **Root [`CLAUDE.md`](../CLAUDE.md)** — the rules an agent must know _without being told
  to look_, plus the comment policy these docs exist to serve.
- **[`.claude/audits/`](../.claude/audits/README.md)** — dated adversarial audits of one
  subsystem each. Findings that survive become docs or TODO items; the audit stays as record.

## Server

| Doc                                                      | What it answers                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration.md](configuration.md)                     | Every environment variable, which ones have dev defaults that throw in production, and why `PUBLIC_URL` is one variable and not three |
| [auth.md](auth.md)                                       | How a magic link becomes a session cookie, why the proxy must not rewrite `Host`, and what each tRPC procedure tier guarantees        |
| [admin.md](admin.md)                                     | Why the first account is the admin, how activity is derived from sessions, and what each admin lever does                             |
| [organizations.md](organizations.md)                     | Where the active organization lives, how the first one is created, and why every org-scoped query goes through `orgProcedure`         |
| [branding.md](branding.md)                               | Where the product is named, what users call a workspace, and how `teams: false` hides workspaces without removing them                |
| [reference-feature.md](reference-feature.md)             | The Projects placeholder: the workspace-scoped, plan-limited pattern it demonstrates and how to rename it on day one                  |
| [database-and-migrations.md](database-and-migrations.md) | Which schema file is generated and which is hand-written, and the generate → review → commit → boot-applies loop                      |
| [background-jobs.md](background-jobs.md)                 | One pg-boss instance, why `createQueue` must precede `work`, and how to add a job                                                     |
| [email.md](email.md)                                     | Which provider sends, chosen by `EMAIL_PROVIDER` alone, and how tests read mail back from Mailpit                                     |
| [notifications.md](notifications.md)                     | How a server call becomes a row in the bell, how rows are scoped to a user and workspace, and how long they live                      |
| [billing.md](billing.md)                                 | Plans as the single source of limits, `planGuard` before premium work, and how a Stripe price id becomes a plan on an organization    |
| [error-reporting.md](error-reporting.md)                 | What reaches GlitchTip and alerts, how user, org, request and action ids are attached, and how the watchdog reports outages once      |

## Client

| Doc                                  | What it answers                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [consent.md](consent.md)             | Why no analytics script exists before consent, where the choice is stored, and which pages the banner promises                 |
| [type-contract.md](type-contract.md) | How the client typechecks against `AppRouter` without a manual server build, and the three rules that keep the contract honest |

## Operational

| Doc                              | What it answers                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [development.md](development.md) | Running it locally, what `docker compose up` does and does not start, and the port-collision trap                       |
| [deployment.md](deployment.md)   | What happens on container start, the shutdown budget, health tiers, and the Coolify settings that live outside the repo |
| [testing.md](testing.md)         | What each test layer proves, how the integration database is created and reset, and which kind of spec a change needs   |

## Adding a doc

These files exist because [`CLAUDE.md` § Comments](../CLAUDE.md) forbids long explanatory
comments in code. When you extract one:

1. **Check whether a doc already covers the topic**, and extend it rather than adding a
   near-duplicate. Two docs on one subject is how a doc folder becomes unusable.
2. **Check the existing doc is not stale before building on it.** Spot-check its claims
   against the code — do the symbols it names still exist? Rewrite rather than append to
   something already wrong.
3. Name the file for the _question it answers_, kebab-case.
4. Add a row above, and add a one-line pointer at the **top** of each file the doc
   governs — `// docs/<name>.md`, nothing else. Not at each call site; not repeated
   wherever the rule bites.

Header pointers hard-code these filenames. **Renaming a doc breaks every pointer to it**,
and nothing will fail the build. If you rename one, grep for it:

```bash
grep -rn 'docs/<old-name>\.md' server/src client/src client/*.template server/Dockerfile client/Dockerfile docker-compose*.yaml
```

## Freshness

Docs drift. When one turns out to be wrong, fix it in place rather than working around it
— a doc that lies is worse than no doc, because it is trusted. Prefer naming files,
symbols and invariants (greppable, and their absence is detectable) over line numbers
(always wrong within a month).

Two greps keep the index honest; both must print nothing:

```bash
# every pointer in source resolves to a doc
grep -rhoE 'docs/[a-z-]+\.md' server/src client/src | sort -u | while read d; do [ -e "$d" ] || echo "BROKEN $d"; done
# every doc in the index has at least one inbound pointer or is operational
for f in docs/*.md; do n=$(basename $f); [ "$n" = README.md ] && continue; grep -rq "docs/$n" server client docker-compose*.yaml .github || echo "ORPHAN $n"; done
```
