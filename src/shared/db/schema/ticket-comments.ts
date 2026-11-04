import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { users } from './users';

export const ticketComments = pgTable(
  'ticket_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    comment: text('comment').notNull(),
    isInternal: boolean('is_internal').notNull().default(false),
    attachments: jsonb('attachments').$type<{ name: string; url: string; size?: number; type?: string }[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ticket_comments_ticket_id_idx').on(table.ticketId),
    index('ticket_comments_user_id_idx').on(table.userId),
  ],
);
