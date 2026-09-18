// docs/testing.md
import type { EmailProvider } from '../../email/types.js'

export type Mail = { kind: keyof EmailProvider; to: string; url: string }

export const sent: Mail[] = []

const record =
  (kind: keyof EmailProvider) =>
  async (input: { to: string; url: string }): Promise<void> => {
    sent.push({ kind, to: input.to, url: input.url })
  }

export const provider: EmailProvider = {
  sendMagicLink: record('sendMagicLink'),
  sendInvitation: record('sendInvitation'),
  sendEmailChange: record('sendEmailChange'),
  sendEmailVerification: record('sendEmailVerification'),
  sendAccountDeletion: record('sendAccountDeletion'),
}

export const emailModule = { createEmailProvider: () => provider }

export function clearMail() {
  sent.length = 0
}

export function lastMail(to: string, kind: Mail['kind']): Mail {
  const mail = sent.filter((m) => m.to === to && m.kind === kind).at(-1)
  if (!mail) throw new Error(`no ${kind} sent to ${to}; sent: ${JSON.stringify(sent)}`)
  return mail
}
