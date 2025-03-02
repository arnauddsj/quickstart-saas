import { z } from 'zod'
import { router, protectedProcedure } from '../index'

// Define reusable validation schema for user data
const userUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'member']).optional(),
})

export const userRouter = router({
  // Get current user profile - for all authenticated users
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role
    }
  })
}) 