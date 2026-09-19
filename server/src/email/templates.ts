// docs/email.md
import { brand } from '../config/brand.js'

export type EmailContent = {
  subject: string
  heading: string
  paragraphs: string[]
  action?: { label: string; url: string }
  footnote?: string
}

const IGNORE = 'If you did not ask for this, you can ignore this email.'

export const templates = {
  magicLink: ({ url }: { url: string }) => ({
    subject: `Sign in to ${brand.name}`,
    heading: 'Sign in',
    paragraphs: [`Use the button below to sign in to ${brand.name}.`],
    action: { label: 'Sign in', url },
    footnote: `This link expires in 15 minutes. ${IGNORE}`,
  }),

  invitation: (d: { url: string; organizationName: string; inviterEmail: string }) => ({
    subject: `You are invited to join ${d.organizationName} on ${brand.name}`,
    heading: `Join ${d.organizationName}`,
    paragraphs: [
      `${d.inviterEmail} invited you to the ${brand.workspace.one} ${d.organizationName}.`,
    ],
    action: { label: 'Accept the invitation', url: d.url },
    footnote: IGNORE,
  }),

  emailChange: ({ url, newEmail }: { url: string; newEmail: string }) => ({
    subject: 'Confirm your new email address',
    heading: 'Change your email',
    paragraphs: [`Confirm changing your ${brand.name} email address to ${newEmail}.`],
    action: { label: 'Confirm the change', url },
    footnote: IGNORE,
  }),

  emailVerification: ({ url }: { url: string }) => ({
    subject: 'Verify your email address',
    heading: 'Verify your email',
    paragraphs: [`Confirm this address for your ${brand.name} account.`],
    action: { label: 'Verify', url },
    footnote: IGNORE,
  }),

  accountDeletion: ({ url }: { url: string }) => ({
    subject: 'Confirm account deletion',
    heading: 'Delete your account',
    paragraphs: [`Confirm deleting your ${brand.name} account and all its data.`],
    action: { label: 'Delete my account', url },
    footnote: `This cannot be undone. ${IGNORE}`,
  }),
} satisfies Record<string, (data: never) => EmailContent>

export type TemplateName = keyof typeof templates
export type TemplateData<K extends TemplateName> = Parameters<(typeof templates)[K]>[0]
export const TEMPLATE_NAMES = Object.keys(templates) as TemplateName[]
