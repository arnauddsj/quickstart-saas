import { router, publicProcedure, protectedProcedure } from '../index'
import { z } from 'zod'
import nodemailer from 'nodemailer'
import { TRPCError } from '@trpc/server'
import { User } from '../../entity/User'
import { AppDataSource } from '../../data-source'
import { generateAuthToken, verifyAndGetUser } from '../../services/auth'
import { CONFIG } from '../../config'
import { Token } from '../../entity/Token'
import { AuditLogService, AuditEventType } from '../../services/auditLog'

const transporter = nodemailer.createTransport({
  host: CONFIG.MAILHOG_HOST,
  port: CONFIG.MAILHOG_PORT,
})

export const authRouter = router({
  sendMagicLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const { email } = input
      const userRepository = AppDataSource.getRepository(User)
      let user = await userRepository.findOne({ where: { email } })
      let isNewUser = false

      if (!user) {
        // Create new user with default member role
        user = userRepository.create({ 
          email,
          role: 'member' 
        })
        await userRepository.save(user)
        isNewUser = true
      }

      const token = await generateAuthToken(user)
      try {
        await transporter.sendMail({
          from: 'noreply@quickstart.com',
          to: email,
          subject: 'Your Magic Link',
          text: `Click this link to log in: http://localhost:5173/auth?token=${token}`,
          html: `<p>Click <a href="http://localhost:5173/auth?token=${token}">here</a> to log in.</p>`,
        })
        
        // Audit log the magic link request
        await AuditLogService.log({
          eventType: AuditEventType.MAGIC_LINK_REQUESTED,
          userId: user.id,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] as string,
          metadata: {
            email,
            isNewUser
          }
        })
        
        return { success: true, message: 'Magic link sent' }
      } catch (error) {
        console.error('Error sending email:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send magic link email',
        })
      }
    }),

  verifyToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { token } = input
      try {
        const user = await verifyAndGetUser(token)
        if (user) {
          const newToken = await generateAuthToken(user)
          ctx.res.setCookie(CONFIG.COOKIE_NAME, newToken, {
            httpOnly: true,
            secure: CONFIG.COOKIE_SECURE,
            sameSite: 'lax',
            maxAge: CONFIG.SESSION_DURATION,
            path: '/',
            domain: CONFIG.COOKIE_DOMAIN
          })
          
          // Audit log the successful login
          await AuditLogService.log({
            eventType: AuditEventType.LOGIN_SUCCESS,
            userId: user.id,
            ipAddress: ctx.req.ip,
            userAgent: ctx.req.headers['user-agent'] as string,
          })
          
          return { 
            id: user.id,
            email: user.email, 
            name: user.name,
            role: user.role
          }
        }
        
        // Audit log the failed token verification
        await AuditLogService.log({
          eventType: AuditEventType.LOGIN_FAILURE,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] as string,
          metadata: {
            reason: 'Invalid token'
          }
        })
        
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
      } catch (error) {
        // Audit log the failed login
        await AuditLogService.log({
          eventType: AuditEventType.LOGIN_FAILURE,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] as string,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
        
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
      }
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      const token = ctx.req.cookies[CONFIG.COOKIE_NAME]
      if (!token) {
        ctx.res.clearCookie(CONFIG.COOKIE_NAME, { path: '/' })
        return { success: true }
      }

      try {
        ctx.res.clearCookie(CONFIG.COOKIE_NAME, { path: '/' })
        
        const user = await verifyAndGetUser(token)
        if (user) {
          const tokenRepository = AppDataSource.getRepository(Token)
          await tokenRepository.delete({ user: { id: user.id } })
          
          // Audit log the logout
          await AuditLogService.log({
            eventType: AuditEventType.LOGOUT,
            userId: user.id,
            ipAddress: ctx.req.ip,
            userAgent: ctx.req.headers['user-agent'] as string,
          })
        }

        return { success: true }
      } catch (error) {
        return { success: true }
      }
    }),

  getUser: protectedProcedure
    .query(async ({ ctx }) => {
      const token = ctx.req.cookies[CONFIG.COOKIE_NAME]
      if (!token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No token found' })
      }

      const user = await verifyAndGetUser(token)
      if (user) {
        return { 
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }

      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
    }),
})