import { count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../../shared/db';
import { users } from '../../../shared/db/schema';
import type {
  CreateUserData,
  ListUsersParams,
  PublicUser,
  UpdateUserData,
  User,
} from '../types/user.types';

const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  roleId: users.roleId,
  departmentId: users.departmentId,
  officeCategory: users.officeCategory,
  designationId: users.designationId,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export const userRepository = {
  async findById(id: string): Promise<PublicUser | undefined> {
    const [row] = await db.select(publicColumns).from(users).where(eq(users.id, id)).limit(1);
    return row;
  },

  async findByEmail(email: string): Promise<PublicUser | undefined> {
    const [row] = await db.select(publicColumns).from(users).where(eq(users.email, email)).limit(1);
    return row;
  },

  /** Includes passwordHash — only for authentication flows. */
  async findByEmailWithPassword(email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return row;
  },

  async list({ page, limit, search }: ListUsersParams): Promise<{ items: PublicUser[]; total: number }> {
    const where: SQL | undefined = search
      ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
      : undefined;

    const [items, [{ value: total }]] = await Promise.all([
      db
        .select(publicColumns)
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ value: count() }).from(users).where(where),
    ]);

    return { items, total };
  },

  async count(): Promise<number> {
    const [{ value }] = await db.select({ value: count() }).from(users);
    return value;
  },

  async create(data: CreateUserData): Promise<PublicUser> {
    const [row] = await db.insert(users).values(data).returning(publicColumns);
    return row;
  },

  async update(id: string, data: UpdateUserData): Promise<PublicUser | undefined> {
    const [row] = await db
      .update(users)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(users.id, id))
      .returning(publicColumns);
    return row;
  },

  async findStaffUsers(): Promise<Array<{ id: string; role: string; name: string }>> {
    return db
      .select({ id: users.id, role: users.role, name: users.name })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'agent')));
  },

    async delete(id: string): Promise<boolean> {
    const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return rows.length > 0;
  },
};
