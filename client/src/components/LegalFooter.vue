<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
    <RouterLink :to="{ name: 'privacy' }" class="hover:underline">Privacy</RouterLink>
    <RouterLink :to="{ name: 'legal' }" class="hover:underline">Legal notice</RouterLink>
    <RouterLink :to="{ name: 'terms' }" class="hover:underline">Terms</RouterLink>
    <button type="button" data-cookie-settings class="hover:underline">Cookies</button>
  </footer>
</template>
