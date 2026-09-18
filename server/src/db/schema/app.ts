// docs/database-and-migrations.md
import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { organization, user } from './auth.js'

export const PLAN_NAMES = ['FREE', 'PRO'] as const
export const ERROR_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const

export const subscription = pgTable('subscription', {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text()
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: 'cascade' }),
  plan: text({ enum: PLAN_NAMES }).notNull().default('FREE'),
  status: text().notNull().default('active'),
  stripeCustomerId: text(),
  stripeSubscriptionId: text().unique(),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const errorLog = pgTable(
  'error_log',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    severity: text({ enum: ERROR_SEVERITIES }).notNull(),
    type: text().notNull(),
    message: text().notNull(),
    stack: text(),
    context: jsonb(),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    organizationId: text().references(() => organization.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('error_log_created_at_idx').on(t.createdAt)],
)

export const userConsent = pgTable('user_consent', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  record: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
