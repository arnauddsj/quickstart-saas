<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const failed = ref<string | null>(null)

onMounted(async () => {
  if (typeof route.query.error === 'string') {
    failed.value = 'This link is invalid or has expired.'
    return
  }
  const { data, error } = await authClient.getSession()
  if (error) {
    failed.value = 'Could not reach the server. Try the link again in a moment.'
    return
  }
  if (!data) {
    failed.value = 'This link is invalid or has expired.'
    return
  }
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/')
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 text-center">
    <template v-if="failed">
      <p class="font-medium">{{ failed }}</p>
      <Button as-child variant="outline">
        <RouterLink :to="{ name: 'login' }">Back to sign in</RouterLink>
      </Button>
    </template>
    <p v-else class="text-sm text-muted-foreground">Signing you in...</p>
  </div>
</template>
