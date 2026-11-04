import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import { permissions, rolePermissions, roles, users } from '../../../shared/db/schema';
import type { CreateRoleData, Permission, Role, RoleWithPermissions, UpdateRoleData } from '../types/role.types';

export const roleRepository = {
  async list(): Promise<RoleWithPermissions[]> {
    const allRoles = await db.select().from(roles).orderBy(roles.name);
    if (allRoles.length === 0) return [];

    const allRolePerms = await db
      .select({
        roleId: rolePermissions.roleId,
        permission: permissions,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

    const permMap = new Map<string, Permission[]>();
    for (const rp of allRolePerms) {
      const list = permMap.get(rp.roleId) ?? [];
      list.push(rp.permission);
      permMap.set(rp.roleId, list);
    }

    return allRoles.map((role) => ({
      ...role,
      permissions: permMap.get(role.id) ?? [],
    }));
  },

  async findById(id: string): Promise<RoleWithPermissions | null> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!role) return null;

    const rolePerms = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, id));

    return {
      ...role,
      permissions: rolePerms.map((rp) => rp.permission),
    };
  },

  async findBySlug(slug: string): Promise<Role | null> {
    const [role] = await db.select().from(roles).where(eq(roles.slug, slug)).limit(1);
    return role ?? null;
  },

  async findByName(name: string): Promise<Role | null> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
    return role ?? null;
  },

  async create(data: CreateRoleData): Promise<RoleWithPermissions> {
    const [role] = await db
      .insert(roles)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description,
      })
      .returning();

    if (data.permissionIds && data.permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        data.permissionIds.map((pId) => ({
          roleId: role.id,
          permissionId: pId,
        })),
      );
    }

    return (await this.findById(role.id))!;
  },

  async update(id: string, data: UpdateRoleData): Promise<RoleWithPermissions | null> {
    const updateValues: Partial<typeof roles.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;

    await db.update(roles).set(updateValues).where(eq(roles.id, id));

    if (data.permissionIds !== undefined) {
      // Replace permissions
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
      if (data.permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          data.permissionIds.map((pId) => ({
            roleId: id,
            permissionId: pId,
          })),
        );
      }
    }

    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(roles).where(eq(roles.id, id)).returning({ id: roles.id });
    return result.length > 0;
  },

  async getPermissionsForUser(userId: string): Promise<string[]> {
    const [user] = await db
      .select({ roleId: users.roleId, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return [];

    let targetRoleId = user.roleId;
    if (!targetRoleId) {
      const [matchedRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.slug, user.role))
        .limit(1);
      targetRoleId = matchedRole?.id ?? null;
    }

    if (!targetRoleId) return [];

    const perms = await db
      .select({ slug: permissions.slug })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, targetRoleId));

    return perms.map((p) => p.slug);
  },
};
