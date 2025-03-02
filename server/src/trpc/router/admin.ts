import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, adminProcedure } from "../index"
import { User } from "../../entity/User"
import { Log } from "../../entity/Log"
import { AppDataSource } from "../../data-source"
import { Token } from "../../entity/Token"
import { logger } from "../../utils/logger"
import { AuditLogService, AuditEventType } from "../../services/auditLog"

// Define reusable validation schema for user data
const userUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "member"]).optional(),
})

export const adminRouter = router({
  // Get all users
  getAllUsers: adminProcedure.query(async ({ ctx }) => {
    try {
      const userRepository = AppDataSource.getRepository(User)
      const users = await userRepository.find({
        select: ["id", "email", "name", "role", "createdAt", "updatedAt"],
      })
      
      // Audit log the admin viewing all users
      await AuditLogService.log({
        eventType: AuditEventType.ADMIN_ACTION,
        userId: ctx.user.id,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] as string,
        resourceType: 'users',
        metadata: {
          action: 'view_all_users',
          count: users.length
        }
      })
      
      return users
    } catch (error) {
      console.error("Error fetching users:", error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch users",
      })
    }
  }),

  // Get user by ID
  getUserById: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      try {
        const userRepository = AppDataSource.getRepository(User)
        const user = await userRepository.findOne({ 
          where: { id: input.userId },
          select: ['id', 'email', 'name', 'role', 'createdAt', 'updatedAt']
        })
        
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          })
        }
        
        // Audit log the admin viewing a specific user
        await AuditLogService.log({
          eventType: AuditEventType.ADMIN_ACTION,
          userId: ctx.user.id,
          targetUserId: user.id,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] as string,
          resourceType: 'user',
          resourceId: user.id,
          metadata: {
            action: 'view_user'
          }
        })
        
        return user
      } catch (error) {
        console.error("Error fetching user:", error)
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user",
        })
      }
    }),

  // Update a user
  updateUser: adminProcedure
    .input(userUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userRepository = AppDataSource.getRepository(User)
        const user = await userRepository.findOne({ 
          where: { id: input.id } 
        })
        
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          })
        }
        
        // Don't allow admins to downgrade themselves
        if (ctx.user.id === user.id && input.role === 'member' && user.role === 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot remove admin privileges from yourself'
          })
        }
        
        // Collect changes for audit log
        const changes: Record<string, { from: any; to: any }> = {}
        
        // Update user data and track changes
        if (input.name !== undefined && input.name !== user.name) {
          changes.name = { from: user.name, to: input.name }
          user.name = input.name
        }
        
        if (input.email !== undefined && input.email !== user.email) {
          changes.email = { from: user.email, to: input.email }
          user.email = input.email
        }
        
        if (input.role !== undefined && input.role !== user.role) {
          changes.role = { from: user.role, to: input.role }
          user.role = input.role
          
          // Additional audit log for role change (sensitive operation)
          await AuditLogService.log({
            eventType: AuditEventType.ROLE_CHANGED,
            userId: ctx.user.id,
            targetUserId: user.id,
            ipAddress: ctx.req.ip,
            userAgent: ctx.req.headers['user-agent'] as string,
            resourceType: 'user',
            resourceId: user.id,
            metadata: {
              from: changes.role.from,
              to: changes.role.to
            }
          })
        }
        
        await userRepository.save(user)
        
        // Audit log the user update
        await AuditLogService.log({
          eventType: AuditEventType.USER_UPDATED,
          userId: ctx.user.id,
          targetUserId: user.id,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] as string,
          resourceType: 'user',
          resourceId: user.id,
          metadata: {
            changes: Object.keys(changes).length > 0 ? changes : 'No changes'
          }
        })
        
        logger.info('User updated', {
          userId: user.id,
          updatedBy: ctx.user.id,
          changes,
          timestamp: new Date().toISOString()
        })
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          updatedAt: user.updatedAt
        }
      } catch (error) {
        console.error("Error updating user:", error)
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user",
        })
      }
    }),

  // Delete a user
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Prevent deleting your own account
        if (ctx.user.id === input.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot delete your own account",
          })
        }
        
        const userRepository = AppDataSource.getRepository(User)
        const tokenRepository = AppDataSource.getRepository(Token)
        
        const user = await userRepository.findOne({ 
          where: { id: input.userId } 
        })
        
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          })
        }
        
        // Get user info for audit log before deletion
        const userInfo = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
        
        // Delete associated tokens first
        await tokenRepository.delete({ user: { id: input.userId } })
        
        // Then delete user
        await userRepository.delete(input.userId)
        
        // Audit log the user deletion
        await AuditLogService.log({
          eventType: AuditEventType.USER_DELETED,
          userId: ctx.user.id,
          targetUserId: input.userId,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] as string,
          resourceType: 'user',
          resourceId: input.userId,
          metadata: {
            deletedUser: userInfo
          }
        })
        
        logger.info('User deleted', {
          deletedUserId: input.userId,
          deletedBy: ctx.user.id,
          timestamp: new Date().toISOString()
        })
        
        return { success: true }
      } catch (error) {
        console.error("Error deleting user:", error)
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete user",
        })
      }
    }),

  // Get logs with pagination and filtering
  getLogs: adminProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(100).default(20),
        level: z.enum(["error", "warn", "info", "debug"]).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const logRepository = AppDataSource.getRepository(Log)
        
        // Build query with filters
        let query = logRepository.createQueryBuilder("log")
        
        // Apply level filter if provided
        if (input.level) {
          query = query.andWhere("log.level = :level", { level: input.level })
        }
        
        // Apply search filter if provided
        if (input.search) {
          query = query.andWhere(
            "(log.message LIKE :search OR log.context LIKE :search)",
            { search: `%${input.search}%` }
          )
        }
        
        // Count total logs matching the filter
        const total = await query.getCount()
        
        // Apply pagination
        const logs = await query
          .orderBy("log.timestamp", "DESC")
          .skip((input.page - 1) * input.pageSize)
          .take(input.pageSize)
          .getMany()
        
        return {
          logs,
          total,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(total / input.pageSize),
        }
      } catch (error) {
        console.error("Error fetching logs:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch logs",
        })
      }
    }),
}) 