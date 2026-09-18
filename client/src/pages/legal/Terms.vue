<script setup lang="ts">
import { legal } from '@/data/legal'
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4 text-sm">
    <h1 class="text-2xl font-semibold">Terms of service</h1>
    <p>
      These terms govern the use of {{ legal.productName }}, provided by {{ legal.company }}.
      Replace this page with the product's real terms before opening sign-ups; it must be reachable
      before any payment.
    </p>
    <p>
      Subscriptions are billed per organization through Stripe and can be cancelled at any time from
      Settings → Billing; access continues until the end of the paid period.
    </p>
    <p>
      Accounts can be deleted at any time from Settings → Account. Deletion is confirmed by email
      and cannot be undone.
    </p>
  </div>
</template>
