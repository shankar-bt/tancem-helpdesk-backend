import type { InferSelectModel } from 'drizzle-orm';
import type { ticketComments, tickets } from '../../../shared/db/schema';
import type { Department } from '../../departments/types/department.types';
import type { PublicUser } from '../../users/types/user.types';

export type Ticket = InferSelectModel<typeof tickets>;
export type TicketComment = InferSelectModel<typeof ticketComments>;

export type TicketStatus = 'open' | 'in_progress' | 'pending_approval' | 'resolved' | 'closed' | 'reopened';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SlaStatus = 'within_sla' | 'at_risk' | 'breached' | 'met';

export interface TicketWithDetails extends Ticket {
  requester?: PublicUser | null;
  assignedTo?: PublicUser | null;
  department?: Department | null;
  slaStatus?: SlaStatus;
  slaRemainingMinutes?: number | null;
}

export interface TicketCommentWithUser extends TicketComment {
  user?: (PublicUser & { roleName?: string | null; roleSlug?: string | null }) | null;
  author?: (PublicUser & { roleName?: string | null; roleSlug?: string | null }) | null;
}

export interface CreateTicketData {
  title?: string;
  description: string;
  category?: string;
  supportCategory?: string;
  issueCategory?: string;
  officeCategory?: string;
  modeType?: string;
  issueType?: string;
  ticketRaisedBy?: string;
  priority?: TicketPriority;
  departmentId?: string | null;
  requesterId: string;
  attachments?: { name: string; url: string; size?: number; type?: string }[];
  firstResponseDueAt?: Date | null;
  resolutionDueAt?: Date | null;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  category?: string;
  supportCategory?: string;
  issueCategory?: string;
  officeCategory?: string;
  modeType?: string;
  issueType?: string;
  ticketRaisedBy?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  departmentId?: string;
  assignedToId?: string | null;
  resolutionNotes?: string;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  firstResponseDueAt?: Date | null;
  firstRespondedAt?: Date | null;
  resolutionDueAt?: Date | null;
  slaBreached?: boolean;
  slaBreachedAt?: Date | null;
}

export interface TicketScope {
  userId: string;
  isManager?: boolean;
  isAgent?: boolean;
  officeCategory?: string | null;
  departmentId?: string | null;
  canReadAll: boolean;
}

export interface ListTicketsQuery {
  page: number;
  limit: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  departmentId?: string;
  officeCategory?: string;
  search?: string;
  requesterId?: string;
  assignedToId?: string;
  slaStatus?: 'all' | 'within_sla' | 'at_risk' | 'breached';
  unassigned?: boolean | string;
  dateRange?: 'all' | 'today' | 'week' | 'month';
  startDate?: string;
  endDate?: string;
  scope?: TicketScope;
}

export interface TicketHistoryEvent {
  id: string;
  type: 'created' | 'assigned' | 'in_progress' | 'comment' | 'sla_breached' | 'resolved' | 'closed' | 'reopened';
  title: string;
  description: string;
  timestamp: string | Date;
  status?: TicketStatus | null;
  actorName?: string | null;
  actorRole?: string | null;
  actorRoleSlug?: string | null;
  details?: Record<string, any>;
}
