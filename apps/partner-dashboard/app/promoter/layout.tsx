"use client";

import { PromoterClientWrapper } from "@/components/layout/PromoterClientWrapper";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import {
    LayoutDashboard,
    Ticket,
    Link2,
    Calendar,
    Handshake,
    BarChart3,
    Wallet,
    Settings,
} from "lucide-react";

const MENU_SECTIONS = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview",  href: "/promoter" },
            { icon: Link2,           label: "Links",     href: "/promoter/links" },
            { icon: Ticket,          label: "Events",    href: "/promoter/events" },
            { icon: Calendar,        label: "Calendar",  href: "/promoter/events?view=calendar" },
            { icon: Handshake,       label: "Partners",  href: "/promoter/partners" },
            { icon: BarChart3,       label: "Analytics", href: "/promoter/analytics" },
            { icon: Wallet,          label: "Finance",   href: "/promoter/finance" },
            { icon: Settings,        label: "Settings",  href: "/promoter/settings" },
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
