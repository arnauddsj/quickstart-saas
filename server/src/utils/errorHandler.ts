import { TRPCError } from '@trpc/server'
import { logger } from './logger'
import { CONFIG } from '../config'

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(code: string, message: string, statusCode = 500, isOperational = true) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }
}

export const handleError = (error: Error | AppError | TRPCError) => {
  if (
    error instanceof TRPCError && 
    error.code === 'UNAUTHORIZED'
  ) {
    return error;
  }

  logger.error('Error occurred:', {
    name: error.name,
    message: error.message,
    stack: CONFIG.IS_DEVELOPMENT ? error.stack : undefined,
  })

  if (error instanceof AppError && error.isOperational) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    })
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: CONFIG.IS_PRODUCTION
      ? 'An unexpected error occurred'
      : error.message,
  })
}