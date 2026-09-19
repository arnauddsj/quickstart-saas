// docs/type-contract.md
import { publicProcedure, router } from '../index.js'
import { adminRouter } from './admin.js'
import { billingRouter } from './billing.js'
import { orgRouter } from './org.js'
import { projectRouter } from './project.js'
import { userRouter } from './user.js'

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })),
  user: userRouter,
  org: orgRouter,
  billing: billingRouter,
  project: projectRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
