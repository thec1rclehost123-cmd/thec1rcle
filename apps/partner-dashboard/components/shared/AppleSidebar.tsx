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
        <aside className="w-[260px] bg-[var(--surface-elevated)] backdrop-blur-xl border-r border-[var(--border-subtle)] flex flex-col h-screen fixed left-0 top-0 overflow-hidden z-50">
            {/* Brand */}
            <div className="p-8 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--text-primary)] flex items-center justify-center text-[var(--surface-primary)] text-sm font-bold shadow-sm">
                    {brandLetter}
                </div>
                <div>
                    <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">C1RCLE</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">{brandLabel}</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
                {menuSections.map((section, idx) => (
                    <div key={idx} className="mb-6">
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            const hasChildren = item.children && item.children.length > 0;
                            const isChildActive = hasChildren && item.children.some(child => pathname.startsWith(child.href));

                            return (
                                <div key={item.href} className="mb-1">
                                    <Link
                                        href={item.href}
                                        className={`nav-item ${active || isChildActive ? 'nav-item-active font-bold' : ''}`}
                                    >
                                        <Icon className="nav-icon" />
                                        <span className="flex-1">{item.label}</span>
                                        {hasChildren && (
                                            <ChevronDown className={`h-3 w-3 transition-transform ${active || isChildActive ? 'rotate-180' : ''}`} />
                                        )}
                                    </Link>

                                    {hasChildren && (active || isChildActive) && (
                                        <div className="mt-1 ml-9 space-y-1 animate-slide-up">
                                            {item.children.map((child) => {
                                                const childActive = pathname === child.href;
                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        className={`block px-3 py-2 rounded-lg text-[13px] transition-all ${childActive
                                                            ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)] font-bold'
                                                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]/50'
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
            <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                <div className="flex items-center gap-3 px-3 py-2 mb-4 bg-[var(--surface-secondary)]/30 rounded-2xl border border-[var(--border-subtle)]">
                    <div className="avatar avatar-sm shadow-sm">
                        {profile?.displayName?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                            {profile?.displayName || "User"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="nav-item w-full text-[var(--text-tertiary)] hover:text-[var(--state-risk)] group"
                >
                    <LogOut className="nav-icon group-hover:text-[var(--state-risk)]" />
                    <span className="font-bold">Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
