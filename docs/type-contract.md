# Type contract

The client typechecks against the server's router through a TypeScript project reference,
so a renamed procedure fails `pnpm typecheck` instead of a deploy.

Code: `server/src/trpc/router/index.ts` (`appRouter`, `AppRouter`), `server/package.json`
(`exports["./router"]`), `server/tsconfig.json` (`composite`), `client/tsconfig.app.json`
(`references`), `client/src/services/server.ts` (`trpc`, `useTRPCQuery`,
`useTRPCMutation`), `client/src/types/api.ts` (`RouterOutputs`).

## The client imports the server's type through a project reference

`client/src/services/server.ts` does `import type { AppRouter } from 'server/router'`.
`server` is a `workspace:*` devDependency whose `package.json` exports `./router` as a
types-only entry pointing at `src/trpc/router/index.ts`. `client/tsconfig.app.json` lists
`../server` under `references`, so `vue-tsc -b` builds the server declarations first when
they are stale. There is no "run the server build before the client typecheck" step to
forget, which is the trap a sibling project documents at length.

Vite never sees any of this: every import of `server/router` is `import type`, erased at
build. The client bundle contains no server code.

## Types are derived, never restated

`client/src/types/api.ts` exposes `RouterOutputs = inferRouterOutputs<AppRouter>` and
named aliases such as `Me = RouterOutputs['user']['me']`. A component that needs the
shape of a procedure's result reads it from there. Hand-writing an interface that
mirrors a server response is how a sibling project ended up with six drifting copies of
one type; the sixth was the one the deploy used.

## No `enum` crosses the boundary

Both sides use `as const` tuples with a companion type (`PLAN_NAMES`,
`ORG_ADMIN_ROLES`). A TypeScript `enum` in a shared type surfaces as a nominal type the
client cannot construct from a string, and zod's `z.enum` takes the tuple unchanged.

## There is no transformer, so dates are strings

The tRPC client and server run without a transformer. A `Date` on the server arrives as
an ISO string on the client, and the router makes that explicit by calling
`toISOString()` on every date it returns, so `RouterOutputs` says `string` and nobody is
surprised. Never put `z.date()` in an input schema; accept a string and parse it.

## The error is the contract working

A client call to a procedure that no longer exists fails with `TS2339: Property 'nope'
does not exist`. That error is correct. Do not stub `AppRouter` as `any` to make a build
green; a green build then proves nothing, and the first user to click the button finds
the missing procedure instead of CI.
