// docs/email.md
import type { Env } from '../config/env.js'
import { LoopsProvider } from './loops.js'
import { SmtpProvider } from './smtp.js'
import { TEMPLATE_NAMES, type TemplateName } from './templates.js'
import type { EmailProvider } from './types.js'

export type { EmailProvider } from './types.js'

type EmailEnv = Pick<
  Env,
  | 'EMAIL_PROVIDER'
  | 'EMAIL_FROM'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'LOOPS_API_KEY'
  | 'LOOPS_TEMPLATE_IDS'
>

export function parseLoopsTemplateIds(value: string | undefined): Record<TemplateName, string> {
  const ids = {} as Record<TemplateName, string>
  for (const pair of (value ?? '').split(',').filter((p) => p.trim())) {
    const [name, id] = pair.split('=').map((s) => s.trim())
    if (!name || !id || !(TEMPLATE_NAMES as string[]).includes(name)) {
      throw new Error(
        `LOOPS_TEMPLATE_IDS: "${pair}" is not <template>=<id>; templates: ${TEMPLATE_NAMES.join(', ')}`,
      )
    }
    ids[name as TemplateName] = id
  }
  return ids
}

export function createEmailProvider(env: EmailEnv): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'loops': {
      const templateIds = parseLoopsTemplateIds(env.LOOPS_TEMPLATE_IDS)
      if (!env.LOOPS_API_KEY || !templateIds.magicLink) {
        throw new Error(
          'EMAIL_PROVIDER=loops needs LOOPS_API_KEY and a magicLink id in LOOPS_TEMPLATE_IDS',
        )
      }
      return new LoopsProvider({ apiKey: env.LOOPS_API_KEY, templateIds })
    }
    case 'smtp':
      return new SmtpProvider({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.EMAIL_FROM })
  }
}
