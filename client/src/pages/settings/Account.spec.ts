import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ServerModule from '@/services/server'
import { overlayStubs } from '@/test/stubs'

const authClient = vi.hoisted(() => ({
  useSession: vi.fn(),
  updateUser: vi.fn(),
  changeEmail: vi.fn(),
  deleteUser: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ authClient }))

const trpc = vi.hoisted(() => ({
  user: { exportData: { query: vi.fn() }, deletionPreview: { query: vi.fn() } },
}))
vi.mock('@/services/server', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerModule>()),
  trpc,
}))
vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { default: Account } = await import('./Account.vue')

function render() {
  return mount(Account, {
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      stubs: overlayStubs,
    },
  })
}

const button = (wrapper: ReturnType<typeof render>, text: string) => {
  const found = wrapper.findAll('button').find((b) => b.text().trim() === text)
  if (!found) throw new Error(`no button "${text}"`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  authClient.useSession.mockReturnValue(
    ref({ data: { user: { id: 'u1', name: 'Jane', email: 'jane@test.io' } } }),
  )
  authClient.updateUser.mockResolvedValue({ data: {}, error: null })
  authClient.changeEmail.mockResolvedValue({ data: {}, error: null })
  authClient.deleteUser.mockResolvedValue({ data: {}, error: null })
  trpc.user.deletionPreview.query.mockResolvedValue({
    organizationsToDelete: [{ id: 'o1', name: 'Acme' }],
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Account page', () => {
  it('prefills and saves the name', async () => {
    const wrapper = render()
    const input = wrapper.find<HTMLInputElement>('#name')
    expect(input.element.value).toBe('Jane')
    await input.setValue('Janet')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(authClient.updateUser).toHaveBeenCalledWith({ name: 'Janet' })
  })

  it('asks for an email change and tells the user to check the current address', async () => {
    const wrapper = render()
    await wrapper.find('#newEmail').setValue(' new@test.io ')
    await wrapper.findAll('form')[1]!.trigger('submit')
    await flushPromises()
    expect(authClient.changeEmail).toHaveBeenCalledWith({
      newEmail: 'new@test.io',
      callbackURL: '/settings/account',
    })
    expect(wrapper.text()).toContain('Check jane@test.io and follow the link')
  })

  it('downloads the export as a dated JSON file', async () => {
    trpc.user.exportData.query.mockResolvedValue({
      exportedAt: '2026-09-18T10:00:00.000Z',
      user: {},
    })
    const createObjectURL = vi.fn(() => 'blob:export')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const wrapper = render()
    await button(wrapper, 'Download my data').trigger('click')
    await flushPromises()

    expect(trpc.user.exportData.query).toHaveBeenCalledOnce()
    const clicked = click.mock.contexts[0] as HTMLAnchorElement
    expect(clicked.download).toBe('my-data-2026-09-18.json')
    expect(clicked.href).toBe('blob:export')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export')
    click.mockRestore()
    vi.unstubAllGlobals()
  })

  it('lists the organizations that go with the account, then requests an emailed confirmation', async () => {
    const wrapper = render()
    await button(wrapper, 'Delete my account').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Acme')

    await button(wrapper, 'Send confirmation').trigger('click')
    await flushPromises()
    expect(authClient.deleteUser).toHaveBeenCalledWith({ callbackURL: '/login?deleted=1' })
    expect(wrapper.text()).toContain('Check jane@test.io to confirm.')
    expect(button(wrapper, 'Delete my account').attributes('disabled')).toBeDefined()
  })
})
