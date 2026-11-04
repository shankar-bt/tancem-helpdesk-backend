import { and, inArray, count, desc, eq, gte, gt, ilike, isNull, lt, lte, notInArray, or, type SQL } from 'drizzle-orm';
import { db } from '../../../config/database';
import { departments, roles, ticketActivities, ticketComments, tickets, users } from '../../../shared/db/schema';
import type {
  CreateTicketData,
  ListTicketsQuery,
  TicketCommentWithUser,
  TicketScope,
  TicketWithDetails,
  UpdateTicketData,
} from '../types/ticket.types';

const userPublicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  roleId: users.roleId,
  designationId: users.designationId,
  departmentId: users.departmentId,
  officeCategory: users.officeCategory,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

function buildScopeCondition(scope?: TicketScope, query?: ListTicketsQuery): SQL | undefined {
  if (!scope || scope.canReadAll) return undefined;

  // Department Manager: sees all tickets in their office category and department,
  // plus tickets they raised or tickets assigned to them.
  if (scope.isManager) {
    const targetOffice = query?.officeCategory || scope.officeCategory;
    const targetDept = query?.departmentId || scope.departmentId;

    const managerConditions: (SQL | undefined)[] = [
      eq(tickets.requesterId, scope.userId),
      eq(tickets.assignedToId, scope.userId),
    ];

    if (targetOffice && targetDept) {
      managerConditions.push(
        and(
          eq(tickets.officeCategory, targetOffice),
          eq(tickets.departmentId, targetDept),
        ),
      );
    } else if (targetOffice) {
      managerConditions.push(eq(tickets.officeCategory, targetOffice));
    } else if (targetDept) {
      managerConditions.push(eq(tickets.departmentId, targetDept));
    } else {
      // If manager has no office or department constraint, allow viewing
      return undefined;
    }

    const validConditions = managerConditions.filter((c): c is SQL => Boolean(c));
    return validConditions.length > 0 ? or(...validConditions) : undefined;
  }

  // Support Agents see tickets assigned to them, tickets they raised,
  // PLUS all unassigned tickets in the queue ready to be claimed!
  if (scope.isAgent) {
    return or(
      eq(tickets.requesterId, scope.userId),
      eq(tickets.assignedToId, scope.userId),
      isNull(tickets.assignedToId),
    );
  }

  // Standard Users see only tickets they raised
  return or(
    eq(tickets.requesterId, scope.userId),
    eq(tickets.assignedToId, scope.userId),
  );
}

