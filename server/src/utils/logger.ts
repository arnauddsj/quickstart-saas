import pino from 'pino'
import { env, IS_PROD } from '../config/env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(IS_PROD || env.NODE_ENV === 'test'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }),
})
