import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const ticketMasters = pgTable(
  'ticket_masters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 50 }).notNull(), // 'support_category' | 'issue_category' | 'office_category' | 'mode_type' | 'issue_type'
    name: varchar('name', { length: 120 }).notNull(),
    code: varchar('code', { length: 50 }),
    description: text('description'),
    parentId: uuid('parent_id').references((): any => ticketMasters.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ticket_masters_type_idx').on(table.type),
    index('ticket_masters_parent_id_idx').on(table.parentId),
  ],
);
