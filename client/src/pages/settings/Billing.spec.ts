import { workspace } from '@/lib/brand'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ServerModule from '@/services/server'

const trpc = vi.hoisted(() => ({
  org: { current: { query: vi.fn() } },
  billing: {
    getSubscription: { query: vi.fn() },
    createCheckout: { mutate: vi.fn() },
    createPortal: { mutate: vi.fn() },
  },
}))
vi.mock('@/services/server', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerModule>()),
  trpc,
}))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const { default: Billing } = await import('./Billing.vue')

async function render(myRole: string) {
  trpc.org.current.query.mockResolvedValue({ id: 'o1', name: 'Acme', myRole, plan: 'FREE' })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Billing }],
  })
  await router.push('/')
  const wrapper = mount(Billing, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  trpc.billing.getSubscription.query.mockResolvedValue({
    plan: 'FREE',
    status: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: true,
  })
})

describe('Billing page', () => {
  it('offers the upgrade and portal to owners and admins', async () => {
    for (const role of ['owner', 'admin']) {
      const text = (await render(role)).text()
      expect(text).toContain('Upgrade to Pro')
      expect(text).toContain('Manage billing')
    }
  })

  it('explains to a member why the plan cannot be changed, instead of a button that fails', async () => {
    const text = (await render('member')).text()
    expect(text).not.toContain('Upgrade to Pro')
    expect(text).not.toContain('Manage billing')
    expect(text).toContain(`Only owners and admins of this ${workspace.one} can change its plan.`)
  })
})
