"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";

type MenuItem = {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    children?: { label: string; href: string }[];
};

type MenuSection = {
    items: MenuItem[];
};

interface AppleSidebarProps {
    brandLetter: string;
    brandLabel: string;
    menuSections: MenuSection[];
    basePath: string;
}

export function AppleSidebar({ brandLetter, brandLabel, menuSections, basePath }: AppleSidebarProps) {
    const pathname = usePathname();
    const { signOut, profile } = useDashboardAuth();

    const isActive = (path: string) => {
        if (path === basePath && pathname === basePath) return true;
        if (path !== basePath && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <aside className="w-[300px] bg-obsidian-sidebar border-r border-black/[0.05] flex flex-col h-screen fixed left-0 top-0 overflow-hidden z-50 shrink-0">
            {/* Brand - Authority Node Style */}
            <div className="p-8 border-b border-black/[0.05]">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(0,0,0,0.1)]">
                        {brandLetter}
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">C1RCLE</h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{brandLabel.includes('Node') ? brandLabel.replace('Node', 'Dashboard') : `${brandLabel} Dashboard`}</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-8 px-6 space-y-8 custom-scrollbar">
                {menuSections.map((section, idx) => (
                    <div key={idx} className="space-y-1">
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            const hasChildren = item.children && item.children.length > 0;
                            const isChildActive = hasChildren && item.children.some(child => pathname.startsWith(child.href));

                            return (
                                <div key={item.href} className="space-y-1">
                                    <Link
                                        href={item.href}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${active || isChildActive
                                            ? "bg-black/10 text-[var(--text-primary)] backdrop-blur-md border border-black/10"
                                            : "text-[var(--text-secondary)] hover:text-black hover:bg-black/5"
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Icon className={`w-4 h-4 ${active || isChildActive ? "text-black" : "text-black/30 group-hover:text-black/50"}`} />
                                            <span className="text-sm font-medium tracking-tight">{item.label}</span>
                                        </div>
                                        {hasChildren && (
                                            <ChevronDown className={`h-3 w-3 transition-transform ${active || isChildActive ? 'rotate-180' : ''}`} />
                                        )}
                                        {active && !hasChildren && <div className="h-1 w-1 rounded-full bg-iris shadow-[0_0_10px_#F44A22]" />}
                                    </Link>

                                    {hasChildren && (active || isChildActive) && (
                                        <div className="mt-1 ml-9 space-y-1 animate-slide-up">
                                            {item.children.map((child) => {
                                                const childActive = pathname === child.href;
                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        className={`block px-4 py-2.5 rounded-lg text-[13px] transition-all ${childActive
                                                            ? 'bg-black/5 text-[var(--text-primary)] font-medium border border-black/5'
                                                            : 'text-[var(--text-tertiary)] hover:text-black hover:bg-black/5'
                                                            }`}
                                                    >
                                                        {child.label}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Account Footer */}
            <div className="p-6 border-t border-black/[0.05]">
                <div className="flex items-center gap-3 px-3 py-3 mb-6 bg-black/5 rounded-xl border border-black/5">
                    <div className="h-8 w-8 rounded-full bg-black/10 flex items-center justify-center text-[11px] font-bold text-black/80 border border-black/5">
                        {profile?.displayName?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                            {profile?.displayName || "Operator"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 w-full px-5 py-3 rounded-xl text-[var(--text-tertiary)] hover:text-iris hover:bg-iris/5 transition-all group font-medium text-sm"
                >
                    <LogOut className="w-4 h-4 text-black/30 group-hover:text-iris" />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
