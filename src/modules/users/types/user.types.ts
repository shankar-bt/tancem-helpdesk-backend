import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '../../../shared/db/schema';
import type { UserRole } from '../../../shared/types';

export type User = InferSelectModel<typeof users>;
export type PublicUser = Omit<User, 'passwordHash'>;

export interface PublicUserWithPermissions extends PublicUser {
  permissions: string[];
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  roleId?: string | null;
  departmentId?: string | null;
  officeCategory?: string | null;
  designationId?: string | null;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  passwordHash?: string;
  role?: UserRole;
  roleId?: string | null;
  departmentId?: string | null;
  officeCategory?: string | null;
  designationId?: string | null;
}

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
}
