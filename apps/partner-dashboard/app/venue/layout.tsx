import { VenueClientWrapper } from "@/components/layout/VenueClientWrapper";
import {
    LayoutDashboard,
    CalendarDays,
    PlusCircle,
    BarChart3,
    Users,
    Shield,
    Settings,
    Building2,
    Calendar,
    FileText,
    Banknote,
    ClipboardList,
    CreditCard,
    Zap,
} from "lucide-react";

const menuSections = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview", href: "/venue" },
            {
                icon: BarChart3,
                label: "Analytics",
                href: "/venue/analytics",
                children: [
                    { label: "Overview", href: "/venue/analytics/overview" },
                    { label: "Advanced Analytics", href: "/venue/analytics/advanced" },
                ]
            },
        ]
    },
    {
        items: [
            { icon: CalendarDays, label: "Events", href: "/venue/events" },
            {
                icon: Banknote,
                label: "Finance",
                href: "/venue/finance",
                children: [
                    { label: "Overview",         href: "/venue/finance" },
                    { label: "Payments",         href: "/venue/finance/payments" },
                    { label: "Venue Payouts",    href: "/venue/finance/venue-payouts" },
                    { label: "Host Payouts",     href: "/venue/finance/host-payouts" },
                    { label: "Promoter Payouts", href: "/venue/finance/promoter-payouts" },
                    { label: "Ledger",           href: "/venue/finance/ledger" },
                    { label: "Reports",          href: "/venue/finance/reports" },
                ],
            },
            { icon: PlusCircle, label: "Create Event", href: "/venue/create" },
            { icon: Calendar, label: "Calendar", href: "/venue/calendar" },
        ]
    },
    {
        items: [
            { icon: ClipboardList, label: "Walk-ins", href: "/venue/walk-ins" },
            { icon: Users, label: "Partnerships", href: "/venue/partnerships" },
            {
                icon: Shield,
                label: "Staff",
                href: "/venue/staff",
                children: [
                    { label: "Team",            href: "/venue/staff" },
                    { label: "Access Profiles", href: "/venue/staff/profiles" },
                    { label: "Invite",          href: "/venue/staff/invite" },
                ],
            },
            { icon: FileText, label: "Registers", href: "/venue/registers" },
        ]
    },
    {
        items: [
            { icon: Building2, label: "Venue Page", href: "/venue/page-management" },
            { icon: Settings, label: "Settings", href: "/venue/settings" },
        ]
    },
];

export default function VenueDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <VenueClientWrapper menuSections={menuSections}>
            {children}
        </VenueClientWrapper>
    );
}
