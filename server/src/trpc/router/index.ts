import { router } from "../index"
import userRouter from "./user"

export const appRouter = router({
  user: userRouter,
  // Add other routers here as needed
})

export type AppRouter = typeof appRouter

export default appRouter