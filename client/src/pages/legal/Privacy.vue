<script setup lang="ts">
import { legal } from '@/data/legal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <h1 class="text-2xl font-semibold">Privacy policy</h1>
    <p class="text-sm text-muted-foreground">
      {{ legal.productName }} is operated by {{ legal.company }}, {{ legal.address }}. Questions:
      <a :href="`mailto:${legal.contactEmail}`" class="underline">{{ legal.contactEmail }}</a
      >. Version {{ legal.policyVersion }}.
    </p>

    <Card>
      <CardHeader><CardTitle>What we store to run your account</CardTitle></CardHeader>
      <CardContent class="space-y-2 text-sm">
        <p>
          Your email address, your name, the organizations you belong to and your role in them, your
          sessions (creation date, expiry, IP address, browser), your billing status per
          organization, and the analytics choice you make on this page. This is what the service
          needs to sign you in and bill the organization; it is kept while the account exists.
        </p>
        <p>
          You can download all of it as JSON, change your email, or delete your account from
          <strong>Settings → Account</strong>. Deleting your account removes every organization you
          are the only owner of, cancels its subscription, and erases the rows above.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Analytics tools</CardTitle></CardHeader>
      <CardContent class="space-y-3 text-sm">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b">
              <th class="py-1 pr-3">Tool</th>
              <th class="py-1 pr-3">Provider</th>
              <th class="py-1 pr-3">What it does</th>
              <th class="py-1">Consent</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in legal.vendors" :key="v.name" class="border-b last:border-0">
              <td class="py-1 pr-3">{{ v.name }}</td>
              <td class="py-1 pr-3">{{ v.provider }}</td>
              <td class="py-1 pr-3">{{ v.purpose }}</td>
              <td class="py-1">{{ v.consent ? 'Required' : 'Not required' }}</td>
            </tr>
          </tbody>
        </table>
        <p>
          These tools are <strong>not loaded at all until you accept them</strong>. They are not
          merely paused: the scripts are absent from the page. Both providers may transfer data
          outside the European Union, under the safeguards their own terms describe.
        </p>
        <p>
          Session replay films the page, so the whole application area is masked before anything is
          sent: text you type, names, emails and organization data are never transmitted.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Cookies</CardTitle></CardHeader>
      <CardContent class="space-y-3 text-sm">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b">
              <th class="py-1 pr-3">Name</th>
              <th class="py-1 pr-3">Purpose</th>
              <th class="py-1">Kept for</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b">
              <td class="py-1 pr-3"><code>better-auth.session_token</code></td>
              <td class="py-1 pr-3">Keeps you signed in. Strictly necessary.</td>
              <td class="py-1">7 days, renewed daily</td>
            </tr>
            <tr>
              <td class="py-1 pr-3"><code>consent_prefs</code></td>
              <td class="py-1 pr-3">
                Remembers your analytics choice, so you are not asked again. Strictly necessary.
                When you are signed in, the same choice is also saved on your account.
              </td>
              <td class="py-1">{{ legal.consentCookieDays }} days</td>
            </tr>
          </tbody>
        </table>
        <p>
          Change your mind at any time with the <strong>Cookies</strong> link in the footer or in
          Settings → Account. Refusing analytics never affects your ability to sign in or use the
          app.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
