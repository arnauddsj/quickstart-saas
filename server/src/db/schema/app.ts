// docs/database-and-migrations.md
import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { organization, user } from './auth.js'

export const PLAN_NAMES = ['FREE', 'PRO'] as const

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

export const userConsent = pgTable('user_consent', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  record: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
