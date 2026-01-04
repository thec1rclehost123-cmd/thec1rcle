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

const MENU_GROUPS = [
    {
        label: "Management",
        items: [
            { label: "Daily Dashboard", href: "/club", icon: LayoutDashboard, minPlan: "basic" },
            { label: "Event Calendar", href: "/club/calendar", icon: CalendarDays, minPlan: "basic" },
            { label: "My Events", href: "/club/events", icon: GlassWater, minPlan: "basic" },
        ]
    },
    {
        label: "Operations",
        items: [
            { label: "Entry & Security", href: "/club/security", icon: ShieldCheck, minPlan: "silver" },
            { label: "Nightly Logs", href: "/club/registers", icon: ClipboardList, minPlan: "silver" },
            { label: "Tables & VIP", href: "/club/tables", icon: Armchair, minPlan: "gold" },
        ]
    },
    {
        label: "Partners",
        items: [
            { label: "Host List", href: "/club/hosts", icon: UserCheck, minPlan: "diamond" },
            { label: "Promoter List", href: "/club/promoters", icon: Handshake, minPlan: "diamond" },
        ]
    }
];

const PLAN_HIERARCHY: Record<string, number> = {
    'basic': 0,
    'silver': 1,
    'gold': 2,
    'diamond': 3
};

export function ClubSidebar({ className = "" }: { className?: string }) {
    const pathname = usePathname();
    const { signOut, profile, subscriptionPlan } = useDashboardAuth();

    const currentPlanLevel = PLAN_HIERARCHY[subscriptionPlan || 'basic'] ?? 0;

    const isActive = (path: string) => {
        if (path === '/club' && pathname === '/club') return true;
        if (path !== '/club' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <aside className={`flex flex-col h-full bg-white border-r border-slate-200 ${className}`}>
            {/* Header / Brand */}
            <div className="p-8 border-b border-slate-50">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[1rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100">
                        <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-extrabold text-slate-900 text-lg tracking-tight truncate">
                            {profile?.activeMembership?.partnerName || "The Circle Venue"}
                        </h1>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Venue Control OS</p>
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-[8px] font-black text-amber-600 uppercase border border-amber-100">{subscriptionPlan || 'Basic'}</span>
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
                            <h3 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                {group.label}
                            </h3>
                            <div className="space-y-1">
                                {visibleItems.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group ${active
                                                ? "bg-emerald-600 text-white shadow-xl shadow-emerald-100"
                                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <Icon className={`h-5 w-5 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-900"}`} />
                                                <span className="text-sm font-bold">{item.label}</span>
                                            </div>
                                            {active && <ChevronRight className="h-4 w-4 text-emerald-200" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer / User Profile */}
            <div className="p-6 border-t border-slate-50">
                <div className="flex items-center gap-4 mb-6 px-2">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 border border-slate-200">
                        {profile?.displayName?.[0] || 'A'}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{profile?.displayName || 'Administrator'}</p>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Shift</p>
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl text-slate-400 font-bold text-sm hover:text-rose-600 hover:bg-rose-50 transition-all"
                >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
