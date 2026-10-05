// docs/auth.md
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, magicLink, organization } from 'better-auth/plugins'
import { brand } from '../config/brand.js'
import { env, IS_PROD } from '../config/env.js'
import { db } from '../db/client.js'
import * as schema from '../db/schema/index.js'
import { createEmailProvider } from '../email/index.js'
import { cancelOrganizationBilling, cleanupBeforeUserDelete } from '../services/account.js'
import { claimFirstAdmin } from '../services/admin.js'
import { notify } from '../services/notify.js'
import { reportError } from '../services/reportError.js'
import { workspacePolicy } from '../services/workspacePolicy.js'

export const emailProvider = createEmailProvider(env)

async function sendEmail(kind: string, send: () => Promise<void>, userId?: string) {
  try {
    await send()
  } catch (err) {
    reportError({
      severity: 'ERROR',
      type: `email.${kind}`,
      message: 'Email send failed',
      error: err,
      userId,
    })
    throw err
  }
}

export const auth = betterAuth({
  baseURL: env.PUBLIC_URL,
  basePath: '/api/auth',
  secret: env.AUTH_SECRET,
  trustedOrigins: env.CORS_ORIGINS,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: false },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await claimFirstAdmin(user.id)
          await notify(user.id, {
            type: 'account.welcome',
            title: `Welcome to ${brand.name}`,
            body: 'Your account is ready.',
          }).catch((err: unknown) =>
            reportError({
              severity: 'ERROR',
              type: 'notification.welcome',
              message: 'Welcome notification failed',
              error: err,
              userId: user.id,
            }),
          )
        },
      },
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        'verification',
        () => emailProvider.send('emailVerification', user.email, { url }),
        user.id,
      )
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendEmail(
          'email_change',
          () => emailProvider.send('emailChange', user.email, { url, newEmail }),
          user.id,
        )
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await sendEmail(
          'account_deletion',
          () => emailProvider.send('accountDeletion', user.email, { url }),
          user.id,
        )
      },
      beforeDelete: async (user) => {
        await cleanupBeforeUserDelete(user.id)
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: env.COOKIE_SECURE,
  },
  rateLimit: {
    enabled: IS_PROD,
    storage: 'database',
    window: 60,
    max: 30,
    customRules: {
      '/sign-in/magic-link': { window: 60 * 60, max: 5 },
      '/get-session': false,
    },
  },
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail('magic_link', () => emailProvider.send('magicLink', email, { url }))
      },
    }),
    admin({ defaultRole: 'member', adminRoles: ['admin'] }),
    organization({
      ...workspacePolicy(brand.teams),
      creatorRole: 'owner',
      organizationHooks: {
        beforeDeleteOrganization: ({ organization: org, user }) =>
          cancelOrganizationBilling(org.id, user.id),
      },
      sendInvitationEmail: async ({ email, id, organization: org, inviter }) => {
        await sendEmail(
          'invitation',
          () =>
            emailProvider.send('invitation', email, {
              url: `${env.PUBLIC_URL}/accept-invitation/${id}`,
              organizationName: org.name,
              inviterEmail: inviter.user.email,
            }),
          inviter.user.id,
        )
      },
    }),
  ],
})

export type Auth = typeof auth
export type Session = Auth['$Infer']['Session']
