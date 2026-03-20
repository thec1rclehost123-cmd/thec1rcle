"use client";

/**
 * AssistantPanel — The main in-dashboard chat interface.
 *
 * Design:
 *   - Right-side slide-in drawer (380px wide on desktop, full-width on mobile)
 *   - Fixed position, overlays content without shifting layout
 *   - Conversation thread with auto-scroll
 *   - Natural language input (no chips, no pre-built filters)
 *   - Follow-up suggestions rendered as quiet tappable chips below each answer
 *   - No avatars, no confidence meters, no decorative chrome
 *
 * State:
 *   - Session context is maintained client-side (stateless server)
 *   - History trimmed to last 6 messages before each request
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send, RotateCcw } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { AssistantMessage } from "./AssistantMessage";
import type {
    AssistantAnswer,
    ChatMessage,
    SessionContext,
    AssistantChatResponse,
} from "@/lib/assistant/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThreadMessage {
    id: string;
    role: "user" | "assistant";
    content?: string;
    answer?: AssistantAnswer;
    followUps?: string[];
}

interface AssistantPanelProps {
    open: boolean;
    onClose: () => void;
}

// ── Suggested prompts for empty state ────────────────────────────────────────

const EMPTY_STATE_SUGGESTIONS: Record<string, string[]> = {
    venue: [
        "How much did we make this weekend?",
        "Which event had the best attendance this month?",
        "What is my pending payout?",
        "Break down revenue by type",
    ],
    host: [
        "What's my net revenue for the last 30 days?",
        "Which promoter drove the most sales?",
        "How many no-shows did my last event have?",
        "What commissions are still pending?",
    ],
    promoter: [
        "How much commission have I earned this month?",
        "What's my conversion rate this week?",
        "Which event drove my best results?",
        "What is my pending payout?",
    ],
};

// ── Main Panel ────────────────────────────────────────────────────────────────

export function AssistantPanel({ open, onClose }: AssistantPanelProps) {
    const { user, profile } = useDashboardAuth();
    const [thread, setThread] = useState<ThreadMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState<SessionContext>({ history: [] });
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const partnerType = profile?.activeMembership?.partnerType || "venue";
    const suggestions = EMPTY_STATE_SUGGESTIONS[partnerType] || EMPTY_STATE_SUGGESTIONS.venue;

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [thread, loading]);

    // Focus input when panel opens
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || loading || !user) return;

        const userMsg: ThreadMessage = {
            id: `u-${Date.now()}`,
            role: "user",
            content: text.trim(),
        };

        const loadingMsg: ThreadMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            answer: { type: "direct", text: "" },
        };

        setThread(prev => [...prev, userMsg, loadingMsg]);
        setInput("");
        setLoading(true);

        // Update session history (send last 6 messages, not the loading placeholder)
        const updatedHistory: ChatMessage[] = [
            ...session.history,
            { role: "user" as const, content: text.trim(), timestamp: Date.now() },
        ].slice(-6);

        try {
            const token = await user.getIdToken();

            const res = await fetch("/api/assistant/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: text.trim(),
                    session: { ...session, history: updatedHistory },
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const data: AssistantChatResponse = await res.json();

            // Replace loading placeholder with real answer
            setThread(prev => {
                const newThread = [...prev];
                newThread[newThread.length - 1] = {
                    id: `a-${Date.now()}`,
                    role: "assistant",
                    answer: data.answer,
                    followUps: data.answer.followUps,
                };
                return newThread;
            });

            // Update session with the assistant's response
            setSession(prev => ({
                ...prev,
                history: [
                    ...updatedHistory,
                    { role: "assistant" as const, content: data.answer.text, timestamp: Date.now() },
                ].slice(-6),
            }));

        } catch (err: any) {
            setThread(prev => {
                const newThread = [...prev];
                newThread[newThread.length - 1] = {
                    id: `a-error-${Date.now()}`,
                    role: "assistant",
                    answer: {
                        type: "error",
                        text: err?.message === "Failed to fetch"
                            ? "Network error. Please check your connection."
                            : "Something went wrong. Please try again.",
                        dataFreshness: "unavailable",
                    },
                };
                return newThread;
            });
        } finally {
            setLoading(false);
        }
    }, [loading, user, session]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const handleReset = () => {
        setThread([]);
        setSession({ history: [] });
        setInput("");
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[2px] lg:hidden"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        key="panel"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 300 }}
                        className="fixed top-0 right-0 bottom-0 z-[210] w-full sm:w-[380px] flex flex-col bg-[var(--bg-base)] border-l border-[var(--border-subtle)] shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
                            <div>
                                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Dashboard Intelligence</h2>
                                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                    {profile?.activeMembership?.partnerName || "Partner"} · {profile?.activeMembership?.role}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                {thread.length > 0 && (
                                    <button
                                        onClick={handleReset}
                                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)] transition-colors"
                                        title="Clear conversation"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)] transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Thread / Empty State */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scroll-smooth"
                        >
                            {thread.length === 0 ? (
                                /* Empty state */
                                <div className="pt-4 space-y-5">
                                    <div className="space-y-1">
                                        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                                            Ask about revenue, payouts, events, tickets, guests, or staff. I only answer from your authorized dashboard data.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Try asking</p>
                                        <div className="flex flex-col gap-1.5">
                                            {suggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => sendMessage(s)}
                                                    className="text-left px-3 py-2 text-[12px] text-[var(--text-secondary)] bg-[var(--bg-fill)]/60 rounded-lg hover:bg-[var(--bg-fill)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-subtle)]"
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Conversation thread */
                                thread.map((msg, i) => (
                                    <div key={msg.id} className="space-y-2">
                                        {msg.role === "user" ? (
                                            /* User message */
                                            <div className="flex justify-end">
                                                <div className="max-w-[85%] bg-[var(--bg-secondary)] rounded-xl rounded-tr-sm px-3 py-2">
                                                    <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{msg.content}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Assistant answer */
                                            <div className="space-y-2">
                                                <div className="px-0.5">
                                                    {msg.answer ? (
                                                        <AssistantMessage
                                                            answer={msg.answer}
                                                            isLoading={loading && i === thread.length - 1}
                                                        />
                                                    ) : (
                                                        <AssistantMessage
                                                            answer={{ type: "direct", text: "" }}
                                                            isLoading={true}
                                                        />
                                                    )}
                                                </div>

                                                {/* Follow-up suggestions */}
                                                {msg.followUps && msg.followUps.length > 0 && !loading && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {msg.followUps.map((q, qi) => (
                                                            <button
                                                                key={qi}
                                                                onClick={() => sendMessage(q)}
                                                                className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-fill)] transition-all"
                                                            >
                                                                {q}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input */}
                        <div className="shrink-0 px-4 py-3 border-t border-[var(--border-subtle)]">
                            <form onSubmit={handleSubmit} className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about revenue, payouts, events…"
                                    rows={1}
                                    maxLength={500}
                                    disabled={loading}
                                    className="flex-1 resize-none bg-[var(--bg-fill)]/70 text-[var(--text-primary)] text-[13px] placeholder:text-[var(--text-tertiary)] rounded-xl px-3 py-2.5 border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-subtle)] transition-colors min-h-[40px] max-h-[120px] overflow-y-auto disabled:opacity-50"
                                    style={{ lineHeight: "1.4" }}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !input.trim()}
                                    className="w-9 h-9 rounded-xl bg-text-primary text-white flex items-center justify-center shrink-0 disabled:opacity-30 hover:opacity-80 transition-opacity"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </button>
                            </form>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">
                                Answers are scoped to your authorized data only.
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
