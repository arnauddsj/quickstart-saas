<script setup lang="ts">
// docs/admin.md
import { RouterLink } from 'vue-router'
import { trpc, useTRPCQuery } from '@/services/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const stats = useTRPCQuery(() => trpc.admin.stats.query(), ['admin', 'stats'], {
  staleTime: 15_000,
})

const cards = [
  { key: 'users', label: 'Users' },
  { key: 'newUsers7d', label: 'New, last 7 days' },
  { key: 'newUsers30d', label: 'New, last 30 days' },
  { key: 'activeUsers7d', label: 'Active, last 7 days' },
  { key: 'activeUsers30d', label: 'Active, last 30 days' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'paidSubscriptions', label: 'Paid subscriptions' },
] as const

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Admin</h1>
      <p class="text-sm text-muted-foreground">
        Activity is derived from sessions: a person is active while a session is refreshed.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card v-for="c in cards" :key="c.key">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-muted-foreground">{{ c.label }}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton v-if="stats.isPending.value" class="h-8 w-16" />
          <div v-else class="text-3xl font-semibold tabular-nums">
            {{ stats.data.value?.[c.key] ?? 0 }}
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Recent sign-ups</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="u in stats.data.value?.recentSignups ?? []" :key="u.id">
              <TableCell>{{ u.email }}</TableCell>
              <TableCell>{{ u.name || '—' }}</TableCell>
              <TableCell>{{ fmt(u.createdAt) }}</TableCell>
              <TableCell>{{ fmt(u.lastLoginAt) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p class="mt-3 text-sm">
          <RouterLink :to="{ name: 'admin-users' }" class="underline">Manage users</RouterLink>
        </p>
      </CardContent>
    </Card>
  </div>
</template>
