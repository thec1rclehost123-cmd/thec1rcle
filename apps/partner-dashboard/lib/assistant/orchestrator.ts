/**
 * Partner Dashboard AI Assistant — Orchestrator
 * (OpenAI GPT-4o-mini backend)
 *
 * Flow:
 *   1. Build a tightly scoped system prompt grounded in canonical metric definitions
 *   2. Call GPT-4o-mini with function calling enabled
 *   3. Model decides which domain tools to call
 *   4. Execute each tool with permission enforcement
 *   5. Return tool results to model for final answer composition
 *   6. Parse structured response into AssistantAnswer
 */

import type {
    AssistantPermissionContext,
    AssistantAnswer,
    SessionContext,
    ToolResult,
    DeepLink,
    GroundingSource,
} from './types';
import { buildDefinitionsPrompt } from './metric-definitions';
import {
    TOOL_REGISTRY,
    type ToolName,
} from './tools/index';

// ── OpenAI API ────────────────────────────────────────────────────────────────

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';
const MAX_TOOL_ROUNDS = 2;

async function callOpenAI(
    apiKey: string,
    messages: any[],
    tools?: any[],
): Promise<any> {
    const body: any = {
        model: OPENAI_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
    };

    if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto';
    }

    const res = await fetch(OPENAI_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }
    return res.json();
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: AssistantPermissionContext): string {
    const roleLabel = `${ctx.partnerType} / ${ctx.role}`;
    const partnerLabel = ctx.partnerName || ctx.partnerId;
    const permList = ctx.permissions.join(', ');
    const defs = buildDefinitionsPrompt();

    return `You are the C1RCLE Partner Dashboard Intelligence — a tightly scoped, data-grounded assistant for partners on THE C1RCLE platform.

IDENTITY
You are not a general AI. You are an embedded operator intelligence inside a premium event management dashboard. Your only job is to answer questions about this partner's dashboard data: finance, payouts, events, tickets, attendance, guestlist, entry operations, staff, commissions, analytics, and metric definitions.

CURRENT USER CONTEXT
- Partner: ${partnerLabel}
- Partner Type: ${ctx.partnerType}
- Role: ${roleLabel}
- Authorized Permissions: ${permList}

STRICT RULES
1. Answer ONLY from data returned by the tool functions. Never invent numbers, causes, or trends.
2. If a tool returns no data or unavailable, say so clearly. Do not fill the gap.
3. If data is estimated, label it. If it is live, label it. If it is pending, label it.
4. Do NOT answer from general model knowledge about business, finance, or events.
5. Do NOT provide generic business advice unrelated to this partner's data.
6. Do NOT access any data outside this partner's authorized scope (partnerId: ${ctx.partnerId}).
7. Keep answers compact and direct. Answer the question first, then break it down.
8. If the question is ambiguous, choose the most specific interpretation and state it briefly.
9. Do not use phrases like "It seems like", "As an AI", "I think", "I believe", or "I don't have access to real-time data" — just state what the tools returned.
10. Out-of-scope questions must be refused cleanly. Do not apologize excessively.

CANONICAL METRIC DEFINITIONS (these are the authoritative meanings for all numbers in this dashboard):
${defs}

RESPONSE FORMAT
Respond with a JSON object using this exact structure:
{
  "type": "direct" | "breakdown" | "comparison" | "ranked_list" | "definition" | "trend" | "diagnostic" | "error" | "scoped_refusal",
  "text": "<main answer — compact, direct, factual>",
  "metrics": [{ "label": "...", "value": "...", "subtext": "...", "change": "...", "changeDirection": "up|down|neutral" }],
  "breakdown": [{ "label": "...", "value": "...", "subtext": "..." }],
  "ranked": [{ "rank": 1, "label": "...", "value": "...", "subtext": "..." }],
  "links": [{ "label": "...", "href": "..." }],
  "followUps": ["<follow-up question 1>", "<follow-up question 2>"],
  "grounding": [{ "label": "...", "scope": "..." }],
  "scopeNote": "<optional: short scope clarification>",
  "dataFreshness": "live|estimated|pending|settled|partial|unavailable"
}
All fields except "type" and "text" are optional. Only include fields that add genuine value. Maximum 2-3 followUps.
All monetary values must be pre-formatted as INR strings (e.g., "₹8,420"). Never return raw numbers in text.
Keep "text" under 120 words. Use newlines for structure if helpful.
IMPORTANT: Your entire response must be valid JSON matching the structure above. Do not add any text outside the JSON object.`;
}

