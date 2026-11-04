import type { InferSelectModel } from 'drizzle-orm';
import type { departments } from '../../../shared/db/schema';

export type Department = InferSelectModel<typeof departments>;

export interface CreateDepartmentData {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  description?: string;
}
