// docs/consent.md
import { brand } from '@/lib/brand'

export const legal = {
  productName: brand.name,
  company: 'ACME SAS',
  address: '1 rue Exemple, 75001 Paris, France',
  registration: 'RCS Paris 000 000 000',
  contactEmail: 'privacy@example.com',
  host: 'Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany',
  vendors: [
    {
      name: 'Google Analytics 4',
      provider: 'Google Ireland Ltd',
      purpose: 'Audience measurement: pages viewed, journeys, approximate location.',
      consent: true,
    },
    {
      name: 'Microsoft Clarity',
      provider: 'Microsoft Corp.',
      purpose: 'Aggregated heatmaps and session replays, with the application masked.',
      consent: true,
    },
  ],
  errorTracking: { tool: 'GlitchTip, self-hosted', retentionDays: 90 },
  usageStatistics: { retentionMonths: 25 },
  consentCookieDays: 180,
  policyVersion: '2026-09',
} as const
