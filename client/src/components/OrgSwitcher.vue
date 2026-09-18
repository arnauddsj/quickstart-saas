<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronsUpDown, Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { errorMessage, queryClient } from '@/services/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const router = useRouter()
const session = authClient.useSession()
const organizations = authClient.useListOrganizations()

const activeId = computed(() => session.value.data?.session.activeOrganizationId ?? null)
const active = computed(
  () => organizations.value.data?.find((o) => o.id === activeId.value) ?? null,
)

const dialogOpen = ref(false)
const name = ref('')
const creating = ref(false)

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function switchTo(organizationId: string) {
  if (organizationId === activeId.value) return
  const { error } = await authClient.organization.setActive({ organizationId })
  if (error) {
    toast.error(error.message ?? 'Could not switch organization')
    return
  }
  await queryClient.invalidateQueries()
  await router.push({ name: 'dashboard' })
}

async function create() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  creating.value = true
  try {
    const { data, error } = await authClient.organization.create({
      name: trimmed,
      slug: `${slugify(trimmed)}-${Date.now().toString(36)}`,
    })
    if (error || !data) throw new Error(error?.message ?? 'Could not create organization')
    await authClient.organization.setActive({ organizationId: data.id })
    await queryClient.invalidateQueries()
    dialogOpen.value = false
    name.value = ''
    toast.success('Organization created')
    await router.push({ name: 'dashboard' })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="w-full justify-between">
        <span class="truncate">{{ active?.name ?? 'Select organization' }}</span>
        <ChevronsUpDown class="size-4 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56" align="start">
      <DropdownMenuItem
        v-for="org in organizations.data ?? []"
        :key="org.id"
        :class="{ 'font-medium': org.id === activeId }"
        @select="switchTo(org.id)"
      >
        {{ org.name }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="dialogOpen = true">
        <Plus class="size-4" />
        Create organization
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <Dialog v-model:open="dialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create organization</DialogTitle>
        <DialogDescription
          >You become its owner and it becomes your active organization.</DialogDescription
        >
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="create">
        <div class="flex flex-col gap-2">
          <Label for="org-name">Name</Label>
          <Input id="org-name" v-model="name" placeholder="Acme Inc." required />
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="creating">Create</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
