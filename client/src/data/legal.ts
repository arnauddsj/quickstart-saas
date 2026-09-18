// docs/consent.md
export const legal = {
  productName: 'Quickstart SaaS',
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
  consentCookieDays: 180,
  policyVersion: '2026-09',
} as const
