import { eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { departments } from '../../../shared/db/schema';
import type { CreateDepartmentData, Department, UpdateDepartmentData } from '../types/department.types';

export const departmentRepository = {
  async list(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.name);
  },

  async findById(id: string): Promise<Department | null> {
    const [record] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return record ?? null;
  },

  async findByCode(code: string): Promise<Department | null> {
    const [record] = await db.select().from(departments).where(eq(departments.code, code)).limit(1);
    return record ?? null;
  },

  async findByName(name: string): Promise<Department | null> {
    const [record] = await db.select().from(departments).where(eq(departments.name, name)).limit(1);
    return record ?? null;
  },

  async create(data: CreateDepartmentData): Promise<Department> {
    const [record] = await db.insert(departments).values(data).returning();
    return record;
  },

  async update(id: string, data: UpdateDepartmentData): Promise<Department | null> {
    const [record] = await db
      .update(departments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return record ?? null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id)).returning({ id: departments.id });
    return result.length > 0;
  },
};
