import type { InferSelectModel } from 'drizzle-orm';
import type { slaPolicies } from '../../../shared/db/schema';
import type { TicketPriority } from '../../tickets/types/ticket.types';

export type SlaPolicy = InferSelectModel<typeof slaPolicies>;

export type SlaStatus = 'within_sla' | 'at_risk' | 'breached' | 'met';

export interface SlaDeadlines {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
}

export interface UpdateSlaPolicyInput {
  name?: string;
  responseTimeMinutes?: number;
  resolutionTimeMinutes?: number;
  isActive?: boolean;
}
