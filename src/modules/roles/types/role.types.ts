import type { InferSelectModel } from 'drizzle-orm';
import type { permissions, rolePermissions, roles } from '../../../shared/db/schema';

export type Role = InferSelectModel<typeof roles>;
export type Permission = InferSelectModel<typeof permissions>;
export type RolePermission = InferSelectModel<typeof rolePermissions>;

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface CreateRoleData {
  name: string;
  slug: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  permissionIds?: string[];
}
