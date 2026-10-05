# Organizations

Users see organizations as "workspaces", or whatever label
[branding.md](branding.md) sets, and may not see them at all in solo mode. The code keeps
better-auth's name.

Every user belongs to at least one organization, the session remembers which one is
active, and nothing org-scoped trusts an organization id sent by the client.

Code: `server/src/auth/index.ts` (the `organization` plugin), `trpc/index.ts`
(`orgProcedure`, `orgAdminProcedure`, `ORG_ADMIN_ROLES`), `trpc/router/org.ts`,
`db/schema/auth.ts` (`organization`, `member`, `invitation`), `db/schema/app.ts`
(`subscription.organizationId`), `client/src/pages/Onboarding.vue`,
`client/src/components/OrgSwitcher.vue`, `client/src/pages/settings/Organization.vue`,
`client/src/router/index.ts`. Specs: `server/src/__tests__/procedures.spec.ts`,
`server/src/__tests__/integration/workspaceControls.int.spec.ts`,
`client/src/pages/settings/Organization.spec.ts`, `e2e/workspace-settings.spec.ts`.

## The active organization lives on the session

better-auth's organization plugin adds `activeOrganizationId` to the `session` row.
`orgProcedure` reads it from `ctx.session`, looks up the caller's `member` row for that
organization, and puts `organizationId` and `membership` on the context. Routers never
accept an organization id as input; a client that wants another organization calls
`authClient.organization.setActive` first, which rewrites the session server-side.

**The rejected alternative** was an `organizationId` input on every procedure with a
membership check in each handler. It is one forgotten check away from cross-tenant reads,
and the check is invisible in a code review of the handler that forgot it.

## The first organization is created by onboarding, nowhere else

Sign-in does not create an organization. The router guard sends a user with no active
organization to `/onboarding` unless `authClient.organization.list()` already returns one,
in which case the first is set active silently. `Onboarding.vue` creates it with
`authClient.organization.create` and the creator becomes `owner`
(`creatorRole: 'owner'`).

This is a hazard worth stating: a server-side script that inserts a user (such as
`make-admin`) produces a user with no organization, and that user goes through onboarding
like anyone else. Do not add an `ensurePersonalOrg` helper to the server; the one place
this happens is the one place to change it.

## Roles come in two unrelated sets

| Role                       | Lives on      | Grants                                                                                  |
| -------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `owner`, `admin`, `member` | `member.role` | organization settings, invitations, billing (`orgAdminProcedure` accepts the first two) |
| `admin`, `member`          | `user.role`   | the `/admin/*` pages and `adminProcedure`                                               |

Nothing links them. See [auth.md](auth.md#what-each-procedure-tier-guarantees).

## The settings page calls better-auth, which enforces the roles

`settings/Organization.vue` renames, transfers, leaves and deletes through the organization
plugin's endpoints; there is no tRPC mutation for any of them. The integration spec pins
the rules the page relies on, so a better-auth upgrade that loosens one fails there:

| Action             | Endpoint                                 | Who                                                                                 |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Rename             | `organization/update`                    | owners and admins; members get 403                                                  |
| Transfer ownership | `organization/update-member-role`, twice | owners only: promote the member to `owner`, then step down to `admin`               |
| Leave              | `organization/leave`                     | anyone but the only owner (`…AS_THE_ONLY_OWNER`)                                    |
| Delete             | `organization/delete`                    | owners only; cancels Stripe first, see [account-lifecycle.md](account-lifecycle.md) |

**Transfer is two calls and fails safe.** If the second call fails the workspace has two
owners and the page says so; it is never left without one, because better-auth refuses to
demote or remove the last owner. An admin cannot promote anyone, themselves included, to
`owner`.

**After leaving or deleting, the page clears the active workspace** with
`setActive({ organizationId: null })` and goes to the dashboard. The router guard then
activates the user's next workspace or sends them to onboarding, the same path a new
account takes. Deletion asks for the workspace name to be typed first.

## Invitations are sent by the plugin and accepted by URL

`authClient.organization.inviteMember({ email, role })` writes an `invitation` row and the
plugin calls `sendInvitationEmail` in `auth/index.ts`, which emails
`${PUBLIC_URL}/accept-invitation/<id>` through the `EmailProvider`. `AcceptInvitation.vue`
calls `acceptInvitation` and sets the organization active. Invitations expire after the
plugin default of 48 hours; `org.invitations` lists pending ones for admins.

**Someone who is not signed in keeps their place through three hops.** The route needs a
session, so the guard sends them to `/login?redirect=/accept-invitation/<id>`; `Login.vue`
puts that path into the magic link's `callbackURL` (`/auth/callback?redirect=…`); the
callback page follows it once the session exists. Drop the `redirect` at any hop and the
invitee lands on onboarding and creates a stray organization instead of joining.
`e2e/invitation.spec.ts` walks the whole chain. An invitation is bound to its email
address: another signed-in account opening the link gets "Invitation not found".

## Every org-scoped table carries `organizationId`

`subscription` is unique per organization and cascades on delete. A new feature table should follow the same
shape and be queried only from an `orgProcedure`, filtered by `ctx.organizationId`. That
one convention is the entire tenancy boundary.