export const ticketRepository = {
  async list(query: ListTicketsQuery): Promise<{ items: TicketWithDetails[]; total: number }> {
    const conditions: SQL[] = [];

    if (query.status) conditions.push(eq(tickets.status, query.status));
    if (query.priority) conditions.push(eq(tickets.priority, query.priority));
    if (query.departmentId) conditions.push(eq(tickets.departmentId, query.departmentId));
    if (query.officeCategory) conditions.push(eq(tickets.officeCategory, query.officeCategory));
    if (query.requesterId) conditions.push(eq(tickets.requesterId, query.requesterId));
    if (query.assignedToId) conditions.push(eq(tickets.assignedToId, query.assignedToId));
    if (query.unassigned) conditions.push(isNull(tickets.assignedToId));
    if (query.startDate) {
      const start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(tickets.createdAt, start));
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(tickets.createdAt, end));
    }
    if (query.dateRange && query.dateRange !== 'all') {
      const now = new Date();
      if (query.dateRange === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        conditions.push(gte(tickets.createdAt, startOfToday));
      } else if (query.dateRange === 'week') {
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        conditions.push(gte(tickets.createdAt, startOfWeek));
      } else if (query.dateRange === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        conditions.push(gte(tickets.createdAt, startOfMonth));
      }
    }
    if (query.search) {
      conditions.push(
        or(
          ilike(tickets.ticketNumber, `%${query.search}%`),
          ilike(tickets.title, `%${query.search}%`),
          ilike(tickets.description, `%${query.search}%`),
          ilike(tickets.category, `%${query.search}%`),
        )!,
      );
    }

    if (query.slaStatus && query.slaStatus !== 'all') {
      const now = new Date();
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
      if (query.slaStatus === 'breached') {
        conditions.push(
          or(
            eq(tickets.slaBreached, true),
            and(notInArray(tickets.status, ['resolved', 'closed']), lt(tickets.resolutionDueAt, now)),
          )!,
        );
      } else if (query.slaStatus === 'at_risk') {
        conditions.push(
          and(
            notInArray(tickets.status, ['resolved', 'closed']),
            eq(tickets.slaBreached, false),
            gte(tickets.resolutionDueAt, now),
            lte(tickets.resolutionDueAt, twoHoursFromNow),
          )!,
        );
      } else if (query.slaStatus === 'within_sla') {
        conditions.push(
          and(
            notInArray(tickets.status, ['resolved', 'closed']),
            eq(tickets.slaBreached, false),
            gt(tickets.resolutionDueAt, twoHoursFromNow),
          )!,
        );
      }
    }

    const scopeCondition = buildScopeCondition(query.scope, query);
    if (scopeCondition) {
      conditions.push(scopeCondition);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [countResult] = await db.select({ value: count() }).from(tickets).where(where);
    const total = Number(countResult?.value ?? 0);

    const rows = await db
      .select({
        ticket: tickets,
        requester: userPublicColumns,
      })
      .from(tickets)
      .innerJoin(users, eq(tickets.requesterId, users.id))
      .where(where)
      .orderBy(desc(tickets.createdAt))
      .limit(query.limit)
      .offset(offset);

    // Fetch department details
    const allDeptIds = rows.map((r) => r.ticket.departmentId).filter(Boolean) as string[];
    const depts = allDeptIds.length > 0 ? await db.select().from(departments) : [];
    const deptMap = new Map(depts.map((d) => [d.id, d]));

    // Fetch assigned users
    const allAssignedIds = rows.map((r) => r.ticket.assignedToId).filter(Boolean) as string[];
    const assignedUsers = allAssignedIds.length > 0
      ? await db.select(userPublicColumns).from(users).where(inArray(users.id, allAssignedIds))
      : [];
    const assignedUserMap = new Map(assignedUsers.map((u) => [u.id, u]));

    const items: TicketWithDetails[] = rows.map((r) => ({
      ...r.ticket,
      requester: r.requester,
      assignedTo: r.ticket.assignedToId ? assignedUserMap.get(r.ticket.assignedToId) ?? null : null,
      department: r.ticket.departmentId ? deptMap.get(r.ticket.departmentId) ?? null : null,
    }));

    return { items, total };
  },

  async findById(id: string): Promise<TicketWithDetails | null> {
    const [row] = await db
      .select({
        ticket: tickets,
        requester: userPublicColumns,
      })
      .from(tickets)
      .innerJoin(users, eq(tickets.requesterId, users.id))
      .where(eq(tickets.id, id))
      .limit(1);

    if (!row) return null;

    let assignedTo = null;
    if (row.ticket.assignedToId) {
      const [assignedUser] = await db
        .select(userPublicColumns)
        .from(users)
        .where(eq(users.id, row.ticket.assignedToId))
        .limit(1);
      assignedTo = assignedUser ?? null;
    }

    let department = null;
    if (row.ticket.departmentId) {
      const [dept] = await db.select().from(departments).where(eq(departments.id, row.ticket.departmentId)).limit(1);
      department = dept ?? null;
    }

    return {
      ...row.ticket,
      requester: row.requester,
      assignedTo,
      department,
    };
  },

  async create(data: CreateTicketData): Promise<TicketWithDetails> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TKT-${dateStr}-`;

    // Calculate sequential ticket number for the day (e.g. TKT-20261021-0001, 0002...)
    const existingToday = await db
      .select({ ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(ilike(tickets.ticketNumber, `${prefix}%`));

    let maxSeq = 0;
    for (const t of existingToday) {
      const parts = t.ticketNumber.split('-');
      const numStr = parts[parts.length - 1];
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }

    let nextSeq = maxSeq + 1;
    let ticketNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    const title =
      data.title ||
      [data.supportCategory, data.issueCategory].filter(Boolean).join(' - ') ||
      'Support Request';

    let ticket: any = null;
    let attempts = 0;
    while (attempts < 5) {
      try {
        const [inserted] = await db
          .insert(tickets)
          .values({
            ticketNumber,
            title,
            description: data.description,
            category: data.category || 'General',
            supportCategory: data.supportCategory,
            issueCategory: data.issueCategory,
            officeCategory: data.officeCategory,
            modeType: data.modeType,
            issueType: data.issueType,
            ticketRaisedBy: data.ticketRaisedBy,
            priority: data.priority ?? 'medium',
            departmentId: data.departmentId,
            requesterId: data.requesterId,
            firstResponseDueAt: data.firstResponseDueAt,
            resolutionDueAt: data.resolutionDueAt,
            attachments: data.attachments || [],
          })
          .returning();
        ticket = inserted;
        break;
      } catch (err) {
        if (err && (err as any).code === '23505' && attempts < 4) {
          nextSeq++;
          ticketNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
          attempts++;
        } else {
          throw err;
        }
      }
    }

    return (await this.findById(ticket.id))!;
  },

  async update(id: string, data: UpdateTicketData): Promise<TicketWithDetails | null> {
    const updateValues: Partial<typeof tickets.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.category !== undefined) updateValues.category = data.category;
    if (data.supportCategory !== undefined) updateValues.supportCategory = data.supportCategory;
    if (data.issueCategory !== undefined) updateValues.issueCategory = data.issueCategory;
    if (data.officeCategory !== undefined) updateValues.officeCategory = data.officeCategory;
    if (data.modeType !== undefined) updateValues.modeType = data.modeType;
    if (data.issueType !== undefined) updateValues.issueType = data.issueType;
    if (data.ticketRaisedBy !== undefined) updateValues.ticketRaisedBy = data.ticketRaisedBy;
    if (data.priority !== undefined) updateValues.priority = data.priority;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.departmentId !== undefined) updateValues.departmentId = data.departmentId;
    if (data.assignedToId !== undefined) updateValues.assignedToId = data.assignedToId;
    if (data.resolutionNotes !== undefined) updateValues.resolutionNotes = data.resolutionNotes;
    if (data.resolvedAt !== undefined) updateValues.resolvedAt = data.resolvedAt;
    if (data.closedAt !== undefined) updateValues.closedAt = data.closedAt;
    if (data.firstResponseDueAt !== undefined) updateValues.firstResponseDueAt = data.firstResponseDueAt;
    if (data.firstRespondedAt !== undefined) updateValues.firstRespondedAt = data.firstRespondedAt;
    if (data.resolutionDueAt !== undefined) updateValues.resolutionDueAt = data.resolutionDueAt;
    if (data.slaBreached !== undefined) updateValues.slaBreached = data.slaBreached;
    if (data.slaBreachedAt !== undefined) updateValues.slaBreachedAt = data.slaBreachedAt;

    await db.update(tickets).set(updateValues).where(eq(tickets.id, id));
    return this.findById(id);
  },

  async addComment(ticketId: string, userId: string, comment: string, isInternal: boolean, attachments?: any[]): Promise<TicketCommentWithUser> {
    const [record] = await db
      .insert(ticketComments)
      .values({
        ticketId,
        userId,
        comment,
        isInternal,
        attachments: attachments || [],
      })
      .returning();

    const [user] = await db
      .select({
        ...userPublicColumns,
        roleName: roles.name,
        roleSlug: roles.slug,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    return {
      ...record,
      user: user ?? null,
      author: user ?? null,
    };
  },

  async listComments(ticketId: string, includeInternal: boolean): Promise<TicketCommentWithUser[]> {
    const conditions = [eq(ticketComments.ticketId, ticketId)];
    if (!includeInternal) {
      conditions.push(eq(ticketComments.isInternal, false));
    }

    const rows = await db
      .select({
        comment: ticketComments,
        user: {
          ...userPublicColumns,
          roleName: roles.name,
          roleSlug: roles.slug,
        },
      })
      .from(ticketComments)
      .innerJoin(users, eq(ticketComments.userId, users.id))
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(and(...conditions))
      .orderBy(ticketComments.createdAt);

    return rows.map((r) => ({
      ...r.comment,
      user: r.user,
      author: r.user,
    }));
  },

  async recordActivity(data: {
    ticketId: string;
    actorId?: string | null;
    type: string;
    title: string;
    description: string;
    status?: string | null;
    actorName?: string | null;
    actorRole?: string | null;
    actorRoleSlug?: string | null;
    details?: Record<string, any>;
    createdAt?: Date;
  }) {
    const [record] = await db
      .insert(ticketActivities)
      .values({
        ticketId: data.ticketId,
        actorId: data.actorId ?? null,
        type: data.type,
        title: data.title,
        description: data.description,
        status: data.status ?? null,
        actorName: data.actorName ?? null,
        actorRole: data.actorRole ?? null,
        actorRoleSlug: data.actorRoleSlug ?? null,
        details: data.details ?? {},
        createdAt: data.createdAt ?? new Date(),
      })
      .returning();
    return record;
  },

  async rateTicket(id: string, rating: number, feedback?: string) {
    await db
      .update(tickets)
      .set({
        rating,
        ratingFeedback: feedback || null,
        ratedAt: new Date(),
      })
      .where(eq(tickets.id, id));
    return this.findById(id);
  },

  async listActivities(ticketId: string) {
    return db
      .select()
      .from(ticketActivities)
      .where(eq(ticketActivities.ticketId, ticketId))
      .orderBy(ticketActivities.createdAt);
  },

  async getStats(filters: { departmentId?: string; requesterId?: string; officeCategory?: string; scope?: TicketScope }): Promise<{
    total: number;
    open: number;
    resolved: number;
    withinSla: number;
    atRisk: number;
    breached: number;
    complianceRate: number;
    averageRating: number;
    ratingCount: number;
    byStatus: {
      open: number;
      in_progress: number;
      pending_approval: number;
      resolved: number;
      closed: number;
      reopened: number;
    };
    byPriority: {
      urgent: number;
      high: number;
      medium: number;
      low: number;
    };
    bySla: {
      withinSla: number;
      atRisk: number;
      breached: number;
      met: number;
    };
    byCategory: { name: string; count: number }[];
  }> {
    const conditions: SQL[] = [];
    if (filters.departmentId) conditions.push(eq(tickets.departmentId, filters.departmentId));
    if (filters.requesterId) conditions.push(eq(tickets.requesterId, filters.requesterId));
    if (filters.officeCategory) conditions.push(eq(tickets.officeCategory, filters.officeCategory));

    const scopeCondition = buildScopeCondition(filters.scope, { officeCategory: filters.officeCategory, departmentId: filters.departmentId } as any);
    if (scopeCondition) {
      conditions.push(scopeCondition);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const allTickets = await db
      .select({
        status: tickets.status,
        priority: tickets.priority,
        category: tickets.category,
        supportCategory: tickets.supportCategory,
        slaBreached: tickets.slaBreached,
        resolutionDueAt: tickets.resolutionDueAt,
        resolvedAt: tickets.resolvedAt,
        rating: tickets.rating,
      })
      .from(tickets)
      .where(where);

    let total = allTickets.length;
    let open = 0;
    let resolved = 0;
    let withinSla = 0;
    let atRisk = 0;
    let breached = 0;
    let compliantResolved = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    const byStatus = {
      open: 0,
      in_progress: 0,
      pending_approval: 0,
      resolved: 0,
      closed: 0,
      reopened: 0,
    };

    const byPriority = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const categoryCounts: Record<string, number> = {};

    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;

    for (const t of allTickets) {
      if (t.status in byStatus) {
        byStatus[t.status as keyof typeof byStatus]++;
      }
      if (t.priority in byPriority) {
        byPriority[t.priority as keyof typeof byPriority]++;
      }

      const catName = t.supportCategory || t.category || 'General';
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;

      if (t.rating && t.rating > 0) {
        ratingSum += t.rating;
        ratingCount++;
      }

      const isClosedOrResolved = t.status === 'resolved' || t.status === 'closed';
      if (isClosedOrResolved) {
        resolved++;
        const isBreached =
          t.slaBreached ||
          (t.resolvedAt && t.resolutionDueAt && new Date(t.resolvedAt).getTime() > new Date(t.resolutionDueAt).getTime());
        if (isBreached) {
          breached++;
        } else {
          compliantResolved++;
        }
      } else {
        open++;
        if (!t.resolutionDueAt) {
          withinSla++;
        } else {
          const dueTime = new Date(t.resolutionDueAt).getTime();
          if (t.slaBreached || now > dueTime) {
            breached++;
          } else if (dueTime - now <= twoHoursMs) {
            atRisk++;
          } else {
            withinSla++;
          }
        }
      }
    }

    const totalEvaluated = compliantResolved + (resolved - compliantResolved);
    const complianceRate = totalEvaluated > 0 ? Math.round((compliantResolved / totalEvaluated) * 100) : 100;

    const byCategory = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      total,
      open,
      resolved,
      withinSla,
      atRisk,
      breached,
      complianceRate,
      averageRating: ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : 5.0,
      ratingCount,
      byStatus,
      byPriority,
      bySla: {
        withinSla,
        atRisk,
        breached,
        met: compliantResolved,
      },
      byCategory,
    };
  },
};
