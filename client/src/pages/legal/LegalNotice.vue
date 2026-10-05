<script setup lang="ts">
import { legal } from '@/data/legal'
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4 text-sm">
    <h1 class="text-2xl font-semibold">Legal notice</h1>
    <p>
      <strong>Publisher:</strong> {{ legal.company }}, {{ legal.registration }},
      {{ legal.address }}.
    </p>
    <p>
      <strong>Contact:</strong>
      <a :href="`mailto:${legal.contactEmail}`" class="underline">{{ legal.contactEmail }}</a>
    </p>
    <p><strong>Hosting:</strong> {{ legal.host }}.</p>
    <p class="text-muted-foreground">
      Personal data and cookies are described in the
      <RouterLink :to="{ name: 'privacy' }" class="underline">privacy policy</RouterLink>.
    </p>
  </div>
</template>
