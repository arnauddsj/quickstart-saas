import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authClient = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authClient }))

const { default: AuthCallback } = await import('./AuthCallback.vue')

async function visit(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/callback', component: AuthCallback },
      { path: '/:path(.*)*', component: { template: '<p>landed</p>' } },
      { path: '/login', name: 'login', component: { template: '<p>login</p>' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(AuthCallback, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  vi.clearAllMocks()
  authClient.getSession.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
})

describe('AuthCallback', () => {
  it('follows a same-site redirect once the session exists', async () => {
    const { router } = await visit('/auth/callback?redirect=/settings/billing')
    expect(router.currentRoute.value.fullPath).toBe('/settings/billing')
  })

  it('ignores a redirect that points off-site', async () => {
    for (const target of ['//evil.example/x', 'https://evil.example']) {
      const { router } = await visit(`/auth/callback?redirect=${encodeURIComponent(target)}`)
      expect(router.currentRoute.value.fullPath).toBe('/')
    }
  })

  it('explains an expired link and a server failure differently', async () => {
    const expired = await visit('/auth/callback?error=INVALID_TOKEN')
    expect(expired.wrapper.text()).toContain('This link is invalid or has expired.')

    authClient.getSession.mockResolvedValue({ data: null, error: { status: 502 } })
    const down = await visit('/auth/callback')
    expect(down.wrapper.text()).toContain('Could not reach the server')
  })
})
