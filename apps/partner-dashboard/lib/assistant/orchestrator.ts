/**
 * Partner Dashboard AI Assistant — Orchestrator
 *
 * The orchestrator is the core intelligence pipeline.
 *
 * Flow:
 *   1. Build a tightly scoped system prompt grounded in canonical metric definitions
 *   2. Call Gemini 2.0 Flash with function calling enabled
 *   3. Gemini decides which domain tools to call
 *   4. Execute each tool with permission enforcement
 *   5. Return tool results to Gemini for final answer composition
 *   6. Parse Gemini's structured response into AssistantAnswer
 *
 * Gemini is used only for:
 *   - Intent resolution (what is the user asking?)
 *   - Tool selection (which tools answer this?)
 *   - Answer composition (how to present the data clearly?)
 *
 * Gemini is NOT used for:
 *   - Any financial calculation (tools own the math)
 *   - Any data retrieval (tools own the data)
 *   - Any permission decision (gate owns the access rules)
 */

import type {
    AssistantPermissionContext,
    AssistantAnswer,
    SessionContext,
    ToolResult,
    GeminiContent,
    GeminiToolDeclaration,
    MetricRow,
    DeepLink,
    GroundingSource,
} from './types';
import { buildDefinitionsPrompt } from './metric-definitions';
import { formatINR } from '@/lib/finance/definitions';
import {
    TOOL_REGISTRY,
    type ToolName,
} from './tools/index';

// ── Gemini API ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_TOOL_ROUNDS = 2;     // Maximum tool-call rounds to prevent infinite loops

