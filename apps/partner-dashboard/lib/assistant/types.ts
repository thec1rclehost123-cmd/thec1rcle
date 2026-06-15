/**
 * Partner Dashboard AI Assistant — Core Types
 *
 * All types used across the assistant pipeline: frontend, API route,
 * orchestrator, tools, and response composer.
 */

import type { PartnerType, StaffRole, Permission } from '@/lib/rbac/types';

// ── Session & Context ────────────────────────────────────────────────────────

/** The permission context attached to every assistant request. */
export interface AssistantPermissionContext {
  uid: string;
  partnerType: PartnerType;
  partnerId: string;
  partnerName: string;
  role: StaffRole;
  permissions: Permission[];
  token: string; // Firebase ID token (server-only)
}

/** Conversational memory sent with each request (stateless server, stateful client). */
export interface SessionContext {
  /** Recent messages (last 6 at most — cost/latency control). */
  history: ChatMessage[];
  /** If the user is currently viewing a specific event, its ID. */
  currentEventId?: string;
  /** If the user has established a comparison period, e.g. "last weekend". */
  comparisonPeriod?: string;
  /** If the user is discussing a specific partner/promoter. */
  focusPartnerId?: string;
  focusPartnerName?: string;
  /** If the user has explicitly set a time range. */
  activePeriod?: '7d' | '30d' | '90d' | 'ytd' | 'today' | 'tonight';
}

// ── Chat Messages ────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

// ── Answer Structures ────────────────────────────────────────────────────────

export type AnswerType =
  | 'direct' // Single clean answer
  | 'breakdown' // Metric breakdown (revenue by category, etc.)
  | 'comparison' // Side-by-side comparison
  | 'ranked_list' // Ordered list (top promoters, etc.)
  | 'ledger' // Transaction preview
  | 'definition' // Metric or term definition
  | 'trend' // Time-based trend summary
  | 'diagnostic' // Root-cause analysis
  | 'error' // Retrieval or permission failure
  | 'scoped_refusal'; // Out-of-scope or permission-denied

export type DataFreshness =
  | 'live' // Real-time
  | 'estimated' // Derived or aggregated
  | 'pending' // Awaiting settlement
  | 'settled' // Finalized
  | 'partial' // Some data available, some missing
  | 'unavailable'; // Could not retrieve

/** A single metric displayed as a pill or row. */
export interface MetricRow {
  label: string;
  value: string; // Pre-formatted (e.g., "₹8,420")
  subtext?: string; // e.g., "after 2 refunds"
  change?: string; // e.g., "+12.4%"
  changeDirection?: 'up' | 'down' | 'neutral';
  freshness?: DataFreshness;
}

/** A comparison column for side-by-side display. */
export interface ComparisonColumn {
  label: string; // e.g., "This Friday"
  metrics: MetricRow[];
}

/** A ranked list row. */
export interface RankedRow {
  rank: number;
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}

/** A table row for ledger/detail previews. */
export interface TableRow {
  cells: string[];
}

/** A deep-link into a dashboard page. */
export interface DeepLink {
  label: string; // e.g., "Open Ledger"
  href: string; // e.g., "/venue/finance/ledger?category=refund"
  description?: string;
}

/** Where data was sourced from (shown as a grounding card). */
export interface GroundingSource {
  label: string; // e.g., "Finance Ledger"
  scope?: string; // e.g., "7d" or "tonight"
  fresh?: boolean; // Live vs cached
}

/** The complete structured answer returned by the orchestrator. */
export interface AssistantAnswer {
  type: AnswerType;
  text: string; // Main narrative answer (markdown supported)
  metrics?: MetricRow[];
  breakdown?: MetricRow[];
  comparison?: ComparisonColumn[];
  ranked?: RankedRow[];
  table?: { headers: string[]; rows: TableRow[] };
  links?: DeepLink[];
  followUps?: string[];
  grounding?: GroundingSource[];
  dataFreshness?: DataFreshness;
  /** Short scope statement, e.g. "Showing venue-wide data for the last 7 days." */
  scopeNote?: string;
}

/** The full response from the chat API. */
export interface AssistantResponse {
  answer: AssistantAnswer;
  /** Milliseconds taken by the orchestrator. */
  latencyMs: number;
  /** Which tools were called (for debug/audit). */
  toolsUsed?: string[];
}

// ── Tool Layer ───────────────────────────────────────────────────────────────

/** Strongly-typed tool input/output pair. */
export interface AssistantTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  requiredPermissions: Permission[];
  /** Validates and executes the tool call. Returns null if data is unavailable. */
  execute(input: TInput, ctx: AssistantPermissionContext): Promise<TOutput | null>;
}

/** Standard wrapper around any tool result. */
export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  freshness: DataFreshness;
  source: string; // Human-readable source label
  errorReason?: string;
}

// ── Gemini API Types (used in orchestrator) ──────────────────────────────────

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

// ── Request/Response shapes for /api/assistant/chat ─────────────────────────

export interface AssistantChatRequest {
  message: string;
  session: SessionContext;
}

export interface AssistantChatResponse {
  answer: AssistantAnswer;
  latencyMs: number;
  toolsUsed: string[];
}
