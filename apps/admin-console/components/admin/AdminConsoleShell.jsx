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
    { label: "Discovery", href: "/content/explore", icon: Calendar, minRole: 'ops' },
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

    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                document.querySelector('input[placeholder="Search..."]')?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    if (!mounted) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-6">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">Starting Admin Panel</p>
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
            <div className="flex bg-obsidian-base text-zinc-100 font-sans min-h-screen selection:bg-iris/30 selection:text-white">
                <aside className="w-[300px] min-w-[300px] fixed inset-y-0 left-0 border-r border-[#ffffff08] bg-obsidian-sidebar z-20 flex flex-col">
                    {/* Workspace Switcher */}
                    <div className="p-4 border-b border-[#ffffff08] flex-shrink-0">
                        <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center shadow-lg shadow-white/10">
                                    <div className="h-3.5 w-3.5 rounded-full bg-black"></div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-lg font-black tracking-tighter leading-none text-white">THE C1RCLE</span>
                                    <span className="text-[9px] text-zinc-500 font-bold mt-1.5 uppercase tracking-widest leading-none opacity-80">Authority Node</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="h-3 w-3 -rotate-90" />
                                <ChevronRight className="h-3 w-3 rotate-90 -mt-1" />
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-4 custom-scrollbar">
                        {filteredItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                                        ? "bg-white/10 text-white shadow-sm"
                                        : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                                        }`}
                                >
                                    <Icon className={`h-5 w-5 ${isActive ? "text-white" : "opacity-60 group-hover:opacity-100 transition-opacity"}`} strokeWidth={1.5} />
                                    <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap">{item.label}</span>
                                    {isActive && (
                                        <div className="ml-auto">
                                            <div className="h-1 w-1 rounded-full bg-white opacity-40" />
                                        </div>
                                    )}
                                </Link>
                            );
                        })}


                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-[#ffffff08] space-y-3 flex-shrink-0 bg-obsidian-sidebar/50">
                        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                            <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-200 border border-white/5">
                                {profile?.displayName?.[0] || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate text-white leading-none mb-1">{profile?.displayName || "Admin"}</p>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-1 w-1 rounded-full bg-emerald-500"></div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold leading-none">{profile?.admin_role || "Super"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <div className="flex-1 ml-[300px] flex flex-col relative bg-obsidian-base">
                    <header className="h-16 flex items-center justify-between px-8 z-30 sticky top-0 bg-obsidian-base/80 backdrop-blur-xl border-b border-[#ffffff05]">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
                                {pathname === '/' ? 'Insights' :
                                    pathname === '/logs' ? 'Audit Ledger' :
                                        pathname === '/approvals' ? 'Partner Queue' :
                                            pathname?.replace('/', '').replace('-', ' ')}
                            </span>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="relative hidden lg:block group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearch}
                                    className="bg-zinc-900/50 border border-white/5 rounded-md pl-10 pr-12 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 w-[240px] transition-all font-medium placeholder:text-zinc-600"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                                    <div className="h-5 w-5 rounded bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-500">/</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Bell
                                        onClick={() => setShowNotifications(!showNotifications)}
                                        className={`h-4.5 w-4.5 cursor-pointer ${alerts.length > 0 ? 'text-iris animate-pulse-glow' : 'text-zinc-500'} hover:text-white transition-colors`}
                                    />
                                    {showNotifications && (
                                        <div className="absolute right-0 mt-4 w-80 bg-obsidian-surface border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Security Feed</span>
                                                <span className="px-2 py-0.5 rounded bg-iris/10 text-iris text-[9px] font-bold uppercase">{alerts.length} Flagged</span>
                                            </div>
                                            <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                                {alerts.length > 0 ? alerts.map((alert, i) => (
                                                    <div key={i} className="p-4 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                                        <div className="flex gap-3">
                                                            <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${alert.priority === 'high' ? 'bg-iris' : 'bg-amber-500'}`}></div>
                                                            <div className="flex-1">
                                                                <p className="text-xs text-white font-medium mb-1 leading-relaxed">{alert.message}</p>
                                                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest leading-none">Priority: {alert.priority}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="p-12 text-center">
                                                        <ShieldCheck className="h-8 w-8 text-zinc-800 mx-auto mb-3" strokeWidth={1} />
                                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">System Sanitized</p>
                                                    </div>
                                                )}
                                            </div>
                                            {alerts.length > 0 && (
                                                <Link href="/approvals" onClick={() => setShowNotifications(false)} className="block p-3 text-center bg-white/[0.02] hover:bg-white/[0.05] transition-colors border-t border-white/5">
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors">Clear All Log Entries</span>
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="h-4 w-px bg-white/5" />
                                <button onClick={logout} className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-white transition-colors">Log Out</button>
                            </div>
                        </div>
                    </header>

                    {searchResults && (
                        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSearchResults(null)}>
                            <div className="bg-obsidian-surface rounded-xl border border-[#ffffff08] shadow-2xl w-full max-w-[600px] overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="p-4 border-b border-[#ffffff08] flex items-center justify-between bg-white/[0.02]">
                                    <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Search Results: {searchResults.length}</span>
                                    </div>
                                    <button onClick={() => setSearchResults(null)} className="p-1.5 hover:bg-white/5 rounded-md transition-colors border border-transparent hover:border-white/5">
                                        <X className="h-4 w-4 text-zinc-500" />
                                    </button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                                    {searchResults.length > 0 ? (
                                        <div className="space-y-0.5">
                                            {searchResults.map((result, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-3 hover:bg-white/[0.03] rounded-lg border border-transparent transition-all cursor-pointer group flex items-center gap-4"
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
                                                    <div className="h-9 w-9 rounded-md bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:border-white/10 transition-all">
                                                        {result.type === 'user' && <User className="h-4.5 w-4.5" strokeWidth={1.5} />}
                                                        {result.type === 'venue' && <Building2 className="h-4.5 w-4.5" strokeWidth={1.5} />}
                                                        {result.type === 'host' && <Users className="h-4.5 w-4.5" strokeWidth={1.5} />}
                                                        {result.type === 'promoter' && <Zap className="h-4.5 w-4.5" strokeWidth={1.5} />}
                                                        {result.type === 'event' && <Calendar className="h-4.5 w-4.5" strokeWidth={1.5} />}
                                                        {result.type === 'order' && <Ticket className="h-4.5 w-4.5" strokeWidth={1.5} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-[#A1A1AA] bg-white/5 px-1.5 py-0.5 rounded-sm">{result.type}</span>
                                                            <h4 className="text-sm font-semibold text-white truncate">{result.displayName || result.name || result.email || result.id}</h4>
                                                        </div>
                                                        <p className="text-[10px] text-zinc-500 font-medium mt-0.5 truncate uppercase tracking-tight">ID: {result.id}</p>
                                                    </div>
                                                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-transform group-hover:translate-x-1" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center">
                                            <AlertTriangle className="h-8 w-8 text-zinc-800 mx-auto mb-3" strokeWidth={1.5} />
                                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">No results found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <main className="flex-1 px-8 pt-8 pb-24 relative">
                        <div className="max-w-[1440px] mx-auto w-full">
                            {envStatus.isNonProd && (
                                <div className="mb-8 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between group overflow-hidden relative">
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <div>
                                            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-500 leading-none">Development Node</h4>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {children}
                        </div>
                    </main>
                </div>
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </AdminGuard>
    );
}
