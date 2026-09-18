<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4">
    <h1 class="text-4xl font-semibold">404</h1>
    <p class="text-muted-foreground">This page does not exist.</p>
    <Button as-child variant="outline">
      <RouterLink to="/">Go home</RouterLink>
    </Button>
  </div>
</template>
