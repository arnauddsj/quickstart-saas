<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import {
  Bug,
  Building2,
  ChartLine,
  CreditCard,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  LogOut,
  Shield,
  UserRound,
  Users,
} from '@lucide/vue'
import { authClient } from '@/lib/auth'
import { queryClient } from '@/services/server'
import { setMonitoringUser } from '@/lib/monitoring'
import { brand, workspace } from '@/lib/brand'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import LegalFooter from '@/components/LegalFooter.vue'

const router = useRouter()
const session = authClient.useSession()
const user = computed(() => session.value.data?.user ?? null)
const isAdmin = computed(() => user.value?.role === 'admin')

const nav = [
  { to: { name: 'dashboard' }, label: 'Dashboard', icon: LayoutDashboard },
  { to: { name: 'projects' }, label: 'Projects', icon: FolderKanban },
  ...(brand.teams
    ? [{ to: { name: 'settings-organization' }, label: workspace.One, icon: Building2 }]
    : []),
  { to: { name: 'settings-billing' }, label: 'Billing', icon: CreditCard },
  { to: { name: 'settings-account' }, label: 'Account', icon: UserRound },
]
const adminNav = [
  { to: { name: 'admin-dashboard' }, label: 'Overview', icon: Gauge },
  { to: { name: 'admin-analytics' }, label: 'Analytics', icon: ChartLine },
  { to: { name: 'admin-users' }, label: 'Users', icon: Users },
  { to: { name: 'admin-organizations' }, label: workspace.Many, icon: Shield },
]
const trackerUrl = import.meta.env.VITE_GLITCHTIP_URL

async function signOut() {
  await authClient.signOut()
  setMonitoringUser(null)
  queryClient.clear()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="flex w-64 shrink-0 flex-col border-r bg-sidebar p-4">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-lg font-semibold">{{ brand.name }}</span>
        <NotificationBell />
      </div>
      <OrgSwitcher v-if="brand.teams" />
      <nav class="mt-6 flex flex-col gap-1">
        <RouterLink
          v-for="item in nav"
          :key="item.label"
          :to="item.to"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          active-class="bg-sidebar-accent font-medium"
        >
          <component :is="item.icon" class="size-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
      <template v-if="isAdmin">
        <Separator class="my-4" />
        <div class="mb-1 px-3 text-xs font-medium uppercase text-muted-foreground">Admin</div>
        <nav class="flex flex-col gap-1">
          <RouterLink
            v-for="item in adminNav"
            :key="item.label"
            :to="item.to"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
            active-class="bg-sidebar-accent font-medium"
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </RouterLink>
          <a
            v-if="trackerUrl"
            :href="trackerUrl"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            <Bug class="size-4" />
            Errors
          </a>
        </nav>
      </template>
      <div class="mt-auto flex flex-col gap-2 pt-4">
        <div class="truncate px-3 text-xs text-muted-foreground">{{ user?.email }}</div>
        <Button variant="ghost" size="sm" class="justify-start" @click="signOut">
          <LogOut class="size-4" />
          Sign out
        </Button>
        <LegalFooter class="px-3 pt-2" />
      </div>
    </aside>
    <main class="flex-1 p-8">
      <RouterView />
    </main>
  </div>
</template>
