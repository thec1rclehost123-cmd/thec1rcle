"use client";

import { Monitor, Smartphone, Loader2, LogOut, ShieldX } from "lucide-react";
import type { LoginSession } from "@/lib/server/hostSettingsStore";

interface SessionListProps {
    sessions: LoginSession[];
    currentSessionId: string;
    onRevoke: (sessionId: string) => Promise<void>;
    onRevokeAll: () => Promise<void>;
    isRevoking: boolean;
}

function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return rtf.format(-Math.floor(ms / 60_000), "minute");
    if (ms < 86_400_000) return rtf.format(-Math.floor(ms / 3_600_000), "hour");
    return rtf.format(-Math.floor(ms / 86_400_000), "day");
}

function parseBrowser(ua: string | null): string {
    if (!ua) return "Unknown Browser";
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    if (ua.includes("Edg")) return "Edge";
    return "Browser";
}

function parseOS(ua: string | null): string {
    if (!ua) return "";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac OS")) return "macOS";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("Linux")) return "Linux";
    return "";
}

export default function SessionList({
    sessions,
    currentSessionId,
    onRevoke,
    onRevokeAll,
    isRevoking,
}: SessionListProps) {
    const otherSessions = sessions.filter(s => s.sessionId !== currentSessionId);
    const currentSession = sessions.find(s => s.sessionId === currentSessionId);

    return (
        <div className="space-y-4">
            {/* Current session */}
            {currentSession && (
                <div className="p-4 rounded-[1.5rem] border-2 space-y-2"
                    style={{ borderColor: "var(--v-orange)", background: "var(--v-card)" }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {currentSession.deviceType === "mobile"
                                ? <Smartphone className="w-4 h-4" style={{ color: "var(--v-orange)" }} />
                                : <Monitor className="w-4 h-4" style={{ color: "var(--v-orange)" }} />
                            }
                            <div>
                                <p className="text-xs font-black" style={{ color: "var(--v-text-primary)" }}>
                                    {parseBrowser(currentSession.userAgent)}
                                    {parseOS(currentSession.userAgent) ? ` on ${parseOS(currentSession.userAgent)}` : ""}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                                    Active {relativeTime(currentSession.lastActiveAt)}
                                </p>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500">
                            Current
                        </span>
                    </div>
                </div>
            )}

            {/* Other sessions */}
            {otherSessions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: "var(--v-text-tertiary)" }}>
                        Other Active Sessions
                    </p>
                    {otherSessions.map(session => (
                        <div key={session.sessionId}
                            className="p-4 rounded-[1.5rem] border flex items-center justify-between"
                            style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}>
                            <div className="flex items-center gap-3">
                                {session.deviceType === "mobile"
                                    ? <Smartphone className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                                    : <Monitor className="w-4 h-4" style={{ color: "var(--v-text-tertiary)" }} />
                                }
                                <div>
                                    <p className="text-xs font-black" style={{ color: "var(--v-text-primary)" }}>
                                        {parseBrowser(session.userAgent)}
                                        {parseOS(session.userAgent) ? ` on ${parseOS(session.userAgent)}` : ""}
                                    </p>
                                    <p className="text-[10px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                                        Active {relativeTime(session.lastActiveAt)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => onRevoke(session.sessionId)}
                                disabled={isRevoking}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)" }}
                            >
                                {isRevoking
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <ShieldX className="w-3 h-3" />
                                }
                                Revoke
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {sessions.length === 0 && (
                <div className="py-8 text-center" style={{ color: "var(--v-text-tertiary)" }}>
                    <Monitor className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold">No active sessions found</p>
                </div>
            )}

            {/* Sign out all other devices */}
            {otherSessions.length > 0 && (
                <button
                    onClick={onRevokeAll}
                    disabled={isRevoking}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[1.5rem] border transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    style={{ borderColor: "var(--v-border)", color: "var(--v-text-secondary)", background: "transparent" }}
                >
                    {isRevoking
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <LogOut className="w-3.5 h-3.5" />
                    }
                    Sign Out All Other Devices
                </button>
            )}
        </div>
    );
}
