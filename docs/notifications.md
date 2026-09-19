# In-app notifications

Notifications are the second channel next to [email](email.md): rows a user reads in the
bell, created by one server call. Which events notify is product-specific. The starter
ships the plumbing and two examples to replace.

Code:

- server: `server/src/db/schema/app.ts` (`notification`), `server/drizzle/0004_notifications.sql`, `server/src/services/notify.ts` (`notify`, `notifyWorkspace`, `deleteExpiredNotifications`), `server/src/trpc/router/notification.ts`, `server/src/jobs/notificationCleanup.ts`
- client: `client/src/components/NotificationBell.vue`, in the sidebar of `DefaultLayout.vue`

Specs: `server/src/__tests__/integration/notifications.int.spec.ts`,
`client/src/components/NotificationBell.spec.ts`, `e2e/notifications.spec.ts`.

## Sending one

```ts
await notify(userId, { type: 'invoice.paid', title: 'Invoice #12 was paid', link: '/invoices' })
await notifyWorkspace(ctx.organizationId, { type, title, link }, { exceptUserId: ctx.user.id })
```

- **Fields.**
  - `type` is a stable dotted key, like `reportError` types. Use it for filtering later,
    never as display text.
  - `title` is the line shown in the bell.
  - `body` is optional.
  - `link` is an in-app path the bell navigates to. Pass only paths built on the server,
    never a URL a user supplied.
- **Workspace scoping.** `notify` without `organizationId` is personal: it shows in
  every workspace. With one, it shows only while that workspace is active. So
  `notifyWorkspace` rows never leak a link into the wrong workspace's data.
- **Excluding the actor.** `notifyWorkspace` writes one row per member. Pass
  `exceptUserId` so the person who acted is not told about their own action.
- **Best effort after the write.** Notify after the transaction that did the work, and
  `.catch` a failure into `reportError` rather than letting it reject the procedure. A
  thrown notification turned a committed create into an error, and the user's retry
  created a second row.
- **Email too.** When an event deserves both channels, call `emailProvider.send` as
  well. The two are deliberately separate, because most in-app events are too minor for
  email.

## Reading them

`notification.list` returns the latest 20 visible rows and the unread count in one query.
The bell polls it every 30 seconds, and any mutation invalidates the `['notification']`
key. Polling is the whole transport. Switch to server-sent events only when 30 seconds
becomes a product problem; the router does not change.

`markRead` only touches the caller's own row, so a guessed id does nothing.
`markAllRead` clears only what the active workspace shows.

## Retention

`notification-cleanup` runs daily at 04:00 UTC and deletes rows older than 90 days
(`NOTIFICATION_RETENTION_DAYS`), read or not. Deleting a user or a workspace cascades to
its notifications.

## The two examples

- `account.welcome` is personal, sent from better-auth's `user.create.after` hook in
  `auth/index.ts`. A failure there is reported, not thrown, so it can never block a
  sign-up.
- `project.created` is sent to the other members of the workspace from
  `project.create`. It goes with the [reference feature](reference-feature.md): rename
  or delete it with Projects. In solo mode no other member exists, so it never fires.
