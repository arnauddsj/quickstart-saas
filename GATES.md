# Gates: starter additions (init, backup, updates, workspace controls, billing)

- [x] `pnpm init-project` writes brand, root .env, server/.env and .starter.json
      CHECK: `pnpm --filter server test -- initProject`
      EXPECT: brand.ts rewritten from answers; env files carry a random AUTH_SECRET, the project name and free ports; refuses to overwrite without --force
      EVIDENCE: initProject.spec 10/10 (brand escaping, env files, random secret, --force refusal, loopback-held port detected). Live: scratch clone init wrote 4 files, re-run refused, `--force` rewrote; API booted on the written env and the magic-link subject read "Sign in to Acme Labs". Found and fixed isPortFree reporting *:3001/5433/8026 as free
- [x] `pnpm check-ready` lists every leftover placeholder and exits 1 until none remain
      CHECK: unit spec on a fixture tree + run on this repo
      EXPECT: fresh starter reports each section-1 TODO item; a resolved fixture exits 0
      EVIDENCE: initProject.spec lists the 10 placeholders of a fresh tree; after init brand/initialized clear; --env spec flags all 6 prod checks. Live clone: 7 items left, exit 1
- [x] Backup, restore and a restore drill work against Compose Postgres
      CHECK: `pnpm db:backup`, then `pnpm db:restore-check <file>`
      EXPECT: dump written; drill restores into a throwaway DB, row counts match, DB dropped; --keep prunes older dumps
      EVIDENCE: dev DB via --container: 27 tables, drill ok, tampered sidecar → exit 1, scratch DB dropped, --keep 2 pruned the oldest. Clone via `docker compose exec`: 15 tables, drill ok. backup.spec 4/4
- [x] Starter update process is documented and traceable
      CHECK: CHANGELOG.md, docs/starter-updates.md, .starter.json written by init
      EXPECT: each release lists what clones must apply; doc gives the fetch/log/cherry-pick loop from the recorded commit
      EVIDENCE: CHANGELOG.md (2.0.0 to 2.3.0, Apply-to-existing sections), docs/starter-updates.md, .starter.json written with version 2.3.0 and commit; CLAUDE.md § Commits points at it
- [x] Workspace controls: rename, leave, transfer ownership, delete
      CHECK: integration specs through better-auth + component spec + e2e
      EXPECT: admins rename; sole owner cannot leave; transfer makes target owner and caller admin; delete cancels billing and lands on another workspace or onboarding
      EVIDENCE: workspaceControls.int.spec 5/5 (rename 403/200, sole owner cannot leave, transfer owner→admin, admin cannot take over or delete); Organization.spec 5/5; e2e workspace-settings: rename, disabled leave, delete after typing name → onboarding
- [x] Account sessions: list and sign out other devices
      CHECK: component spec + e2e
      EXPECT: current session marked; "sign out other sessions" leaves only the current one
      EVIDENCE: workspaceControls.int.spec: two sessions → revoke-other-sessions → one, the revoked cookie's get-session is null; Account.spec lists, marks This device, revokes one and others; e2e sees This device
- [x] Billing: pending confirmation, usage vs limits, past-due policy
      CHECK: integration + component specs
      EXPECT: return from checkout shows "confirming" until the plan changes; usage per limit shown; past_due keeps paid plan with a fix-payment banner
      EVIDENCE: billing.int.spec 17/17 (past_due keeps PRO, unpaid → FREE, usage projects 2 of 3); Billing.spec 6/6 (confirming banner without success toast, PRO announced after the poll, past-due alert with portal button, usage bar); analytics plan SQL counts past_due as paid, analytics.int green
- [x] Docs match the code; TODO section 1 points at init-project/check-ready
      CHECK: grep each new behaviour in docs/
      EXPECT: no contradiction
      EVIDENCE: new docs: new-project, backups, starter-updates, indexed; organizations, account-lifecycle, billing, development, README, CLAUDE.md, TODO updated; doc pointer grep prints nothing
