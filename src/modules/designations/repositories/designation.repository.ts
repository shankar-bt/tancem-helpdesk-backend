import { and, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../../../config/database';
import { designations, roles } from '../../../shared/db/schema';
import type {
  CreateDesignationData,
  Designation,
  ListDesignationsQuery,
  UpdateDesignationData,
} from '../types/designation.types';

export const designationRepository = {
  async list(query: ListDesignationsQuery): Promise<{ items: Designation[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.search) {
      conditions.push(
        or(
          ilike(designations.title, `%${query.search}%`),
          ilike(designations.code, `%${query.search}%`),
        ),
      );
    }
    if (query.roleId) {
      conditions.push(eq(designations.roleId, query.roleId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(designations)
      .where(whereClause);

    const items = await db
      .select({
        id: designations.id,
        code: designations.code,
        title: designations.title,
        description: designations.description,
        isActive: designations.isActive,
        roleId: designations.roleId,
        roleName: roles.name,
        roleSlug: roles.slug,
        createdAt: designations.createdAt,
        updatedAt: designations.updatedAt,
      })
      .from(designations)
      .leftJoin(roles, eq(designations.roleId, roles.id))
      .where(whereClause)
      .orderBy(designations.code)
      .limit(limit)
      .offset(offset);

    return {
      items,
      total: countResult?.count ?? 0,
    };
  },

  async findById(id: string): Promise<Designation | null> {
    const [record] = await db
      .select({
        id: designations.id,
        code: designations.code,
        title: designations.title,
        description: designations.description,
        isActive: designations.isActive,
        roleId: designations.roleId,
        roleName: roles.name,
        roleSlug: roles.slug,
        createdAt: designations.createdAt,
        updatedAt: designations.updatedAt,
      })
      .from(designations)
      .leftJoin(roles, eq(designations.roleId, roles.id))
      .where(eq(designations.id, id))
      .limit(1);

    return record ?? null;
  },

  async findByCode(code: string): Promise<Designation | null> {
    const [record] = await db.select().from(designations).where(eq(designations.code, code)).limit(1);
    return record ?? null;
  },

  async create(data: CreateDesignationData): Promise<Designation> {
    const [record] = await db.insert(designations).values(data).returning();
    return this.findById(record.id) as Promise<Designation>;
  },

  async update(id: string, data: UpdateDesignationData): Promise<Designation | null> {
    await db
      .update(designations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(designations.id, id));

    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(designations).where(eq(designations.id, id)).returning({ id: designations.id });
    return result.length > 0;
  },
};
