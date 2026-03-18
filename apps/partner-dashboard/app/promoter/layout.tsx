import { PromoterClientWrapper } from "@/components/layout/PromoterClientWrapper";
import { ApprovalGuard } from "@/components/guards/ApprovalGuard";
import {
    LayoutDashboard,
    Ticket,
    Calendar,
    Link2,
    Fingerprint,
    Handshake,
    Wallet,
    Settings,
} from "lucide-react";

const MENU_SECTIONS = [
    {
        items: [
            { icon: LayoutDashboard, label: "Overview",  href: "/promoter" },
            { icon: Ticket,          label: "Events",    href: "/promoter/events" },
            { icon: Calendar,        label: "Calendar",  href: "/promoter/calendar" },
        ],
    },
    {
        items: [
            { icon: Link2,        label: "MyLinks",      href: "/promoter/links" },
            { icon: Fingerprint,  label: "Persona",      href: "/promoter/persona" },
            { icon: Handshake,    label: "Partnerships", href: "/promoter/partnerships" },
        ],
    },
    {
        items: [
            { icon: Wallet,   label: "Finance",  href: "/promoter/finance" },
            { icon: Settings, label: "Settings", href: "/promoter/settings" },
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