async function callGemini(
    apiKey: string,
    contents: GeminiContent[],
    tools?: GeminiToolDeclaration[],
    systemInstruction?: string
): Promise<any> {
    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const body: any = { contents };

    if (systemInstruction) {
        body.system_instruction = { parts: [{ text: systemInstruction }] };
    }
    if (tools && tools.length > 0) {
        body.tools = [{ function_declarations: tools }];
    }
    body.generation_config = {
        temperature: 0.2,       // Low temperature for factual, deterministic answers
        top_p: 0.8,
        max_output_tokens: 1024,
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`Gemini API error ${res.status}: ${errText}`);
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
Keep "text" under 120 words. Use newlines for structure if helpful.`;
}

// ── Gemini Tool Declarations ──────────────────────────────────────────────────

const GEMINI_TOOL_DECLARATIONS: GeminiToolDeclaration[] = [
    {
        name: 'getRevenueSummary',
        description: 'Get gross revenue, net revenue, ticket revenue, cover revenue, table revenue, fees, refunds, and chargebacks for a time period.',
        parameters: {
            type: 'object',
            properties: {
                period: { type: 'string', description: 'Time period', enum: ['7d', '30d', '90d', 'ytd'] },
            },
        },
    },
    {
        name: 'getPayoutStatus',
        description: 'Get payout status: pending amount, settled amount, next payout date, payout schedule, and recent payout history.',
        parameters: { type: 'object', properties: {} },
    },
    {
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
    {
        name: 'getRefundAndChargebackSummary',
        description: 'Get total refunds, chargebacks, counts, and recent refund transactions for a period.',
        parameters: {
            type: 'object',
            properties: {
                period: { type: 'string', description: 'Time period', enum: ['7d', '30d', '90d', 'ytd'] },
            },
        },
    },
    {
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
    {
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
    {
        name: 'getScanVelocityMetrics',
        description: 'Get QR scan velocity, slowdown detection, peak scans/minute, rejected scans. For entry operations analysis.',
        parameters: {
            type: 'object',
            properties: {
                eventId: { type: 'string', description: 'Specific event ID' },
            },
        },
    },
    {
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
    {
        name: 'getGuestListMetrics',
        description: 'Get guestlist totals: confirmed, checked-in, declined, broken down by promoter.',
        parameters: {
            type: 'object',
            properties: {
                eventId: { type: 'string', description: 'Specific event ID' },
            },
        },
    },
    {
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
    {
        name: 'getVenuePartnerObligations',
        description: 'Get the total amount the venue owes to hosts and promoters. Venue-only, requires VIEW_FINANCIALS permission.',
        parameters: { type: 'object', properties: {} },
    },
    {
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
    {
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
    {
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
    {
        name: 'getDashboardAlerts',
        description: 'Get current dashboard alerts: payout failures, low balance warnings, chargeback alerts, KYC issues.',
        parameters: { type: 'object', properties: {} },
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
        const result = await (tool as any)(args, ctx);
        return result;
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

    // Supplement with contextual links based on what tools were called
    if (toolsUsed.includes('getRevenueSummary') || toolsUsed.includes('getLedgerBreakdown')) {
        if (!links.some(l => l.href.includes('/finance'))) {
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
        if (!links.some(l => l.href.includes('/events'))) {
            links.push({ label: 'View Events', href: `${base}/events` });
        }
    }
    if (toolsUsed.includes('getAttendanceMetrics') || toolsUsed.includes('getScanVelocityMetrics')) {
        links.push({ label: 'Entry Operations Analytics', href: `${base}/analytics/ops` });
    }
    if (toolsUsed.includes('getPromoterCommissionSummary')) {
        links.push({ label: 'Analytics > Promoter ROI', href: `${base}/analytics/attribution` });
    }

    return links.slice(0, 3); // Maximum 3 deep links
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
    const apiKey = process.env.GEMINI_API_KEY;

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

    // Build conversation history for Gemini
    const geminiHistory: GeminiContent[] = session.history
        .filter(m => m.role !== 'system')
        .slice(-6)  // Last 6 messages for context
        .map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
        }));

    // Add the current user message
    geminiHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    let contents: GeminiContent[] = geminiHistory;
    let toolRound = 0;

    try {
        // ── Round 1+ : Tool Calling Loop ───────────────────────────────────────
        while (toolRound < MAX_TOOL_ROUNDS) {
            const geminiResponse = await callGemini(
                apiKey,
                contents,
                toolRound === 0 ? GEMINI_TOOL_DECLARATIONS : undefined,
                systemPrompt
            );

            const candidate = geminiResponse?.candidates?.[0];
            if (!candidate) throw new Error('No response from Gemini');

            const parts = candidate.content?.parts || [];
            const functionCalls = parts.filter((p: any) => p.functionCall);
            const textParts = parts.filter((p: any) => p.text);

            // If no function calls, Gemini is composing the final answer
            if (functionCalls.length === 0) {
                const rawText = textParts.map((p: any) => p.text).join('');
                let answer: AssistantAnswer;

                try {
                    // Parse structured JSON response
                    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        const deepLinks = buildDeepLinks(ctx, toolsUsed, parsed);

                        answer = {
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
                    } else {
                        // Plain text fallback
                        answer = {
                            type: 'direct',
                            text: rawText,
                            grounding: groundingSources.length > 0 ? groundingSources : undefined,
                            links: buildDeepLinks(ctx, toolsUsed, {}),
                        };
                    }
                } catch {
                    answer = { type: 'direct', text: rawText };
                }

                return { answer, toolsUsed, latencyMs: Date.now() - startTime };
            }

            // Execute tool calls
            const toolResponseParts: any[] = [];

            for (const fc of functionCalls) {
                const { name, args } = fc.functionCall;
                toolsUsed.push(name);

                const result = await executeTool(name, args || {}, ctx);

                if (result.ok && result.source) {
                    groundingSources.push({
                        label: result.source,
                        scope: undefined,
                        fresh: result.freshness === 'live',
                    });
                }

                toolResponseParts.push({
                    functionResponse: {
                        name,
                        response: result.ok
                            ? { result: result.data, freshness: result.freshness, source: result.source }
                            : { error: result.errorReason, freshness: 'unavailable' },
                    },
                });
            }

            // Add the model's tool call response and tool results to the conversation
            contents = [
                ...contents,
                { role: 'model', parts: functionCalls.map((fc: any) => ({ functionCall: fc.functionCall })) },
                { role: 'user', parts: toolResponseParts },
            ];

            toolRound++;
        }

        // If we exhausted tool rounds without a text response, ask Gemini to compose
        const finalResponse = await callGemini(apiKey, contents, undefined, systemPrompt);
        const finalText = finalResponse?.candidates?.[0]?.content?.parts
            ?.filter((p: any) => p.text)
            ?.map((p: any) => p.text)
            ?.join('') || 'Unable to compose an answer. Please check your dashboard directly.';

        let answer: AssistantAnswer;
        try {
            const jsonMatch = finalText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                answer = {
                    type: parsed.type || 'direct',
                    text: parsed.text || finalText,
                    metrics: parsed.metrics,
                    breakdown: parsed.breakdown,
                    links: buildDeepLinks(ctx, toolsUsed, parsed),
                    followUps: parsed.followUps?.slice(0, 3),
                    grounding: groundingSources.length > 0 ? groundingSources : undefined,
                    dataFreshness: parsed.dataFreshness || 'estimated',
                    scopeNote: parsed.scopeNote,
                };
            } else {
                answer = { type: 'direct', text: finalText };
            }
        } catch {
            answer = { type: 'direct', text: finalText };
        }

        return { answer, toolsUsed, latencyMs: Date.now() - startTime };

    } catch (err: any) {
        // Graceful failure
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
