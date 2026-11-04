import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { departments } from './departments';
import { users } from './users';

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'pending_approval',
  'resolved',
  'closed',
  'reopened',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketNumber: varchar('ticket_number', { length: 32 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    category: varchar('category', { length: 80 }).notNull().default('General'),

    // Corporate Ticket Fields from Raise Ticket Form
    supportCategory: varchar('support_category', { length: 120 }),
    issueCategory: varchar('issue_category', { length: 120 }),
    officeCategory: varchar('office_category', { length: 120 }),
    modeType: varchar('mode_type', { length: 80 }),
    issueType: varchar('issue_type', { length: 80 }),
    ticketRaisedBy: varchar('ticket_raised_by', { length: 120 }),

    // SLA Tracking Fields
    firstResponseDueAt: timestamp('first_response_due_at', { withTimezone: true }),
    firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
    resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }),
    slaBreached: boolean('sla_breached').notNull().default(false),
    slaBreachedAt: timestamp('sla_breached_at', { withTimezone: true }),

    status: ticketStatusEnum('status').notNull().default('open'),
    priority: ticketPriorityEnum('priority').notNull().default('medium'),
    departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedToId: uuid('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    attachments: jsonb('attachments').$type<{ name: string; url: string; size?: number; type?: string }[]>().default([]),
    resolutionNotes: text('resolution_notes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    rating: integer('rating'),
    ratingFeedback: text('rating_feedback'),
    ratedAt: timestamp('rated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tickets_requester_id_idx').on(table.requesterId),
    index('tickets_assigned_to_idx').on(table.assignedToId),
    index('tickets_department_id_idx').on(table.departmentId),
    index('tickets_status_idx').on(table.status),
    index('tickets_resolution_due_at_idx').on(table.resolutionDueAt),
    index('tickets_sla_breached_idx').on(table.slaBreached),
    index('tickets_created_at_idx').on(table.createdAt),
    index('tickets_office_category_idx').on(table.officeCategory),
  ],
);
