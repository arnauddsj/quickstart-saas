import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ServerModule from '@/services/server'
import { overlayStubs } from '@/test/stubs'

const ok = { data: {}, error: null }
const authClient = vi.hoisted(() => ({
  useSession: vi.fn(),
  organization: {
    update: vi.fn(),
    updateMemberRole: vi.fn(),
    leave: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
    inviteMember: vi.fn(),
    removeMember: vi.fn(),
    cancelInvitation: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ authClient }))

const trpc = vi.hoisted(() => ({
  org: {
    current: { query: vi.fn() },
    members: { query: vi.fn() },
    invitations: { query: vi.fn() },
  },
}))
vi.mock('@/services/server', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerModule>()),
  trpc,
}))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { default: Organization } = await import('./Organization.vue')

const owner = { id: 'm1', userId: 'u1', role: 'owner', name: 'Olive', email: 'olive@test.io' }
const mate = { id: 'm2', userId: 'u2', role: 'member', name: 'Mat', email: 'mat@test.io' }

async function render(myRole: string, members = [owner, mate]) {
  trpc.org.current.query.mockResolvedValue({
    id: 'o1',
    name: 'Acme',
    slug: 'acme',
    myRole,
    plan: 'FREE',
  })
  trpc.org.members.query.mockResolvedValue(members)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Organization },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
    ],
  })
  await router.push('/')
  const wrapper = mount(Organization, {
    attachTo: document.body,
    global: {
      plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
      stubs: overlayStubs,
    },
  })
  await flushPromises()
  return { wrapper, router }
}

const button = (wrapper: Awaited<ReturnType<typeof render>>['wrapper'], text: string) => {
  const found = wrapper.findAll('button').find((b) => b.text().trim() === text)
  if (!found) throw new Error(`no button "${text}"`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  authClient.useSession.mockReturnValue(ref({ data: { user: { id: 'u1' }, session: {} } }))
  for (const fn of Object.values(authClient.organization)) fn.mockResolvedValue(ok)
  trpc.org.invitations.query.mockResolvedValue([])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Workspace settings', () => {
  it('shows a member no rename, transfer or delete, but lets them leave', async () => {
    const { wrapper } = await render('member')
    expect(wrapper.find('#org-name').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Make owner')
    expect(wrapper.text()).not.toContain('Delete workspace')
    expect(button(wrapper, 'Leave workspace').attributes('disabled')).toBeUndefined()
  })

  it('renames the workspace', async () => {
    const { wrapper } = await render('owner')
    await wrapper.find('#org-name').setValue('Acme Labs')
    await wrapper.find('#org-name').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(authClient.organization.update).toHaveBeenCalledWith({
      organizationId: 'o1',
      data: { name: 'Acme Labs' },
    })
  })

  it('transfers ownership: promotes the member, then steps the owner down to admin', async () => {
    const { wrapper } = await render('owner')
    await button(wrapper, 'Make owner').trigger('click')
    await button(wrapper, 'Transfer ownership').trigger('click')
    await flushPromises()
    expect(authClient.organization.updateMemberRole.mock.calls).toEqual([
      [{ organizationId: 'o1', memberId: 'm2', role: 'owner' }],
      [{ organizationId: 'o1', memberId: 'm1', role: 'admin' }],
    ])
  })

  it('keeps the only owner from leaving', async () => {
    const { wrapper } = await render('owner')
    expect(button(wrapper, 'Leave workspace').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('You are the only owner')
  })

  it('deletes only after the name is typed, then leaves the workspace', async () => {
    const { wrapper, router } = await render('owner')
    await button(wrapper, 'Delete workspace').trigger('click')
    expect(button(wrapper, 'Delete forever').attributes('disabled')).toBeDefined()

    await wrapper.find('input[aria-label="Confirmation"]').setValue('Acme')
    await button(wrapper, 'Delete forever').trigger('click')
    await flushPromises()
    expect(authClient.organization.delete).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'o1' }),
    )
    expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: null })
    expect(router.currentRoute.value.name).toBe('dashboard')
  })
})
