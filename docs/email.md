# Email

One provider sends, chosen by `EMAIL_PROVIDER` alone, and there is no fallback between
them.

Code: `server/src/email/index.ts` (`createEmailProvider`, `parseLoopsTemplateIds`),
`email/templates.ts` (`templates`), `email/render.ts` (`renderEmail`), `email/types.ts`
(`EmailProvider`), `email/smtp.ts` (`SmtpProvider`), `email/loops.ts` (`LoopsProvider`),
`auth/index.ts` (`emailProvider`). Spec: `server/src/__tests__/email.spec.ts`.

## An email is a template entry and a call

`EmailProvider` has one method, `send(template, to, data)`. `templates.ts` maps each
template name to a function from its data to content: subject, heading, paragraphs, an
optional button and a footnote. `data` is typed per template, so a missing variable is a
compile error at the call site.

Adding an email takes two steps:

1. Add an entry to `templates`.
2. Call `emailProvider.send('<name>', to, data)`.

The providers never change. The built-in templates are `magicLink`, `invitation`,
`emailChange` (sent to the old address), `emailVerification` (sent to the new address)
and `accountDeletion`. better-auth calls all five from `auth/index.ts`; see
[account-lifecycle.md](account-lifecycle.md) for when.

`renderEmail` wraps every template in one layout, which carries the product name, the
button in `brand.accentColor` and a footer with `brand.supportEmail` (see
[branding.md](branding.md)). It HTML-escapes every value. Workspace names and emails are
user input, and the old hand-written HTML interpolated them raw. The plain-text part is
rendered from the same content, with the link written out.

## No fallback, on purpose

`createEmailProvider(env)` returns `SmtpProvider` for `smtp` and `LoopsProvider` for
`loops`, and throws at boot if Loops is selected without a key or a `magicLink` id. A sibling project let
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

## Loops maps template names to ids

With Loops, the content lives in Loops and `templates.ts` only fixes the name and the
variables. `LOOPS_TEMPLATE_IDS` is one variable of `<template>=<id>` pairs, for example
`magicLink=abc,invitation=def`. An unknown name fails at boot, and a template without an
id fails when it is sent, with its name in the error. Each Loops template receives the
template's `data` keys as `dataVariables`:

- `url` for `magicLink`, `emailVerification` and `accountDeletion`
- `url` and `newEmail` for `emailChange`
- `url`, `organizationName` and `inviterEmail` for `invitation`

A new email therefore needs a Loops template and one more pair in the variable, not a
new environment variable. A non-2xx response throws with the status and body, so a wrong
id shows up in GlitchTip instead of an email going silently missing.

`fetchImpl` on the constructor exists so the spec can assert the payload without the
network.
