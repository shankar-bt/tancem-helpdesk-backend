import type { InferSelectModel } from 'drizzle-orm';
import type { ticketMasters } from '../../../shared/db/schema';

export type TicketMasterBase = InferSelectModel<typeof ticketMasters>;

export interface TicketMaster extends TicketMasterBase {
  parentName?: string | null;
}

export type MasterType =
  | 'support_category'
  | 'issue_category'
  | 'office_category'
  | 'mode_type'
  | 'issue_type';

export interface CreateMasterData {
  type: string;
  name: string;
  code?: string;
  description?: string;
  parentId?: string | null;
  isActive?: boolean;
}

export interface UpdateMasterData {
  name?: string;
  code?: string;
  description?: string;
  parentId?: string | null;
  isActive?: boolean;
}

