# Consent and analytics

No analytics script exists on the page until a visitor in Europe accepts it, the choice
follows a signed-in person across devices, and the pages the banner promises are real.

Code: `client/src/lib/consent.ts` (`setupConsent`), `client/src/main.ts`,
`client/src/data/legal.ts`, `client/src/components/LegalFooter.vue`,
`client/src/pages/legal/*.vue`, `client/nginx.conf.template` (CSP),
`server/src/trpc/router/user.ts` (`getConsent`, `setConsent`), `server/src/db/schema/app.ts`
(`userConsent`).

## The kit decides, the ids come from the environment

`@hivehorizon/consent-kit` (pinned to a tag in `client/package.json`) reads the country
from Cloudflare's `/cdn-cgi/trace`: outside Europe the vendors start immediately, inside
Europe nothing loads until "Accept". `setupConsent()` runs after `app.mount()` because
`maskRoot: '#app'` needs the element to exist.

Vendors are declared only when their id is set: `VITE_GA4_ID` and `VITE_CLARITY_ID` in
`client/.env` (public values, compiled into the bundle). With both empty the kit is not
initialised and no banner appears, which is the state a fresh clone is in. In development
`staticGeo('FR')` and `debug: true` are forced so the banner is always exercised.

## The choice is stored on the account when there is one

`accountStorage` loads through `user.getConsent` (null when signed out) and saves through
`user.setConsent` into the `user_consent` table, one jsonb row per user with cascade on
delete. The newer of cookie and account copy wins, so signing in on a second device does
not overwrite a more recent refusal.

## The CSP names the vendor hosts, consent gates them

`nginx.conf.template` allows `googletagmanager.com` and `clarity.ms` in `script-src` and
`connect-src`. The policy only says what _may_ load; the kit decides _whether_ it does. A
vendor added to `consent.ts` without its hosts in the CSP loads in development and is
blocked silently in production.

## Every layout has the control

`LegalFooter.vue` carries the `data-cookie-settings` button and links to `/privacy`,
`/legal`, `/terms`; it sits in `DefaultLayout` and `AuthLayout`, and the Account page
repeats the button. The click handler is bound once, by delegation, in `setupConsent()`,
so any `[data-cookie-settings]` element works without its own script. A layout without the
control is the usual failure, and it is a fine.

## The legal pages read one data file

`client/src/data/legal.ts` holds the entity, host, vendor table and `policyVersion`; the
three pages render it. Replace its placeholder values before opening sign-ups, and bump
`policyVersion` whenever a vendor or the retention changes, which re-asks everyone.

## Rules that do not bend

"Refuse all" stays as prominent as "Accept all"; nothing pre-ticked; a refusal is remembered
as long as an acceptance. Never pass an email to `clarity('identify')` or `user_id`, and
never put a personal value in a URL: replay records URLs verbatim.
