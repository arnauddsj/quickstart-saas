<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { authClient } from '@/lib/auth'
import { errorMessage, queryClient } from '@/services/server'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const error = ref<string | null>(null)

onMounted(async () => {
  const invitationId = String(route.params.id ?? '')
  try {
    const result = await authClient.organization.acceptInvitation({ invitationId })
    if (result.error || !result.data)
      throw new Error(result.error?.message ?? 'Invitation is invalid')
    await authClient.organization.setActive({
      organizationId: result.data.invitation.organizationId,
    })
    await queryClient.invalidateQueries()
    await router.replace({ name: 'dashboard' })
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 text-center">
    <template v-if="error">
      <p class="font-medium">Could not accept invitation</p>
      <p class="text-sm text-muted-foreground">{{ error }}</p>
      <Button as-child variant="outline">
        <RouterLink to="/">Go to dashboard</RouterLink>
      </Button>
    </template>
    <p v-else class="text-sm text-muted-foreground">Accepting invitation...</p>
  </div>
</template>
