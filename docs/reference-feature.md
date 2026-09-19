# Reference feature: Projects

**Projects is a placeholder.** It exists so every new product starts from one complete,
tested, workspace-scoped feature instead of rebuilding the pattern. Rename it to the
product's first real entity (invoices, domains, clients...) or delete it. It must not
ship under its own name. The item in `.claude/TODO.md` stays open until that is done.

Code:

- server: `server/src/db/schema/app.ts` (`project`), `server/drizzle/0003_project-reference.sql`, `server/src/trpc/router/project.ts`, `server/src/config/plans.ts` (`limits.projects`, `assertWithinLimit`)
- client: `client/src/pages/Projects.vue`, `client/src/router/index.ts` (`projects`), `client/src/layouts/DefaultLayout.vue` (nav entry), `client/src/types/api.ts` (`Project`)

Specs: `server/src/__tests__/integration/projects.int.spec.ts`, `e2e/projects.spec.ts`.

## What it demonstrates

- **Workspace scoping.** Every row carries `organizationId` with `onDelete: 'cascade'`,
  so deleting a workspace deletes its projects. Every query filters by
  `ctx.organizationId` from `orgProcedure`. A project id from the client is always paired
  with that filter (`inOrg`), so a guessed id from another workspace is `NOT_FOUND`,
  never a leak.
- **Roles.** Members list, create and rename; `orgAdminProcedure` restricts delete to
  owners and admins.
- **Plan limits.** `create` counts existing rows and calls `assertWithinLimit` before the
  insert. `list` returns the limit so the page can show "2 of 3" and disable the button.
  The count and the insert are not atomic; two simultaneous creates can exceed the limit
  by one, which is accepted until a product needs a hard quota.
- **The page.** A loading skeleton, an empty state with a call to action, a table, one
  dialog for create and rename, a confirmation for delete, toasts, and cache
  invalidation on success.
- **Tests.** The integration spec proves isolation between workspaces, the role split and
  the limit. The e2e spec proves the page end to end.

## Renaming it

Do this before the first deploy, while `0003` has never run anywhere that matters:

1. Delete `server/drizzle/0003_project-reference.sql` and its entry in
   `server/drizzle/meta/_journal.json` and `0003_snapshot.json`.
2. Rename across the files above:
   - `project` to the new entity
   - `projectRouter` and the `project` router key
   - `Projects.vue`, the route, the nav label and icon
   - the `Project` type
   - the `projects` limit in `plans.ts`
3. Add the entity's real columns to the table and the zod inputs.
4. `pnpm db:generate` produces a fresh `0003` for the new table. Read it.
5. Update both specs, then run `pnpm typecheck`, which lists every call site the rename
   missed.

If the product needs no such entity, delete the same files, remove the router key, the
route and the nav entry, and drop the `projects` limit.
