import { inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import { permissions } from '../../../shared/db/schema';
import type { Permission } from '../types/role.types';

export const permissionRepository = {
  async list(): Promise<Permission[]> {
    return db.select().from(permissions).orderBy(permissions.module, permissions.name);
  },

  async findByIds(ids: string[]): Promise<Permission[]> {
    if (ids.length === 0) return [];
    return db.select().from(permissions).where(inArray(permissions.id, ids));
  },

  async findBySlug(slug: string): Promise<Permission | null> {
    const [record] = await db.select().from(permissions).where(inArray(permissions.slug, [slug])).limit(1);
    return record ?? null;
  },
};
