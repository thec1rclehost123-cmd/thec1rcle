// Scanner module types for the shared mobile scanner flow

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
  codeId?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
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
    canWalkIn?: boolean;
    canCharge?: boolean;
  };
  tiers: EventTier[];
  gate?: string;
  stats?: {
    totalEntered: number;
    prebooked: number;
    doorEntries: number;
    doorRevenue: number;
    walkIns?: number;
  };
  error?: string;
}

export interface ScanRequest {
  qrData: string;
  eventId: string;
  eventCode: string;
  gate?: string;
  venueId?: string;
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
  paymentMethod: 'cash' | 'upi' | 'card';
  gate?: string;
  idempotencyKey?: string;
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
  source: 'online' | 'door';
  status: 'entered' | 'not_entered';
  enteredAt?: string;
}

export type ScanResultType =
  | 'valid'
  | 'already_scanned'
  | 'invalid'
  | 'wrong_event'
  | 'not_confirmed'
  | 'network_error'
  | 'session_expired'
  | 'device_invalid'
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

export interface WalletContext {
  id: string;
  orderId: string;
  currentBalancePaise: number;
  openingBalancePaise: number;
  totalDebitedPaise: number;
  guestFirstName: string;
  state: string;
  terminationTime: string | null;
  rules: {
    allowedPresetItems: PresetItem[];
    showBalanceToGuest: boolean;
    maxChargeAmountPaise: number;
    minChargeAmountPaise: number;
  };
}

export interface PresetItem {
  id: string;
  name: string;
  amountPaise: number;
  category?: string;
  isAvailable: boolean;
  sortOrder: number;
}

export interface DebitRequest {
  walletId: string;
  presetItemId: string;
  quantity: number;
  idempotencyKey: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  deviceId: string;
  eventCodeId: string;
  isOnline: true;
}

export interface DebitResponse {
  success: boolean;
  balanceAfterPaise?: number;
  receipt?: { itemName: string; amountPaise: number };
  error?: string;
}

export interface WalkInRequest {
  eventCode: string;
  eventId: string;
  venueId: string;
  guestName: string;
  guestAge?: number;
  guestPhone?: string;
  gate?: string;
}

export interface WalkInEntry {
  id: string;
  guestName: string;
  guestAge?: number | null;
  phoneHash?: string;
  gate?: string | null;
  addedAt: string;
}

export interface WalkInResponse {
  success: boolean;
  walkInId?: string;
  error?: string;
}
