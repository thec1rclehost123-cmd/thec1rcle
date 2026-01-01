"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    Building2,
    Users,
    UserRound,
    Calendar,
    CreditCard,
    Image as ImageIcon,
    Settings,
    History,
    LogOut,
    Bell,
    Search,
    ChevronRight,
    ShieldCheck
} from "lucide-react";
import AdminGuard from "../../components/admin/AdminGuard";
import { useAuth } from "@/components/providers/AuthProvider";

const sidebarItems = [
    { label: "Intelligence", href: "/admin", icon: BarChart3 },
    { label: "Venue Directory", href: "/admin/venues", icon: Building2 },
    { label: "Host Pipeline", href: "/admin/hosts", icon: UserRound },
    { label: "Promoter Network", href: "/admin/promoters", icon: Users },
    { label: "Event Monitor", href: "/admin/events", icon: Calendar },
    { label: "Financial Oversight", href: "/admin/payments", icon: CreditCard },
    { label: "Content Policy", href: "/admin/content", icon: ImageIcon },
    { label: "Identity Governance", href: "/admin/users", icon: Users },
    { label: "Authority Queue", href: "/admin/proposals", icon: ShieldCheck },
    { label: "Audit Trace", href: "/admin/logs", icon: History },
    { label: "System Config", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }) {
    const pathname = usePathname();
    const { profile, logout } = useAuth();

    return (
        <AdminGuard>
            <div className="flex bg-[#F8FAFC] text-slate-900 font-sans min-h-screen">
                {/* Fixed Sidebar - Occupies full height but content is offset */}
                <aside className="w-[320px] min-w-[320px] fixed inset-y-0 left-0 border-r border-slate-200 bg-white z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.02)] flex flex-col pt-[110px]">
                    <div className="p-10 border-b border-slate-50 flex-shrink-0">
                        <Link href="/" className="flex items-center gap-4 group">
                            <div className="h-12 w-12 rounded-[1.25rem] bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-200 transition-transform duration-500 group-hover:rotate-12">
                                <div className="h-5 w-5 rounded-full bg-white"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black tracking-tighter text-2xl text-slate-900 italic leading-none">c1rcle</span>
                                <span className="text-[10px] uppercase opacity-40 font-black tracking-[0.3em] mt-1 leading-none">Command Center</span>
                            </div>
                        </Link>
                    </div>

                    <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto py-8 custom-scrollbar">
                        {sidebarItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-4 px-6 py-4 rounded-[1.5rem] transition-all duration-500 group ${isActive
                                        ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                                        : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                >
                                    <Icon className={`h-5 w-5 ${isActive ? "text-white" : "group-hover:scale-110 group-hover:text-indigo-600 transition-all opacity-80"}`} />
                                    <span className="font-black text-[13px] tracking-tight uppercase tracking-widest leading-none">{item.label}</span>
                                    {isActive && (
                                        <div className="ml-auto">
                                            <ChevronRight className="h-4 w-4 text-white/40" />
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-8 border-t border-slate-100 space-y-6 flex-shrink-0">
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-500 font-black text-[11px] uppercase tracking-widest"
                        >
                            <LogOut className="h-5 w-5" />
                            <span>Internal Exit</span>
                        </button>

                        <div className="p-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 shadow-inner group hover:bg-white hover:border-indigo-100 transition-all duration-500">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center text-sm font-black text-slate-900 group-hover:scale-110 transition-transform">
                                    {profile?.displayName?.[0] || "A"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black truncate text-slate-900 leading-none mb-1.5">{profile?.displayName || "Admin"}</p>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black leading-none">{profile?.admin_role || "Super"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Workspace - Offset by sidebar width */}
                <div className="flex-1 ml-[320px] flex flex-col pt-[110px]">
                    {/* Top Console - Sticky actions area */}
                    <div className="h-24 flex items-center justify-between px-12 z-10 sticky top-[110px]">
                        <div className="flex items-center gap-6">
                            {/* Path Indicator */}
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
                                {pathname?.replace('/admin/', '').replace('/admin', 'Intelligence').replace('-', ' ')}
                            </span>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="relative hidden lg:block group">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Execute registry lookup..."
                                    className="bg-white border border-slate-200 pl-14 pr-8 py-3.5 rounded-[1.2rem] text-sm w-80 focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-300 transition-all font-semibold placeholder:text-slate-300 shadow-sm"
                                />
                            </div>

                            <div className="flex items-center gap-6">
                                <button className="relative p-3.5 rounded-2xl bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-100 transition-all group">
                                    <Bell className="h-5 w-5 text-slate-400 group-hover:text-slate-900 transition-colors" />
                                    <span className="absolute top-3.5 right-3.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                                </button>
                                <div className="h-10 w-[1px] bg-slate-200 mx-2"></div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1.5">{profile?.displayName}</p>
                                    <div className="flex items-center justify-end gap-2">
                                        <ShieldCheck className="h-3 w-3 text-indigo-600" />
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black leading-none">Access Authorized</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Canvas Scroll Area */}
                    <main className="flex-1 px-12 pb-24 relative">
                        {/* Static Textures in Canvas background */}
                        <div className="fixed top-0 right-0 w-[1000px] h-[1000px] bg-indigo-50/20 blur-[200px] -z-10 rounded-full pointer-events-none" />
                        <div className="fixed bottom-0 left-[320px] w-[600px] h-[600px] bg-emerald-50/20 blur-[150px] -z-10 rounded-full pointer-events-none" />

                        <div className="max-w-[1440px] mx-auto w-full">
                            {children}
                        </div>
                    </main>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #E2E8F0;
                  border-radius: 20px;
                  border: 2px solid #F8FAFC;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #CBD5E1;
                }
                /* Ensure no horizontal scroll */
                body {
                    overflow-x: hidden;
                }
            `}</style>

        </AdminGuard>
    );
}
