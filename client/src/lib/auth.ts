// docs/auth.md
import { createAuthClient } from 'better-auth/vue'
import { adminClient, magicLinkClient, organizationClient } from 'better-auth/client/plugins'

type NoOptions = Record<never, never>

type Plugins = [
  ReturnType<typeof magicLinkClient>,
  ReturnType<typeof adminClient<NoOptions>>,
  ReturnType<typeof organizationClient<NoOptions>>,
]

export type AuthClient = ReturnType<typeof createAuthClient<{ plugins: Plugins }>>

export const authClient: AuthClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [magicLinkClient(), adminClient(), organizationClient()],
})
