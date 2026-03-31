"use client";

import { useState } from "react";
import {
    Info, ShoppingCart, Megaphone, Share2, Lock,
    ShieldCheck, HeartPulse, Palette, Code2,
    Download, ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import SettingsPanel, { type SettingsKey } from "./SettingsPanel";

// ─── Settings card definitions ────────────────────────────────────────────────

interface SettingCard {
    key: SettingsKey;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
}

const SETTINGS_CARDS: SettingCard[] = [
    {
        key: "event-info",
        icon: Info,
        iconBg: "rgba(129,140,248,0.12)",
        iconColor: "#818CF8",
        title: "Event Info",
        description: "Event name, start & end time, description, and venue information.",
    },
    {
        key: "checkout",
        icon: ShoppingCart,
        iconBg: "rgba(52,211,153,0.12)",
        iconColor: "#34D399",
        title: "Checkout",
        description: "Checkout flow, custom checkout fields, event fees, and buttons.",
    },
    {
        key: "marketing",
        icon: Megaphone,
        iconBg: "rgba(244,74,34,0.12)",
        iconColor: "var(--c1rcle-orange)",
        title: "Marketing",
        description: "Facebook Pixel, TikTok Pixel, and third-party marketplace integrations.",
    },
    {
        key: "social",
        icon: Share2,
        iconBg: "rgba(56,189,248,0.12)",
        iconColor: "#38BDF8",
        title: "Social Features",
        description: "Configure social features layout and display threshold settings.",
    },
    {
        key: "privacy",
        icon: Lock,
        iconBg: "rgba(251,191,36,0.12)",
        iconColor: "#FBBF24",
        title: "Privacy",
        description: "Password-protect the event page for added privacy and access control.",
    },
    {
        key: "policies",
        icon: ShieldCheck,
        iconBg: "rgba(52,211,153,0.12)",
        iconColor: "#34D399",
        title: "Policies",
        description: "Set your Terms of Service and Refund Policy for this event.",
    },
    {
        key: "health-safety",
        icon: HeartPulse,
        iconBg: "rgba(248,113,113,0.12)",
        iconColor: "#F87171",
        title: "Health & Safety",
        description: "Display entrance rules, vaccination requirements, and health guidelines.",
    },
    {
        key: "branding",
        icon: Palette,
        iconBg: "rgba(244,74,34,0.12)",
        iconColor: "var(--c1rcle-orange)",
        title: "Branding",
        description: "Change the display name and branding for your organisation on this event.",
    },
    {
        key: "embed",
        icon: Code2,
        iconBg: "rgba(129,140,248,0.12)",
        iconColor: "#818CF8",
        title: "Embed",
        description: "Embed the checkout for this event directly on another website.",
    },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventSettingsClient({ eventId }: { eventId: string }) {
    const [activeKey, setActiveKey] = useState<SettingsKey | null>(null);

    const activeCard = SETTINGS_CARDS.find(c => c.key === activeKey) ?? null;

    return (
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2
                        className="text-[22px] font-bold tracking-tight"
                        style={{ color: "var(--v-text-primary)" }}
                    >
                        Event Settings
                    </h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--v-text-tertiary)" }}>
                        Configure and manage all aspects of this event
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download size={14} />}
                    iconPosition="left"
                >
                    Export Event Report
                </Button>
            </div>

            {/* 3-column settings grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SETTINGS_CARDS.map(card => (
                    <SettingsTile
                        key={card.key}
                        card={card}
                        onClick={() => setActiveKey(card.key)}
                    />
                ))}
            </div>

            {/* Slide-over panel */}
            <SettingsPanel
                open={activeKey !== null}
                settingsKey={activeKey}
                title={activeCard?.title ?? ""}
                onClose={() => setActiveKey(null)}
            />
        </div>
    );
}

// ─── Individual tile ──────────────────────────────────────────────────────────

function SettingsTile({ card, onClick }: { card: SettingCard; onClick: () => void }) {
    const Icon = card.icon;

    return (
        <Card
            interactive
            padding="lg"
            className="group flex flex-col gap-4 hover:-translate-y-0.5"
            onClick={onClick}
            style={{
                background: "var(--v-card)",
                border: "1px solid var(--v-border)",
                transition: "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--v-border)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: card.iconBg }}
            >
                <Icon size={18} style={{ color: card.iconColor }} />
            </div>

            <div className="flex-1">
                <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--v-text-primary)" }}>
                    {card.title}
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--v-text-tertiary)" }}>
                    {card.description}
                </p>
            </div>

            <div className="flex justify-end">
                <ChevronRight
                    size={16}
                    className="transition-all duration-150 group-hover:translate-x-0.5"
                    style={{ color: "var(--v-text-tertiary)" }}
                />
            </div>
        </Card>
    );
}
