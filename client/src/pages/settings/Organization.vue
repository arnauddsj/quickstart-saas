<script setup lang="ts">
// docs/organizations.md
import { workspace } from '@/lib/brand'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { actionHeaders, runAction } from '@/lib/monitoring'
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

type MemberRole = 'member' | 'admin'

const org = useTRPCQuery(() => trpc.org.current.query(), ['org', 'current'])
const members = useTRPCQuery(() => trpc.org.members.query(), ['org', 'members'])
const canManage = computed(
  () => org.data.value?.myRole === 'owner' || org.data.value?.myRole === 'admin',
)
const invitations = useTRPCQuery(() => trpc.org.invitations.query(), ['org', 'invitations'], {
  enabled: canManage,
})
const pendingInvitations = computed(
  () => invitations.data.value?.filter((i) => i.status === 'pending') ?? [],
)

const session = authClient.useSession()
const myUserId = computed(() => session.value.data?.user.id ?? null)

const inviteEmail = ref('')
const inviteRole = ref<MemberRole>('member')
const inviting = ref(false)

async function invite() {
  const email = inviteEmail.value.trim()
  if (!email) return
  inviting.value = true
  try {
    const { error } = await runAction('organization.invite', (actionId) =>
      authClient.organization.inviteMember({
        email,
        role: inviteRole.value,
        fetchOptions: { headers: actionHeaders(actionId) },
      }),
    )
    if (error) throw new Error(error.message ?? 'Could not send invitation')
    inviteEmail.value = ''
    toast.success(`Invitation sent to ${email}`)
    await queryClient.invalidateQueries({ queryKey: ['org', 'invitations'] })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    inviting.value = false
  }
}

async function changeRole(memberId: string, role: MemberRole) {
  const { error } = await authClient.organization.updateMemberRole({ memberId, role })
  if (error) {
    toast.error(error.message ?? 'Could not update role')
    return
  }
  toast.success('Role updated')
  await queryClient.invalidateQueries({ queryKey: ['org'] })
}

async function removeMember(memberId: string) {
  const { error } = await authClient.organization.removeMember({ memberIdOrEmail: memberId })
  if (error) {
    toast.error(error.message ?? 'Could not remove member')
    return
  }
  toast.success('Member removed')
  await queryClient.invalidateQueries({ queryKey: ['org', 'members'] })
}

const router = useRouter()
const organizationId = computed(() => org.data.value?.id ?? '')
const isOwner = computed(() => org.data.value?.myRole === 'owner')
const ownerCount = computed(() => members.data.value?.filter((m) => m.role === 'owner').length ?? 0)
const canLeave = computed(() => !isOwner.value || ownerCount.value > 1)

const orgName = ref('')
watch(
  () => org.data.value?.name,
  (current) => {
    if (current && !orgName.value) orgName.value = current
  },
  { immediate: true },
)
const renaming = ref(false)
async function rename() {
  const name = orgName.value.trim()
  if (!name) return
  renaming.value = true
  try {
    const { error } = await authClient.organization.update({
      organizationId: organizationId.value,
      data: { name },
    })
    if (error) throw new Error(error.message ?? `Could not rename the ${workspace.one}`)
    toast.success(`${workspace.One} renamed`)
    await queryClient.invalidateQueries({ queryKey: ['org'] })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    renaming.value = false
  }
}

const transferTo = ref<{ id: string; label: string } | null>(null)
const transferring = ref(false)
async function transferOwnership() {
  const target = transferTo.value
  const me = members.data.value?.find((m) => m.userId === myUserId.value)
  if (!target || !me) return
  transferring.value = true
  try {
    const promoted = await authClient.organization.updateMemberRole({
      organizationId: organizationId.value,
      memberId: target.id,
      role: 'owner',
    })
    if (promoted.error) throw new Error(promoted.error.message ?? 'Could not transfer ownership')
    const stepped = await authClient.organization.updateMemberRole({
      organizationId: organizationId.value,
      memberId: me.id,
      role: 'admin',
    })
    if (stepped.error) {
      throw new Error(
        `${target.label} is now an owner, but you are still one: ${stepped.error.message}`,
      )
    }
    toast.success(`${target.label} now owns this ${workspace.one}`)
    transferTo.value = null
    await queryClient.invalidateQueries({ queryKey: ['org'] })
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    transferring.value = false
  }
}

async function exitWorkspace(message: string) {
  await authClient.organization.setActive({ organizationId: null })
  await queryClient.invalidateQueries()
  toast.success(message)
  await router.push({ name: 'dashboard' })
}

const leaveOpen = ref(false)
const leaving = ref(false)
async function leave() {
  leaving.value = true
  try {
    const { error } = await authClient.organization.leave({ organizationId: organizationId.value })
    if (error) throw new Error(error.message ?? `Could not leave the ${workspace.one}`)
    leaveOpen.value = false
    await exitWorkspace(`You left ${org.data.value?.name ?? `the ${workspace.one}`}`)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    leaving.value = false
  }
}

const deleteOpen = ref(false)
const deleteConfirmation = ref('')
const deleting = ref(false)
async function deleteWorkspace() {
  deleting.value = true
  try {
    const { error } = await runAction('organization.delete', (actionId) =>
      authClient.organization.delete({
        organizationId: organizationId.value,
        fetchOptions: { headers: actionHeaders(actionId) },
      }),
    )
    if (error) throw new Error(error.message ?? `Could not delete the ${workspace.one}`)
    deleteOpen.value = false
    await exitWorkspace(`${workspace.One} deleted`)
  } catch (e) {
    toast.error(errorMessage(e))
  } finally {
    deleting.value = false
  }
}

