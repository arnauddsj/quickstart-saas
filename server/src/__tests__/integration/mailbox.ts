// docs/testing.md
import type { EmailProvider } from '../../email/types.js'
import type { TemplateName } from '../../email/templates.js'

export type Mail = { kind: TemplateName; to: string; url: string }

export const sent: Mail[] = []

export const provider: EmailProvider = {
  async send(kind, to, data) {
    sent.push({ kind, to, url: data.url })
  },
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
