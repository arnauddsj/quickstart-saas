import { router, publicProcedure, protectedProcedure } from '../index'
import { z } from 'zod'
import nodemailer from 'nodemailer'
import { TRPCError } from '@trpc/server'
import { User } from '../../entity/User'
import { AppDataSource } from '../../data-source'
import { generateAuthToken, verifyAndGetUser } from '../../services/auth'
import { CONFIG } from '../../config'
import { Token } from '../../entity/Token'

const transporter = nodemailer.createTransport({
  host: 'mailhog',
  port: 1025,
})

export const authRouter = router({
  sendMagicLink: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const { email } = input
      const userRepository = AppDataSource.getRepository(User)
      let user = await userRepository.findOne({ where: { email } })

      if (!user) {
        user = userRepository.create({ email })
        await userRepository.save(user)
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
        console.log('Email sent successfully')
      } catch (error) {
        console.error('Error sending email:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send magic link email',
        })
      }

      return { success: true, message: 'Magic link sent' }
    }),

  verifyToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { token } = input
      const user = await verifyAndGetUser(token)
      if (user) {
        const newToken = await generateAuthToken(user)
        ctx.res.setCookie(CONFIG.COOKIE_NAME, newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: CONFIG.SESSION_DURATION,
          path: '/',
        })
        return { email: user.email }
      }
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
    }),

  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      const token = ctx.req.cookies[CONFIG.COOKIE_NAME]
      if (!token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No token found' })
      }

      try {
        const user = await verifyAndGetUser(token)
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
        }

        // Delete the token from the database
        const tokenRepository = AppDataSource.getRepository(Token)
        await tokenRepository.delete({ user: { id: user.id } })

        // Clear the cookie
        ctx.res.clearCookie(CONFIG.COOKIE_NAME, { path: '/' })

        return { success: true }
      } catch (error) {
        console.error('Logout error:', error)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to logout' })
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
        return { email: user.email }
      }

      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
    }),
})