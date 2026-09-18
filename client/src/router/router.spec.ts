import { beforeEach, describe, expect, it, vi } from 'vitest'

const authClient = vi.hoisted(() => ({
  getSession: vi.fn(),
  useSession: vi.fn(),
  useListOrganizations: vi.fn(),
  organization: { list: vi.fn(), setActive: vi.fn() },
}))
vi.mock('@/lib/auth', () => ({ authClient }))

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const { router } = await import('./index')

type Role = 'admin' | 'member'
function signedIn(role: Role, activeOrganizationId: string | null) {
  authClient.getSession.mockResolvedValue({
    data: { user: { id: 'u1', role }, session: { id: 's1', activeOrganizationId } },
  })
}

async function go(path: string) {
  await router.push(path)
  return router.currentRoute.value
}

beforeEach(async () => {
  vi.clearAllMocks()
  authClient.getSession.mockResolvedValue({ data: null })
  authClient.organization.list.mockResolvedValue({ data: [] })
  authClient.organization.setActive.mockResolvedValue({ data: {} })
  await router.replace('/login')
})

describe('route guard', () => {
  it('sends an anonymous visitor to login and remembers where they were going', async () => {
    const to = await go('/settings/account')
    expect(to.name).toBe('login')
    expect(to.query.redirect).toBe('/settings/account')
  })

  it('serves the legal pages without asking for a session', async () => {
    expect((await go('/privacy')).name).toBe('privacy')
    expect((await go('/legal')).name).toBe('legal')
    expect((await go('/terms')).name).toBe('terms')
    expect(authClient.getSession).not.toHaveBeenCalled()
  })

  it('keeps members out of the admin area', async () => {
    signedIn('member', 'o1')
    expect((await go('/admin')).name).toBe('dashboard')
    expect((await go('/admin/users')).name).toBe('dashboard')
  })

  it('lets admins into the admin area', async () => {
    signedIn('admin', 'o1')
    expect((await go('/admin')).name).toBe('admin-dashboard')
    expect((await go('/admin/users')).name).toBe('admin-users')
  })

  it('sends a user with no organization to onboarding', async () => {
    signedIn('member', null)
    expect((await go('/')).name).toBe('onboarding')
  })

  it('activates the first organization when the session has none but the user has one', async () => {
    signedIn('member', null)
    authClient.organization.list.mockResolvedValue({ data: [{ id: 'o7', name: 'Acme' }] })
    expect((await go('/settings/billing')).name).toBe('settings-billing')
    expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: 'o7' })
  })

  it('keeps the user on the current page when the session check fails, instead of signing them out', async () => {
    signedIn('member', 'o1')
    expect((await go('/settings/billing')).name).toBe('settings-billing')
    authClient.getSession.mockResolvedValue({
      data: null,
      error: { status: 429, message: 'Too many requests' },
    })
    expect((await go('/settings/account')).name).toBe('settings-billing')
    expect(toast.error).toHaveBeenCalledWith('Could not reach the server. Try again in a moment.')
  })

  it('does not require an organization on onboarding itself', async () => {
    signedIn('member', null)
    expect((await go('/onboarding')).name).toBe('onboarding')
    expect(authClient.organization.list).not.toHaveBeenCalled()
  })
})
