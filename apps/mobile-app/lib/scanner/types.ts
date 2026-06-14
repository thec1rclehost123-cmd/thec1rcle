// Scanner module types — ported from scanner-app

export interface EventTier {
  id: string;
  name: string;
  price: number;
  entryType: string;
  available: boolean;
}

export interface ScannerEventData {
  valid: boolean;
  code: string;
  event: {
    id: string;
    title: string;
    venue: string;
    venueId: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    imageUrl?: string;
  };
  permissions: {
    canScan: boolean;
    canDoorEntry: boolean;
  };
  tiers: EventTier[];
  gate?: string;
  stats?: {
    totalEntered: number;
    prebooked: number;
    doorEntries: number;
    doorRevenue: number;
  };
  error?: string;
}

export interface ScanRequest {
  qrData: string;
  eventId: string;
  eventCode: string;
  gate?: string;
}

export interface ScanResponse {
  success: boolean;
  result?: string;
  scanId?: string;
  error?: string;
  message?: string;
  ticket?: {
    orderId: string;
    eventId: string;
    eventTitle: string;
    ticketName: string;
    quantity: number;
    entryType: string;
    userName: string;
    userEmail: string;
  };
  previousScan?: {
    scannedAt: string;
    scannedBy: {
      name: string;
      role: string;
    };
  };
}

export interface DoorEntryRequest {
  eventCode: string;
  eventId: string;
  guestName: string;
  guestPhone?: string;
  tierId: string;
  tierName: string;
  entryType: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: "cash" | "upi" | "card";
  gate?: string;
}

export interface DoorEntryResponse {
  success: boolean;
  orderId?: string;
  entryId?: string;
  qrData?: string;
  error?: string;
}

export interface Guest {
  id: string;
  name: string;
  ticketType: string;
  entryType: string;
  quantity: number;
  source: "online" | "door";
  status: "entered" | "not_entered";
  enteredAt?: string;
}

export type ScanResultType =
  | "valid"
  | "already_scanned"
  | "invalid"
  | "wrong_event"
  | "not_confirmed"
  | null;

export interface ScanResultData {
  type: ScanResultType;
  message: string;
  guest?: {
    name: string;
    ticketType: string;
    quantity: number;
    entryType: string;
  };
  previousScan?: {
    time: string;
    by: string;
  };
}
