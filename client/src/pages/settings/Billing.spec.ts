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

async function render(myRole: string, path = '/') {
  trpc.org.current.query.mockResolvedValue({ id: 'o1', name: 'Acme', myRole, plan: 'FREE' })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Billing }],
  })
  await router.push(path)
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
    usage: [{ limit: 'projects', used: 2, max: 3 }],
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

  it('keeps a past-due workspace on its plan and asks the owner to fix the card', async () => {
    trpc.billing.getSubscription.query.mockResolvedValue({
      plan: 'PRO',
      status: 'past_due',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
      usage: [],
    })
    const wrapper = await render('owner')
    expect(wrapper.find('[role="alert"]').text()).toContain('The last payment failed')
    expect(wrapper.text()).toContain('Update payment method')
    expect(wrapper.text()).not.toContain('Upgrade to Pro')
  })

  it('shows usage against each plan limit', async () => {
    const text = (await render('owner')).text()
    expect(text).toContain('projects')
    expect(text).toContain('2 of 3')
  })

  it('waits for Stripe to confirm a checkout instead of claiming success', async () => {
    const { toast } = await import('vue-sonner')
    const wrapper = await render('owner', '/?status=success')
    expect(wrapper.find('[role="status"]').text()).toContain('Waiting for the confirmation')
    expect(wrapper.text()).not.toContain('Upgrade to Pro')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('announces the plan once the webhook has landed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { toast } = await import('vue-sonner')
    const wrapper = await render('owner', '/?status=success')
    trpc.billing.getSubscription.query.mockResolvedValue({
      plan: 'PRO',
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
      usage: [],
    })
    await vi.advanceTimersByTimeAsync(2_100)
    await flushPromises()
    vi.useRealTimers()
    expect(toast.success).toHaveBeenCalledWith('You are on PRO now')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('explains to a member why the plan cannot be changed, instead of a button that fails', async () => {
    const text = (await render('member')).text()
    expect(text).not.toContain('Upgrade to Pro')
    expect(text).not.toContain('Manage billing')
    expect(text).toContain(`Only owners and admins of this ${workspace.one} can change its plan.`)
  })
})
