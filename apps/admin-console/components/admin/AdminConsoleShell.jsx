"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    BarChart3,
    Building2,
    Users,
    User,
    Calendar,
    Settings,
    ShieldAlert,
    Clock,
    Activity,
    LogOut,
    Bell,
    Search,
    ChevronRight,
    ShieldCheck,
    Ticket,
    CreditCard,
    RefreshCcw,
    X,
    CheckSquare,
    History,
    AlertTriangle
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import AdminGuard from "@/components/admin/AdminGuard";

// Internal icon for Zap if not imported correctly
const Zap = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 14.71 13 4l-1 8h8l-9 10.71 1-8h-8z" /></svg>
);

const sidebarItems = [
    { label: "Overview", href: "/", icon: BarChart3, minRole: 'support' },
    { label: "Approvals", href: "/approvals", icon: CheckSquare, minRole: 'support' },
    { label: "Users", href: "/users", icon: User, minRole: 'support' },


    { label: "Venues", href: "/venues", icon: Building2, minRole: 'ops' },
    { label: "Hosts", href: "/hosts", icon: Users, minRole: 'ops' },
    { label: "Promoters", href: "/promoters", icon: Zap, minRole: 'ops' },
    { label: "Events", href: "/events", icon: Calendar, minRole: 'ops' },
    { label: "Payments", href: "/payments", icon: CreditCard, minRole: 'finance' },
    { label: "Support", href: "/support", icon: ShieldCheck, minRole: 'support' },
    { label: "Safety", href: "/safety", icon: ShieldAlert, minRole: 'content' },
    { label: "Admins", href: "/admins", icon: ShieldCheck, minRole: 'admin' },
    { label: "Settings", href: "/settings", icon: Settings, minRole: 'admin' },
    { label: "Audit Log", href: "/logs", icon: History, minRole: 'admin' },
    { label: "System Health", href: "/health", icon: Activity, minRole: 'admin' },
];

const hierarchy = {
    'super': 1000,
    'finance': 500,
    'ops': 400,
    'support': 300,
    'content': 200,
    'readonly': 100
};

