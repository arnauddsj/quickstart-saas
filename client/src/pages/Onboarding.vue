<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { brand, workspace } from '@/lib/brand'
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

const workspaceName = computed(() => (brand.teams ? name.value.trim() : 'Personal'))
const slug = computed(() =>
  workspaceName.value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''),
)

async function create() {
  if (!slug.value || pending.value) return
  pending.value = true
  try {
    if (askName.value && personName.value.trim()) {
      const { error: nameError } = await authClient.updateUser({ name: personName.value.trim() })
      if (nameError) throw new Error(nameError.message ?? 'Could not save your name')
    }
    const { data, error } = await authClient.organization.create({
      name: workspaceName.value,
      slug: `${slug.value}-${Date.now().toString(36)}`,
    })
    if (error || !data) throw new Error(error?.message ?? `Could not create the ${workspace.one}`)
    await authClient.organization.setActive({ organizationId: data.id })
    await queryClient.invalidateQueries()
    await router.replace({ name: 'dashboard' })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    pending.value = false
  }
}

watch(
  () => session.value.data,
  (data) => {
    if (data && !brand.teams && !askName.value) void create()
  },
  { immediate: true },
)
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="create">
    <div v-if="brand.teams">
      <h1 class="text-xl font-semibold">Create your {{ workspace.one }}</h1>
      <p class="text-sm text-muted-foreground">You need one to get started.</p>
    </div>
    <div v-else>
      <h1 class="text-xl font-semibold">Welcome to {{ brand.name }}</h1>
      <p class="text-sm text-muted-foreground">One last detail before you start.</p>
    </div>
    <div v-if="askName" class="flex flex-col gap-2">
      <Label for="person-name">Your name</Label>
      <Input id="person-name" v-model="personName" placeholder="Ada Lovelace" autocomplete="name" />
    </div>
    <div v-if="brand.teams" class="flex flex-col gap-2">
      <Label for="name">{{ workspace.One }} name</Label>
      <Input id="name" v-model="name" placeholder="Acme Inc." required />
      <p v-if="slug" class="text-xs text-muted-foreground">Slug: {{ slug }}</p>
    </div>
    <Button type="submit" :disabled="pending || !slug">
      {{ brand.teams ? `Create ${workspace.one}` : 'Get started' }}
    </Button>
  </form>
</template>
