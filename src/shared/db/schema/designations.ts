import { boolean, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { roles } from './roles';

export const designations = pgTable('designations', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 150 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
