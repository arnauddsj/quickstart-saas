// docs/auth.md
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, magicLink, organization } from 'better-auth/plugins'
import { env, IS_PROD } from '../config/env.js'
import { db } from '../db/client.js'
import * as schema from '../db/schema/index.js'
import { createEmailProvider } from '../email/index.js'
import { cleanupBeforeUserDelete } from '../services/account.js'
import { roleForNewUser } from '../services/admin.js'

export const emailProvider = createEmailProvider(env)

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
        before: async (user) => ({ data: { ...user, role: await roleForNewUser() } }),
      },
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await emailProvider.sendEmailVerification({ to: user.email, url })
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await emailProvider.sendEmailChange({ to: user.email, url, newEmail })
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        await emailProvider.sendAccountDeletion({ to: user.email, url })
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
        await emailProvider.sendMagicLink({ to: email, url })
      },
    }),
    admin({ defaultRole: 'member', adminRoles: ['admin'] }),
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      sendInvitationEmail: async ({ email, id, organization: org, inviter }) => {
        await emailProvider.sendInvitation({
          to: email,
          url: `${env.PUBLIC_URL}/accept-invitation/${id}`,
          organizationName: org.name,
          inviterEmail: inviter.user.email,
        })
      },
    }),
  ],
})

export type Auth = typeof auth
export type Session = Auth['$Infer']['Session']
