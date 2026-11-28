export type TicketStatus = 'open' | 'pending' | 'answered' | 'closed';
export type TicketRole = 'user' | 'admin';

export interface ThreadMessage {
  id: string;
  ticketId?: string;
  senderRole: TicketRole;
  senderId?: string | null;
  body: string;
  attachmentUrl?: string | null;
  createdAt: string;
}

export interface CreatedTicket {
  id: string;
  code: string;
  subject: string;
  topic: string;
  message: string;
  createdAt: string;
}

export interface TicketSummary {
  id: string;
  code: string;
  subject: string;
  topic: string;
  status: TicketStatus;
  preview: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}
