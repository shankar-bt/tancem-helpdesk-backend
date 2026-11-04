import { aliasedTable, and, eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { ticketMasters } from '../../../shared/db/schema';
import type { CreateMasterData, TicketMaster, UpdateMasterData } from '../types/master.types';

const parentMasters = aliasedTable(ticketMasters, 'parent_masters');

const masterSelectFields = {
  id: ticketMasters.id,
  type: ticketMasters.type,
  name: ticketMasters.name,
  code: ticketMasters.code,
  description: ticketMasters.description,
  parentId: ticketMasters.parentId,
  parentName: parentMasters.name,
  isActive: ticketMasters.isActive,
  createdAt: ticketMasters.createdAt,
  updatedAt: ticketMasters.updatedAt,
};

export const masterRepository = {
  async list(type?: string, isActive?: boolean, parentId?: string): Promise<TicketMaster[]> {
    const conditions = [];
    if (type) conditions.push(eq(ticketMasters.type, type));
    if (isActive !== undefined) conditions.push(eq(ticketMasters.isActive, isActive));
    if (parentId) conditions.push(eq(ticketMasters.parentId, parentId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db
      .select(masterSelectFields)
      .from(ticketMasters)
      .leftJoin(parentMasters, eq(ticketMasters.parentId, parentMasters.id))
      .where(where)
      .orderBy(ticketMasters.name);
  },

  async findById(id: string): Promise<TicketMaster | null> {
    const [record] = await db
      .select(masterSelectFields)
      .from(ticketMasters)
      .leftJoin(parentMasters, eq(ticketMasters.parentId, parentMasters.id))
      .where(eq(ticketMasters.id, id))
      .limit(1);
    return record ?? null;
  },

  async create(data: CreateMasterData): Promise<TicketMaster> {
    const [record] = await db.insert(ticketMasters).values(data).returning();
    return record;
  },

  async update(id: string, data: UpdateMasterData): Promise<TicketMaster | null> {
    const [record] = await db
      .update(ticketMasters)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ticketMasters.id, id))
      .returning();
    return record ?? null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(ticketMasters).where(eq(ticketMasters.id, id)).returning({ id: ticketMasters.id });
    return result.length > 0;
  },
};
