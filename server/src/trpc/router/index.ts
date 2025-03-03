import { router, publicProcedure } from "../index"
import { authRouter } from "./auth"
import { userRouter } from "./user"
import { adminRouter } from "./admin"
import { AppDataSource } from "../../data-source"

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  admin: adminRouter,
  healthCheck: publicProcedure.query(async () => {
    try {
      await AppDataSource.query('SELECT 1')
      return { status: 'ok', message: 'Server is running and connected to the database' }
    } catch (error) {
      console.error('Health check failed:', error)
      return { status: 'error', message: 'Server is running but database connection failed' }
    }
  }),
})

export type AppRouter = typeof appRouter

export default appRouter