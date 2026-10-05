<script setup lang="ts">
import { workspace } from '@/lib/brand'
import { trpc, useTRPCQuery } from '@/services/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const organizations = useTRPCQuery(
  () => trpc.admin.listOrganizations.query({ limit: 100 }),
  ['admin', 'organizations'],
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">{{ workspace.Many }}</h1>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="o in organizations.data.value ?? []" :key="o.id">
          <TableCell>{{ o.name }}</TableCell>
          <TableCell class="text-muted-foreground">{{ o.slug }}</TableCell>
          <TableCell class="text-muted-foreground">{{
            new Date(o.createdAt).toLocaleDateString()
          }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
