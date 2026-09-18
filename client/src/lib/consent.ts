// docs/consent.md
import type { ConsentRecord } from '@hivehorizon/consent-kit'
import {
  accountStorage,
  clarity,
  ga4,
  initConsent,
  openConsentSettings,
  staticGeo,
} from '@hivehorizon/consent-kit'
import { legal } from '@/data/legal'
import { trpc } from '@/services/server'

const ga4Id = import.meta.env.VITE_GA4_ID as string | undefined
const clarityId = import.meta.env.VITE_CLARITY_ID as string | undefined

export function setupConsent() {
  const vendors = [
    ...(ga4Id ? [ga4(ga4Id)] : []),
    ...(clarityId ? [clarity(clarityId, { maskRoot: '#app' })] : []),
  ]
  if (vendors.length === 0) return null

  const consent = initConsent({
    profile: 'app',
    appRoot: '#app',
    policyVersion: legal.policyVersion,
    expiryDays: legal.consentCookieDays,
    ui: {
      privacyUrl: '/privacy',
      text: {
        necessaryBody:
          'Required for the app to work: keeping you signed in, and remembering the choice you make here. Refusing analytics affects neither.',
      },
    },
    storage: accountStorage({
      load: async () => {
        try {
          const stored = await trpc.user.getConsent.query()
          return stored ? (stored.record as unknown as ConsentRecord) : null
        } catch {
          return null
        }
      },
      save: async (record) => {
        try {
          await trpc.user.setConsent.mutate(record as unknown as Record<string, unknown>)
        } catch {
          return
        }
      },
    }),
    vendors,
    ...(import.meta.env.DEV ? { geo: staticGeo('FR'), debug: true } : {}),
  })

  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    if (target?.closest('[data-cookie-settings]')) {
      event.preventDefault()
      openConsentSettings()
    }
  })

  return consent
}
