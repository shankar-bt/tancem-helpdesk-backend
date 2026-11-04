import { z } from 'zod';

export const ticketIdParamSchema = z.object({
  id: z.string().uuid('Invalid ticket id'),
});

export const ticketStatusSchema = z.enum([
  'open',
  'in_progress',
  'pending_approval',
  'resolved',
  'closed',
  'reopened',
]);

export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(10),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  departmentId: z.string().uuid().optional(),
  officeCategory: z.string().trim().max(120).optional(),
  assignedToId: z.string().optional(),
  unassigned: z.coerce.boolean().optional(),
  dateRange: z.enum(['all', 'today', 'week', 'month']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  slaStatus: z.enum(['all', 'within_sla', 'at_risk', 'breached']).optional(),
});

export const createTicketSchema = z.object({
  title: z.string().trim().max(255).optional(),
  description: z.string().trim().min(3, 'Detailed description is required'),
  category: z.string().trim().max(80).optional().default('General'),
  supportCategory: z.string().trim().max(120).optional(),
  issueCategory: z.string().trim().max(120).optional(),
  officeCategory: z.string().trim().max(120).optional(),
  modeType: z.string().trim().max(80).optional(),
  issueType: z.string().trim().max(80).optional(),
  ticketRaisedBy: z.string().trim().max(120).optional(),
  priority: ticketPrioritySchema.default('medium'),
  departmentId: z.string().uuid('Invalid department id').optional().nullable(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    size: z.number().optional(),
    type: z.string().optional(),
  })).optional(),
});

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
  resolutionNotes: z.string().trim().optional(),
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().uuid('Invalid user id').nullable(),
});

export const addCommentSchema = z.object({
  comment: z.string().trim().min(1, 'Comment cannot be empty'),
  isInternal: z.boolean().default(false),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    size: z.number().optional(),
    type: z.string().optional(),
  })).optional(),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
