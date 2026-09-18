<script setup lang="ts">
import { trpc, useTRPCQuery } from '@/services/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const me = useTRPCQuery(() => trpc.user.me.query(), ['user', 'me'])
const org = useTRPCQuery(() => trpc.org.current.query(), ['org', 'current'])

const placeholders = [
  { title: 'Activity', description: 'Recent events in your organization.' },
  { title: 'Usage', description: 'How much of your plan you have used.' },
  { title: 'Team', description: 'Who has access to this workspace.' },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Dashboard</h1>
        <p class="text-sm text-muted-foreground">
          <Skeleton v-if="me.isPending.value" class="inline-block h-4 w-40" />
          <template v-else-if="me.data.value">Signed in as {{ me.data.value.email }}</template>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Skeleton v-if="org.isPending.value" class="h-6 w-32" />
        <template v-else-if="org.data.value">
          <span class="font-medium">{{ org.data.value.name }}</span>
          <Badge variant="secondary">{{ org.data.value.plan }}</Badge>
        </template>
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-3">
      <Card v-for="card in placeholders" :key="card.title">
        <CardHeader>
          <CardTitle>{{ card.title }}</CardTitle>
          <CardDescription>{{ card.description }}</CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Nothing here yet.</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
