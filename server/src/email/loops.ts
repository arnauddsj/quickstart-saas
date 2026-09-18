// docs/email.md
import type { EmailProvider } from './types.js'

export class LoopsProvider implements EmailProvider {
  constructor(
    private readonly options: {
      apiKey: string
      magicLinkTemplateId: string
      invitationTemplateId?: string
      emailChangeTemplateId?: string
      emailVerificationTemplateId?: string
      accountDeletionTemplateId?: string
      fetchImpl?: typeof fetch
    },
  ) {}

  async sendMagicLink({ to, url }: { to: string; url: string }) {
    await this.send(this.options.magicLinkTemplateId, to, { url })
  }

  async sendInvitation({
    to,
    url,
    organizationName,
    inviterEmail,
  }: {
    to: string
    url: string
    organizationName: string
    inviterEmail: string
  }) {
    if (!this.options.invitationTemplateId) {
      throw new Error('LOOPS_INVITATION_TEMPLATE_ID is not set')
    }
    await this.send(this.options.invitationTemplateId, to, { url, organizationName, inviterEmail })
  }

  async sendEmailChange({ to, url, newEmail }: { to: string; url: string; newEmail: string }) {
    if (!this.options.emailChangeTemplateId)
      throw new Error('LOOPS_EMAIL_CHANGE_TEMPLATE_ID is not set')
    await this.send(this.options.emailChangeTemplateId, to, { url, newEmail })
  }

  async sendEmailVerification({ to, url }: { to: string; url: string }) {
    if (!this.options.emailVerificationTemplateId) {
      throw new Error('LOOPS_EMAIL_VERIFICATION_TEMPLATE_ID is not set')
    }
    await this.send(this.options.emailVerificationTemplateId, to, { url })
  }

  async sendAccountDeletion({ to, url }: { to: string; url: string }) {
    if (!this.options.accountDeletionTemplateId) {
      throw new Error('LOOPS_ACCOUNT_DELETION_TEMPLATE_ID is not set')
    }
    await this.send(this.options.accountDeletionTemplateId, to, { url })
  }

  private async send(
    transactionalId: string,
    email: string,
    dataVariables: Record<string, string>,
  ) {
    const fetchImpl = this.options.fetchImpl ?? fetch
    const res = await fetchImpl('https://app.loops.so/api/v1/transactional', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transactionalId, email, dataVariables }),
    })
    if (!res.ok) {
      throw new Error(`Loops responded ${res.status}: ${await res.text()}`)
    }
  }
}
