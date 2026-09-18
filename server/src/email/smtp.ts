// docs/email.md
import nodemailer from 'nodemailer'
import type { EmailProvider } from './types.js'

export class SmtpProvider implements EmailProvider {
  private readonly transport: ReturnType<typeof nodemailer.createTransport>

  constructor(private readonly options: { host: string; port: number; from: string }) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: false,
    })
  }

  async sendMagicLink({ to, url }: { to: string; url: string }) {
    await this.transport.sendMail({
      from: this.options.from,
      to,
      subject: 'Your sign-in link',
      text: `Sign in: ${url}\n\nThis link expires in 15 minutes.`,
      html: `<p>Click <a href="${url}">here</a> to sign in.</p><p>This link expires in 15 minutes.</p>`,
    })
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
    await this.transport.sendMail({
      from: this.options.from,
      to,
      subject: `You are invited to join ${organizationName}`,
      text: `${inviterEmail} invited you to ${organizationName}. Accept: ${url}`,
      html: `<p>${inviterEmail} invited you to <strong>${organizationName}</strong>.</p><p><a href="${url}">Accept the invitation</a></p>`,
    })
  }

  async sendEmailChange({ to, url, newEmail }: { to: string; url: string; newEmail: string }) {
    await this.transport.sendMail({
      from: this.options.from,
      to,
      subject: 'Confirm your new email address',
      text: `Confirm changing your email to ${newEmail}: ${url}\n\nIf you did not ask for this, ignore this message.`,
      html: `<p>Confirm changing your email to <strong>${newEmail}</strong>: <a href="${url}">confirm</a></p><p>If you did not ask for this, ignore this message.</p>`,
    })
  }

  async sendEmailVerification({ to, url }: { to: string; url: string }) {
    await this.transport.sendMail({
      from: this.options.from,
      to,
      subject: 'Verify your email address',
      text: `Verify this address for your account: ${url}`,
      html: `<p>Verify this address for your account: <a href="${url}">verify</a></p>`,
    })
  }

  async sendAccountDeletion({ to, url }: { to: string; url: string }) {
    await this.transport.sendMail({
      from: this.options.from,
      to,
      subject: 'Confirm account deletion',
      text: `Confirm deleting your account and all its data: ${url}\n\nThis cannot be undone. If you did not ask for this, ignore this message.`,
      html: `<p>Confirm deleting your account and all its data: <a href="${url}">delete my account</a></p><p>This cannot be undone. If you did not ask for this, ignore this message.</p>`,
    })
  }
}
