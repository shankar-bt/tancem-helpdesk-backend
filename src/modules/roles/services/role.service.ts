import { AppError } from '../../../shared/utils/app-error';
import { permissionRepository } from '../repositories/permission.repository';
import { roleRepository } from '../repositories/role.repository';
import type { AssignPermissionsInput, CreateRoleInput, UpdateRoleInput } from '../schemas/role.schema';
import type { Permission, RoleWithPermissions } from '../types/role.types';

export const roleService = {
  async listRoles(): Promise<RoleWithPermissions[]> {
    return roleRepository.list();
  },

  async getRoleById(id: string): Promise<RoleWithPermissions> {
    const role = await roleRepository.findById(id);
    if (!role) throw AppError.notFound('Role not found');
    return role;
  },

  async createRole(input: CreateRoleInput): Promise<RoleWithPermissions> {
    if (await roleRepository.findBySlug(input.slug)) {
      throw AppError.conflict(`Role with slug '${input.slug}' already exists`);
    }
    if (await roleRepository.findByName(input.name)) {
      throw AppError.conflict(`Role with name '${input.name}' already exists`);
    }

    if (input.permissionIds && input.permissionIds.length > 0) {
      const validPermissions = await permissionRepository.findByIds(input.permissionIds);
      if (validPermissions.length !== input.permissionIds.length) {
        throw AppError.badRequest('One or more permission IDs are invalid');
      }
    }

    return roleRepository.create(input);
  },

  async updateRole(id: string, input: UpdateRoleInput): Promise<RoleWithPermissions> {
    const role = await roleRepository.findById(id);
    if (!role) throw AppError.notFound('Role not found');

    if (input.name && input.name !== role.name) {
      if (await roleRepository.findByName(input.name)) {
        throw AppError.conflict(`Role with name '${input.name}' already exists`);
      }
    }

    if (input.permissionIds && input.permissionIds.length > 0) {
      const validPermissions = await permissionRepository.findByIds(input.permissionIds);
      if (validPermissions.length !== input.permissionIds.length) {
        throw AppError.badRequest('One or more permission IDs are invalid');
      }
    }

    const updated = await roleRepository.update(id, input);
    if (!updated) throw AppError.notFound('Role not found');
    return updated;
  },

  async deleteRole(id: string): Promise<void> {
    const role = await roleRepository.findById(id);
    if (!role) throw AppError.notFound('Role not found');
    if (role.isSystem) {
      throw AppError.badRequest('System roles cannot be deleted');
    }

    const deleted = await roleRepository.delete(id);
    if (!deleted) throw AppError.notFound('Role not found');
  },

  async assignPermissions(id: string, input: AssignPermissionsInput): Promise<RoleWithPermissions> {
    const role = await roleRepository.findById(id);
    if (!role) throw AppError.notFound('Role not found');

    const validPermissions = await permissionRepository.findByIds(input.permissionIds);
    if (validPermissions.length !== input.permissionIds.length) {
      throw AppError.badRequest('One or more permission IDs are invalid');
    }

    const updated = await roleRepository.update(id, { permissionIds: input.permissionIds });
    if (!updated) throw AppError.notFound('Role not found');
    return updated;
  },

  async listPermissions(): Promise<{ module: string; permissions: Permission[] }[]> {
    const perms = await permissionRepository.list();
    const grouped = new Map<string, Permission[]>();
    for (const p of perms) {
      const list = grouped.get(p.module) ?? [];
      list.push(p);
      grouped.set(p.module, list);
    }

    const MODULE_ORDER = [
      'Dashboard',
      'Tickets',
      'Reports & Analytics',
      'User Management',
      'Category Masters',
      'Departments',
      'Designations',
      'SLA Policies',
      'Roles & Permissions',
    ];
    const ACTION_ORDER = ['view', 'create', 'edit', 'delete'];

    const sortedGroups = Array.from(grouped.entries())
      .map(([module, permissions]) => {
        permissions.sort((a, b) => {
          const actionA = a.slug.split(':')[1] || '';
          const actionB = b.slug.split(':')[1] || '';
          const idxA = ACTION_ORDER.indexOf(actionA);
          const idxB = ACTION_ORDER.indexOf(actionB);
          return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
        });
        return { module, permissions };
      })
      .sort((a, b) => {
        const idxA = MODULE_ORDER.indexOf(a.module);
        const idxB = MODULE_ORDER.indexOf(b.module);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.module.localeCompare(b.module);
      });

    return sortedGroups;
  },

  async getUserPermissions(userId: string, role?: string): Promise<string[]> {
    // Super admins and administrators always have full access to all permissions
    const r = (role || '').toLowerCase();
    if (r === 'admin' || r === 'super_admin' || r === 'superadmin' || r === 'administrator' || r.includes('admin')) {
      const all = await permissionRepository.list();
      return all.map((p) => p.slug);
    }
    return roleRepository.getPermissionsForUser(userId);
  },
};