- [x] Repo gates green
      CHECK: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration && pnpm test:e2e`
      EXPECT: all pass
      EVIDENCE: typecheck, lint, format clean; unit server 76 + client 52; integration 12 files / 85; e2e isolated (API 3016, Vite 5195, throwaway DB) 7 passed / 1 skipped

---

# Gates (open): error tracking (GlitchTip + Sentry SDKs + watchdog)

- [x] Server reports through Sentry; WARNING/INFO stay local
      CHECK: `pnpm --filter server test -- reportError`
      EXPECT: level mapping, WARNING/INFO not captured, never throws
      EVIDENCE: reportError.spec.ts 3/3 pass (server unit 13 files / 55 tests green)
- [x] Scrubbing removes secrets (server + client)
      CHECK: `pnpm --filter server test -- scrub && pnpm --filter client test -- scrub`
      EXPECT: cookies, auth headers, `?token=`, email, secret-named context keys absent
      EVIDENCE: scrub.spec.ts passes in both packages; live event from a real server had only
      user-agent + x-action-id headers, and `?token=SHOULD_NOT_LEAK` appeared 0 times
- [x] Watchdog latches one alert and one recovery
      CHECK: `pnpm --filter server test -- watchdog`, then stop a disposable postgres under a running server
      EXPECT: 2-failure threshold, single outage + recovery, heartbeat staleness
      EVIDENCE: watchdog.spec.ts 6/6 pass. Live check: postgres:17 on 5434 stopped 23:41:20 gave one
      `fatal` "Database unavailable" with fingerprint [watchdog.db, 1789767739189] by 23:43:19. Restarting it
      at 23:43:28 gave one `info` "Database recovered" with the same outage start and nothing more
      in the next 65 s
- [x] Per-request isolation: user/org/request id per event
      CHECK: `pnpm --filter server test -- monitoring`
      EXPECT: concurrent requests carry their own user and request_id
      EVIDENCE: monitoring.spec.ts passes over a real HTTP listener with interleaved requests
- [x] Client: server INTERNAL errors are breadcrumbs, others captured
      CHECK: `pnpm --filter client test -- monitoring`
      EXPECT: pass
      EVIDENCE: monitoring.spec.ts 4/4 pass (client unit 10 files / 38 tests green)
- [x] error_log removed; migration is a lone DROP TABLE
      CHECK: `cat server/drizzle/0002_*.sql`
      EXPECT: `DROP TABLE "error_log"`; no stale references
      EVIDENCE: `DROP TABLE "error_log" CASCADE;` (nothing references it); grep of src/docs clean;
      integration suite applies it on a fresh DB (6 files / 38 tests green)
- [x] Production client build ships no source maps
      CHECK: `pnpm --filter client build && find client/dist -name '*.map'`
      EXPECT: no output
      EVIDENCE: 0 map files; the Dockerfile also fails the build if any remain
- [x] Repo gates green
      CHECK: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration && pnpm test:e2e`
      EXPECT: all pass
      EVIDENCE: all green; e2e ran on an isolated stack (API 3006, Vite 5175, throwaway DB): 4 passed,
      1 skipped (consent spec's own skip)
- [x] Docker images build
      CHECK: `docker build -f server/Dockerfile . && docker build -f client/Dockerfile .`
      EXPECT: success
      EVIDENCE: 2026-09-19 both images built by the local production recipe; stack answered
      /health/ready 200 and delivered a magic link through nginx
- [x] Real events reach a local GlitchTip (partly manual)
      CHECK: `docker compose --profile glitchtip up -d`, create a project, send an event with the server SDK
      EXPECT: UI answers on :8100; the event appears as an issue in that project
      EVIDENCE: 2026-09-19 glitchtip/glitchtip:6 pulled and running next to the dev stack;
      /api/0/ returned 200; a throwaway org and project (deleted afterwards) received an
      `@sentry/node` event with fingerprint trpc.verify, listed as one issue with 1 event.
      Not verified: alert delivery to Discord and email, and the uptime monitor

# Gates: dev seed (`pnpm db:seed`)

- [x] Seed fills every feature's tables and respects plan limits and solo mode
      CHECK: `pnpm test:integration -- seed`
      EXPECT: known users exist, admin is admin, every user has a membership, FREE org ≤ FREE project limit, Acme PRO/active; solo mode gives one org per user and no invitations; second run without --reset refuses
      EVIDENCE: seed.int.spec 3/3: known users, admin role, membership per user, FREE < limit, Acme PRO/active, 1 invitation, unread notifications, one session per user, usage_event = projects; solo → one org per user, 0 invitations; second run throws SeedRefused, --reset reseeds
- [x] CLI guards and summary
      CHECK: `pnpm db:seed` on a non-empty DB, then `pnpm db:seed --reset`
      EXPECT: first exits 1 with a message; second prints accounts and row counts per seeder
      EVIDENCE: on the dev DB (backed up first to backups/quickstart-20260919-100551.dump): without --reset → "the database already has users", exit 1; --reset → users 15, organizations 20, projects 10, notifications 73, activity 318, plus the three sign-in emails
- [x] The app works on seeded data as a user runs it
      CHECK: plain `pnpm dev`, sign in as admin@example.com and owner@example.com through Mailpit
      EXPECT: no onboarding; projects listed; bell shows unread; Billing PRO; members + invitation; admin charts non-empty; FREE org shows 2 of 3 projects
      EVIDENCE: Playwright on the running app (:5174), magic links from Mailpit: admin lands on / without onboarding, Projects 8 of 100, bell 2 unread, Billing PRO renews 10/19/2026, Workspace lists 10 members + pending invitation, admin overview 15 users/2 workspaces/1 paid, analytics filled (stickiness 33%, activation 8%); owner lands on /, Projects 2 of 3, Billing FREE
- [x] Quality gates
      CHECK: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`
      EXPECT: all pass
      EVIDENCE: typecheck, lint, format:check pass; pnpm test server 76/76, client 52/52; test:integration 13 files, 88/88

# Gates: local GlitchTip profile

- [x] Default compose is unchanged
      CHECK: `docker compose config --services`
      EXPECT: postgres, mailpit only
      EVIDENCE: prints mailpit, postgres; the profile adds glitchtip-postgres and glitchtip
- [x] Profile runs and ingests
      CHECK: see the error-tracking gate above
      EXPECT: issue listed
      EVIDENCE: as above
- [x] Docs and formatting pass
      CHECK: `pnpm format:check`
      EXPECT: clean
      EVIDENCE: prettier --check: all files formatted
