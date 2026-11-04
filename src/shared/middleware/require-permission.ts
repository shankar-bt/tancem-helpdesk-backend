import type { NextFunction, Request, Response } from 'express';
import { roleService } from '../../modules/roles/services/role.service';
import { AppError } from '../utils/app-error';

async function resolveUserPermissions(req: Request): Promise<string[]> {
  if (!req.user) return [];
  if (req.user.permissions) return req.user.permissions;

  const perms = await roleService.getUserPermissions(req.user.id, req.user.role);
  req.user.permissions = perms;
  return perms;
}

const PERMISSION_ALIAS_MAP: Record<string, string[]> = {
  // Tickets
  'tickets:read': ['tickets:view', 'tickets:read', 'Ticket List'],
  'tickets:read_all': ['tickets:view', 'tickets:read_all', 'Ticket List'],
  'tickets:read_dept': ['tickets:view', 'tickets:read_dept', 'Ticket List'],
  'tickets:create': ['tickets:create', 'Create Ticket'],
  'tickets:update_status': ['tickets:edit', 'tickets:update_status'],
  'tickets:assign': ['tickets:edit', 'tickets:assign'],
  'tickets:delete': ['tickets:delete'],

  // Departments
  'departments:manage': ['departments:create', 'departments:edit', 'departments:delete', 'departments:manage', 'Departments'],
  'departments:read': ['departments:view', 'departments:read', 'Departments'],

  // Users
  'users:manage': ['users:create', 'users:edit', 'users:delete', 'users:manage', 'User Management'],
  'users:read': ['users:view', 'users:read', 'User Management'],

  // Masters
  'masters:manage': ['masters:create', 'masters:edit', 'masters:delete', 'masters:manage', 'Master'],
  'masters:read': ['masters:view', 'masters:read', 'Master'],

  // Roles
  'roles:manage': ['roles:create', 'roles:edit', 'roles:delete', 'roles:manage', 'Roles & Permissions'],
  'roles:read': ['roles:view', 'roles:read', 'Roles & Permissions'],

  // Dashboard
  'dashboard:view': ['dashboard:view', 'Dashboard'],

  // Reports
  'reports:read': ['reports:view', 'reports:read', 'Reports & Analytics'],
  'reports:manage': ['reports:create', 'reports:edit', 'reports:delete', 'reports:manage', 'Reports & Analytics'],

  // SLA
  'sla:manage': ['sla:create', 'sla:edit', 'sla:delete', 'sla:manage', 'SLA Policies'],
  'sla:read': ['sla:view', 'sla:read', 'SLA Policies'],

  // Designations
  'designations:manage': ['designations:create', 'designations:edit', 'designations:delete', 'designations:manage', 'Designations'],
  'designations:read': ['designations:view', 'designations:read', 'Designations'],
};

function checkPermissionMatch(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes(required)) return true;

  // Fully dynamic matching based on module and action semantics
  const normReq = required.toLowerCase().trim();
  const [reqMod, reqAct] = normReq.split(':');

  for (const perm of userPermissions) {
    const normPerm = perm.toLowerCase().trim();
    if (normPerm === normReq) return true;

    const [pMod, pAct] = normPerm.split(':');
    if (pMod && reqMod && pMod === reqMod) {
      // Full module management wildcard
      if (pAct === 'manage' || pAct === 'all' || !pAct) return true;
      // Semantic equivalents: read <-> view, manage <-> create/edit/delete
      if ((reqAct === 'read' && pAct === 'view') || (reqAct === 'view' && pAct === 'read')) return true;
      if (reqAct === 'manage' && ['create', 'edit', 'delete'].includes(pAct)) return true;
      if ((reqAct === 'assign' || reqAct === 'update_status') && pAct === 'edit') return true;
      if (reqAct && pAct && reqAct.startsWith(pAct)) return true;
    }
  }

  const aliases = PERMISSION_ALIAS_MAP[required] ?? [];
  return aliases.some((a) => userPermissions.includes(a));
}

export const requirePermission =
  (...requiredPermissions: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin' || role === 'super_admin' || role === 'superadmin' || role === 'administrator' || role.includes('admin')) return next();

    try {
      const userPermissions = await resolveUserPermissions(req);
      const hasAll = requiredPermissions.every((p) => checkPermissionMatch(userPermissions, p));
      if (!hasAll) {
        return next(
          AppError.forbidden(`Missing required permission: ${requiredPermissions.join(', ')}`),
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };

export const requireAnyPermission =
  (...permissions: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin' || role === 'super_admin' || role === 'superadmin' || role === 'administrator' || role.includes('admin')) return next();

    try {
      const userPermissions = await resolveUserPermissions(req);
      const hasAny = permissions.some((p) => checkPermissionMatch(userPermissions, p));
      if (!hasAny) {
        return next(
          AppError.forbidden(`Requires at least one permission: ${permissions.join(', ')}`),
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
