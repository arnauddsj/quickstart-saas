import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueRouter from 'vue-router'
import type * as ServerModule from '@/services/server'
import { overlayStubs } from '@/test/stubs'

const trpc = vi.hoisted(() => ({
  notification: {
    list: { query: vi.fn() },
    markRead: { mutate: vi.fn() },
    markAllRead: { mutate: vi.fn() },
  },
}))
vi.mock('@/services/server', async (importOriginal) => ({
  ...(await importOriginal<typeof ServerModule>()),
  trpc,
}))

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof VueRouter>()),
  useRouter: () => ({ push }),
}))

const { default: NotificationBell } = await import('./NotificationBell.vue')

const now = new Date().toISOString()
const unreadItem = {
  id: 'n1',
  type: 'project.created',
  title: 'Ada created Alpha',
  body: null,
  link: '/projects',
  read: false,
  createdAt: now,
}

async function render() {
  const wrapper = mount(NotificationBell, {
    global: {
      stubs: overlayStubs,
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  trpc.notification.markRead.mutate.mockResolvedValue(undefined)
  trpc.notification.markAllRead.mutate.mockResolvedValue(undefined)
})

describe('NotificationBell', () => {
  it('shows the unread count and marks an opened notification read before navigating', async () => {
    trpc.notification.list.query.mockResolvedValue({ unread: 1, items: [unreadItem] })
    const wrapper = await render()
    expect(wrapper.find('button').attributes('aria-label')).toBe('Notifications, 1 unread')

    await wrapper.find('[data-menu-item]').trigger('click')
    await flushPromises()
    expect(trpc.notification.markRead.mutate).toHaveBeenCalledWith({ id: 'n1' })
    expect(push).toHaveBeenCalledWith('/projects')
  })

  it('says so when there is nothing, and hides the badge', async () => {
    trpc.notification.list.query.mockResolvedValue({ unread: 0, items: [] })
    const wrapper = await render()
    expect(wrapper.find('button').attributes('aria-label')).toBe('Notifications')
    expect(wrapper.text()).toContain('You are all caught up.')
    expect(wrapper.text()).not.toContain('Mark all as read')
  })
})
