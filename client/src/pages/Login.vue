<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { errorMessage } from '@/services/server'
import LoginForm from '@/components/LoginForm.vue'

const route = useRoute()
const pending = ref(false)
const sentTo = ref<string | null>(null)

async function sendLink(email: string) {
  pending.value = true
  try {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `/auth/callback?redirect=${encodeURIComponent(redirect)}`,
    })
    if (error) throw new Error(error.message ?? 'Could not send magic link')
    sentTo.value = email
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Sign in</h1>
      <p class="text-sm text-muted-foreground">We will email you a magic link.</p>
    </div>
    <div v-if="sentTo" class="rounded-md border bg-muted/40 p-4 text-sm">
      <p class="font-medium">Check your inbox</p>
      <p class="text-muted-foreground">A sign-in link was sent to {{ sentTo }}.</p>
    </div>
    <LoginForm v-else :pending="pending" @submit="sendLink" />
  </div>
</template>
