"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { BarChart2, Ticket, Users, Shield, Settings, ChevronLeft } from "lucide-react";

const TABS = [
    { key: "analytics",    label: "Event Analytics",  icon: BarChart2 },
    { key: "ticket-types", label: "Ticket Types",      icon: Ticket    },
    { key: "attendees",    label: "Event Attendees",   icon: Users     },
    { key: "team",         label: "Event Team",        icon: Shield    },
    { key: "settings",     label: "Event Settings",    icon: Settings  },
] as const;

export default function EventSubNav() {
    const { id } = useParams<{ id: string }>();
    const pathname = usePathname();

    const activeKey = TABS.find(t => pathname.includes(`/${t.key}`))?.key ?? "analytics";

    return (
        <div
            className="sticky top-0 z-20 px-4 sm:px-6 lg:px-10"
            style={{
                borderBottom: "1px solid var(--v-border)",
                background: "var(--v-canvas)",
            }}
        >
            <div className="flex items-center gap-3 py-2.5 overflow-x-auto scrollbar-hide">
                {/* Back link */}
                <Link
                    href="/venue/events"
                    className="flex items-center gap-1 shrink-0 text-[13px] font-medium transition-colors"
                    style={{ color: "var(--v-text-tertiary)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--v-text-primary)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--v-text-tertiary)")}
                >
                    <ChevronLeft size={14} />
                    Events
                </Link>

                {/* Divider */}
                <div
                    className="shrink-0 w-px h-5"
                    style={{ background: "var(--v-border)" }}
                />

                {/* Tabs */}
                <div className="flex items-center gap-1.5">
                    {TABS.map(({ key, label, icon: Icon }) => {
                        const isActive = activeKey === key;
                        return (
                            <Link
                                key={key}
                                href={`/venue/events/${id}/${key}`}
                                className="group flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-semibold whitespace-nowrap transition-all duration-150"
                                style={
                                    isActive
                                        ? {
                                              background: "var(--v-elevated)",
                                              color: "#ffffff",
                                              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                                              minWidth: "max-content",
                                          }
                                        : {
                                              color: "var(--v-text-secondary)",
                                              minWidth: "max-content",
                                          }
                                }
                                onMouseEnter={e => {
                                    if (!isActive) {
                                        (e.currentTarget as HTMLElement).style.background = "var(--v-card)";
                                        (e.currentTarget as HTMLElement).style.color = "var(--v-text-primary)";
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!isActive) {
                                        (e.currentTarget as HTMLElement).style.background = "transparent";
                                        (e.currentTarget as HTMLElement).style.color = "var(--v-text-secondary)";
                                    }
                                }}
                            >
                                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
