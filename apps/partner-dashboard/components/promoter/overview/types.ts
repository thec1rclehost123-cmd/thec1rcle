export type OverviewResponse = {
  kpis?: {
    totalClicks?: number;
    ticketsSold?: number;
    commission?: number;
    activeEvents?: number;
  };
  activeAssignments?: Array<{
    id: string;
    eventId?: string;
    eventName?: string;
    eventDate?: string | null;
    venueName?: string;
    coverImage?: string | null;
    status?: string;
    ticketsSold?: number;
    commission?: number;
  }>;
  warnings?: Array<{
    message: string;
    adminId?: string;
    timestamp?: string;
    auditReason?: string;
  }>;
};

export type GuestsResponse = {
  guests?: Array<{
    id: string;
    guestName?: string;
    eventTitle?: string;
    amount?: number;
    ticketCount?: number;
    status?: string;
    createdAt?: string;
  }>;
};