// ── OpenAI Tool Declarations ──────────────────────────────────────────────────

const OPENAI_TOOL_DECLARATIONS = [
    {
        type: 'function',
        function: {
            name: 'getRevenueSummary',
            description: 'Get gross revenue, net revenue, ticket revenue, cover revenue, table revenue, fees, refunds, and chargebacks for a time period.',
            parameters: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period', enum: ['7d', '30d', '90d', 'ytd'] },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getPayoutStatus',
            description: 'Get payout status: pending amount, settled amount, next payout date, payout schedule, and recent payout history.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getLedgerBreakdown',
            description: 'Get recent ledger transactions, optionally filtered by category (refund, chargeback, ticket_sale, cover_payment, etc.) or status.',
            parameters: {
                type: 'object',
                properties: {
                    category: { type: 'string', description: 'Filter by transaction category' },
                    status: { type: 'string', description: 'Filter by settlement status: pending, processing, paid, failed, held, reversed' },
                    limit: { type: 'string', description: 'Number of transactions to retrieve (max 20)' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getRefundAndChargebackSummary',
            description: 'Get total refunds, chargebacks, counts, and recent refund transactions for a period.',
            parameters: {
                type: 'object',
                properties: {
                    period: { type: 'string', description: 'Time period', enum: ['7d', '30d', '90d', 'ytd'] },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getEventPerformance',
            description: 'Get event performance data: revenue, tickets sold, check-ins, attendance rate. Can fetch a specific event or list recent events.',
            parameters: {
                type: 'object',
                properties: {
                    eventId: { type: 'string', description: 'Specific event ID. Omit to list recent events.' },
                    period: { type: 'string', description: 'Time period for list view' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getAttendanceMetrics',
            description: 'Get check-in count, attendance rate, no-show rate, and peak entry hour. Can be for a specific event or a period.',
            parameters: {
                type: 'object',
                properties: {
                    eventId: { type: 'string', description: 'Specific event ID' },
                    period: { type: 'string', description: 'Time period: 7d, 30d, 90d, ytd' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getScanVelocityMetrics',
            description: 'Get QR scan velocity, slowdown detection, peak scans/minute, rejected scans. For entry operations analysis.',
            parameters: {
                type: 'object',
                properties: {
                    eventId: { type: 'string', description: 'Specific event ID' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getTicketSalesMetrics',
            description: 'Get total tickets sold, revenue, tier breakdown (GA, VIP, early-bird, etc.), and conversion rate.',
            parameters: {
                type: 'object',
                properties: {
                    eventId: { type: 'string', description: 'Specific event ID' },
                    period: { type: 'string', description: 'Time period for aggregate view' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getGuestListMetrics',
            description: 'Get guestlist totals: confirmed, checked-in, declined, broken down by promoter.',
            parameters: {
                type: 'object',
                properties: {
                    eventId: { type: 'string', description: 'Specific event ID' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getPromoterCommissionSummary',
            description: 'Get promoter commission data: attributed sales, earned commissions, pending/settled amounts, conversion rate. Promoters see their own data only.',
            parameters: {
                type: 'object',
                properties: {
                    promoterId: { type: 'string', description: 'Specific promoter ID (optional for venue owners)' },
                    period: { type: 'string', description: 'Time period' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getVenuePartnerObligations',
            description: 'Get the total amount the venue owes to hosts and promoters. Venue-only, requires VIEW_FINANCIALS permission.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getStaffPerformanceSummary',
            description: 'Get staff scan counts, top scanner, and average performance.',
            parameters: {
                type: 'object',
                properties: {
                    eventId: { type: 'string', description: 'Specific event ID' },
                    period: { type: 'string', description: 'Time period' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getTimeRangeComparison',
            description: 'Compare a metric across two time periods (e.g., this week vs last week).',
            parameters: {
                type: 'object',
                properties: {
                    period1: { type: 'string', description: 'First period', enum: ['7d', '30d', '90d', 'ytd'] },
                    period2: { type: 'string', description: 'Second (comparison) period', enum: ['7d', '30d', '90d', 'ytd'] },
                    metric: { type: 'string', description: 'Metric to compare', enum: ['revenue', 'tickets', 'attendance', 'commissions'] },
                },
                required: ['period1', 'period2', 'metric'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getMetricDefinition',
            description: 'Look up the official definition of a dashboard metric term (e.g., "net revenue", "attendance rate", "reserve balance").',
            parameters: {
                type: 'object',
                properties: {
                    term: { type: 'string', description: 'The metric term to define' },
                },
                required: ['term'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getDashboardAlerts',
            description: 'Get current dashboard alerts: payout failures, low balance warnings, chargeback alerts, KYC issues.',
            parameters: { type: 'object', properties: {} },
        },
    },
];

// ── Tool Executor ─────────────────────────────────────────────────────────────

async function executeTool(
    name: string,
    args: Record<string, unknown>,
    ctx: AssistantPermissionContext
): Promise<ToolResult> {
    const tool = TOOL_REGISTRY[name as ToolName];
    if (!tool) {
        return { ok: false, freshness: 'unavailable', source: name, errorReason: 'Unknown tool' };
    }
    try {
        return await (tool as any)(args, ctx);
    } catch (err: any) {
        return {
            ok: false,
            freshness: 'unavailable',
            source: name,
            errorReason: err?.message || 'Tool execution failed',
        };
    }
}

// ── Deep Link Builder ─────────────────────────────────────────────────────────

function buildDeepLinks(
    ctx: AssistantPermissionContext,
    toolsUsed: string[],
    parsedAnswer: any
): DeepLink[] {
    const base = `/${ctx.partnerType === 'venue' || ctx.partnerType === 'club' ? 'venue'
        : ctx.partnerType === 'promoter' ? 'promoter' : 'host'}`;
    const links: DeepLink[] = parsedAnswer.links || [];

    if (toolsUsed.includes('getRevenueSummary') || toolsUsed.includes('getLedgerBreakdown')) {
        if (!links.some((l: DeepLink) => l.href.includes('/finance'))) {
            links.push({ label: 'Open Finance', href: `${base}/finance` });
        }
    }
    if (toolsUsed.includes('getRefundAndChargebackSummary')) {
        links.push({ label: 'View Refunds in Ledger', href: `${base}/finance/ledger?category=refund` });
    }
    if (toolsUsed.includes('getPayoutStatus')) {
        links.push({ label: 'Payout Settings', href: `${base}/finance/payouts` });
    }
    if (toolsUsed.includes('getEventPerformance')) {
        if (!links.some((l: DeepLink) => l.href.includes('/events'))) {
            links.push({ label: 'View Events', href: `${base}/events` });
        }
    }
    if (toolsUsed.includes('getAttendanceMetrics') || toolsUsed.includes('getScanVelocityMetrics')) {
        links.push({ label: 'Entry Operations Analytics', href: `${base}/analytics/ops` });
    }
    if (toolsUsed.includes('getPromoterCommissionSummary')) {
        links.push({ label: 'Analytics > Promoter ROI', href: `${base}/analytics/attribution` });
    }

    return links.slice(0, 3);
}

// ── Answer Parser ─────────────────────────────────────────────────────────────

function parseAnswer(
    rawText: string,
    ctx: AssistantPermissionContext,
    toolsUsed: string[],
    groundingSources: GroundingSource[]
): AssistantAnswer {
    try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const deepLinks = buildDeepLinks(ctx, toolsUsed, parsed);
            return {
                type: parsed.type || 'direct',
                text: parsed.text || rawText,
                metrics: parsed.metrics || undefined,
                breakdown: parsed.breakdown || undefined,
                comparison: parsed.comparison || undefined,
                ranked: parsed.ranked || undefined,
                table: parsed.table || undefined,
                links: deepLinks.length > 0 ? deepLinks : undefined,
                followUps: parsed.followUps?.slice(0, 3) || undefined,
                grounding: groundingSources.length > 0 ? groundingSources : undefined,
                dataFreshness: parsed.dataFreshness || 'estimated',
                scopeNote: parsed.scopeNote || undefined,
            };
        }
    } catch {
        // fall through to plain text
    }
    return {
        type: 'direct',
        text: rawText,
        grounding: groundingSources.length > 0 ? groundingSources : undefined,
        links: buildDeepLinks(ctx, toolsUsed, {}),
    };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export interface OrchestratorResult {
    answer: AssistantAnswer;
    toolsUsed: string[];
    latencyMs: number;
}

export async function orchestrate(
    userMessage: string,
    session: SessionContext,
    ctx: AssistantPermissionContext
): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return {
            answer: {
                type: 'error',
                text: "The intelligence layer is not configured. Contact your platform administrator.",
                dataFreshness: 'unavailable',
            },
            toolsUsed: [],
            latencyMs: Date.now() - startTime,
        };
    }

    const systemPrompt = buildSystemPrompt(ctx);
    const toolsUsed: string[] = [];
    const groundingSources: GroundingSource[] = [];

    // Build messages array: system + history + current user message
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...session.history
            .filter(m => m.role !== 'system')
            .slice(-6)
            .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
        { role: 'user', content: userMessage },
    ];

    try {
        let toolRound = 0;

        while (toolRound < MAX_TOOL_ROUNDS) {
            const response = await callOpenAI(
                apiKey,
                messages,
                toolRound === 0 ? OPENAI_TOOL_DECLARATIONS : undefined,
            );

            const choice = response?.choices?.[0];
            if (!choice) throw new Error('No response from OpenAI');

            const { finish_reason, message } = choice;

            // No tool calls — model is composing the final answer
            if (finish_reason !== 'tool_calls' || !message.tool_calls?.length) {
                const rawText = message.content || '';
                return {
                    answer: parseAnswer(rawText, ctx, toolsUsed, groundingSources),
                    toolsUsed,
                    latencyMs: Date.now() - startTime,
                };
            }

            // Execute tool calls
            // Append the assistant's tool_calls message first
            messages.push({ role: 'assistant', content: null, tool_calls: message.tool_calls });

            for (const toolCall of message.tool_calls) {
                const name = toolCall.function.name;
                let args: Record<string, unknown> = {};
                try {
                    args = JSON.parse(toolCall.function.arguments || '{}');
                } catch {
                    args = {};
                }

                toolsUsed.push(name);
                const result = await executeTool(name, args, ctx);

                if (result.ok && result.source) {
                    groundingSources.push({
                        label: result.source,
                        scope: undefined,
                        fresh: result.freshness === 'live',
                    });
                }

                // Append tool result
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(
                        result.ok
                            ? { result: result.data, freshness: result.freshness, source: result.source }
                            : { error: result.errorReason, freshness: 'unavailable' }
                    ),
                });
            }

            toolRound++;
        }

        // Exhausted tool rounds — ask model to compose with what we have
        const finalResponse = await callOpenAI(apiKey, messages);
        const finalText = finalResponse?.choices?.[0]?.message?.content || 'Unable to compose an answer. Please check your dashboard directly.';

        return {
            answer: parseAnswer(finalText, ctx, toolsUsed, groundingSources),
            toolsUsed,
            latencyMs: Date.now() - startTime,
        };

    } catch (err: any) {
        console.error('[Orchestrator] Error:', err?.message, err?.stack?.split('\n')[1]);
        const isPermissionError = err?.message?.includes('permission') || err?.message?.includes('Unauthorized');
        const isNetworkError = err?.message?.includes('fetch') || err?.message?.includes('ECONNREFUSED');

        return {
            answer: {
                type: 'error',
                text: isNetworkError
                    ? "The data layer is temporarily unreachable. Please check your dashboard directly."
                    : isPermissionError
                        ? "That data is outside your current permissions."
                        : "Something went wrong while retrieving your answer. Please try again.",
                dataFreshness: 'unavailable',
            },
            toolsUsed,
            latencyMs: Date.now() - startTime,
        };
    }
}
