export interface ChatMessageRequest {
  message: string;
}

export interface ChatQuickAction {
  label: string;
  query: string;
  link?: string;
  icon?: string;
}

export interface ChatTicketSummary {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  category?: string | null;
  assignedToName?: string | null;
  createdAt: string;
  resolutionDueAt?: string | null;
}

export interface ChatMessageResponse {
  reply: string;
  role: 'user' | 'agent' | 'admin' | 'manager';
  intent: string;
  tickets?: ChatTicketSummary[];
  quickActions: ChatQuickAction[];
}

export interface ChatActor {
  id: string;
  role?: string;
  name?: string;
  email?: string;
}
