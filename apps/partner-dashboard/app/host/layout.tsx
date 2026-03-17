import { HostClientWrapper } from "@/components/layout/HostClientWrapper";
import {
    LayoutDashboard,
    CalendarDays,
    BarChart3,
    Network,
    Banknote,
    Zap,
} from "lucide-react";

const menuSections = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview", href: "/host" },
            {
                icon: BarChart3,
                label: "Analytics",
                href: "/host/analytics",
                children: [
                    { label: "Overview", href: "/host/analytics/overview" },
                    { label: "Yield", href: "/host/analytics/performance" },
                    { label: "Audience", href: "/host/analytics/audience" },
                    { label: "Partners", href: "/host/analytics/partners" },
                    { label: "Strategy", href: "/host/analytics/strategy" },
                ]
            },
        ]
    },
    {
        items: [
            { icon: Zap, label: "Events", href: "/host/events" },
            { icon: Banknote, label: "Finance", href: "/host/finance" },
            { icon: CalendarDays, label: "Calendar", href: "/host/calendar" },
        ]
    },
    {
        items: [
            { icon: Network, label: "Network", href: "/host/network" },
        ]
    },
];

export default function HostLayout({ children }: { children: React.ReactNode }) {
    return (
        <HostClientWrapper menuSections={menuSections}>
            {children}
        </HostClientWrapper>
    );
}
