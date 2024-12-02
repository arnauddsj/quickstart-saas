import winston from 'winston'
import { CONFIG } from '../config'

const format = CONFIG.IS_PRODUCTION
  ? winston.format.json()
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(
        ({ timestamp, level, message, ...meta }) =>
          `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`
      )
    )

export const logger = winston.createLogger({
  level: CONFIG.IS_PRODUCTION ? 'info' : 'debug',
  format,
  transports: [
    new winston.transports.Console(),
    ...(CONFIG.IS_PRODUCTION
      ? [
          new winston.transports.File({ filename: 'error.log', level: 'error' }),
          new winston.transports.File({ filename: 'combined.log' }),
        ]
      : []),
  ],
})