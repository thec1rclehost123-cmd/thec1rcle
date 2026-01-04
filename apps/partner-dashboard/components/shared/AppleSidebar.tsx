"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useDashboardAuth } from "../providers/DashboardAuthProvider";

type MenuItem = {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
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
        <aside className="w-[260px] bg-white/80 backdrop-blur-xl border-r border-black/[0.04] flex flex-col h-screen fixed left-0 top-0 overflow-hidden z-50">
            {/* Brand */}
            <div className="p-6 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1d1d1f] flex items-center justify-center text-white text-sm font-semibold">
                    {brandLetter}
                </div>
                <div>
                    <h1 className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">C1RCLE</h1>
                    <p className="text-[11px] text-[#86868b]">{brandLabel}</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-2">
                {menuSections.map((section, idx) => (
                    <div key={idx} className="mb-2">
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-item ${active ? 'nav-item-active' : ''}`}
                                >
                                    <Icon className="nav-icon" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Account Footer */}
            <div className="p-4 border-t border-black/[0.04]">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                    <div className="avatar avatar-sm">
                        {profile?.displayName?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1d1d1f] truncate">
                            {profile?.displayName || "User"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => signOut()}
                    className="nav-item w-full text-[#86868b] hover:text-[#ff3b30]"
                >
                    <LogOut className="nav-icon" />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
