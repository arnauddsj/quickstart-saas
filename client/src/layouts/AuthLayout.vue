<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { Card, CardContent } from '@/components/ui/card'
import LegalFooter from '@/components/LegalFooter.vue'

const route = useRoute()
const wide = computed(() => route.meta.wide === true)
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 p-4">
    <Card class="w-full" :class="wide ? 'max-w-3xl' : 'max-w-md'">
      <CardContent>
        <RouterView />
      </CardContent>
    </Card>
    <LegalFooter class="justify-center" />
  </div>
</template>
