import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { users } from './users';

export const ticketActivities = pgTable(
  'ticket_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    status: varchar('status', { length: 50 }),
    actorName: varchar('actor_name', { length: 255 }),
    actorRole: varchar('actor_role', { length: 100 }),
    actorRoleSlug: varchar('actor_role_slug', { length: 50 }),
    details: jsonb('details').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ticket_activities_ticket_id').on(table.ticketId),
    index('idx_ticket_activities_created_at').on(table.createdAt),
  ],
);
