# Reference feature: Projects

**Projects is a placeholder.** It exists so every new product starts from one complete,
tested, workspace-scoped feature instead of rebuilding the pattern. Rename it to the
product's first real entity (invoices, domains, clients...) or delete it. It must not
ship under its own name. The item in `.claude/TODO.md` stays open until that is done.

Code:

- server: `server/src/db/schema/app.ts` (`project`), `server/drizzle/0003_project-reference.sql` and `0005_project-created-by.sql`, `server/src/trpc/router/project.ts`, `server/src/config/plans.ts` (`limits.projects`, `assertWithinLimit`)
- client: `client/src/pages/Projects.vue`, `client/src/router/index.ts` (`projects`), `client/src/layouts/DefaultLayout.vue` (nav entry), `client/src/types/api.ts` (`Project`)

Specs: `server/src/__tests__/integration/projects.int.spec.ts`, `e2e/projects.spec.ts`.

## What it demonstrates

- **Workspace scoping.** Every row carries `organizationId` with `onDelete: 'cascade'`,
  so deleting a workspace deletes its projects. Every query filters by
  `ctx.organizationId` from `orgProcedure`. A project id from the client is always paired
  with that filter (`inOrg`), so a guessed id from another workspace is `NOT_FOUND`,
  never a leak.
- **Authorship.** `createdById` records who created the row, with `onDelete: 'set null'`:
  the row belongs to the workspace and outlives its author, and the page then shows
  "Former member". Keep this column on the renamed entity; admin analytics count creations
  by it.
- **Roles.** Members list, create and rename; `orgAdminProcedure` restricts delete to
  owners and admins.
- **Plan limits.** `create` opens a transaction, locks the workspace's `subscription` row
  (`SELECT … FOR UPDATE`), counts, calls `assertWithinLimit` and inserts. The lock makes
  concurrent creates in one workspace take turns; without it eight simultaneous requests
  each counted two rows and all passed a limit of three. A transaction alone does not
  help at `READ COMMITTED`. Copy the lock with the check for any limited resource.
  `list` returns the limit so the page can show "2 of 3" and disable the button.
- **The page.** A loading skeleton, an empty state with a call to action, a table, one
  dialog for create and rename, a confirmation for delete, toasts, and cache
  invalidation on success.
- **A notification.** `create` tells the other members with `notifyWorkspace` after the
  transaction commits, and reports a failure instead of throwing it; see
  [notifications.md](notifications.md).
- **Tests.** The integration spec proves isolation between workspaces, the role split and
  the limit. The e2e spec proves the page end to end.

## Renaming it

Keep the existing migrations: later ones such as `0004_notifications` build on their
snapshots, so deleting `0003` or `0005` breaks the chain. Rename through a new migration
instead.

1. Rename across the files above:
   - `project` to the new entity
   - `projectRouter` and the `project` router key
   - `Projects.vue`, the route, the nav label and icon
   - the `Project` type
   - the `projects` limit in `plans.ts`
2. Rename or drop the `project.created` notification and `track` event in `create`, set
   `ACTIVATION_EVENT` in `services/analytics.ts` to the product's key action, and rename
   the `projects` entry in `usageCounters`.
3. Add the entity's real columns to the table and the zod inputs.
4. Run `pnpm db:generate`. drizzle-kit asks whether the new table is a rename of
   `project`. Answer yes to keep the data, or "create" to start empty. Read the SQL it
   writes.
5. Update both specs, then run `pnpm typecheck`, which lists every call site the rename
   missed.

If the product needs no such entity, delete the router, page and specs, remove the router
key, the route and the nav entry, drop the `projects` limit and the table from the
schema, and generate the migration that drops it.
