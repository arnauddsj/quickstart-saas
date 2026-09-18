# Authentication

No passwords anywhere: a magic link becomes a session cookie, better-auth owns every
table involved, and the only hand-written parts are the Fastify bridge and the tRPC tiers.

Code: `server/src/auth/index.ts` (`auth`, `emailProvider`), `auth/fastify.ts`
(`registerAuthRoutes`), `trpc/index.ts` (`createContext`, `protectedProcedure`,
`adminProcedure`, `orgProcedure`, `orgAdminProcedure`), `scripts/make-admin.ts`,
`client/src/lib/auth.ts`, `client/src/router/index.ts`. Spec:
`server/src/__tests__/procedures.spec.ts`.

## The flow

1. The client calls `authClient.signIn.magicLink({ email, callbackURL: '/auth/callback' })`,
   which POSTs to `/api/auth/sign-in/magic-link` through the Vite or nginx proxy.
2. better-auth stores a 15-minute token (`verification` table) and calls
   `sendMagicLink` from `auth/index.ts`, which hands the URL to the `EmailProvider`.
3. Clicking the link hits `/api/auth/magic-link/verify?token=…` on `PUBLIC_URL`. A new
   user is created on first click (`disableSignUp` is off), a `session` row is written
   and the `better-auth.session_token` cookie is set for 7 days, refreshed daily.
4. The browser lands on `/auth/callback`, which reads the session and redirects.

**The previous template's magic link was the session token.** The same JWT was emailed and
then set as the cookie, valid for seven days and never consumed. That is the bug this
replaces; do not reintroduce a hand-rolled token.

## `baseURL` is `PUBLIC_URL`, and the proxy must not rewrite `Host`

better-auth builds the magic link from `baseURL` and issues the cookie for the request's
origin. Both must be the origin the browser uses, which is Vite on 5173 in development
and nginx in production, never the API's own port. The Vite proxy therefore runs with
`changeOrigin: false` and `nginx.conf.template` sets `proxy_set_header Host $host`. With
`changeOrigin: true` the cookie is issued for `localhost:3000` and the dashboard bounces
back to login forever with no error anywhere.

## The Fastify bridge forwards every `set-cookie`

`registerAuthRoutes` mounts one catch-all route on `/api/auth/*`, rebuilds a web `Request`
(Fastify has already parsed the JSON body, so it is re-serialised) and forwards
`auth.handler()`'s response. `reply.header(key, value)` overwrites, and better-auth sets
several cookies on sign-in, so `set-cookie` is copied with `getSetCookie()` as an array.
Collapsing it to one header loses the session on the first login.

## Rate limits live in better-auth, not in Fastify

`@fastify/rate-limit` guards the whole API at 300 requests a minute per IP. better-auth
adds its own window on `/api/auth/*` (30 a minute) with a custom rule of 5 an hour on
`/sign-in/magic-link`, stored in the `rate_limit` table so it survives restarts and
scales past one process. The old home-grown limiter counted nothing and failed open.

**`/get-session` is exempt, because the router guard calls it on every navigation.** With
it inside the 30-a-minute window, an ordinary user clicking through a dozen pages hit
429, the guard read that as "no session", and they were bounced to the sign-in page as if
logged out; an office behind one NAT address would have hit it together. The exemption
is `customRules['/get-session']: false` in `auth/index.ts`; the check is one indexed
lookup and signs nobody in, so there is nothing to brute-force.

**better-auth's limits run in production only** (`enabled: IS_PROD`). In development
every request comes from `127.0.0.1`, so five magic links locked the developer out for an
hour. `rateLimit.int.spec.ts` runs with production settings to keep both rules tested.

Both key on the client address, and both read `X-Forwarded-For`. That address is only as
trustworthy as the proxy that set it: see the `real_ip` and `TRUST_PROXY` rules in
[deployment.md](deployment.md#nginx-serves-the-spa-and-proxies-the-api).

## A failed session check is not "signed out"

`authClient.getSession()` returns `{ data, error }`. `data: null` with no error means there
is no session and the guard sends the visitor to sign in. An `error` (429, 502, the API
down) means the check failed, and the guard keeps the user where they are with a
"Could not reach the server" toast. `AuthCallback.vue` makes the same distinction for its
message. Treating both as "no session" is what turned a rate limit into a fake logout;
any new code that reads the session must keep the two apart.

`AuthCallback.vue` only follows a `redirect` that starts with a single `/`, so a crafted
link cannot send someone to another site after they sign in.

## tRPC mutations check `Origin` themselves

better-auth rejects state changes whose `Origin` is missing or not in `trustedOrigins`.
tRPC has no such check, and relies on `SameSite=Lax` plus the CORS preflight that a JSON
body triggers. `app.ts` adds the same rule for every non-GET request under `/trpc/`: an
`Origin` header that is present and not in `CORS_ORIGINS` is answered 403 before the
procedure runs. Requests without an `Origin` (curl, server-to-server) pass, because
browsers always send one on cross-site POSTs.

## What each procedure tier guarantees

| Procedure            | Adds to `ctx`                              | Rejects with                                                                             |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `publicProcedure`    | `user` and `session`, both possibly `null` | nothing                                                                                  |
| `protectedProcedure` | non-null `user` and `session`              | `UNAUTHORIZED` when anonymous, `FORBIDDEN` when `user.banned`                            |
| `adminProcedure`     | —                                          | `FORBIDDEN` unless `user.role === 'admin'`                                               |
| `orgProcedure`       | `organizationId`, `membership`             | `PRECONDITION_FAILED` without an active organization, `FORBIDDEN` without a `member` row |
| `orgAdminProcedure`  | —                                          | `FORBIDDEN` unless `membership.role` is `owner` or `admin`                               |

`createContext` calls `auth.api.getSession` once per request with the raw headers, and it
hits the database every time: the cookie cache is off so bans and revocations apply on
the next request (see [admin.md](admin.md)).

**App admin and organization admin are different roles.** `user.role` comes from the
better-auth admin plugin and gates `/admin/*`; `member.role` comes from the organization
plugin and gates organization settings. An app admin is not automatically a member of
anything.

## The first account is the admin

The first user created on an empty database gets `role = 'admin'` from a better-auth
database hook; everyone after is a member. `pnpm make-admin you@example.com` remains as a
fallback. Details in [admin.md](admin.md).
