<script setup lang="ts">
// docs/notifications.md
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from '@lucide/vue'
import { queryClient, trpc, useTRPCMutation, useTRPCQuery } from '@/services/server'
import type { AppNotification } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const POLL_MS = 30_000

const router = useRouter()
const list = useTRPCQuery(() => trpc.notification.list.query(), ['notification'], {
  refetchInterval: POLL_MS,
})
const unread = computed(() => list.data.value?.unread ?? 0)
const items = computed(() => list.data.value?.items ?? [])

const refresh = () => queryClient.invalidateQueries({ queryKey: ['notification'] })
const markRead = useTRPCMutation((id: string) => trpc.notification.markRead.mutate({ id }), {
  onSuccess: refresh,
})
const markAllRead = useTRPCMutation(() => trpc.notification.markAllRead.mutate(), {
  onSuccess: refresh,
})

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function ago(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  if (Math.abs(minutes) < 60 * 24) return relative.format(Math.round(minutes / 60), 'hour')
  return relative.format(Math.round(minutes / (60 * 24)), 'day')
}

async function open(n: AppNotification) {
  if (!n.read) markRead.mutate(n.id)
  if (n.link) await router.push(n.link)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="relative"
        :aria-label="unread ? `Notifications, ${unread} unread` : 'Notifications'"
      >
        <Bell class="size-4" />
        <span
          v-if="unread"
          class="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
        >
          {{ unread > 9 ? '9+' : unread }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-80" align="start">
      <div class="flex items-center justify-between px-2 py-1.5">
        <DropdownMenuLabel class="p-0">Notifications</DropdownMenuLabel>
        <Button
          v-if="unread"
          variant="link"
          size="sm"
          class="h-auto p-0 text-xs"
          @click="markAllRead.mutate()"
        >
          Mark all as read
        </Button>
      </div>
      <DropdownMenuSeparator />
      <p v-if="items.length === 0" class="px-2 py-6 text-center text-sm text-muted-foreground">
        You are all caught up.
      </p>
      <DropdownMenuItem
        v-for="n in items"
        :key="n.id"
        class="flex flex-col items-start gap-0.5"
        :class="{ 'opacity-60': n.read }"
        @select="open(n)"
      >
        <span class="flex w-full items-center gap-2 text-sm" :class="{ 'font-medium': !n.read }">
          <span v-if="!n.read" class="size-1.5 shrink-0 rounded-full bg-primary" />
          {{ n.title }}
        </span>
        <span v-if="n.body" class="text-xs text-muted-foreground">{{ n.body }}</span>
        <span class="text-xs text-muted-foreground">{{ ago(n.createdAt) }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
