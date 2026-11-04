import type { AuthUser } from '../../../shared/types';
import { AppError } from '../../../shared/utils/app-error';
import { roleRepository } from '../../roles/repositories/role.repository';
import { roleService } from '../../roles/services/role.service';
import { slaService } from '../../sla/services/sla.service';
import { userRepository } from '../../users/repositories/user.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { notificationService } from '../../notifications/services/notification.service';
import type {
  AddCommentInput,
  AssignTicketInput,
  CreateTicketInput,
  ListTicketsQuery as ListTicketsInput,
  UpdateTicketStatusInput,
} from '../schemas/ticket.schema';
import type { ListTicketsQuery, TicketCommentWithUser, TicketHistoryEvent, TicketWithDetails } from '../types/ticket.types';

function attachSlaInfo(ticket: TicketWithDetails): TicketWithDetails {
  return {
    ...ticket,
    slaStatus: slaService.computeSlaStatus(ticket),
    slaRemainingMinutes: slaService.computeRemainingMinutes(ticket.resolutionDueAt),
  };
}

async function resolveActorDetails(actor: AuthUser): Promise<{
  actorName: string;
  actorRole: string;
  actorRoleSlug: string;
}> {
  const user = await userRepository.findById(actor.id);
  let actorName = user?.name || 'Support Staff';
  let actorRole =
    actor.role === 'admin'
      ? 'Super Admin'
      : actor.role === 'agent'
      ? 'Support Agent'
      : actor.role === 'manager'
      ? 'Department Manager'
      : 'Standard User';
  let actorRoleSlug: string = actor.role;

  if (user?.roleId) {
    const role = await roleRepository.findById(user.roleId);
    if (role?.name) actorRole = role.name;
    if (role?.slug) actorRoleSlug = role.slug;
  }

  return { actorName, actorRole, actorRoleSlug };
}

async function resolveActorScope(actor: AuthUser): Promise<{
  canReadAll: boolean;
  isManager: boolean;
  isAgent: boolean;
  officeCategory?: string;
  departmentId?: string;
}> {
  const permissions = await roleService.getUserPermissions(actor.id, actor.role);
  const canReadAll = actor.role === 'admin' || permissions.includes('tickets:read_all');
  if (canReadAll) {
    return { canReadAll: true, isManager: false, isAgent: false };
  }

  const user = await userRepository.findById(actor.id);
  let isManager = actor.role === 'manager' || user?.role === 'manager';
  let isAgent = actor.role === 'agent' || user?.role === 'agent';
  if (user?.roleId) {
    const role = await roleRepository.findById(user.roleId);
    if (!isManager && (role?.slug === 'manager' || role?.name?.toLowerCase().includes('manager'))) {
      isManager = true;
    }
    if (!isAgent && (role?.slug === 'agent' || role?.name?.toLowerCase().includes('agent'))) {
      isAgent = true;
    }
  }

  return {
    canReadAll: false,
    isManager,
    isAgent,
    officeCategory: user?.officeCategory ?? undefined,
    departmentId: user?.departmentId ?? undefined,
  };
}

