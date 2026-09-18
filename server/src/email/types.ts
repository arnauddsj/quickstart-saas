// docs/email.md
export interface EmailProvider {
  sendMagicLink(input: { to: string; url: string }): Promise<void>
  sendInvitation(input: {
    to: string
    url: string
    organizationName: string
    inviterEmail: string
  }): Promise<void>
  sendEmailChange(input: { to: string; url: string; newEmail: string }): Promise<void>
  sendEmailVerification(input: { to: string; url: string }): Promise<void>
  sendAccountDeletion(input: { to: string; url: string }): Promise<void>
}
