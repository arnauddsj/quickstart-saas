// src/services/tokenCleanup.ts
import PgBoss from 'pg-boss'
import { AppDataSource } from '../data-source'
import { Token } from '../entity/Token'
import { logger } from '../utils/logger'
import { CONFIG } from '../config'

const QUEUE_NAME = 'auth/cleanup-tokens'

export async function initializeTokenCleanup(boss: PgBoss) {
  try {
    // First, create the queue if it doesn't exist
    await boss.work(QUEUE_NAME, async () => {
      const tokenRepository = AppDataSource.getRepository(Token)
      try {
        const result = await tokenRepository
          .createQueryBuilder()
          .delete()
          .from(Token)
          .where('expires_at < :now', { now: new Date() })
          .execute()
        
        logger.info('Token cleanup completed', { 
          deletedCount: result.affected,
          timestamp: new Date().toISOString()
        })

        return { success: true, deletedCount: result.affected }
      } catch (error) {
        logger.error('Token cleanup failed', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
        throw error // This will trigger the retry mechanism
      }
    })

    // Schedule the recurring job
    await boss.schedule(QUEUE_NAME, '0 3 * * *', // Run daily at 3 AM
      null, // no data needed
      {
        tz: 'UTC',
        singletonKey: 'cleanup-tokens', // Ensure only one instance runs
        retentionDays: 7, // Keep job history for a week
      }
    )

    logger.info('Token cleanup job initialized', {
      queue: QUEUE_NAME,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to initialize token cleanup', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    throw error
  }
}