export const ticketService = {
  async list(query: ListTicketsInput, actor: AuthUser) {
    const { canReadAll, isManager, isAgent, officeCategory, departmentId } = await resolveActorScope(actor);

    const effectiveQuery: ListTicketsQuery = {
      ...query,
      scope: {
        userId: actor.id,
        canReadAll,
        isManager,
        isAgent,
        officeCategory,
        departmentId,
      },
    };

    const { items, total } = await ticketRepository.list(effectiveQuery);
    return {
      items: items.map(attachSlaInfo),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  },

  async getStats(actor: AuthUser) {
    const { canReadAll, isManager, officeCategory, departmentId } = await resolveActorScope(actor);

    return ticketRepository.getStats({
      scope: {
        userId: actor.id,
        canReadAll,
        isManager,
        officeCategory,
        departmentId,
      },
    });
  },

  async getById(id: string, actor: AuthUser): Promise<TicketWithDetails> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');

    const { canReadAll, isManager, isAgent, officeCategory, departmentId } = await resolveActorScope(actor);

    if (!canReadAll) {
      const isRequester = ticket.requesterId === actor.id;
      const isAssigned = ticket.assignedToId === actor.id;
      const isManagerMatch = isManager && (
        (officeCategory && departmentId && ticket.officeCategory === officeCategory && ticket.departmentId === departmentId) ||
        (!officeCategory && departmentId && ticket.departmentId === departmentId) ||
        (officeCategory && !departmentId && ticket.officeCategory === officeCategory) ||
        (!officeCategory && !departmentId)
      );

      if (!isRequester && !isAssigned && !isManagerMatch) {
        throw AppError.forbidden('You can only view your own tickets, tickets assigned to you, or tickets within your department/office');
      }
    }



    return attachSlaInfo(ticket);
  },

  async create(input: CreateTicketInput, actor: AuthUser): Promise<TicketWithDetails> {
    const priority = input.priority ?? 'medium';
    const deadlines = await slaService.calculateDeadlines(priority);
    const user = await userRepository.findById(actor.id);

    const ticket = await ticketRepository.create({
      ...input,
      officeCategory: input.officeCategory || user?.officeCategory || undefined,
      departmentId: input.departmentId || user?.departmentId || undefined,
      requesterId: actor.id,
      firstResponseDueAt: deadlines.firstResponseDueAt,
      resolutionDueAt: deadlines.resolutionDueAt,
      attachments: input.attachments,
    });

    const { actorName, actorRole, actorRoleSlug } = await resolveActorDetails(actor);

    await ticketRepository.recordActivity({
      ticketId: ticket.id,
      actorId: actor.id,
      type: 'created',
      title: 'Ticket Created',
      description: `Ticket #${ticket.ticketNumber} was created by ${user?.name || actorName}.`,
      status: 'open',
      actorName: user?.name || actorName,
      actorRole: user?.role === 'admin' ? 'Super Admin' : user?.role === 'agent' ? 'Support Agent' : 'Standard User',
      actorRoleSlug: user?.role || actorRoleSlug || 'user',
      details: {
        ticketNumber: ticket.ticketNumber,
        category: ticket.category,
        officeCategory: ticket.officeCategory,
        department: ticket.department?.name,
        priority: ticket.priority,
        firstResponseDueAt: ticket.firstResponseDueAt,
        resolutionDueAt: ticket.resolutionDueAt,
      },
      createdAt: ticket.createdAt,
    });

    try {
      // 1. Notify the requester that their ticket was registered
      const targetRequesterId = ticket.requesterId || actor.id;
      await notificationService.create({
        userId: targetRequesterId,
        title: 'Ticket Raised Successfully',
        message: `Your ticket #${ticket.ticketNumber} has been registered.`,
        type: 'ticket_created',
        link: '/tickets',
      });

      // 2. If an agent is assigned on creation, notify ONLY that assigned agent
      if (ticket.assignedToId && ticket.assignedToId !== actor.id) {
        await notificationService.create({
          userId: ticket.assignedToId,
          title: 'New Ticket Assigned',
          message: `You have been assigned ticket #${ticket.ticketNumber} (${ticket.title}).`,
          type: 'ticket_assigned',
          link: '/tickets',
        });
      }
    } catch (e) {
      console.error('Failed to send notification on ticket create:', e);
    }

    return attachSlaInfo(ticket);
  },

  async updateStatus(id: string, input: UpdateTicketStatusInput, actor: AuthUser): Promise<TicketWithDetails> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');

    const isRequester = ticket.requesterId === actor.id;
    const isAssigned = ticket.assignedToId === actor.id;
    const isAdmin = actor.role === 'admin';
    const permissions = await roleService.getUserPermissions(actor.id, actor.role);
    const hasStatusPerm = permissions.includes('tickets:update_status') || permissions.includes('tickets:edit');
    const isRequesterAllowed = isRequester && (input.status === 'closed' || input.status === 'reopened');

    if (!isAdmin && !isAssigned && !hasStatusPerm && !isRequesterAllowed) {
      throw AppError.forbidden('Only administrators, assigned support agents, or the ticket requester can close or reopen this ticket');
    }

    const updateData: {
      status: typeof input.status;
      resolutionNotes?: string;
      resolvedAt?: Date | null;
      closedAt?: Date | null;
      slaBreached?: boolean;
      slaBreachedAt?: Date | null;
    } = {
      status: input.status,
      resolutionNotes: input.resolutionNotes,
    };

    if (input.status === 'resolved') {
      const now = new Date();
      updateData.resolvedAt = now;
      if (ticket.resolutionDueAt && now.getTime() > new Date(ticket.resolutionDueAt).getTime()) {
        updateData.slaBreached = true;
        updateData.slaBreachedAt = ticket.resolutionDueAt;
      }
    } else if (input.status === 'closed') {
      updateData.closedAt = new Date();
    } else if (input.status === 'reopened' || input.status === 'in_progress') {
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    const updated = await ticketRepository.update(id, updateData);
    if (!updated) throw AppError.notFound('Ticket not found');

    const { actorName, actorRole, actorRoleSlug } = await resolveActorDetails(actor);

    if (input.status === 'resolved') {
      await ticketRepository.recordActivity({
        ticketId: id,
        actorId: actor.id,
        type: 'resolved',
        title: 'Ticket Resolved',
        description: input.resolutionNotes
          ? `Issue resolved by ${actorName}: "${input.resolutionNotes}"`
          : `Ticket marked as resolved by ${actorName}.`,
        status: 'resolved',
        actorName,
        actorRole,
        actorRoleSlug,
        details: {
          resolutionNotes: input.resolutionNotes,
          resolvedAt: updateData.resolvedAt,
        },
      });
    } else if (input.status === 'closed') {
      await ticketRepository.recordActivity({
        ticketId: id,
        actorId: actor.id,
        type: 'closed',
        title: 'Ticket Closed',
        description: `Ticket resolution verified and closed by ${actorName}.`,
        status: 'closed',
        actorName,
        actorRole,
        actorRoleSlug,
        details: {
          closedAt: updateData.closedAt,
        },
      });
    } else if (input.status === 'reopened') {
      await ticketRepository.recordActivity({
        ticketId: id,
        actorId: actor.id,
        type: 'reopened',
        title: 'Ticket Reopened',
        description: `Ticket was reopened by ${actorName}.`,
        status: 'reopened',
        actorName,
        actorRole,
        actorRoleSlug,
        details: {},
      });
    } else {
      const formattedStatus = input.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      await ticketRepository.recordActivity({
        ticketId: id,
        actorId: actor.id,
        type: 'in_progress',
        title: `Status Updated: ${formattedStatus}`,
        description: `${actorName} updated ticket status to ${formattedStatus}.`,
        status: input.status,
        actorName,
        actorRole,
        actorRoleSlug,
        details: {},
      });
    }

        try {
      if (input.status === 'resolved') {
        if (ticket.requesterId && ticket.requesterId !== actor.id) {
          await notificationService.create({
            userId: ticket.requesterId,
            title: 'Ticket Resolved',
            message: `Ticket #${ticket.ticketNumber} has been resolved by ${actorName}.`,
            type: 'ticket_resolved',
            link: '/tickets',
          });
        }
      } else if (input.status === 'closed') {
        const targetUserId = actor.id === ticket.requesterId ? ticket.assignedToId : ticket.requesterId;
        if (targetUserId && targetUserId !== actor.id) {
          await notificationService.create({
            userId: targetUserId,
            title: 'Ticket Closed',
            message: `Ticket #${ticket.ticketNumber} has been closed by ${actorName}.`,
            type: 'ticket_closed',
            link: '/tickets',
          });
        }
      } else if (input.status === 'in_progress') {
        if (ticket.requesterId && ticket.requesterId !== actor.id) {
          await notificationService.create({
            userId: ticket.requesterId,
            title: 'Ticket In Progress',
            message: `Work on ticket #${ticket.ticketNumber} has been initiated by ${actorName}.`,
            type: 'ticket_updated',
            link: '/tickets',
          });
        }
      } else if (input.status === 'reopened') {
        const targetUserId = actor.id === ticket.requesterId ? ticket.assignedToId : ticket.requesterId;
        if (targetUserId && targetUserId !== actor.id) {
          await notificationService.create({
            userId: targetUserId,
            title: 'Ticket Reopened',
            message: `Ticket #${ticket.ticketNumber} has been reopened by ${actorName}.`,
            type: 'ticket_updated',
            link: '/tickets',
          });
        }
      }
    } catch (e) {
      console.error('Failed to send notification on status update:', e);
    }

    return attachSlaInfo(updated);
  },

  async assign(id: string, input: AssignTicketInput, actor: AuthUser): Promise<TicketWithDetails> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');

    const isSelfClaim =
      input.assignedToId === actor.id ||
      (input.assignedToId === null && ticket.assignedToId === actor.id);

    if (actor.role !== 'admin' && !isSelfClaim) {
      throw AppError.forbidden('Only administrators can assign tickets to other support agents');
    }

    let assignee: any = null;
    if (input.assignedToId) {
      assignee = await userRepository.findById(input.assignedToId);
      if (!assignee) throw AppError.notFound('Assignee user not found');
    }

    const updatePayload: {
      assignedToId: string | null;
      status?: 'in_progress';
      firstRespondedAt?: Date;
    } = {
      assignedToId: input.assignedToId,
      status: ticket.status === 'open' && input.assignedToId ? 'in_progress' : undefined,
    };

    if (!ticket.firstRespondedAt && input.assignedToId) {
      updatePayload.firstRespondedAt = new Date();
    }

    const updated = await ticketRepository.update(id, updatePayload);
    if (!updated) throw AppError.notFound('Ticket not found');

    const { actorName, actorRole, actorRoleSlug } = await resolveActorDetails(actor);

    if (input.assignedToId && assignee) {
      if (input.assignedToId === actor.id) {
        // Self-claim: Support agent claimed this ticket
        await ticketRepository.recordActivity({
          ticketId: id,
          actorId: actor.id,
          type: 'assigned',
          title: 'Ticket Claimed',
          description: `${actorName} claimed this ticket. Status updated to In Progress.`,
          status: 'in_progress',
          actorName,
          actorRole,
          actorRoleSlug,
          details: {
            assignedAgent: actorName,
            assignedTo: actorName,
            assignedToEmail: assignee.email,
          },
        });
      } else {
        // Administrator or supervisor assigned ticket to support agent
        await ticketRepository.recordActivity({
          ticketId: id,
          actorId: actor.id,
          type: 'assigned',
          title: 'Assigned to Support Agent',
          description: `${actorName} assigned ticket to ${assignee.name}. Status updated to In Progress.`,
          status: 'in_progress',
          actorName,
          actorRole,
          actorRoleSlug,
          details: {
            assignedAgent: assignee.name,
            assignedTo: assignee.name,
            assignedToEmail: assignee.email,
          },
        });
      }
    } else {
      // Unassigned
      await ticketRepository.recordActivity({
        ticketId: id,
        actorId: actor.id,
        type: 'assigned',
        title: 'Ticket Unassigned',
        description: `${actorName} unassigned this ticket.`,
        status: ticket.status,
        actorName,
        actorRole,
        actorRoleSlug,
        details: {},
      });
    }

        try {
      if (input.assignedToId && assignee) {
        if (input.assignedToId === actor.id) {
          // Self-claim: notify requester ONLY (if requester is not the actor)
          if (ticket.requesterId && ticket.requesterId !== actor.id) {
            await notificationService.create({
              userId: ticket.requesterId,
              title: 'Support Agent Assigned',
              message: `${actorName} claimed your ticket #${ticket.ticketNumber} and is currently resolving it.`,
              type: 'ticket_assigned',
              link: '/tickets',
            });
          }
        } else {
          // Direct assignment: notify the assigned agent & ticket requester ONLY
          if (assignee.id !== actor.id) {
            await notificationService.create({
              userId: assignee.id,
              title: 'New Ticket Assigned',
              message: `You have been assigned ticket #${ticket.ticketNumber} (${ticket.title}).`,
              type: 'ticket_assigned',
              link: '/tickets',
            });
          }
          if (ticket.requesterId && ticket.requesterId !== actor.id && ticket.requesterId !== assignee.id) {
            await notificationService.create({
              userId: ticket.requesterId,
              title: 'Support Agent Assigned',
              message: `Ticket #${ticket.ticketNumber} has been assigned to ${assignee.name}.`,
              type: 'ticket_assigned',
              link: '/tickets',
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to send notification on assign:', e);
    }

    return attachSlaInfo(updated);
  },

  async addComment(ticketId: string, input: AddCommentInput, actor: AuthUser): Promise<TicketCommentWithUser> {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw AppError.notFound('Ticket not found');

    const isRequester = ticket.requesterId === actor.id || (ticket as any).createdById === actor.id;
    const isSolver = ticket.assignedToId === actor.id;
    const isAdmin = actor.role === 'admin';

    if (!isAdmin && !isRequester && !isSolver) {
      throw AppError.forbidden('Only the ticket requester, assigned support agent, and administrators can participate in this discussion');
    }

    const permissions = await roleService.getUserPermissions(actor.id, actor.role);
    const isStaff = actor.role === 'admin' || permissions.includes('tickets:internal_notes');

    if (input.isInternal && !isStaff) {
      throw AppError.forbidden('Only support staff and administrators can post internal notes');
    }

    // If staff/admin adds a comment and firstRespondedAt is not yet set, record it
    if (isStaff && !ticket.firstRespondedAt) {
      await ticketRepository.update(ticketId, { firstRespondedAt: new Date() });
    }

        try {
      const targetUserId = actor.id === ticket.requesterId ? ticket.assignedToId : ticket.requesterId;
      if (targetUserId && !input.isInternal) {
        await notificationService.create({
          userId: targetUserId,
          title: 'New Discussion Update',
          message: `${actor.role === 'agent' ? 'Support Agent' : 'User'} added a note to ticket #${ticket.ticketNumber}.`,
          type: 'comment_added',
          link: '/tickets',
        });
      }
    } catch (e) {
      console.error('Failed to send notification on comment:', e);
    }

    return ticketRepository.addComment(ticketId, actor.id, input.comment, input.isInternal, input.attachments);
  },

  async listComments(ticketId: string, actor: AuthUser): Promise<TicketCommentWithUser[]> {
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw AppError.notFound('Ticket not found');

    const isRequester = ticket.requesterId === actor.id || (ticket as any).createdById === actor.id;
    const isSolver = ticket.assignedToId === actor.id;
    const isAdmin = actor.role === 'admin';

    if (!isAdmin && !isRequester && !isSolver) {
      return [];
    }

    const permissions = await roleService.getUserPermissions(actor.id, actor.role);
    const isStaff = actor.role === 'admin' || permissions.includes('tickets:internal_notes');

    return ticketRepository.listComments(ticketId, isStaff);
  },
  async rate(id: string, input: { rating: number; feedback?: string }, actor: AuthUser): Promise<TicketWithDetails> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');

    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      throw AppError.badRequest('You can only rate tickets that have been resolved or closed');
    }

    if (actor.role !== 'admin' && ticket.requesterId !== actor.id) {
      throw AppError.forbidden('Only the ticket requester can submit a satisfaction rating');
    }

    const { actorName } = await resolveActorDetails(actor);

    const updated = await ticketRepository.rateTicket(id, input.rating, input.feedback);
    if (!updated) throw AppError.notFound('Ticket not found');

    await ticketRepository.recordActivity({
      ticketId: id,
      actorId: actor.id,
      type: 'resolved',
      title: 'Customer Satisfaction Rated',
      description: `${actorName} rated the resolution ${input.rating}/5 stars${input.feedback ? `: "${input.feedback}"` : ''}.`,
      status: ticket.status,
      actorName,
      actorRole: 'Standard User',
      actorRoleSlug: 'user',
      details: {
        rating: input.rating,
        ratingFeedback: input.feedback,
      },
    });

    if (ticket.assignedToId) {
      try {
        await notificationService.create({
          userId: ticket.assignedToId,
          title: 'New Customer Feedback',
          message: `${actorName} rated ticket #${ticket.ticketNumber} ${input.rating}/5 stars.`,
          type: 'ticket_resolved',
          link: '/tickets',
        });
      } catch (e) {
        console.error('Failed to notify agent of rating:', e);
      }
    }

    return attachSlaInfo(updated);
  },

  async getHistory(id: string, actor: AuthUser): Promise<TicketHistoryEvent[]> {
    const ticket = await this.getById(id, actor);
    if (!ticket) throw AppError.notFound('Ticket not found');

    const events: TicketHistoryEvent[] = [];

    // 1. Fetch persistent recorded activities
    const activities = await ticketRepository.listActivities(id);

    if (activities.length > 0) {
      for (const act of activities) {
        events.push({
          id: act.id,
          type: act.type as TicketHistoryEvent['type'],
          title: act.title,
          description: act.description,
          timestamp: act.createdAt,
          status: (act.status as any) || null,
          actorName: act.actorName || null,
          actorRole: act.actorRole || null,
          actorRoleSlug: act.actorRoleSlug || null,
          details: (act.details as Record<string, any>) || undefined,
        });
      }
    } else {
      // Fallback for legacy tickets without activities table entries
      // 1. Ticket Created Event
      events.push({
        id: `created-${ticket.id}`,
        type: 'created',
        title: 'Ticket Created',
        description: `Ticket #${ticket.ticketNumber} was created by ${ticket.requester?.name || ticket.ticketRaisedBy || 'Requester'}`,
        timestamp: ticket.createdAt,
        status: 'open',
        actorName: ticket.requester?.name || ticket.ticketRaisedBy || 'Requester',
        actorRole: 'Standard User',
        actorRoleSlug: 'user',
        details: {
          ticketNumber: ticket.ticketNumber,
          category: ticket.category,
          officeCategory: ticket.officeCategory,
          department: ticket.department?.name,
          priority: ticket.priority,
          firstResponseDueAt: ticket.firstResponseDueAt,
          resolutionDueAt: ticket.resolutionDueAt,
        },
      });

      // 2. Assignment & In-Progress Event
      if (ticket.assignedToId && ticket.assignedTo) {
        const assignmentTime = ticket.firstRespondedAt || ticket.updatedAt;
        const isSelf = ticket.assignedToId === ticket.requesterId || ticket.assignedTo.role === 'agent';
        events.push({
          id: `assigned-${ticket.id}`,
          type: 'assigned',
          title: isSelf ? 'Ticket Claimed' : 'Assigned to Support Agent',
          description: isSelf
            ? `${ticket.assignedTo.name} claimed this ticket. Status updated to In Progress.`
            : `Administrator assigned ticket to ${ticket.assignedTo.name}. Status updated to In Progress.`,
          timestamp: assignmentTime,
          status: 'in_progress',
          actorName: ticket.assignedTo.name,
          actorRole: 'Support Agent',
          actorRoleSlug: 'agent',
          details: {
            assignedAgent: ticket.assignedTo.name,
            assignedTo: ticket.assignedTo.name,
            assignedToEmail: ticket.assignedTo.email,
            firstRespondedAt: ticket.firstRespondedAt,
          },
        });
      }

      // 3. Resolution Event
      if (ticket.resolvedAt || ticket.status === 'resolved' || ticket.status === 'closed') {
        events.push({
          id: `resolved-${ticket.id}`,
          type: 'resolved',
          title: 'Ticket Resolved',
          description: ticket.resolutionNotes
            ? `Issue resolved: "${ticket.resolutionNotes}"`
            : `Ticket marked as resolved by ${ticket.assignedTo?.name || 'Support Agent'}.`,
          timestamp: ticket.resolvedAt || ticket.updatedAt,
          status: 'resolved',
          actorName: ticket.assignedTo?.name || 'Support Agent',
          actorRole: 'Support Agent',
          actorRoleSlug: 'agent',
          details: {
            resolutionNotes: ticket.resolutionNotes,
            resolvedAt: ticket.resolvedAt,
          },
        });
      }

      // 4. Closure Event
      if (ticket.closedAt || ticket.status === 'closed') {
        events.push({
          id: `closed-${ticket.id}`,
          type: 'closed',
          title: 'Ticket Closed',
          description: 'Ticket resolution verified and closed.',
          timestamp: ticket.closedAt || ticket.updatedAt,
          status: 'closed',
          actorName: 'Requester / Administrator',
          actorRole: 'User / Admin',
          actorRoleSlug: 'admin',
          details: {
            closedAt: ticket.closedAt,
          },
        });
      }
    }

    // Discussion Comments (Audit trail)
    try {
      const comments = await this.listComments(id, actor);
      for (const c of comments) {
        const author = c.author || c.user;
        events.push({
          id: `comment-${c.id}`,
          type: 'comment',
          title: c.isInternal ? 'Internal Discussion Note' : 'Discussion Note',
          description: c.comment,
          timestamp: c.createdAt,
          status: null,
          actorName: author?.name || 'User',
          actorRole: author?.roleName || (author?.role === 'admin' ? 'Super Admin' : author?.role === 'agent' ? 'Support Agent' : 'User'),
          actorRoleSlug: author?.roleSlug || author?.role,
          details: c.attachments && c.attachments.length > 0 ? { attachments: c.attachments } : undefined,
        });
      }
    } catch {
      // If unauthorized to view comments, skip discussion events
    }

    // SLA Breach Event (if breached)
    if (ticket.slaBreached && ticket.slaBreachedAt) {
      events.push({
        id: `breach-${ticket.id}`,
        type: 'sla_breached',
        title: 'Resolution SLA Breached',
        description: 'Ticket exceeded the target resolution deadline.',
        timestamp: ticket.slaBreachedAt,
        status: null,
        actorName: 'SLA Monitoring Engine',
        actorRole: 'System',
        actorRoleSlug: 'system',
      });
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },
};
