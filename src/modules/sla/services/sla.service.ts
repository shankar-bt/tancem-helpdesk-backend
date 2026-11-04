import { eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { slaPolicies } from '../../../shared/db/schema';
import { AppError } from '../../../shared/utils/app-error';
import type { TicketPriority } from '../../tickets/types/ticket.types';
import type { SlaDeadlines, SlaPolicy, SlaStatus, UpdateSlaPolicyInput } from '../types/sla.types';

const DEFAULT_SLA_MINUTES: Record<TicketPriority, { response: number; resolution: number }> = {
  urgent: { response: 30, resolution: 240 }, // 30m response, 4h resolution
  high: { response: 120, resolution: 480 }, // 2h response, 8h resolution
  medium: { response: 240, resolution: 1440 }, // 4h response, 24h resolution
  low: { response: 480, resolution: 2880 }, // 8h response, 48h resolution
};

export const slaService = {
  async listPolicies(): Promise<SlaPolicy[]> {
    return db.select().from(slaPolicies).orderBy(slaPolicies.priority);
  },

  async getPolicyByPriority(priority: TicketPriority): Promise<{ responseTimeMinutes: number; resolutionTimeMinutes: number }> {
    try {
      const [policy] = await db
        .select()
        .from(slaPolicies)
        .where(eq(slaPolicies.priority, priority))
        .limit(1);

      if (policy && policy.isActive) {
        return {
          responseTimeMinutes: policy.responseTimeMinutes,
          resolutionTimeMinutes: policy.resolutionTimeMinutes,
        };
      }
    } catch (e) {
      // Fallback if query fails
    }

    return {
      responseTimeMinutes: DEFAULT_SLA_MINUTES[priority]?.response ?? 240,
      resolutionTimeMinutes: DEFAULT_SLA_MINUTES[priority]?.resolution ?? 1440,
    };
  },

  async updatePolicy(id: string, input: UpdateSlaPolicyInput): Promise<SlaPolicy> {
    const [existing] = await db.select().from(slaPolicies).where(eq(slaPolicies.id, id)).limit(1);
    if (!existing) throw AppError.notFound('SLA policy not found');

    const [updated] = await db
      .update(slaPolicies)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(slaPolicies.id, id))
      .returning();

    return updated;
  },

  async calculateDeadlines(priority: TicketPriority, startTime: Date = new Date()): Promise<SlaDeadlines> {
    const { responseTimeMinutes, resolutionTimeMinutes } = await this.getPolicyByPriority(priority);

    const firstResponseDueAt = new Date(startTime.getTime() + responseTimeMinutes * 60 * 1000);
    const resolutionDueAt = new Date(startTime.getTime() + resolutionTimeMinutes * 60 * 1000);

    return {
      firstResponseDueAt,
      resolutionDueAt,
    };
  },

  computeSlaStatus(ticket: {
    status: string;
    resolutionDueAt: Date | string | null;
    slaBreached: boolean;
    resolvedAt?: Date | string | null;
  }): SlaStatus {
    const isClosedOrResolved = ticket.status === 'resolved' || ticket.status === 'closed';

    if (isClosedOrResolved) {
      if (ticket.slaBreached) return 'breached';
      if (ticket.resolvedAt && ticket.resolutionDueAt) {
        const resolvedTime = new Date(ticket.resolvedAt).getTime();
        const dueTime = new Date(ticket.resolutionDueAt).getTime();
        if (resolvedTime > dueTime) return 'breached';
      }
      return 'met';
    }

    if (!ticket.resolutionDueAt) return 'within_sla';

    const now = Date.now();
    const dueTime = new Date(ticket.resolutionDueAt).getTime();

    if (ticket.slaBreached || now > dueTime) {
      return 'breached';
    }

    // At risk if less than 2 hours or within 25% of deadline
    const diffMs = dueTime - now;
    if (diffMs <= 2 * 60 * 60 * 1000) {
      return 'at_risk';
    }

    return 'within_sla';
  },

  computeRemainingMinutes(resolutionDueAt: Date | string | null): number | null {
    if (!resolutionDueAt) return null;
    const now = Date.now();
    const dueTime = new Date(resolutionDueAt).getTime();
    return Math.round((dueTime - now) / (60 * 1000));
  },
};