export default function AdminConsoleShell({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { profile, logout, user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [envStatus, setEnvStatus] = useState({ verified: false, isNonProd: false });
    const [alerts, setAlerts] = useState([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        if (projectId) {
            setEnvStatus({ verified: true, isNonProd: projectId !== 'thec1rcle-india' });
        }
    }, []);

    useEffect(() => {
        const fetchAlerts = async () => {
            if (!user) return;
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/snapshot', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.alerts) setAlerts(data.alerts);
            } catch (err) {
                console.error("Failed to fetch alerts", err);
            }
        };

        if (mounted) {
            fetchAlerts();
            const interval = setInterval(fetchAlerts, 60000);
            return () => clearInterval(interval);
        }
    }, [user, mounted]);

    const handleSearch = async (e) => {
        if (e.key === 'Enter' && searchQuery.length >= 3) {
            setIsSearching(true);
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/lookup?q=${encodeURIComponent(searchQuery)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Search failed");
                const json = await res.json();
                setSearchResults(json.results || []);
            } catch (err) {
                console.error("Lookup failed", err);
            } finally {
                setIsSearching(false);
            }
        }
    };

    if (!mounted) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-6">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">Booting Authority Node</p>
                </div>
            </div>
        );
    }

    const isLoginPage = pathname === "/login";
    const userRoleValue = hierarchy[profile?.admin_role] || (profile?.role === 'admin' ? 100 : 0);
    const filteredItems = sidebarItems.filter(item => {
        const requiredValue = hierarchy[item.minRole] || 100;
        return userRoleValue >= requiredValue;
    });

    if (isLoginPage) {
        return <AdminGuard>{children}</AdminGuard>;
    }

    return (
        <AdminGuard>
            <div className="flex bg-[#F8FAFC] text-slate-900 font-sans min-h-screen">
                <aside className="w-[320px] min-w-[320px] fixed inset-y-0 left-0 border-r border-slate-200 bg-white z-20 flex flex-col">
                    <div className="p-10 border-b border-slate-50 flex-shrink-0">
                        <Link href="/" className="flex items-center gap-4 group">
                            <div className="h-10 w-10 rounded-[1rem] bg-slate-900 flex items-center justify-center transition-transform duration-500 group-hover:rotate-12">
                                <div className="h-4 w-4 rounded-full bg-white"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black tracking-tighter text-xl text-slate-900 italic leading-none">THE C1RCLE</span>
                                <span className="text-[9px] uppercase opacity-40 font-black tracking-[0.3em] mt-1 leading-none">Admin Panel</span>
                            </div>
                        </Link>
                    </div>

                    <nav className="flex-1 px-6 space-y-1 overflow-y-auto py-6 custom-scrollbar">
                        {filteredItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-4 px-6 py-3.5 rounded-[1.25rem] transition-all duration-500 group ${isActive
                                        ? "bg-slate-900 text-white shadow-xl shadow-slate-200"
                                        : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                >
                                    <Icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "group-hover:scale-110 group-hover:text-indigo-600 transition-all opacity-80"}`} />
                                    <span className="font-black text-[12px] tracking-tight uppercase tracking-widest leading-none">{item.label}</span>
                                    {isActive && (
                                        <div className="ml-auto">
                                            <ChevronRight className="h-4 w-4 text-white/40" />
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-6 border-t border-slate-100 space-y-4 flex-shrink-0">
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-4 px-6 py-3 rounded-2xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-500 font-black text-[10px] uppercase tracking-widest"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>System Exit</span>
                        </button>

                        <div className="p-4 rounded-[2rem] bg-slate-50 border border-slate-100 group hover:bg-white hover:border-indigo-100 transition-all duration-500">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-xs font-black text-slate-900 group-hover:scale-110 transition-transform">
                                    {profile?.displayName?.[0] || 'A'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black truncate text-slate-900 leading-none mb-1">{profile?.displayName || "Admin"}</p>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
                                        <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black leading-none">{profile?.admin_role || "Super"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <div className="flex-1 ml-[320px] flex flex-col relative">
                    <header className="h-20 flex items-center justify-between px-12 z-30 sticky top-0 bg-[#F8FAFC]/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm shadow-slate-200/10">
                        <div className="flex items-center gap-6">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                                {pathname?.replace('/', '').replace('admin', 'Intelligence').replace('-', ' ') || 'Overview'}
                            </span>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="relative hidden lg:block group">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Execute registry lookup..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearch}
                                    className="bg-slate-100/50 border border-slate-200/50 rounded-2xl pl-14 pr-6 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:bg-white w-[380px] transition-all font-semibold placeholder:text-slate-300"
                                />
                                {isSearching && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <RefreshCcw className="h-4 w-4 text-slate-400 animate-spin" />
                                    </div>
                                )}
                            </div>

                            <button className="relative p-3.5 rounded-2xl bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-100 transition-all group">
                                <Bell className={`h-5 w-5 ${alerts.length > 0 ? 'text-indigo-600' : 'text-slate-400'} group-hover:text-slate-900 transition-colors`} />
                                {alerts.length > 0 && (
                                    <span className="absolute top-3.5 right-3.5 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
                                    </span>
                                )}
                            </button>
                        </div>
                    </header>

                    {searchResults && (
                        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSearchResults(null)}>
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl w-full max-w-[600px] overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <Search className="h-4 w-4 text-indigo-600" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registry Results: {searchResults.length}</span>
                                    </div>
                                    <button onClick={() => setSearchResults(null)} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-slate-200">
                                        <X className="h-4 w-4 text-slate-400" />
                                    </button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
                                    {searchResults.length > 0 ? (
                                        <div className="space-y-2">
                                            {searchResults.map((result, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-5 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all cursor-pointer group flex items-center gap-6"
                                                    onClick={() => {
                                                        const routeMap = {
                                                            'user': `/users?id=${result.id}`,
                                                            'venue': `/venues?id=${result.id}`,
                                                            'host': `/hosts?id=${result.id}`,
                                                            'promoter': `/promoters?id=${result.id}`,
                                                            'event': `/events?id=${result.id}`,
                                                            'order': `/payments?id=${result.id}`
                                                        };
                                                        router.push(routeMap[result.type] || '/');
                                                        setSearchResults(null);
                                                        setSearchQuery("");
                                                    }}
                                                >
                                                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                                                        {result.type === 'user' && <UserRound className="h-5 w-5" />}
                                                        {result.type === 'venue' && <Building2 className="h-5 w-5" />}
                                                        {result.type === 'host' && <Users className="h-5 w-5" />}
                                                        {result.type === 'promoter' && <Zap className="h-5 w-5" />}
                                                        {result.type === 'event' && <Calendar className="h-5 w-5" />}
                                                        {result.type === 'order' && <Ticket className="h-5 w-5" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">{result.type}</span>
                                                            <h4 className="text-sm font-black text-slate-900">{result.displayName || result.name || result.email || result.id}</h4>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-tighter">ID: {result.id}</p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-slate-200 group-hover:text-slate-400 transition-transform group-hover:translate-x-1" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">No registry entries found.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                                    <p className="text-[9px] text-slate-400 font-bold italic tracking-tight">Full-text registry index updated in real-time.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <main className="flex-1 px-12 pt-12 pb-24 relative">
                        <div className="fixed top-0 right-0 w-[1000px] h-[1000px] bg-indigo-50/20 blur-[200px] -z-10 rounded-full pointer-events-none" />
                        <div className="fixed bottom-0 left-[320px] w-[600px] h-[600px] bg-emerald-50/20 blur-[150px] -z-10 rounded-full pointer-events-none" />

                        <div className="max-w-[1440px] mx-auto w-full">
                            {envStatus.isNonProd && (
                                <div className="mb-8 p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between group overflow-hidden relative">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="p-2 rounded-xl bg-amber-500 text-white">
                                            <AlertCircle className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-amber-900 leading-none">Non-Production Instance</h4>
                                            <p className="text-[10px] text-amber-700/80 font-bold uppercase tracking-tight mt-1">Cross-environment data drift & experimentation permitted</p>
                                        </div>
                                    </div>
                                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-amber-500 skew-x-[30deg] translate-x-12 opacity-5 flex items-center justify-center -z-0"></div>
                                </div>
                            )}
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
            `}</style>
        </AdminGuard>
    );
}
