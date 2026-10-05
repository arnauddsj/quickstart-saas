# Account lifecycle

Everything a person can do to their own account, in the order it fails when done wrong:
rename, change email, download their data, delete the account and what goes with it.

Code: `server/src/auth/index.ts` (`user.changeEmail`, `user.deleteUser`,
`organizationHooks.beforeDeleteOrganization`), `server/src/services/account.ts`
(`organizationsOwnedSolelyBy`, `cancelOrganizationBilling`, `cleanupBeforeUserDelete`,
`exportUserData`), `server/src/trpc/router/user.ts` (`exportData`, `deletionPreview`,
`getConsent`, `setConsent`), `server/src/email/templates.ts` (`emailChange`,
`emailVerification`, `accountDeletion`), `client/src/pages/settings/Account.vue`. Spec:
`server/src/__tests__/account.spec.ts`,
`server/src/__tests__/integration/account.int.spec.ts`.

## Profile and email are better-auth endpoints, not tRPC

`authClient.updateUser({ name })` writes the name. `role`, `banned` and `emailVerified` are
refused by the admin plugin (`FIELD_NOT_ALLOWED`), which the pen test confirmed; do not add
a tRPC mutation that accepts a user object, that is how mass assignment comes back.

**An email change takes two links, and the old address goes first.**
`authClient.changeEmail({ newEmail })` emails the current address
(`sendChangeEmailConfirmation` → the `emailChange` email). Following that link
sends a second mail to the new address (`emailVerification.sendVerificationEmail` →
the `emailVerification` email), and only following the second one changes the row.
better-auth refuses the request outright when `emailVerification` is not configured
("Verification email isn't enabled"), which is why both callbacks exist. The order is what
survives a stolen session: an attacker with a cookie cannot move the account to their own
address without reading the victim's mailbox, and cannot claim an address they do not own.

## Deletion is confirmed by email and cleans up before the row goes

`authClient.deleteUser({ callbackURL })` emails a link (`sendDeleteAccountVerification` →
the `accountDeletion` email). Following it runs `beforeDelete`, then better-auth
deletes the `user` row; sessions, accounts, memberships, invitations addressed to the user
and the consent record follow by `ON DELETE CASCADE`.

`beforeDelete` is `cleanupBeforeUserDelete`. For every organization where the person is
the **only** owner it cancels the Stripe subscription, deletes the Stripe customer, then
deletes the organization, whose members, invitations and `subscription` row cascade.
Organizations with another owner are kept; the person simply leaves them.

**A failed Stripe cancellation aborts the deletion.** Deleting first and cancelling later is
how a paid subscription keeps billing an organization that no longer exists. The user sees
an error and can retry; the spec covers this branch.

**Deleting a workspace directly goes through the same billing cleanup.** The organization
plugin exposes `POST /api/auth/organization/delete` to owners whether or not the UI offers
a button. Its `beforeDeleteOrganization` hook calls `cancelOrganizationBilling`, the same
function account deletion uses, so a throw from Stripe aborts that path too. A new deletion
path must call it as well.

The Account page calls `user.deletionPreview` before asking for confirmation so the person
sees which organizations disappear with them.

## Sessions are listed and revoked by better-auth

The Account page lists `authClient.listSessions()`, newest activity first, labels each
with `describeUserAgent` (`client/src/lib/userAgent.ts`, browser and system, never the raw
string) and marks the current one by `session.id`. "Sign out" on a row calls
`revokeSession({ token })`; "Sign out other sessions" calls `revokeOtherSessions()`, which
keeps only the current one. A revoked device's next `get-session` answers `null`, so its
router guard signs it out on the next navigation.

## The export is the GDPR "right of access", and it is one query

`user.exportData` returns JSON with `user`, `sessions`, `memberships`, `invitations`,
`subscriptions` and `consent`, all filtered by the caller's id. Nothing else is stored
about a person, so nothing else is exported; when a project adds a table with personal
data it adds a key here in the same change. The client turns the payload into a download.

Notifications are left out on purpose. They are messages the app generated about events
the user can already see, not data the user provided. They are deleted with the account
by cascade. Do not add them to the export.

GlitchTip events carry only a user id, never an email. They are operational logs held by
the tracker's retention and are not part of the export. The privacy page's "Error
monitoring" section discloses them, with the retention from `legal.errorTracking`.

## What is not here

No soft delete and no grace period: the row is gone when the link is followed. A project
that needs a cooling-off period adds a `deletedAt` column and a pg-boss job; that is a
product decision, not a template default.
