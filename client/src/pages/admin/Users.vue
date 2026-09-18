<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { errorMessage, queryClient, trpc, useTRPCMutation, useTRPCQuery } from '@/services/server'
import type { AdminUser } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Role = 'admin' | 'member'

const session = authClient.useSession()
const myId = computed(() => session.value.data?.user.id ?? null)

const search = ref('')
const queryKey = computed(() => ['admin', 'users', search.value])
const users = useTRPCQuery(
  () => trpc.admin.listUsers.query({ search: search.value || undefined, limit: 100 }),
  queryKey,
)

function refresh() {
  return queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
}
const onError = (e: Error) => toast.error(errorMessage(e))

const setRole = useTRPCMutation(
  (input: { userId: string; role: Role }) => trpc.admin.setRole.mutate(input),
  {
    onSuccess: () => {
      toast.success('Role updated')
      return refresh()
    },
    onError,
  },
)
const setBanned = useTRPCMutation(
  (input: { userId: string; banned: boolean }) => trpc.admin.setBanned.mutate(input),
  {
    onSuccess: (_data, input) => {
      toast.success(input.banned ? 'User banned' : 'User unbanned')
      return refresh()
    },
    onError,
  },
)
const removeUser = useTRPCMutation(
  (input: { userId: string }) => trpc.admin.removeUser.mutate(input),
  {
    onSuccess: () => {
      toast.success('User deleted')
      toDelete.value = null
      return refresh()
    },
    onError,
  },
)

const setEmail = useTRPCMutation(
  (input: { userId: string; email: string }) => trpc.admin.setEmail.mutate(input),
  {
    onSuccess: (_data, input) => {
      toast.success(`Email changed; verification sent to ${input.email}`)
      toEdit.value = null
      return refresh()
    },
    onError,
  },
)
const revokeSessions = useTRPCMutation(
  (input: { userId: string }) => trpc.admin.revokeSessions.mutate(input),
  {
    onSuccess: (data) => {
      toast.success(`${data.revoked} session(s) revoked`)
      return refresh()
    },
    onError,
  },
)

const toDelete = ref<AdminUser | null>(null)
const toEdit = ref<AdminUser | null>(null)
const newEmail = ref('')
function openEdit(u: AdminUser) {
  toEdit.value = u
  newEmail.value = u.email
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never')
const isActive = (iso: string | null) =>
  Boolean(iso && Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold">Users</h1>
      <Input v-model="search" placeholder="Search by email or name" class="max-w-xs" />
    </div>
    <p v-if="users.data.value" class="text-sm text-muted-foreground">
      {{ users.data.value.total }} {{ users.data.value.total === 1 ? 'user' : 'users' }}
    </p>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Last login</TableHead>
          <TableHead>Orgs</TableHead>
          <TableHead class="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="u in users.data.value?.users ?? []" :key="u.id">
          <TableCell>{{ u.email }}</TableCell>
          <TableCell>{{ u.name || '—' }}</TableCell>
          <TableCell>
            <Select
              :disabled="u.id === myId"
              :model-value="u.role"
              @update:model-value="(v) => setRole.mutate({ userId: u.id, role: v as Role })"
            >
              <SelectTrigger class="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <Badge :variant="u.banned ? 'destructive' : 'secondary'">{{
              u.banned ? 'banned' : 'active'
            }}</Badge>
          </TableCell>
          <TableCell class="text-muted-foreground">{{
            new Date(u.createdAt).toLocaleDateString()
          }}</TableCell>
          <TableCell class="text-muted-foreground">
            {{ fmt(u.lastLoginAt) }}
            <Badge v-if="isActive(u.lastActiveAt)" variant="secondary" class="ml-1">active</Badge>
          </TableCell>
          <TableCell class="text-muted-foreground">{{ u.organizationCount }}</TableCell>
          <TableCell class="space-x-1 text-right">
            <Button
              variant="outline"
              size="sm"
              :disabled="u.id === myId || setBanned.isPending.value"
              @click="setBanned.mutate({ userId: u.id, banned: !u.banned })"
            >
              {{ u.banned ? 'Unban' : 'Ban' }}
            </Button>
            <Button variant="outline" size="sm" @click="openEdit(u)">Email</Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="u.sessionCount === 0"
              @click="revokeSessions.mutate({ userId: u.id })"
            >
              Sign out
            </Button>
            <Button variant="destructive" size="sm" :disabled="u.id === myId" @click="toDelete = u">
              Delete
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <Dialog :open="toEdit !== null" @update:open="(open) => !open && (toEdit = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>
            The address is replaced now and marked unverified; a verification link is sent to the
            new address.
          </DialogDescription>
        </DialogHeader>
        <form
          class="space-y-2"
          @submit.prevent="toEdit && setEmail.mutate({ userId: toEdit.id, email: newEmail })"
        >
          <Input v-model="newEmail" type="email" required />
          <DialogFooter>
            <Button type="button" variant="outline" @click="toEdit = null">Cancel</Button>
            <Button type="submit" :disabled="setEmail.isPending.value">Change email</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="toDelete !== null" @update:open="(open) => !open && (toDelete = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            This permanently deletes {{ toDelete?.email }}, every organization they are the only
            owner of, and its subscription. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="toDelete = null">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="removeUser.isPending.value"
            @click="toDelete && removeUser.mutate({ userId: toDelete.id })"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
