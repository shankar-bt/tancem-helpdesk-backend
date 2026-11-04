import { passwordService } from '../../../shared/services/password.service';
import type { AuthUser } from '../../../shared/types';
import { AppError } from '../../../shared/utils/app-error';
import { roleRepository } from '../../roles/repositories/role.repository';
import { userRepository } from '../repositories/user.repository';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from '../schemas/user.schema';
import type { PublicUser, UpdateUserData } from '../types/user.types';

async function determineRoleFromRoleId(roleId?: string | null, fallbackRole: string = 'user'): Promise<string> {
  if (!roleId) return fallbackRole;
  const role = await roleRepository.findById(roleId);
  if (!role) return fallbackRole;
  if (role.slug === 'admin' || role.slug === 'administrator') return 'admin';
  if (role.slug === 'manager' || role.name?.toLowerCase().includes('manager')) return 'manager';
  if (role.slug === 'agent') return 'agent';
  return 'user';
}

export const userService = {
  async list(query: ListUsersQuery) {
    const { items, total } = await userRepository.list(query);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  },

  async getById(id: string): Promise<PublicUser> {
    const user = await userRepository.findById(id);
    if (!user) throw AppError.notFound('User not found');
    return user;
  },

  async create(input: CreateUserInput): Promise<PublicUser> {
    if (await userRepository.findByEmail(input.email)) {
      throw AppError.conflict('A user with this email already exists');
    }
    const finalRole = (input.roleId
      ? await determineRoleFromRoleId(input.roleId, input.role)
      : input.role) as any;

    return userRepository.create({
      name: input.name,
      email: input.email,
      role: finalRole,
      roleId: input.roleId,
      departmentId: input.departmentId,
      officeCategory: input.officeCategory,
      designationId: input.designationId || null,
      passwordHash: await passwordService.hash(input.password),
    });
  },

  async update(id: string, input: UpdateUserInput, actor: AuthUser): Promise<PublicUser> {
    const isAdmin = actor.role === 'admin';
    if (!isAdmin && actor.id !== id) throw AppError.forbidden('You can only update your own account');
    if (!isAdmin && (input.role !== undefined || input.roleId !== undefined)) {
      throw AppError.forbidden('Only administrators can assign access roles or modify privileges');
    }
    if (!isAdmin && (input.departmentId !== undefined || input.officeCategory !== undefined)) {
      throw AppError.forbidden('Department and office reassignments can only be performed by an administrator');
    }

    const existing = await userRepository.findById(id);
    if (!existing) throw AppError.notFound('User not found');

    if (input.email && input.email !== existing.email) {
      if (await userRepository.findByEmail(input.email)) {
        throw AppError.conflict('A user with this email already exists');
      }
    }

    const data: UpdateUserData = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.roleId !== undefined) {
      data.roleId = input.roleId;
      if (input.roleId) {
        data.role = (await determineRoleFromRoleId(input.roleId, input.role || existing.role)) as any;
      } else if (input.role !== undefined) {
        data.role = input.role;
      }
    } else if (input.role !== undefined) {
      data.role = input.role;
    }
    if (input.departmentId !== undefined) data.departmentId = input.departmentId;
    if (input.officeCategory !== undefined) data.officeCategory = input.officeCategory;
    if (input.designationId !== undefined) data.designationId = input.designationId;
    if (input.password) data.passwordHash = await passwordService.hash(input.password);

    const updated = await userRepository.update(id, data);
    if (!updated) throw AppError.notFound('User not found');
    return updated;
  },

  async remove(id: string, actor: AuthUser): Promise<void> {
    if (actor.id === id) throw AppError.badRequest('You cannot delete your own account');
    const deleted = await userRepository.delete(id);
    if (!deleted) throw AppError.notFound('User not found');
  },
};
