import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const kit = vi.hoisted(() => ({
  initConsent: vi.fn((_config: { vendors: unknown[] }) => ({})),
  ga4: vi.fn((id: string) => ({ vendor: 'ga4', id })),
  clarity: vi.fn((id: string, options: unknown) => ({ vendor: 'clarity', id, options })),
  openConsentSettings: vi.fn(),
  staticGeo: vi.fn((country: string) => ({ country })),
  accountStorage: vi.fn((options: unknown) => ({ storage: options })),
}))
vi.mock('@hivehorizon/consent-kit', () => kit)

const trpc = vi.hoisted(() => ({
  user: { getConsent: { query: vi.fn() }, setConsent: { mutate: vi.fn() } },
}))
vi.mock('@/services/server', () => ({ trpc }))

type StorageOptions = {
  load: () => Promise<unknown>
  save: (record: unknown) => Promise<void>
}

async function setup(env: Record<string, string>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const { setupConsent } = await import('./consent')
  return setupConsent()
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('setupConsent', () => {
  it('does nothing when no analytics id is configured', async () => {
    expect(await setup({ VITE_GA4_ID: '', VITE_CLARITY_ID: '' })).toBeNull()
    expect(kit.initConsent).not.toHaveBeenCalled()
  })

  it('declares only the vendors whose id is set, with Clarity masking the app', async () => {
    await setup({ VITE_GA4_ID: 'G-TEST', VITE_CLARITY_ID: '' })
    expect(kit.initConsent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        profile: 'app',
        appRoot: '#app',
        policyVersion: '2026-09',
        vendors: [{ vendor: 'ga4', id: 'G-TEST' }],
        ui: expect.objectContaining({ privacyUrl: '/privacy' }),
      }),
    )

    await setup({ VITE_GA4_ID: 'G-TEST', VITE_CLARITY_ID: 'clar' })
    expect(kit.clarity).toHaveBeenCalledWith('clar', { maskRoot: '#app' })
    expect(kit.initConsent.mock.lastCall?.[0].vendors).toHaveLength(2)
  })

  it('forces a European visitor and debug output in development', async () => {
    await setup({ VITE_GA4_ID: 'G-TEST' })
    expect(kit.initConsent).toHaveBeenLastCalledWith(
      expect.objectContaining({ geo: { country: 'FR' }, debug: true }),
    )
  })

  it('opens the preferences from any [data-cookie-settings] element, and only from those', async () => {
    await setup({ VITE_GA4_ID: 'G-TEST' })
    document.body.innerHTML =
      '<footer><button data-cookie-settings><span id="inner">Cookies</span></button><a id="other">Other</a></footer>'

    const before = kit.openConsentSettings.mock.calls.length
    document.getElementById('inner')!.click()
    expect(kit.openConsentSettings.mock.calls.length).toBeGreaterThan(before)

    const afterSettings = kit.openConsentSettings.mock.calls.length
    document.getElementById('other')!.click()
    expect(kit.openConsentSettings.mock.calls.length).toBe(afterSettings)
  })

  it('stores the choice on the account and never breaks the page when the API fails', async () => {
    await setup({ VITE_GA4_ID: 'G-TEST' })
    const storage = kit.accountStorage.mock.lastCall?.[0] as unknown as StorageOptions

    trpc.user.getConsent.query.mockResolvedValueOnce({
      record: { analytics: true },
      updatedAt: 'x',
    })
    expect(await storage.load()).toEqual({ analytics: true })
    trpc.user.getConsent.query.mockResolvedValueOnce(null)
    expect(await storage.load()).toBeNull()
    trpc.user.getConsent.query.mockRejectedValueOnce(new Error('401'))
    expect(await storage.load()).toBeNull()

    trpc.user.setConsent.mutate.mockRejectedValueOnce(new Error('401'))
    await expect(storage.save({ analytics: false })).resolves.toBeUndefined()
    expect(trpc.user.setConsent.mutate).toHaveBeenCalledWith({ analytics: false })
  })
})
