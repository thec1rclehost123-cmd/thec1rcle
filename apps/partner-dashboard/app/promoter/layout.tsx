import { AppleTopBar } from "@/components/shared/AppleTopBar";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import { PromoterSidebarWrapper } from "@/components/layout/PromoterSidebarWrapper";
import { PromoterPageTransition } from "@/components/layout/PromoterPageTransition";
import {
    LayoutDashboard,
    CalendarDays,
    Link2,
    BarChart3,
    CreditCard,
    Settings,
    User,
    Users,
    Activity
} from "lucide-react";

const menuSections = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview", href: "/promoter" },
            {
                icon: BarChart3,
                label: "Analytics",
                href: "/promoter/analytics",
                children: [
                    { label: "Overview", href: "/promoter/analytics/overview" },
                    { label: "Event Data", href: "/promoter/analytics/performance" },
                    { label: "Audience Mix", href: "/promoter/analytics/audience" },
                    { label: "Funnel Velocity", href: "/promoter/analytics/funnel" },
                    { label: "Trust Score", href: "/promoter/analytics/trust" },
                    { label: "Strategy", href: "/promoter/analytics/strategy" },
                ]
            },
        ]
    },
    {
        items: [
            { icon: CalendarDays, label: "Events", href: "/promoter/events" },
            { icon: Link2, label: "My Links", href: "/promoter/links" },
            { icon: Activity, label: "Guest Stream", href: "/promoter/guests" },
        ]
    },
    {
        items: [
            { icon: Users, label: "Partnerships", href: "/promoter/partnerships" },
        ]
    },
    {
        items: [
            { icon: CreditCard, label: "Payouts", href: "/promoter/payouts" },
        ]
    },
    {
        items: [
            { icon: User, label: "Profile", href: "/promoter/profile" },
            { icon: Settings, label: "Settings", href: "/promoter/settings" },
        ]
    }
];

export default function PromoterLayout({ children }: { children: React.ReactNode }) {
    return (
        <ApprovalGuard>
            <RoleGuard allowedType="promoter">
                <div className="min-h-screen bg-surface-base">
                    <PromoterSidebarWrapper menuSections={menuSections} />

                    {/* Main Content */}
                    <div className="lg:pl-[280px] flex flex-col min-h-screen pt-14 lg:pt-0">
                        <div className="hidden lg:block sticky top-0 z-40">
                            <AppleTopBar />
                        </div>

                        <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">
                            <PromoterPageTransition>
                                <div className="max-w-[1600px] mx-auto">
                                    {children}
                                </div>
                            </PromoterPageTransition>
                        </main>
                    </div>
                </div>
            </RoleGuard>
        </ApprovalGuard>
    );
}
