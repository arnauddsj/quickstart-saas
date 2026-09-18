# Email

One provider sends, chosen by `EMAIL_PROVIDER` alone, and there is no fallback between
them.

Code: `server/src/email/index.ts` (`createEmailProvider`), `email/types.ts`
(`EmailProvider`), `email/smtp.ts` (`SmtpProvider`), `email/loops.ts` (`LoopsProvider`),
`auth/index.ts` (`emailProvider`). Spec: `server/src/__tests__/email.spec.ts`.

## The interface has five methods and nothing else

`EmailProvider` is `sendMagicLink`, `sendInvitation`, `sendEmailChange` (to the old
address), `sendEmailVerification` (to the new address) and `sendAccountDeletion`. Every
one is called by better-auth from `auth/index.ts`; see
[account-lifecycle.md](account-lifecycle.md) for when. A new transactional email adds a
method here and an implementation in each provider; the rest of the code never sees a
transport.

## No fallback, on purpose

`createEmailProvider(env)` returns `SmtpProvider` for `smtp` and `LoopsProvider` for
`loops`, and throws at boot if Loops is selected without its ids. A sibling project let
production fall through to SMTP when the Loops key was missing, which sent real customers
mail from a dev relay for a week before anyone noticed. Here the provider named in the
environment is the one that sends; a misconfiguration is a boot failure, not a silent
downgrade.

## SMTP means Mailpit locally

`SmtpProvider` wraps nodemailer with `secure: false` and no auth, which is what Mailpit
accepts on port 1025. Mailpit replaces MailHog, which is archived upstream, and adds an
HTTP API the E2E test uses to read the magic link back:

```bash
curl -s 'http://localhost:8025/api/v1/search?query=to:you@example.com'
curl -s 'http://localhost:8025/api/v1/message/<ID>'      # .Text contains the link
```

The UI is on the same port. In production `smtp` still works against any relay that
accepts unauthenticated submission from the container network; add auth to
`SmtpProvider` when a relay needs it.

## Loops is a template id per email

`LoopsProvider` posts to `https://app.loops.so/api/v1/transactional` with a Bearer key,
the recipient, and `dataVariables` the template interpolates: `url` for the magic link,
email verification and account deletion; `url`, `newEmail` for the email change; `url`,
`organizationName`, `inviterEmail` for invitations. Create the five templates in Loops
with those exact variable names and put their ids in the `LOOPS_*_TEMPLATE_ID` variables
listed in `.env.example`; a missing id fails at send time with a named error. A non-2xx response throws with the status and body, so a
wrong template id is visible in the error log rather than a silently missing email.

`fetchImpl` on the constructor exists so the spec can assert the payload without the
network.
