# Admin area

Everything an operator needs to run the product without opening the database: who signed
up, who is active, and the levers on a single account.

Code: `server/src/services/admin.ts` (`roleForNewUser`, `adminStats`, `userActivity`,
`userOrganizations`, `recentSignups`), `server/src/trpc/router/admin.ts`,
`server/src/auth/index.ts` (`databaseHooks.user.create.before`),
`server/src/scripts/make-admin.ts`, `client/src/pages/admin/Dashboard.vue`,
`client/src/pages/admin/Users.vue`. Spec: `server/src/__tests__/adminRouter.spec.ts`.

## The first account to sign up is the admin

`databaseHooks.user.create.before` in `auth/index.ts` asks `roleForNewUser()`, which
returns `admin` when the `user` table is empty and `member` otherwise. The first person
through the magic link on a fresh database is therefore the operator, with no SQL and no
script. Every later account is a member until an admin promotes it from the Users page.

The honest caveat: two accounts created in the same instant on an empty table could both
count zero. On a brand-new deployment that window is yours alone; if it worries you, make
the first sign-in before sharing the URL. `pnpm make-admin <email>` remains as the fallback
for a database whose first user is gone.

## Activity is derived from sessions, not stored on the user

There is no `lastLoginAt` column to keep in sync. `userActivity` is a grouped subquery over
`session`: `lastLoginAt` is the newest `session.createdAt`, `lastActiveAt` the newest
`session.updatedAt` (better-auth refreshes it once a day while the person keeps using the
app, `session.updateAge`), `sessionCount` the number of live sessions. "Active in the last
7 days" in `adminStats` is `count(distinct user_id)` over sessions touched in that window.
When sessions expire (7 days) or are revoked, the person stops counting as active, which is
the honest reading.

`adminStats` also counts users created in the last 7 and 30 days, organizations, and
subscriptions whose plan is not `FREE` and whose status is `active`.

## Every user lever is a tRPC mutation on `adminProcedure`

| Procedure        | Does                                                                                                                                                            | Guard                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `setRole`        | `admin` or `member`                                                                                                                                             | cannot demote yourself                               |
| `setBanned`      | sets `banned`, `banReason`, and deletes the person's sessions so the ban applies now                                                                            | cannot ban yourself                                  |
| `setEmail`       | lowercases, writes the address with `emailVerified = false`, and sends a verification link to the **new** address through better-auth's `sendVerificationEmail` | refuses an address another account uses (`CONFLICT`) |
| `revokeSessions` | deletes every session row, signing the person out everywhere                                                                                                    | —                                                    |
| `removeUser`     | runs `cleanupBeforeUserDelete` (sole-owned organizations and their Stripe subscriptions), then deletes the row                                                  | cannot delete yourself                               |

`removeUser` used to call `db.delete(user)` directly, which left a sole-owned
organization and its paid Stripe subscription orphaned. It now takes the same path as
self-deletion in [account-lifecycle.md](account-lifecycle.md).

The routes use Drizzle rather than better-auth's own `/admin/*` endpoints so the admin
plugin's permission model is not a second thing to configure; the plugin is kept for the
`role` and `banned` columns and for refusing those fields on `update-user`.

## Revocation is immediate because the session cookie cache is off

better-auth can cache the session in a signed cookie (`session.cookieCache`) and skip the
database for a few minutes. With it on, `revokeSessions`, `setBanned` and `setRole` took
effect only when the cache expired: the pen test showed a revoked member still passing
`user.me` for up to five minutes. The cache is disabled in `auth/index.ts`, so every
request costs one indexed lookup on `session` and an admin action applies on the next
request. Do not turn it back on without accepting that delay; document the window if you do.

## The pages

`/admin` is the dashboard: the stats above and the eight most recent sign-ups with their
last login. `/admin/users` lists accounts with created, last login, last active, session
and organization counts, and the levers above behind confirmation dialogs.
`/admin/organizations` lists organizations. All three sit under `requiresAdmin` in the
router and every procedure is `adminProcedure`, so a member gets `FORBIDDEN` from the API
whatever the client shows.
