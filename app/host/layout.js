"use client";

import { useAuth } from "../../components/providers/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Menu,
    X,
    Search,
    Bell,
    ChevronDown,
    Command,
    LogOut,
    Settings,
    HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationDropdown from "../../components/host/NotificationDropdown";

export default function HostLayout({ children }) {
    const { user, profile, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login?next=/host");
        }
    }, [user, loading, router]);

    if (loading) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#5D5FEF]/20 border-t-[#5D5FEF] rounded-full animate-spin" />
        </div>
    );

    if (!user) return null;

    const navItems = [
        { label: "Overview", href: "/host" },
        { label: "Events", href: "/host/events" },
        { label: "Audience", href: "/host/audience" },
        { label: "Bookings", href: "/host/bookings" },
        { label: "Marketing", href: "/host/marketing" },
        { label: "Finance", href: "/host/finance" },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#F44A22] selection:text-white flex flex-col overflow-hidden relative">

            {/* Background Grid Pattern - Adds Structure */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-[#F44A22]/10 rounded-full blur-[120px]" />
            </div>

            {/* Top Navigation Bar - Anchored & Glassmorphic - Scaled Up */}
            <header className="h-28 px-8 lg:px-12 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/[0.08]">
                {/* Left: Brand & Nav */}
                <div className="flex items-center gap-16">
                    <Link href="/" className="flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F44A22] to-[#FF6B4A] flex items-center justify-center shadow-[0_0_25px_-5px_rgba(244,74,34,0.5)]">
                            <span className="font-heading font-black text-white text-xl">C1</span>
                        </div>
                        <div className="hidden md:block">
                            <span className="font-heading text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70 tracking-widest block leading-none mb-1 drop-shadow-lg">
                                THE C1RCLE
                            </span>
                            <span className="text-[10px] font-bold text-[#666] uppercase tracking-[0.4em] ml-1">
                                Host Studio
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center gap-1.5 bg-white/[0.03] p-1.5 rounded-full border border-white/[0.05]">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`relative px-8 py-3 rounded-full text-base font-bold transition-all duration-300 ${isActive
                                        ? "bg-[#F44A22] text-white shadow-lg shadow-[#F44A22]/20"
                                        : "text-[#888] hover:text-white hover:bg-white/[0.05]"
                                        }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: Actions & Profile */}
                <div className="flex items-center gap-8">
                    {/* Global Search */}
                    <div className="hidden xl:flex items-center gap-4 px-5 py-3.5 bg-[#111] rounded-2xl border border-white/[0.05] w-80 focus-within:border-[#F44A22]/50 focus-within:bg-[#161616] transition-all group">
                        <Search className="w-5 h-5 text-[#666] group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Search anything..."
                            className="bg-transparent border-none outline-none text-base text-white placeholder:text-[#444] w-full font-medium"
                        />
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.05] border border-white/[0.05]">
                            <Command className="w-3.5 h-3.5 text-[#666]" />
                            <span className="text-[10px] font-bold text-[#666]">K</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 pl-8 border-l border-white/[0.08]">
                        <NotificationDropdown />

                        {/* Profile Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-4 pl-2 pr-1 py-1 rounded-full hover:bg-white/[0.05] transition-all border border-transparent hover:border-white/[0.05]"
                            >
                                <div className="text-right hidden md:block">
                                    <p className="text-base font-bold text-white leading-none mb-1.5">{profile.displayName}</p>
                                    <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Admin</p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-[#1A1A1A] border border-white/[0.1] flex items-center justify-center overflow-hidden">
                                    {profile.photoURL ? (
                                        <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-base font-bold text-white">{profile.displayName?.[0]}</span>
                                    )}
                                </div>
                            </button>

                            <AnimatePresence>
                                {isProfileOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-4 w-72 bg-[#111] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden z-50"
                                    >
                                        <div className="p-6 border-b border-white/[0.05]">
                                            <p className="text-base font-bold text-white">Signed in as</p>
                                            <p className="text-sm text-[#888] truncate mt-1">{profile.email}</p>
                                        </div>
                                        <div className="p-3 space-y-1">
                                            <Link href="/host/settings" className="flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-[#ccc] hover:text-white hover:bg-white/[0.05] transition-colors">
                                                <Settings className="w-5 h-5" />
                                                Settings
                                            </Link>
                                            <button className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-[#ccc] hover:text-white hover:bg-white/[0.05] transition-colors">
                                                <HelpCircle className="w-5 h-5" />
                                                Support
                                            </button>
                                            <div className="h-px bg-white/[0.05] my-2" />
                                            <button
                                                onClick={logout}
                                                className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-[#FF4B55] hover:bg-[#FF4B55]/10 transition-colors"
                                            >
                                                <LogOut className="w-5 h-5" />
                                                Sign Out
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Toggle */}
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 text-white">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 z-40 bg-[#050505] pt-24 px-6 lg:hidden"
                    >
                        <nav className="flex flex-col gap-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="px-6 py-4 rounded-2xl bg-white/[0.05] text-lg font-bold text-white border border-white/[0.05]"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 relative z-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
