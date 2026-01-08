"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Ticket,
    Link as LinkIcon,
    TrendingUp,
    Users,
    Wallet,
    UserCircle,
    LogOut,
    Bell,
    Settings,
    Shield,
    Zap,
    DollarSign,
    Handshake,
    BarChart3,
    Activity
} from "lucide-react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";

export default function PromoterSidebar() {
    const pathname = usePathname();
    const { signOut, profile } = useDashboardAuth();

    const menuItems = [
        {
            category: "Analytics Studio",
            items: [
                { icon: Activity, label: "Overview", href: "/promoter/analytics/overview" },
                { icon: TrendingUp, label: "Reach", href: "/promoter/analytics/reach" },
                { icon: Zap, label: "Engagement", href: "/promoter/analytics/engagement" },
                { icon: DollarSign, label: "Revenue", href: "/promoter/analytics/revenue" },
                { icon: Users, label: "Audience", href: "/promoter/analytics/audience" },
                { icon: Handshake, label: "Attribution", href: "/promoter/analytics/attribution" },
            ]
        },
        {
            category: "Earnings",

            items: [
                { icon: LayoutDashboard, label: "Overview", href: "/promoter" },
                { icon: TrendingUp, label: "My Stats", href: "/promoter/stats" },
                { icon: Wallet, label: "Payouts", href: "/promoter/payouts" },
            ]
        },
        {
            category: "Sales Tools",
            items: [
                { icon: Ticket, label: "Events", href: "/promoter/events" },
                { icon: LinkIcon, label: "My Links", href: "/promoter/links" },
                { icon: Users, label: "Buyers List", href: "/promoter/guests" },
            ]
        },
        {
            category: "Account",
            items: [
                { icon: Settings, label: "Settings", href: "/promoter/settings" },
            ]
        }
    ];

    const isActive = (path: string) => {
        if (path === '/promoter' && pathname === '/promoter') return true;
        if (path !== '/promoter' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 overflow-hidden z-50">
            {/* Brand Header */}
            <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                        P
                    </div>
                    <div>
                        <h1 className="font-extrabold text-slate-900 tracking-tight leading-none text-lg">C1RCLE</h1>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SALES DASHBOARD</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-6 px-3 space-y-7">
                {menuItems.map((section, idx) => (
                    <div key={idx}>
                        <h3 className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            {section.category}
                        </h3>
                        <div className="space-y-0.5">
                            {section.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive(item.href)
                                        ? "bg-emerald-50 text-emerald-700 font-bold"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    <item.icon className={`w-5 h-5 ${isActive(item.href) ? "text-emerald-600" : "text-slate-400"}`} />
                                    <span className="text-[15px]">{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Account */}
            <div className="p-4 border-t border-slate-100">
                <div className="mb-4 px-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Connected As</p>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {profile?.displayName?.charAt(0) || "U"}
                        </div>
                        <p className="text-xs font-bold text-slate-700 truncate">{profile?.displayName || "Promoter"}</p>
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                </button>
            </div>
        </aside>
    );
}
