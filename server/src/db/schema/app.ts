// docs/database-and-migrations.md
import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
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

export const project = pgTable(
  'project',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    createdById: text().references(() => user.id, { onDelete: 'set null' }),
    name: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('project_organization_id_idx').on(t.organizationId)],
)

export const notification = pgTable(
  'notification',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: text().references(() => organization.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    title: text().notNull(),
    body: text(),
    link: text(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notification_user_created_idx').on(t.userId, t.createdAt)],
)

export const activityDay = pgTable(
  'activity_day',
  {
    subjectId: text().notNull(),
    day: date({ mode: 'string' }).notNull(),
    signedUpOn: date({ mode: 'string' }).notNull(),
    organizationId: text().references(() => organization.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('activity_day_subject_day_idx').on(t.subjectId, t.day),
    index('activity_day_day_idx').on(t.day),
  ],
)

export const usageEvent = pgTable(
  'usage_event',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    subjectId: text().notNull(),
    organizationId: text().references(() => organization.id, { onDelete: 'set null' }),
    type: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('usage_event_type_created_idx').on(t.type, t.createdAt),
    index('usage_event_subject_idx').on(t.subjectId),
  ],
)
