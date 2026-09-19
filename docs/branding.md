# Branding and workspaces

One file names the product, words the tenant, and decides whether users ever see it.

Code:

- `server/src/config/brand.ts` (`brand`), exported to the client as `server/brand`
- `client/src/lib/brand.ts` (`workspace` label forms)
- `server/src/services/workspacePolicy.ts`
- `client/src/pages/Onboarding.vue`, `client/src/router/index.ts` (`requiresTeams`)
- `e2e/onboarding.ts`

Spec: `server/src/__tests__/integration/workspacePolicy.int.spec.ts`.

## `brand.ts` is the only place the product is named

| Key            | Used by                                                           |
| -------------- | ----------------------------------------------------------------- |
| `name`         | the page title, the sidebar, legal pages, every email and subject |
| `supportEmail` | the email footer                                                  |
| `accentColor`  | the email button                                                  |
| `workspace`    | every user-facing word for the tenant (`one`, `many`, lowercase)  |
| `teams`        | whether users see workspaces at all (below)                       |

`EMAIL_FROM` stays an environment variable, because the sending address differs per
deployment; emails go out as `"<brand.name>" <EMAIL_FROM>`. `index.html` has an empty
`<title>` and `main.ts` sets it from `brand.name`.

The file lives in the server package so emails and the client read the same values. It
must stay import-free: the client bundles it.

## The tenant is always a better-auth organization

In code the tenant is `organization`, and that name stays in the schema, the routers and
`orgProcedure`. Only the label users read changes: the default is "workspace", and a
product can call it "team" or "company" by editing `brand.workspace`. Billing, plan limits
and every org-scoped row belong to the workspace, never to a user.

## `teams: false` hides workspaces without removing them

A single-user product sets `teams: false`:

- Onboarding creates a workspace named "Personal" and moves on. It only waits when it
  still needs the user's name, and it acts only once the session has loaded, or it would
  race the name check.
- The layout drops the switcher and the workspace settings link. Routes marked
  `requiresTeams` redirect to the dashboard.
- Account deletion copy stops listing workspaces.
- On the server, `workspacePolicy(false)` makes better-auth refuse a second workspace per
  user (`allowUserToCreateOrganization`) and every invitation (`invitationLimit: 0`), so
  hiding the UI is not the only guard.

Because data and the subscription still sit on the workspace, turning `teams` on later is
a config change with no migration: each user's "Personal" workspace becomes visible,
renamable and shareable.

The e2e suite reads `brand` through `e2e/onboarding.ts`, so it passes in both modes. The
invitation spec skips itself when `teams` is off.
