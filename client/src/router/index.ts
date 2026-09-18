import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import { toast } from 'vue-sonner'
import { authClient } from '@/lib/auth'
import { captureClientError, setMonitoringUser } from '@/lib/monitoring'
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
        {
          path: 'settings/organization',
          name: 'settings-organization',
          component: () => import('@/pages/settings/Organization.vue'),
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
        { path: 'login', name: 'login', component: () => import('@/pages/Login.vue') },
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

router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  if (!requiresAuth) return true

  const { data, error } = await authClient.getSession()
  if (error) {
    toast.error('Could not reach the server. Try again in a moment.')
    return false
  }
  if (!data) return { name: 'login', query: { redirect: to.fullPath } }
  setMonitoringUser(data.user.id)

  const requiresAdmin = to.matched.some((r) => r.meta.requiresAdmin)
  if (requiresAdmin && data.user.role !== 'admin') return { name: 'dashboard' }

  const requiresOrg = to.matched.some((r) => r.meta.requiresOrg)
  if (requiresOrg && !data.session.activeOrganizationId) {
    const orgs = await authClient.organization.list()
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
    requiresAdmin?: boolean
    requiresOrg?: boolean
    wide?: boolean
  }
}
