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
    ReceiptText,
    CreditCard,
    TrendingUp,
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
                    { label: "Audience & Demographics", href: "/venue/analytics/audience" },
                    { label: "Discovery & Funnel", href: "/venue/analytics/reach" },
                    { label: "Entry & Operations", href: "/venue/analytics/ops" },
                    { label: "Host & Promoter ROI", href: "/venue/analytics/attribution" },
                    { label: "Revenue & Payouts", href: "/venue/analytics/revenue" },
                    { label: "Strategy & Insights", href: "/venue/analytics/strategy" },
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
                    { label: "Overview",        href: "/venue/finance" },
                    { label: "Ledger",          href: "/venue/finance/ledger" },
                    { label: "Payout Settings", href: "/venue/finance/payouts" },
                    { label: "Reports",         href: "/venue/finance/reports" },
                ],
            },
            { icon: PlusCircle, label: "Create Event", href: "/venue/create" },
            { icon: Calendar, label: "Calendar", href: "/venue/calendar" },
        ]
    },
    {
        items: [
            { icon: Users, label: "Partnerships", href: "/venue/partnerships" },
            { icon: Shield, label: "Staff", href: "/venue/staff" },
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
