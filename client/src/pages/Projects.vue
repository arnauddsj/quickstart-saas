<script setup lang="ts">
// docs/reference-feature.md
import { computed, ref } from 'vue'
import { FolderKanban, Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { errorMessage, queryClient, trpc, useTRPCMutation, useTRPCQuery } from '@/services/server'
import type { Project } from '@/types/api'
import { workspace } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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

const projects = useTRPCQuery(() => trpc.project.list.query(), ['project', 'list'])
const org = useTRPCQuery(() => trpc.org.current.query(), ['org', 'current'])
const canDelete = computed(
  () => org.data.value?.myRole === 'owner' || org.data.value?.myRole === 'admin',
)
const rows = computed(() => projects.data.value?.projects ?? [])
const atLimit = computed(() => {
  const data = projects.data.value
  return data ? data.projects.length >= data.limit : false
})

const editing = ref<Project | 'new' | null>(null)
const name = ref('')
const toDelete = ref<Project | null>(null)

function openEditor(target: Project | 'new') {
  editing.value = target
  name.value = target === 'new' ? '' : target.name
}

const refresh = () => queryClient.invalidateQueries({ queryKey: ['project'] })

const save = useTRPCMutation(
  (input: { id?: string; name: string }) =>
    input.id
      ? trpc.project.rename.mutate({ id: input.id, name: input.name })
      : trpc.project.create.mutate({ name: input.name }),
  {
    onSuccess: async (_, input) => {
      toast.success(input.id ? 'Project renamed' : 'Project created')
      editing.value = null
      await refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  },
)

const remove = useTRPCMutation((id: string) => trpc.project.delete.mutate({ id }), {
  onSuccess: async () => {
    toast.success('Project deleted')
    toDelete.value = null
    await refresh()
  },
  onError: (e) => toast.error(errorMessage(e)),
})

function submit() {
  const target = editing.value
  if (!target) return
  save.mutate({ id: target === 'new' ? undefined : target.id, name: name.value })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Projects</h1>
        <p v-if="projects.data.value" class="text-sm text-muted-foreground">
          {{ rows.length }} of {{ projects.data.value.limit }} on your plan
        </p>
      </div>
      <Button :disabled="atLimit" @click="openEditor('new')">
        <Plus class="size-4" />
        New project
      </Button>
    </div>

    <Skeleton v-if="projects.isPending.value" class="h-32 w-full" />

    <Card v-else-if="rows.length === 0">
      <CardContent class="flex flex-col items-center gap-3 py-12 text-center">
        <FolderKanban class="size-8 text-muted-foreground" />
        <div>
          <p class="font-medium">No projects yet</p>
          <p class="text-sm text-muted-foreground">
            Projects are shared with everyone in this {{ workspace.one }}.
          </p>
        </div>
        <Button @click="openEditor('new')">Create a project</Button>
      </CardContent>
    </Card>

    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Created by</TableHead>
          <TableHead>Created</TableHead>
          <TableHead class="text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="p in rows" :key="p.id">
          <TableCell class="font-medium">{{ p.name }}</TableCell>
          <TableCell class="text-muted-foreground">{{ p.createdBy ?? 'Former member' }}</TableCell>
          <TableCell class="text-muted-foreground">{{
            new Date(p.createdAt).toLocaleDateString()
          }}</TableCell>
          <TableCell class="space-x-1 text-right">
            <Button variant="outline" size="sm" @click="openEditor(p)">Rename</Button>
            <Button v-if="canDelete" variant="destructive" size="sm" @click="toDelete = p">
              Delete
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <Dialog :open="editing !== null" @update:open="(open) => !open && (editing = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editing === 'new' ? 'New project' : 'Rename project' }}</DialogTitle>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div class="flex flex-col gap-2">
            <Label for="project-name">Name</Label>
            <Input id="project-name" v-model="name" maxlength="100" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="editing = null">Cancel</Button>
            <Button type="submit" :disabled="save.isPending.value || !name.trim()">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="toDelete !== null" @update:open="(open) => !open && (toDelete = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            {{ toDelete?.name }} is deleted for everyone in this {{ workspace.one }}. It cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="toDelete = null">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="remove.isPending.value"
            @click="toDelete && remove.mutate(toDelete.id)"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
