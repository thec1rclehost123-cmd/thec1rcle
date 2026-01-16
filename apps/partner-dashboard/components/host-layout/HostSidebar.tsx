"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    CalendarDays,
    PlusCircle,
    BarChart3,
    Users,
    Handshake,
    UserCircle,
    Settings,
    LogOut,
    ShieldCheck,
    Bell,
    Star,
    Layout
} from "lucide-react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import { cleanJargon } from "@/lib/utils/jargon";

export default function HostSidebar() {
    const pathname = usePathname();
    const { signOut, profile } = useDashboardAuth();

    const menuItems = [
        {
            category: "management",
            items: [
                { icon: LayoutDashboard, label: "overview", href: "/host" },
                { icon: BarChart3, label: "analytics", href: "/host/analytics" },
            ]
        },
        {
            category: "events",
            items: [
                { icon: CalendarDays, label: "my_events", href: "/host/events" },
                { icon: PlusCircle, label: "create", href: "/host/create" },
                { icon: ShieldCheck, label: "security", href: "/host/ops" },
            ]
        },
        {
            category: "network",
            items: [
                { icon: Users, label: "promoters", href: "/host/promoters" },
                { icon: Handshake, label: "venues", href: "/host/venues" },
            ]
        },
        {
            category: "personal",
            items: [
                { icon: Layout, label: "profile", href: "/host/page" },
                { icon: Settings, label: "settings", href: "/host/settings" },
            ]
        }
    ];

    const isActive = (path: string) => {
        if (path === '/host' && pathname === '/host') return true;
        if (path !== '/host' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <aside className="w-[300px] bg-obsidian-sidebar border-r border-black/[0.05] flex flex-col h-screen fixed left-0 top-0 overflow-hidden z-50 shrink-0">
            {/* Brand Header - Authority Node Style */}
            <div className="p-8 border-b border-black/[0.05]">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.1)]">
                        <UserCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold text-[var(--text-primary)] text-base tracking-tight truncate">C1RCLE</h1>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] font-bold">Host Account</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-8 px-6 space-y-10 custom-scrollbar">
                {menuItems.map((section, idx) => (
                    <div key={idx}>
                        <h3 className="px-3 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.3em] mb-4">
                            {cleanJargon(section.category)}
                        </h3>
                        <div className="space-y-1">
                            {section.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isActive(item.href)
                                        ? "bg-black/10 text-[var(--text-primary)] backdrop-blur-md border border-black/10"
                                        : "text-[var(--text-secondary)] hover:text-black hover:bg-black/5"
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <item.icon className={`w-4 h-4 ${isActive(item.href) ? "text-black" : "text-black/30 group-hover:text-black/50"}`} />
                                        <span className="text-sm font-medium tracking-tight">{cleanJargon(item.label)}</span>
                                    </div>
                                    {isActive(item.href) && <div className="h-1 w-1 rounded-full bg-iris shadow-[0_0_10px_#F44A22]" />}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Account */}
            <div className="p-6 border-t border-black/[0.05]">
                <div className="mb-6 px-2">
                    <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">Your Account</p>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center text-[11px] font-bold text-black/80 border border-black/5">
                            {profile?.displayName?.charAt(0) || "U"}
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{profile?.displayName || "User"}</p>
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 px-5 py-3 w-full rounded-xl text-black/50 hover:bg-iris/5 hover:text-iris transition-all font-medium text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                </button>
            </div>
        </aside>
    );
}
