import { workspace } from '@/lib/brand'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueRouter from 'vue-router'
import { overlayStubs } from '@/test/stubs'

const authClient = vi.hoisted(() => ({
  useSession: vi.fn(),
  useListOrganizations: vi.fn(),
  organization: { create: vi.fn(), setActive: vi.fn() },
}))
vi.mock('@/lib/auth', () => ({ authClient }))

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof VueRouter>()),
  useRouter: () => ({ push }),
}))

const invalidateQueries = vi.hoisted(() => vi.fn())
vi.mock('@/services/server', () => ({
  queryClient: { invalidateQueries },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong'),
}))

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const { default: OrgSwitcher } = await import('./OrgSwitcher.vue')

const render = () => mount(OrgSwitcher, { global: { stubs: overlayStubs } })
const menuItem = (wrapper: ReturnType<typeof render>, text: string) => {
  const found = wrapper.findAll('[data-menu-item]').find((b) => b.text().trim() === text)
  if (!found) throw new Error(`no menu item "${text}"`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  authClient.useSession.mockReturnValue(ref({ data: { session: { activeOrganizationId: 'o1' } } }))
  authClient.useListOrganizations.mockReturnValue(
    ref({
      data: [
        { id: 'o1', name: 'Acme' },
        { id: 'o2', name: 'Globex' },
      ],
    }),
  )
  authClient.organization.create.mockResolvedValue({ data: { id: 'o3' }, error: null })
  authClient.organization.setActive.mockResolvedValue({ data: {}, error: null })
})

describe('OrgSwitcher', () => {
  it('shows the active organization on the trigger and every organization in the menu', () => {
    const wrapper = render()
    expect(wrapper.findAll('button')[0]!.text()).toContain('Acme')
    expect(wrapper.findAll('[data-menu-item]').map((b) => b.text().trim())).toEqual([
      'Acme',
      'Globex',
      `Create ${workspace.one}`,
    ])
  })

  it('switches, refreshes every query and returns to the dashboard', async () => {
    const wrapper = render()
    await menuItem(wrapper, 'Globex').trigger('click')
    await flushPromises()
    expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: 'o2' })
    expect(invalidateQueries).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })

  it('does nothing when the active organization is picked again', async () => {
    const wrapper = render()
    await menuItem(wrapper, 'Acme').trigger('click')
    await flushPromises()
    expect(authClient.organization.setActive).not.toHaveBeenCalled()
  })

  it('creates an organization with a unique slug and makes it active', async () => {
    const wrapper = render()
    await menuItem(wrapper, `Create ${workspace.one}`).trigger('click')
    await wrapper.find('#org-name').setValue('  New Team!  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const created = authClient.organization.create.mock.lastCall?.[0] as {
      name: string
      slug: string
    }
    expect(created.name).toBe('New Team!')
    expect(created.slug).toMatch(/^new-team-[a-z0-9]+$/)
    expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: 'o3' })
    expect(invalidateQueries).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
    expect(wrapper.find('#org-name').exists()).toBe(false)
  })

  it('keeps the dialog open and reports the error when creation fails', async () => {
    authClient.organization.create.mockResolvedValue({
      data: null,
      error: { message: 'Slug taken' },
    })
    const wrapper = render()
    await menuItem(wrapper, `Create ${workspace.one}`).trigger('click')
    await wrapper.find('#org-name').setValue('Dup')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Slug taken')
    expect(authClient.organization.setActive).not.toHaveBeenCalled()
    expect(wrapper.find('#org-name').exists()).toBe(true)
  })
})