async function cancelInvitation(invitationId: string) {
  const { error } = await authClient.organization.cancelInvitation({ invitationId })
  if (error) {
    toast.error(error.message ?? 'Could not cancel invitation')
    return
  }
  await queryClient.invalidateQueries({ queryKey: ['org', 'invitations'] })
}
</script>

<template>
  <div class="flex max-w-4xl flex-col gap-6">
    <div>
      <h1 class="text-2xl font-semibold">{{ org.data.value?.name ?? workspace.One }}</h1>
      <p v-if="org.data.value" class="text-sm text-muted-foreground">
        {{ org.data.value.slug }} · your role: {{ org.data.value.myRole }}
      </p>
    </div>

    <Card v-if="canManage">
      <CardHeader>
        <CardTitle>{{ workspace.One }} name</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="flex items-end gap-2" @submit.prevent="rename">
          <div class="flex flex-1 flex-col gap-2">
            <Label for="org-name">Name</Label>
            <Input id="org-name" v-model="orgName" maxlength="100" required />
          </div>
          <Button type="submit" :disabled="renaming || orgName.trim() === org.data.value?.name"
            >Save</Button
          >
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead v-if="canManage" class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="m in members.data.value ?? []" :key="m.id">
              <TableCell>{{ m.name || '—' }}</TableCell>
              <TableCell>{{ m.email }}</TableCell>
              <TableCell>
                <Select
                  v-if="canManage && m.role !== 'owner' && m.userId !== myUserId"
                  :model-value="m.role"
                  @update:model-value="(v) => changeRole(m.id, v as MemberRole)"
                >
                  <SelectTrigger class="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">member</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
                <Badge v-else variant="outline">{{ m.role }}</Badge>
              </TableCell>
              <TableCell v-if="canManage" class="text-right">
                <Button
                  v-if="isOwner && m.role !== 'owner' && m.userId !== myUserId"
                  variant="ghost"
                  size="sm"
                  @click="transferTo = { id: m.id, label: m.name || m.email }"
                >
                  Make owner
                </Button>
                <Button
                  v-if="m.role !== 'owner' && m.userId !== myUserId"
                  variant="ghost"
                  size="sm"
                  @click="removeMember(m.id)"
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card v-if="canManage">
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <form class="flex items-end gap-2" @submit.prevent="invite">
          <div class="flex flex-1 flex-col gap-2">
            <Label for="invite-email">Email</Label>
            <Input
              id="invite-email"
              v-model="inviteEmail"
              type="email"
              placeholder="colleague@example.com"
              required
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label>Role</Label>
            <Select v-model="inviteRole">
              <SelectTrigger class="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" :disabled="inviting">Invite</Button>
        </form>

        <div v-if="pendingInvitations.length" class="flex flex-col gap-2">
          <p class="text-sm font-medium">Pending invitations</p>
          <Table>
            <TableBody>
              <TableRow v-for="inv in pendingInvitations" :key="inv.id">
                <TableCell>{{ inv.email }}</TableCell>
                <TableCell
                  ><Badge variant="outline">{{ inv.role }}</Badge></TableCell
                >
                <TableCell class="text-muted-foreground">
                  expires {{ new Date(inv.expiresAt).toLocaleDateString() }}
                </TableCell>
                <TableCell class="text-right">
                  <Button variant="ghost" size="sm" @click="cancelInvitation(inv.id)"
                    >Cancel</Button
                  >
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    <Card class="border-destructive/40">
      <CardHeader>
        <CardTitle>Leave or delete</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <p v-if="!canLeave" class="text-muted-foreground">
          You are the only owner. Make someone else owner before leaving.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="!canLeave" @click="leaveOpen = true">
            Leave {{ workspace.one }}
          </Button>
          <Button
            v-if="isOwner"
            variant="destructive"
            @click="((deleteConfirmation = ''), (deleteOpen = true))"
          >
            Delete {{ workspace.one }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Dialog :open="transferTo !== null" @update:open="(open) => !open && (transferTo = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make {{ transferTo?.label }} the owner?</DialogTitle>
          <DialogDescription>
            They get full control, including billing and deletion. You stay as an admin.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="transferTo = null">Cancel</Button>
          <Button :disabled="transferring" @click="transferOwnership">Transfer ownership</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="leaveOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave {{ org.data.value?.name }}?</DialogTitle>
          <DialogDescription>
            You lose access to its data until someone invites you again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="leaveOpen = false">Cancel</Button>
          <Button variant="destructive" :disabled="leaving" @click="leave">Leave</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {{ org.data.value?.name }}?</DialogTitle>
          <DialogDescription>
            Every member loses access, all its data is deleted and its subscription is cancelled.
            This cannot be undone. Type the {{ workspace.one }} name to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          v-model="deleteConfirmation"
          aria-label="Confirmation"
          :placeholder="org.data.value?.name"
        />
        <DialogFooter>
          <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="deleting || deleteConfirmation.trim() !== org.data.value?.name"
            @click="deleteWorkspace"
          >
            Delete forever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
