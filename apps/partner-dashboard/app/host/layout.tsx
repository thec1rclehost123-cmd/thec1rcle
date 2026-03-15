import { HostClientWrapper } from "@/components/layout/HostClientWrapper";
import {
    LayoutDashboard,
    CalendarDays,
    PlusCircle,
    BarChart3,
    Users,
    Settings,
    Layout,
    ShieldCheck,
    Building,
    Clock,
    Star,
    Compass,
    Banknote,
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
                    { label: "Performance", href: "/host/analytics/performance" },
                    { label: "Audience Quality", href: "/host/analytics/audience" },
                    { label: "Trust & Reliability", href: "/host/analytics/reliability" },
                    { label: "Venue ROI", href: "/host/analytics/partners" },
                    { label: "Strategy", href: "/host/analytics/strategy" },
                ]
            },
        ]
    },
    {
        items: [
            { icon: CalendarDays, label: "Events", href: "/host/events" },
            { icon: Banknote, label: "Finance", href: "/host/finance" },
            { icon: PlusCircle, label: "Create Event", href: "/host/create" },
            { icon: Clock, label: "Slot Requests", href: "/host/events/requests" },
            { icon: ShieldCheck, label: "Entry Control", href: "/host/ops" },
            { icon: Star, label: "Reviews", href: "/host/reviews" },
        ]
    },
    {
        items: [
            { icon: Users, label: "Promoters", href: "/host/promoters" },
            { icon: Building, label: "Venues", href: "/host/partnerships" },
            { icon: Compass, label: "Discover", href: "/host/discover" },
        ]
    },
    {
        items: [
            { icon: Layout, label: "Page Management", href: "/host/page-management" },
            { icon: Settings, label: "Settings", href: "/host/settings" },
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
