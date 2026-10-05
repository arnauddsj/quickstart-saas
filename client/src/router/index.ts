import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { captureClientError, setMonitoringUser } from '@/lib/monitoring'
import { brand } from '@/lib/brand'
// docs/auth.md

const RELOAD_KEY = 'chunk-reload-at'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      meta: { requiresAuth: true, requiresOrg: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('@/pages/Dashboard.vue') },
        { path: 'projects', name: 'projects', component: () => import('@/pages/Projects.vue') },
        {
          path: 'settings/organization',
          name: 'settings-organization',
          component: () => import('@/pages/settings/Organization.vue'),
          meta: { requiresTeams: true },
        },
        {
          path: 'settings/account',
          name: 'settings-account',
          component: () => import('@/pages/settings/Account.vue'),
        },
        {
          path: 'settings/billing',
          name: 'settings-billing',
          component: () => import('@/pages/settings/Billing.vue'),
        },
        {
          path: 'admin',
          name: 'admin-dashboard',
          component: () => import('@/pages/admin/Dashboard.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/analytics',
          name: 'admin-analytics',
          component: () => import('@/pages/admin/Analytics.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/users',
          name: 'admin-users',
          component: () => import('@/pages/admin/Users.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/organizations',
          name: 'admin-organizations',
          component: () => import('@/pages/admin/Organizations.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        {
          path: 'login',
          name: 'login',
          component: () => import('@/pages/Login.vue'),
          meta: { guestOnly: true },
        },
        {
          path: 'privacy',
          name: 'privacy',
          component: () => import('@/pages/legal/Privacy.vue'),
          meta: { wide: true },
        },
        {
          path: 'legal',
          name: 'legal',
          component: () => import('@/pages/legal/LegalNotice.vue'),
          meta: { wide: true },
        },
        {
          path: 'terms',
          name: 'terms',
          component: () => import('@/pages/legal/Terms.vue'),
          meta: { wide: true },
        },
        {
          path: 'auth/callback',
          name: 'auth-callback',
          component: () => import('@/pages/AuthCallback.vue'),
        },
        {
          path: 'onboarding',
          name: 'onboarding',
          component: () => import('@/pages/Onboarding.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'accept-invitation/:id',
          name: 'accept-invitation',
          component: () => import('@/pages/AcceptInvitation.vue'),
          meta: { requiresAuth: true },
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AuthLayout.vue'),
      children: [
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('@/pages/NotFound.vue'),
        },
      ],
    },
  ],
})

const UNREACHABLE = 'Could not reach the server. Try again in a moment.'
const RECONNECTING_TOAST = 'reconnecting'

const GATEWAY_DOWN = [0, 502, 503, 504]

async function untilReachable<T extends { error: { status?: number } | null }>(
  call: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await call()
    if (!result.error || !GATEWAY_DOWN.includes(result.error.status ?? 0)) {
      toast.dismiss(RECONNECTING_TOAST)
      return result
    }
    toast.loading('Reconnecting to the server…', { id: RECONNECTING_TOAST })
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 5000)))
  }
}

function afterSignIn(redirect: unknown): string {
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/'
}

router.beforeEach(async (to, from) => {
  if (!brand.teams && to.matched.some((r) => r.meta.requiresTeams)) return { name: 'dashboard' }
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  const guestOnly = to.matched.some((r) => r.meta.guestOnly)
  if (!requiresAuth && !guestOnly) return true

  const ask = <T extends { error: { status?: number } | null }>(call: () => Promise<T>) =>
    from === START_LOCATION ? untilReachable(call) : call()

  const { data, error } = await ask(() => authClient.getSession())
  if (error) {
    toast.error(UNREACHABLE)
    return false
  }
  if (guestOnly) return data ? afterSignIn(to.query.redirect) : true
  if (!data) return { name: 'login', query: { redirect: to.fullPath } }
  setMonitoringUser(data.user.id)

  const requiresAdmin = to.matched.some((r) => r.meta.requiresAdmin)
  if (requiresAdmin && data.user.role !== 'admin') return { name: 'dashboard' }

  const requiresOrg = to.matched.some((r) => r.meta.requiresOrg)
  if (requiresOrg && !data.session.activeOrganizationId) {
    const orgs = await ask(() => authClient.organization.list())
    if (orgs.error) {
      toast.error(UNREACHABLE)
      return false
    }
    const first = orgs.data?.[0]
    if (!first) return { name: 'onboarding' }
    await authClient.organization.setActive({ organizationId: first.id })
  }
  return true
})

router.onError((error: unknown, to: RouteLocationNormalized) => {
  const message = error instanceof Error ? error.message : String(error)
  const isChunkError =
    /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(
      message,
    )
  if (!isChunkError) return captureClientError(error, 'router.navigation')
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  if (Date.now() - last < 10_000) return captureClientError(error, 'router.chunk_load')
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  window.location.assign(to.fullPath)
})

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    requiresAdmin?: boolean
    requiresOrg?: boolean
    requiresTeams?: boolean
    wide?: boolean
  }
}
