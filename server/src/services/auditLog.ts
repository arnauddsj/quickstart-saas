import { logger } from '../utils/logger'
import { AppDataSource } from '../data-source'
import { User } from '../entity/User'
import PgBoss, { Job } from 'pg-boss'

/**
 * Event types for audit logging
 */
export enum AuditEventType {
  // Auth events
  LOGIN_SUCCESS = 'auth:login:success',
  LOGIN_FAILURE = 'auth:login:failure',
  LOGOUT = 'auth:logout',
  MAGIC_LINK_REQUESTED = 'auth:magic_link:requested',
  
  // User management events
  USER_CREATED = 'user:created',
  USER_UPDATED = 'user:updated',
  USER_DELETED = 'user:deleted',
  ROLE_CHANGED = 'user:role:changed',
  
  // Admin actions
  ADMIN_ACTION = 'admin:action',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'security:rate_limit:exceeded',
  UNAUTHORIZED_ACCESS = 'security:unauthorized_access',
  FORBIDDEN_ACCESS = 'security:forbidden_access'
}

/**
 * Interface for audit log entry
 */
export interface AuditLogEntry {
  eventType: AuditEventType;
  userId?: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Service for audit logging sensitive operations
 */
export class AuditLogService {
  private static boss: PgBoss;
  private static QUEUE_NAME = 'audit-logs';
  private static initialized = false;

  /**
   * Initialize the audit log service
   */
  static async initialize(pgBoss: PgBoss): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.boss = pgBoss;
    
    // Create the audit log queue if it doesn't exist
    await this.boss.createQueue(this.QUEUE_NAME);
    
    // Set up worker to process audit logs
    await this.boss.work(this.QUEUE_NAME, async (jobArg: Job<AuditLogEntry> | Job<AuditLogEntry>[]) => {
      try {
        // Handle job processing based on whether it's a single job or an array of jobs
        const processLogEntry = (logEntry: AuditLogEntry) => {
          logger.info(`AUDIT: ${logEntry.eventType}`, {
            ...logEntry,
            metadata: logEntry.metadata ? JSON.stringify(logEntry.metadata) : undefined
          });
        };

        // Process job data, which could be a single entry or an array
        if (Array.isArray(jobArg)) {
          // Handle batch of jobs
          jobArg.forEach((j: Job<AuditLogEntry>) => {
            if (j && j.data) {
              processLogEntry(j.data);
            }
          });
        } else {
          // Handle single job
          if (jobArg && jobArg.data) {
            processLogEntry(jobArg.data);
          }
        }
        
        return { success: true };
      } catch (error) {
        logger.error('Failed to process audit log', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw error; // Will be retried
      }
    });
    
    this.initialized = true;
    logger.info('Audit log service initialized');
  }

  /**
   * Log an audit event
   */
  static async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    if (!this.initialized || !this.boss) {
      logger.warn('Audit log service not initialized, but log was attempted');
      return;
    }
    
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };
    
    // Queue the audit log entry as a job
    await this.boss.send(this.QUEUE_NAME, fullEntry);
  }

  /**
   * Get current user information for audit context
   */
  static async getUserInfo(userId: string): Promise<{ id: string; email: string } | null> {
    if (!userId) return null;
    
    try {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });
      
      if (!user) return null;
      
      return {
        id: user.id,
        email: user.email
      };
    } catch (error) {
      logger.error('Error getting user info for audit log', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
} 