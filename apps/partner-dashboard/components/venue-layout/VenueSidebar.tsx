import {
    LayoutDashboard,
    CalendarDays,
    GlassWater,
    Users,
    ClipboardList,
    ShieldCheck,
    Settings,
    LogOut,
    Building2,
    Armchair,
    ImageIcon,
    Activity,
    LineChart,
    UserCheck,
    Handshake,
    Inbox,
    History,
    TrendingUp,
    ShieldAlert,
    ChevronRight
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";
import { cleanJargon } from "@/lib/utils/jargon";

const MENU_GROUPS = [
    {
        label: "Management",
        items: [
            { label: "daily_dashboard", href: "/club", icon: LayoutDashboard, minPlan: "basic" },
            { label: "event_calendar", href: "/venue/calendar", icon: CalendarDays, minPlan: "basic" },
            { label: "my_events", href: "/venue/events", icon: GlassWater, minPlan: "basic" },
        ]
    },
    {
        label: "Operations",
        items: [
            { label: "security", href: "/venue/security", icon: ShieldCheck, minPlan: "silver" },
            { label: "registers", href: "/venue/registers", icon: ClipboardList, minPlan: "silver" },
            { label: "tables", href: "/venue/tables", icon: Armchair, minPlan: "gold" },
        ]
    },
    {
        label: "Partners",
        items: [
            { label: "hosts", href: "/venue/hosts", icon: UserCheck, minPlan: "diamond" },
            { label: "promoters", href: "/venue/promoters", icon: Handshake, minPlan: "diamond" },
        ]
    }
];

const PLAN_HIERARCHY: Record<string, number> = {
    'basic': 0,
    'silver': 1,
    'gold': 2,
    'diamond': 3
};

export function VenueSidebar({ className = "" }: { className?: string }) {
    const pathname = usePathname();
    const { signOut, profile, subscriptionPlan } = useDashboardAuth();

    const currentPlanLevel = PLAN_HIERARCHY[subscriptionPlan || 'basic'] ?? 0;

    const isActive = (path: string) => {
        if (path === '/club' && pathname === '/club') return true;
        if (path !== '/club' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <aside className={`flex flex-col h-full bg-obsidian-sidebar border-r border-black/[0.05] w-[300px] shrink-0 ${className}`}>
            {/* Header / Brand - Authority Node Style */}
            <div className="p-8 border-b border-black/[0.05]">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.1)]">
                        <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold text-[var(--text-primary)] text-base tracking-tight truncate">
                            {profile?.activeMembership?.partnerName || "The Circle Venue"}
                        </h1>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-[0.2em] font-bold">Venue Account</p>
                            <span className="px-1.5 py-0.5 rounded bg-black/5 text-[8px] font-bold text-black/80 uppercase border border-black/10">{subscriptionPlan || 'Basic'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Grid */}
            <nav className="flex-1 overflow-y-auto py-8 px-6 space-y-10 custom-scrollbar">
                {MENU_GROUPS.map((group, idx) => {
                    const visibleItems = group.items.filter(item => PLAN_HIERARCHY[item.minPlan] <= currentPlanLevel);
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={idx}>
                            <h3 className="px-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.3em] mb-4">
                                {cleanJargon(group.label)}
                            </h3>
                            <div className="space-y-1">
                                {visibleItems.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${active
                                                ? "bg-black/10 text-[var(--text-primary)] backdrop-blur-md border border-black/10"
                                                : "text-[var(--text-secondary)] hover:text-black hover:bg-black/5"
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <Icon className={`h-4 w-4 ${active ? "text-black" : "text-black/30 group-hover:text-black/50"}`} />
                                                <span className="text-sm font-medium tracking-tight">{cleanJargon(item.label)}</span>
                                            </div>
                                            {active && <div className="h-1 w-1 rounded-full bg-iris shadow-[0_0_10px_#F44A22]" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer / User Profile */}
            <div className="p-6 border-t border-black/[0.05]">
                <div className="flex items-center gap-4 mb-6 px-2">
                    <div className="h-9 w-9 rounded-full bg-black/5 flex items-center justify-center font-bold text-black/80 border border-black/5">
                        {profile?.displayName?.[0] || 'A'}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{profile?.displayName || 'Administrator'}</p>
                        <p className="text-[10px] font-bold text-iris uppercase tracking-widest">ActiveSession</p>
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 w-full px-5 py-3 rounded-xl text-black/50 font-medium text-sm hover:text-iris hover:bg-iris/5 transition-all"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
