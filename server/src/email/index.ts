// docs/email.md
import type { Env } from '../config/env.js'
import { LoopsProvider } from './loops.js'
import { SmtpProvider } from './smtp.js'
import type { EmailProvider } from './types.js'

export type { EmailProvider } from './types.js'

type EmailEnv = Pick<
  Env,
  | 'EMAIL_PROVIDER'
  | 'EMAIL_FROM'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'LOOPS_API_KEY'
  | 'LOOPS_MAGIC_LINK_TEMPLATE_ID'
  | 'LOOPS_INVITATION_TEMPLATE_ID'
  | 'LOOPS_EMAIL_CHANGE_TEMPLATE_ID'
  | 'LOOPS_EMAIL_VERIFICATION_TEMPLATE_ID'
  | 'LOOPS_ACCOUNT_DELETION_TEMPLATE_ID'
>

export function createEmailProvider(env: EmailEnv): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'loops':
      if (!env.LOOPS_API_KEY || !env.LOOPS_MAGIC_LINK_TEMPLATE_ID) {
        throw new Error('EMAIL_PROVIDER=loops needs LOOPS_API_KEY and LOOPS_MAGIC_LINK_TEMPLATE_ID')
      }
      return new LoopsProvider({
        apiKey: env.LOOPS_API_KEY,
        magicLinkTemplateId: env.LOOPS_MAGIC_LINK_TEMPLATE_ID,
        invitationTemplateId: env.LOOPS_INVITATION_TEMPLATE_ID,
        emailChangeTemplateId: env.LOOPS_EMAIL_CHANGE_TEMPLATE_ID,
        emailVerificationTemplateId: env.LOOPS_EMAIL_VERIFICATION_TEMPLATE_ID,
        accountDeletionTemplateId: env.LOOPS_ACCOUNT_DELETION_TEMPLATE_ID,
      })
    case 'smtp':
      return new SmtpProvider({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.EMAIL_FROM })
  }
}
