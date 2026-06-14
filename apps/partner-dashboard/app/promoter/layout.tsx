"use client";

import { PromoterClientWrapper } from "@/components/layout/PromoterClientWrapper";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import {
    LayoutDashboard,
    Zap,
    BarChart3,
    Banknote,
    Handshake,
    Link2,
    Users,
} from "lucide-react";

const MENU_SECTIONS = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview",   href: "/promoter" },
            { icon: Zap,             label: "Events",     href: "/promoter/events" },
            { icon: Link2,           label: "Links",      href: "/promoter/links" },
            { icon: Users,           label: "Guests",     href: "/promoter/guests" },
            { icon: BarChart3,       label: "Analytics",  href: "/promoter/analytics" },
            { icon: Banknote,        label: "Finance",    href: "/promoter/finance" },
            { icon: Handshake,       label: "Partners",   href: "/promoter/partners" },
        ],
    },
];

export default function PromoterLayout({ children }: { children: React.ReactNode }) {
    return (
        <ApprovalGuard>
            <PromoterClientWrapper menuSections={MENU_SECTIONS}>
                {children}
            </PromoterClientWrapper>
        </ApprovalGuard>
    );
}
