<script setup lang="ts">
// docs/account-lifecycle.md
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { actionHeaders, runAction } from '@/lib/monitoring'
import { brand, workspace } from '@/lib/brand'
import { describeUserAgent } from '@/lib/userAgent'
import { errorMessage, queryClient, trpc, useTRPCQuery } from '@/services/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const session = authClient.useSession()
const user = computed(() => session.value.data?.user ?? null)

const name = ref('')
watch(
  user,
  (u) => {
    if (u && !name.value) name.value = u.name
  },
  { immediate: true },
)
const savingName = ref(false)
async function saveName() {
  savingName.value = true
  try {
    const { error } = await authClient.updateUser({ name: name.value.trim() })
    if (error) throw new Error(error.message ?? 'Could not update your name')
    toast.success('Name updated')
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    savingName.value = false
  }
}

const newEmail = ref('')
const changingEmail = ref(false)
const emailPending = ref(false)
async function changeEmail() {
  changingEmail.value = true
  try {
    const { error } = await authClient.changeEmail({
      newEmail: newEmail.value.trim(),
      callbackURL: '/settings/account',
    })
    if (error) throw new Error(error.message ?? 'Could not change your email')
    emailPending.value = true
    toast.success(`Confirmation sent to ${user.value?.email}`)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    changingEmail.value = false
  }
}

const exporting = ref(false)
async function downloadData() {
  exporting.value = true
  try {
    const data = await trpc.user.exportData.query()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-data-${data.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    exporting.value = false
  }
}

const sessions = useTRPCQuery(async () => {
  const { data, error } = await authClient.listSessions()
  if (error) throw new Error(error.message ?? 'Could not list your sessions')
  return [...data].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
}, ['auth', 'sessions'])
const currentSessionId = computed(() => session.value.data?.session.id ?? null)
const otherSessions = computed(
  () => sessions.data.value?.filter((s) => s.id !== currentSessionId.value).length ?? 0,
)
const signingOut = ref(false)
async function signOutOthers() {
  signingOut.value = true
  try {
    const { error } = await authClient.revokeOtherSessions()
    if (error) throw new Error(error.message ?? 'Could not sign out the other sessions')
    toast.success('Signed out everywhere else')
    await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    signingOut.value = false
  }
}
async function signOutSession(token: string) {
  const { error } = await authClient.revokeSession({ token })
  if (error) {
    toast.error(error.message ?? 'Could not sign that session out')
    return
  }
  await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
}

const deleteOpen = ref(false)
const preview = useTRPCQuery(() => trpc.user.deletionPreview.query(), ['user', 'deletionPreview'], {
  enabled: deleteOpen,
})
const deleting = ref(false)
const deletePending = ref(false)
async function requestDeletion() {
  deleting.value = true
  try {
    const { error } = await runAction('account.delete', (actionId) =>
      authClient.deleteUser({
        callbackURL: '/login?deleted=1',
        fetchOptions: { headers: actionHeaders(actionId) },
      }),
    )
    if (error) throw new Error(error.message ?? 'Could not start account deletion')
    deletePending.value = true
    deleteOpen.value = false
    toast.success(`Confirmation sent to ${user.value?.email}`)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Account</h1>
      <p class="text-sm text-muted-foreground">Signed in as {{ user?.email }}</p>
    </div>

    <Card>
      <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
      <CardContent>
        <form class="flex items-end gap-3" @submit.prevent="saveName">
          <div class="flex-1 space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" v-model="name" required />
          </div>
          <Button type="submit" :disabled="savingName">Save</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Email address</CardTitle></CardHeader>
      <CardContent class="space-y-3">
        <p v-if="emailPending" class="text-sm text-muted-foreground">
          Check {{ user?.email }} and follow the link to confirm the change.
        </p>
        <form class="flex items-end gap-3" @submit.prevent="changeEmail">
          <div class="flex-1 space-y-2">
            <Label for="newEmail">New email</Label>
            <Input id="newEmail" v-model="newEmail" type="email" required />
          </div>
          <Button type="submit" variant="outline" :disabled="changingEmail">Change</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
      <CardContent class="space-y-3">
        <ul class="divide-y text-sm">
          <li
            v-for="s in sessions.data.value ?? []"
            :key="s.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div>
              <p class="font-medium">
                {{ describeUserAgent(s.userAgent) }}
                <Badge v-if="s.id === currentSessionId" variant="secondary" class="ml-1"
                  >This device</Badge
                >
              </p>
              <p class="text-muted-foreground">
                {{ s.ipAddress ?? 'unknown address' }} · last active
                {{ new Date(s.updatedAt).toLocaleString() }}
              </p>
            </div>
            <Button
              v-if="s.id !== currentSessionId"
              variant="ghost"
              size="sm"
              @click="signOutSession(s.token)"
              >Sign out</Button
            >
          </li>
        </ul>
        <Button
          variant="outline"
          :disabled="signingOut || otherSessions === 0"
          @click="signOutOthers"
        >
          Sign out other sessions
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Your data</CardTitle></CardHeader>
      <CardContent class="flex flex-wrap items-center gap-3">
        <Button variant="outline" :disabled="exporting" @click="downloadData"
          >Download my data</Button
        >
        <button type="button" data-cookie-settings class="text-sm underline">
          Cookie preferences
        </button>
      </CardContent>
    </Card>

    <Card class="border-destructive/40">
      <CardHeader><CardTitle>Delete account</CardTitle></CardHeader>
      <CardContent class="space-y-3">
        <p class="text-sm text-muted-foreground">
          <template v-if="brand.teams">
            Removes your account and every {{ workspace.one }} you are the only owner of, including
            its subscription.
          </template>
          <template v-else>Removes your account, all its data and its subscription.</template>
          Confirmed by email; cannot be undone.
        </p>
        <p v-if="deletePending" class="text-sm">Check {{ user?.email }} to confirm.</p>
        <Button variant="destructive" :disabled="deletePending" @click="deleteOpen = true">
          Delete my account
        </Button>
      </CardContent>
    </Card>

    <Dialog v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            A confirmation link will be sent to {{ user?.email }}. Following it deletes your
            account.
          </DialogDescription>
        </DialogHeader>
        <div v-if="brand.teams && preview.data.value?.organizationsToDelete.length" class="text-sm">
          These {{ workspace.many }} will be deleted with their data and subscriptions:
          <ul class="mt-2 list-disc pl-5">
            <li v-for="o in preview.data.value.organizationsToDelete" :key="o.id">{{ o.name }}</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
          <Button variant="destructive" :disabled="deleting" @click="requestDeletion">
            Send confirmation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
