import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '../../config/database';
import { tickets, users } from '../../shared/db/schema';
import type { ChatActor, ChatMessageResponse, ChatQuickAction, ChatTicketSummary } from './chatbot.types';

export const chatbotService = {
  async processMessage(userMessage: string, actor: ChatActor): Promise<ChatMessageResponse> {
    const rawMsg = (userMessage || '').trim();
    const msg = rawMsg.toLowerCase();

    const role = (actor.role || 'user') as 'user' | 'agent' | 'admin' | 'manager';
    const isStaff = role === 'agent' || role === 'admin' || role === 'manager';

    // 1. Check for specific ticket number (e.g. TKT-20261028-0001 or #TKT-...)
    const ticketMatch = rawMsg.match(/TKT-[A-Za-z0-9-]+/i);
    if (ticketMatch) {
      const ticketNum = ticketMatch[0].toUpperCase();
      const [found] = await db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          title: tickets.title,
          description: tickets.description,
          status: tickets.status,
          priority: tickets.priority,
          category: tickets.category,
          supportCategory: tickets.supportCategory,
          requesterId: tickets.requesterId,
          assignedToId: tickets.assignedToId,
          resolutionNotes: tickets.resolutionNotes,
          createdAt: tickets.createdAt,
          resolutionDueAt: tickets.resolutionDueAt,
          slaBreached: tickets.slaBreached,
          rating: tickets.rating,
        })
        .from(tickets)
        .where(eq(tickets.ticketNumber, ticketNum))
        .limit(1);

      if (!found) {
        return {
          reply: `I searched for ticket **#${ticketNum}**, but no matching ticket was found in the database. Please verify the ticket number.`,
          role,
          intent: 'ticket_lookup',
          quickActions: isStaff
            ? [{ label: 'View All Tickets', query: 'show all tickets', link: '/tickets' }]
            : [{ label: 'My Tickets', query: 'my tickets', link: '/tickets' }],
        };
      }

      // Role permission check
      if (!isStaff && found.requesterId !== actor.id) {
        return {
          reply: `Ticket **#${ticketNum}** is registered in the system, but it belongs to another user. You can only view details of tickets you have raised.`,
          role,
          intent: 'ticket_lookup',
          quickActions: [{ label: 'Show My Tickets', query: 'my tickets' }],
        };
      }

      // Fetch assignee name if present
      let assigneeName = 'Unassigned';
      if (found.assignedToId) {
        const [assignee] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, found.assignedToId))
          .limit(1);
        if (assignee) assigneeName = assignee.name;
      }

      const statusFmt = found.status.replace(/_/g, ' ').toUpperCase();
      const isOverdue = found.slaBreached || (found.resolutionDueAt && new Date(found.resolutionDueAt).getTime() < Date.now() && found.status !== 'resolved' && found.status !== 'closed');

      let reply = `**Ticket Details for #${found.ticketNumber}**\n\n` +
        `• **Title:** ${found.title || 'Support Request'}\n` +
        `• **Status:** ${statusFmt}\n` +
        `• **Priority:** ${found.priority.toUpperCase()}\n` +
        `• **Category:** ${found.supportCategory || found.category || 'General'}\n` +
        `• **Assigned Agent:** ${assigneeName}\n` +
        `• **SLA Condition:** ${isOverdue ? '⚠️ Overdue / At Risk' : '✅ Within SLA'}\n`;

      if (found.resolutionNotes) {
        reply += `• **Resolution Notes:** ${found.resolutionNotes}\n`;
      }
      if (found.rating) {
        reply += `• **Customer CSAT:** ⭐ ${found.rating} / 5 Stars\n`;
      }

      return {
        reply,
        role,
        intent: 'ticket_lookup',
        tickets: [
          {
            id: found.id,
            ticketNumber: found.ticketNumber,
            title: found.title,
            status: found.status,
            priority: found.priority,
            category: found.supportCategory || found.category,
            assignedToName: assigneeName,
            createdAt: found.createdAt ? new Date(found.createdAt).toISOString() : '',
            resolutionDueAt: found.resolutionDueAt ? new Date(found.resolutionDueAt).toISOString() : null,
          },
        ],
        quickActions: [
          { label: 'Open in Ticket Viewer', query: '', link: '/tickets' },
          { label: 'Check Other Tickets', query: isStaff ? 'assigned to me' : 'my tickets' },
        ],
      };
    }

    // 2. Check for "My Tickets" / "Raised by me"
    if (
      msg.includes('my ticket') ||
      msg.includes('raised by me') ||
      msg.includes('created by me') ||
      msg.includes('my requests') ||
      msg.includes('my open') ||
      (msg.includes('status') && !isStaff)
    ) {
      const myTickets = await db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
          category: tickets.supportCategory,
          createdAt: tickets.createdAt,
          resolutionDueAt: tickets.resolutionDueAt,
        })
        .from(tickets)
        .where(eq(tickets.requesterId, actor.id))
        .orderBy(desc(tickets.createdAt))
        .limit(6);

      if (myTickets.length === 0) {
        return {
          reply: `You haven't raised any support tickets yet. If you have an IT, hardware, or ERP issue, you can raise a ticket right now.`,
          role,
          intent: 'my_tickets',
          quickActions: [
            { label: 'Raise a Ticket Now', query: '', link: '/tickets/create' },
            { label: 'Common IT Help Guides', query: 'help guides' },
          ],
        };
      }

      const activeCount = myTickets.filter((t: any) => t.status !== 'resolved' && t.status !== 'closed').length;
      return {
        reply: `You have **${myTickets.length} recent ticket(s)** (${activeCount} currently active/in progress). Here are your latest tickets:`,
        role,
        intent: 'my_tickets',
        tickets: myTickets.map((t: any) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : '',
          resolutionDueAt: t.resolutionDueAt ? new Date(t.resolutionDueAt).toISOString() : null,
        })),
        quickActions: [
          { label: 'Raise New Ticket', query: '', link: '/tickets/create' },
          { label: 'View Full Table', query: '', link: '/tickets' },
        ],
      };
    }

    // 3. Check for "Assigned to Me" (Staff only)
    if (
      msg.includes('assigned to me') ||
      msg.includes('my workload') ||
      msg.includes('my assigned') ||
      msg.includes('tickets to solve') ||
      (isStaff && msg.includes('my active'))
    ) {
      if (!isStaff) {
        return {
          reply: `You are logged in as an Employee / Requester. Tickets are assigned to Support Agents. To see the tickets you raised, ask for **"My Tickets"**.`,
          role,
          intent: 'role_restriction',
          quickActions: [{ label: 'Show My Tickets', query: 'my tickets' }],
        };
      }

      const assigned = await db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
          category: tickets.supportCategory,
          createdAt: tickets.createdAt,
          resolutionDueAt: tickets.resolutionDueAt,
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.assignedToId, actor.id),
            or(eq(tickets.status, 'open'), eq(tickets.status, 'in_progress'), eq(tickets.status, 'pending_approval'))
          )
        )
        .orderBy(desc(tickets.createdAt))
        .limit(6);

      if (assigned.length === 0) {
        return {
          reply: `Great news! You currently have **0 active tickets assigned to you**. Check the unassigned queue to claim new incoming tickets.`,
          role,
          intent: 'assigned_tickets',
          quickActions: [
            { label: 'View Unassigned Queue', query: 'unassigned tickets' },
            { label: 'Check SLA At-Risk', query: 'sla status' },
          ],
        };
      }

      return {
        reply: `You have **${assigned.length} active ticket(s)** currently assigned to you for resolution:`,
        role,
        intent: 'assigned_tickets',
        tickets: assigned.map((t: any) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : '',
          resolutionDueAt: t.resolutionDueAt ? new Date(t.resolutionDueAt).toISOString() : null,
        })),
        quickActions: [
          { label: 'Open in Tickets Page', query: '', link: '/tickets' },
          { label: 'Check Unassigned Queue', query: 'unassigned tickets' },
        ],
      };
    }

    // 4. Check for "Unassigned Tickets" (Staff only)
    if (
      msg.includes('unassigned') ||
      msg.includes('queue') ||
      msg.includes('waiting') ||
      msg.includes('unclaimed')
    ) {
      if (!isStaff) {
        return {
          reply: `The unassigned ticket queue is accessible to Support Agents and Administrators. If you have an inquiry, you can ask for **"My Tickets"** or **"How to raise a ticket"**.`,
          role,
          intent: 'role_restriction',
          quickActions: [{ label: 'My Tickets', query: 'my tickets' }],
        };
      }

      const unassigned = await db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
          category: tickets.supportCategory,
          createdAt: tickets.createdAt,
          resolutionDueAt: tickets.resolutionDueAt,
        })
        .from(tickets)
        .where(
          and(
            isNull(tickets.assignedToId),
            or(eq(tickets.status, 'open'), eq(tickets.status, 'in_progress'))
          )
        )
        .orderBy(desc(tickets.createdAt))
        .limit(6);

      if (unassigned.length === 0) {
        return {
          reply: `All clear! There are currently **no unassigned tickets** in the queue. All tickets have been picked up.`,
          role,
          intent: 'unassigned_tickets',
          quickActions: [
            { label: 'My Assigned Tickets', query: 'assigned to me' },
            { label: 'SLA Performance', query: 'sla status' },
          ],
        };
      }

      return {
        reply: `There are **${unassigned.length} unassigned ticket(s)** waiting in the queue. You can claim any ticket from the ticket table:`,
        role,
        intent: 'unassigned_tickets',
        tickets: unassigned.map((t: any) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : '',
          resolutionDueAt: t.resolutionDueAt ? new Date(t.resolutionDueAt).toISOString() : null,
        })),
        quickActions: [
          { label: 'Go to Ticket Table (Claim)', query: '', link: '/tickets' },
          { label: 'My Workload', query: 'assigned to me' },
        ],
      };
    }

    // 5. Check for SLA / At-Risk / Breached
    if (
      msg.includes('sla') ||
      msg.includes('at risk') ||
      msg.includes('breach') ||
      msg.includes('deadline') ||
      msg.includes('compliance')
    ) {
      if (!isStaff) {
        // Regular user SLA overview
        return {
          reply: `TANCEM Helpdesk tracks strict Service Level Agreements (SLAs) for every ticket based on priority:
• **Urgent**: 2-hour response, 6-hour resolution
• **High**: 4-hour response, 12-hour resolution
• **Medium**: 8-hour response, 24-hour resolution
• **Low**: 12-hour response, 48-hour resolution

Our IT team prioritizes tickets according to these deadlines.`,
          role,
          intent: 'sla_info',
          quickActions: [{ label: 'Check My Tickets', query: 'my tickets' }],
        };
      }

      // Staff SLA overview
      const allActive = await db
        .select({
          id: tickets.id,
          ticketNumber: tickets.ticketNumber,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
          category: tickets.supportCategory,
          slaBreached: tickets.slaBreached,
          resolutionDueAt: tickets.resolutionDueAt,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .where(or(eq(tickets.status, 'open'), eq(tickets.status, 'in_progress')))
        .limit(50);

      const now = Date.now();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const breached = allActive.filter((t: any) => t.slaBreached || (t.resolutionDueAt && new Date(t.resolutionDueAt).getTime() < now));
      const atRisk = allActive.filter((t: any) => !breached.includes(t) && t.resolutionDueAt && (new Date(t.resolutionDueAt).getTime() - now <= twoHoursMs));

      return {
        reply: `**SLA Status Telemetry:**\n\n` +
          `• **Active Tickets Evaluated:** ${allActive.length}\n` +
          `• **SLA Breached:** ${breached.length} ${breached.length > 0 ? '🚨 Immediate action required' : '✅ None'}\n` +
          `• **At-Risk (&lt; 2h Remaining):** ${atRisk.length} ${atRisk.length > 0 ? '⚠️ Escalation alert' : '✅ Safe'}\n\n` +
          (breached.length > 0 || atRisk.length > 0
            ? `Here are tickets needing immediate priority:`
            : `All active tickets are comfortably within resolution deadlines.`),
        role,
        intent: 'sla_status',
        tickets: [...breached, ...atRisk].slice(0, 5).map((t: any) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : '',
          resolutionDueAt: t.resolutionDueAt ? new Date(t.resolutionDueAt).toISOString() : null,
        })),
        quickActions: [
          { label: 'Filter At-Risk in Table', query: '', link: '/tickets?slaStatus=at_risk' },
          { label: 'View Dashboard Telemetry', query: '', link: '/' },
        ],
      };
    }

    // 6. How to Raise a Ticket
    if (
      msg.includes('how to raise') ||
      msg.includes('create ticket') ||
      msg.includes('new ticket') ||
      msg.includes('how do i') ||
      msg.includes('raise ticket') ||
      msg.includes('submit ticket')
    ) {
      return {
        reply: `**How to Raise a Support Ticket in 3 Easy Steps:**\n\n` +
          `1. Click **"Raise Ticket"** in the top navigation or click the button below.\n` +
          `2. Select your **Category**, **Issue Category**, and your office/plant location.\n` +
          `3. Enter a clear description of the issue and attach any error screenshots or logs.\n\n` +
          `Once submitted, our IT Support Agents receive an automated notification and SLA timers begin immediately.`,
        role,
        intent: 'raise_ticket_guide',
        quickActions: [
          { label: 'Raise a Ticket Now', query: '', link: '/tickets/create' },
          { label: 'Check My Current Tickets', query: 'my tickets' },
        ],
      };
    }

    // 7. IT Common Troubleshooting (Mailbox, Password, Network, Printer)
    if (msg.includes('mailbox') || msg.includes('quota') || msg.includes('outlook') || msg.includes('storage full')) {
      return {
        reply: `**Quick Steps to Resolve "Mailbox Quota Full" in Outlook:**\n\n` +
          `1. **Empty Deleted Items:** Right-click **"Deleted Items"** folder &gt; click **Empty Folder**.\n` +
          `2. **Clean Junk:** Empty your **"Junk Email"** folder.\n` +
          `3. **Sort by Size:** In Inbox, click **Filter &gt; Sort by &gt; Size (Largest on top)** to delete heavy attachments.\n` +
          `4. **Archive:** Use **File &gt; Cleanup Tools &gt; Archive** to store older messages to your local drive.\n\n` +
          `If your quota still does not reset, raise a ticket and IT Support will adjust your server storage tier.`,
        role,
        intent: 'it_troubleshooting',
        quickActions: [
          { label: 'Raise Ticket for Mailbox Quota', query: '', link: '/tickets/create' },
          { label: 'Check Other Guides', query: 'help guides' },
        ],
      };
    }

    if (msg.includes('password') || msg.includes('forgot') || msg.includes('login') || msg.includes('credential')) {
      return {
        reply: `**Password & Account Access Instructions:**\n\n` +
          `• For security reasons, TANCEM system passwords can only be reset through authorized channels.\n` +
          `• If you are locked out of your ERP or Windows account, please raise an **Urgent Password Reset** ticket or contact your Department IT Coordinator.\n` +
          `• Temporary credentials will be securely shared and you will be prompted to set a new password on first login.`,
        role,
        intent: 'it_troubleshooting',
        quickActions: [
          { label: 'Raise Password Reset Ticket', query: '', link: '/tickets/create' },
          { label: 'Check My Tickets', query: 'my tickets' },
        ],
      };
    }

    if (msg.includes('printer') || msg.includes('print') || msg.includes('scanner') || msg.includes('paper jam')) {
      return {
        reply: `**Printer & Scanner Troubleshooting:**\n\n` +
          `1. Check that the printer power light is solid blue/green and network cable (LAN) is firmly connected.\n` +
          `2. Clear any pending document queues in Windows: **Settings &gt; Devices &gt; Printers &gt; Open Queue &gt; Cancel All Documents**.\n` +
          `3. Turn printer power off, wait 10 seconds, and turn back on.\n\n` +
          `If the printer is showing offline across the department, submit a ticket for on-site technician dispatch.`,
        role,
        intent: 'it_troubleshooting',
        quickActions: [
          { label: 'Raise Hardware Support Ticket', query: '', link: '/tickets/create' },
        ],
      };
    }

    // 8. Overall Dashboard Summary (Admins & Managers)
    if (isStaff && (msg.includes('summary') || msg.includes('overview') || msg.includes('report') || msg.includes('stats'))) {
      const all = await db.select({ status: tickets.status, rating: tickets.rating }).from(tickets);
      const total = all.length;
      const open = all.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
      const resolved = all.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
      const ratings = all.filter((t: any) => t.rating && t.rating > 0).map((t: any) => t.rating as number);
      const avgRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : '5.0';

      return {
        reply: `**TANCEM Helpdesk Executive Snapshot:**\n\n` +
          `• **Total Tickets Logged:** ${total}\n` +
          `• **Active / In-Progress:** ${open}\n` +
          `• **Resolved / Closed:** ${resolved}\n` +
          `• **Customer CSAT Score:** ⭐ ${avgRating} / 5.0 (${ratings.length} ratings)\n\n` +
          `You can view deep analytics and departmental breakdowns on the Command Dashboard.`,
        role,
        intent: 'stats_summary',
        quickActions: [
          { label: 'Go to Command Dashboard', query: '', link: '/' },
          { label: 'View All Tickets Table', query: '', link: '/tickets' },
        ],
      };
    }

    // 9. Greeting / Default Fallback
    const nameStr = actor.name ? ` **${actor.name.split(' ')[0]}**` : '';
    let greeting = '';
    let defaultActions: ChatQuickAction[] = [];

    if (role === 'admin') {
      greeting = `Hello${nameStr}! 👋 I am your **TANCEM Helpdesk Assistant** (Administrator Mode).\n\nI can provide live operational summaries, check unassigned queues, investigate SLA breaches, or look up any ticket details.`;
      defaultActions = [
        { label: '📊 System Snapshot', query: 'system summary' },
        { label: '🚨 SLA Telemetry', query: 'sla status' },
        { label: '📥 Unassigned Queue', query: 'unassigned tickets' },
        { label: '🔍 Check Ticket #', query: 'TKT-20261028-0001' },
      ];
    } else if (role === 'agent') {
      greeting = `Hello${nameStr}! 👋 I am your **TANCEM Support Copilot**.\n\nI can help you review your active workload, browse unassigned tickets ready to claim, or monitor tickets nearing their SLA deadline.`;
      defaultActions = [
        { label: '📋 Assigned to Me', query: 'assigned to me' },
        { label: '📥 Unassigned Tickets', query: 'unassigned tickets' },
        { label: '⚠️ SLA At-Risk', query: 'sla status' },
        { label: '🔍 Check Ticket #', query: 'TKT-20261028-0001' },
      ];
    } else if (role === 'manager') {
      greeting = `Hello${nameStr}! 👋 I am your **TANCEM Helpdesk Assistant**.\n\nI can help you monitor tickets across your department/office, track SLA compliance, and view service metrics.`;
      defaultActions = [
        { label: '📊 Department Summary', query: 'system summary' },
        { label: '🚨 SLA Status', query: 'sla status' },
        { label: '📋 My Raised Tickets', query: 'my tickets' },
        { label: '❓ How to Raise Ticket', query: 'how to raise ticket' },
      ];
    } else {
      greeting = `Hello${nameStr}! 👋 I am your **TANCEM Helpdesk Assistant**.\n\nI can help you check the status of your tickets, guide you through raising a new ticket, or provide quick troubleshooting for common IT issues.`;
      defaultActions = [
        { label: '📋 Check My Tickets', query: 'my tickets' },
        { label: '❓ How to Raise Ticket', query: 'how to raise ticket' },
        { label: '📧 Mailbox Quota Help', query: 'mailbox quota full' },
        { label: '🔑 Password Reset Info', query: 'password reset' },
      ];
    }

    return {
      reply: greeting,
      role,
      intent: 'greeting',
      quickActions: defaultActions,
    };
  },
};
