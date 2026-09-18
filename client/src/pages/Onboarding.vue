<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { errorMessage, queryClient } from '@/services/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const router = useRouter()
const session = authClient.useSession()
const askName = computed(() => session.value.data?.user.name === '')
const personName = ref('')
const name = ref('')
const pending = ref(false)

const slug = computed(() =>
  name.value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''),
)

async function create() {
  if (!slug.value) return
  pending.value = true
  try {
    if (askName.value && personName.value.trim()) {
      const { error: nameError } = await authClient.updateUser({ name: personName.value.trim() })
      if (nameError) throw new Error(nameError.message ?? 'Could not save your name')
    }
    const { data, error } = await authClient.organization.create({
      name: name.value.trim(),
      slug: `${slug.value}-${Date.now().toString(36)}`,
    })
    if (error || !data) throw new Error(error?.message ?? 'Could not create organization')
    await authClient.organization.setActive({ organizationId: data.id })
    await queryClient.invalidateQueries()
    await router.replace({ name: 'dashboard' })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="create">
    <div>
      <h1 class="text-xl font-semibold">Create your organization</h1>
      <p class="text-sm text-muted-foreground">You need one to get started.</p>
    </div>
    <div v-if="askName" class="flex flex-col gap-2">
      <Label for="person-name">Your name</Label>
      <Input id="person-name" v-model="personName" placeholder="Ada Lovelace" autocomplete="name" />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="name">Organization name</Label>
      <Input id="name" v-model="name" placeholder="Acme Inc." required />
      <p v-if="slug" class="text-xs text-muted-foreground">Slug: {{ slug }}</p>
    </div>
    <Button type="submit" :disabled="pending || !slug">Create organization</Button>
  </form>
</template>
