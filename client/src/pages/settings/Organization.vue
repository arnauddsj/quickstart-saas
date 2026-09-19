<script setup lang="ts">
import { workspace } from '@/lib/brand'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { actionHeaders, runAction } from '@/lib/monitoring'
import { errorMessage, queryClient, trpc, useTRPCQuery } from '@/services/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  </div>
</template>
