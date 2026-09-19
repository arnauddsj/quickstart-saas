// docs/branding.md
export const brand = {
  name: 'Quickstart SaaS',
  supportEmail: 'support@example.com',
  accentColor: '#18181b',
  workspace: { one: 'workspace', many: 'workspaces' },
  teams: true,
} as const

export type Brand = typeof brand
