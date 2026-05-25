"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    ArrowLeft,
    BarChart3,
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Code2,
    Copy,
    Edit3,
    ExternalLink,
    Eye,
    Globe2,
    Heart,
    ImageIcon,
    Instagram,
    Info,
    Landmark,
    Loader2,
    Link2,
    Lock,
    Mail,
    MapPin,
    Megaphone,
    Menu,
    PanelTopOpen,
    Palette,
    Phone,
    RefreshCw,
    Save,
    ScrollText,
    Search,
    Shield,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Ticket,
    TrendingUp,
    Users,
    Wallet,
    Activity,
    Plus,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import EventAnalyticsClient from "@/components/analytics/EventAnalyticsClient";
import EventTeamTab from "@/app/host/events/[id]/EventTeamTab";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Toggle } from "@/components/ui/Toggle";
import { VenueFilterTabs } from "@/components/venue-layout/VenuePageShell";
import { formatDate, formatDatetime, formatINR, formatINRCompact, formatNumber, formatPercent, formatRelativeDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type SettingsBlockId =
    | "eventInfo"
    | "checkout"
    | "marketing"
    | "socialFeatures"
    | "privacy"
    | "policies"
    | "branding"
    | "embed"
    | "promoters";

interface EventPromoterSettings {
    enabled: boolean;
    allowedPromoterIds: string[];
    defaultCommission?: number;
    defaultCommissionType?: string;
}


interface EventSettings {
    eventInfo: {
        title: string;
        shortDescription: string;
        description: string;
        venue: string;
        venueAddress: string;
        city: string;
        timezone: string;
        startDate: string | null;
        endDate: string | null;
        doorsTime: string;
        displayEndTime: boolean;
        displayMultipleDays: boolean;
        publicVisibility: boolean;
    };
    checkout: {
        confirmationMessage: string;
        includeFeesInPrice: boolean;
        longFormButton: boolean;
        submitButtonText: string;
        helperText: string;
        customFields: string[];
    };
    marketing: {
        thirdPartySiteDisplay: boolean;
        facebookPixelId: string;
        tiktokPixelId: string;
        gtmId: string;
    };
    socialFeatures: {
        disableGuestlist: boolean;
        hideNumberAttending: boolean;
        guestlistDisplayThreshold: number;
        publicGuestlist: boolean;
        activityEnabled: boolean;
    };
    privacy: {
        passwordProtected: boolean;
        eventPassword: string;
    };
    policies: {
        termsOfService: string;
        refundPolicy: string;
    };
    branding: {
        organizationDisplayName: string;
        organizationDisplayLogo: string;
    };
    embed: {
        enabled: boolean;
        embedCode: string;
    };
}

interface EventDetail {
    id: string;
    title: string;
    lifecycle: string;
    slug?: string;
    creatorRole?: string | null;
    eventType?: string | null;
    startDate: string | null;
    endDate: string | null;
    venue: string;
    venueId: string | null;
    hostId?: string | null;
    hostName?: string | null;
    venueAddress: string | null;
    city: string | null;
    capacity: number;
    coverImage: string | null;
    eventUrl: string;
    description: string;
    shortDescription: string;
    tags: string[];
    ticketsSold: number;
    ticketTiers: any[];
    createdAt: string | null;
    updatedAt: string | null;
    settings: EventSettings;
    promoterSettings: EventPromoterSettings;
    image: string | null;
    stats: {
        views?: number;
        saves?: number;
    };
}

interface EventPromoterRow {
    id: string;
    promoterId: string | null;
    promoterName: string;
    name: string;
    avatar: string | null;
    isSelected: boolean;
    assignmentId: string | null;
    commissionRate: number;
    shortCode: string;
    trackingLink: string | null;
    sales: number;
    revenue: number;
    clicks: number;
    assignedAt: string | null;
    status: string;
}

interface EventPromotersResponse {
    promoters: EventPromoterRow[];
    promoterSettings: EventPromoterSettings & {
        mode: "all" | "selected" | "none";
    };
    summary: {
        totalPromoters: number;
        selectedPromoters: number;
        activePromoters: number;
        disabledPromoters: number;
        ticketsSold: number;
        revenue: number;
        clicks: number;
    };
}

interface OverviewData {
    ticketsSold: number;
    grossRevenue: number;
    estimatedEarnings: number;
    guestListSize: number;
    totalCheckedIn: number;
    conversionRate: number;
    sellThrough: number;
    uniqueAttendees: number;
    repeatGuests: number;
    firstTimeGuests: number;
    topTier: {
        tierId: string;
        tierName: string;
        sold: number;
        revenue: number;
    } | null;
    locationDistribution: Array<{ label: string; value: number }>;
    ticketMix: Array<{ tierId: string; tierName: string; sold: number; revenue: number }>;
    inventory: number;
    capacity: number;
    isPublic: boolean;
    isLiveEditable: boolean;
    topPromoter: {
        name: string;
        sales: number;
        revenue: number;
    } | null;
    views: number;
    saves: number;
    salesTimeline: Array<{ date: string; label: string; tickets: number; revenue: number; checkIns: number }>;
    hourlyTimeline: Array<{ hour: number; label: string; tickets: number; revenue: number; checkIns: number }>;
    peakSalesHour: { label: string; revenue: number } | null;
    peakCheckInHour: { label: string; checkIns: number } | null;
    timeZone: string;
}

interface TicketsResponse {
    tiers: TicketTierRow[];
    totalSold: number;
    totalInventory: number;
    totalRemaining: number;
}

interface TicketTierRow {
    id: string;
    name: string;
    description: string;
    entryType: string;
    price: number;
    quantity: number;
    sold: number;
    remaining: number;
    sellThrough: number;
    startSale: string | null;
    endSale: string | null;
    minPurchaseQuantity: number;
    maxPurchaseQuantity: number;
    promoterEnabled: boolean;
    isHidden: boolean;
    isDisabled: boolean;
    isSoldOut: boolean;
    passwordProtected: boolean;
    requiresApproval: boolean;
    status: string;
    order: number;
}

interface FinanceData {
    gross: number;
    platformFee: number;
    venueCommission: number;
    venueNetRevenue?: number;
    venueCommissionRate: number;
    refundAmount: number;
    expenses: number;
    net: number;
    walkInRevenue: number;
    walkInOrders: number;
    onlineRevenue: number;
    onlineOrders: number;
    settlementStatus: string;
    paidAt: string | null;
    paymentSources: Array<{ label: string; amount: number; orders: number }>;
    intakeChannels: Array<{ label: string; amount: number; orders: number }>;
    ticketMix: Array<{ tierId: string; tierName: string; revenue: number; sold: number }>;
    hostPayout?: {
        hostId: string;
        hostName: string | null;
        estimate: number;
        status: string;
        paidAt: string | null;
        holdReason: string | null;
        source: string;
    } | null;
    promoterPayouts?: Array<{
        assignmentId: string;
        promoterId: string;
        promoterName: string;
        revenue: number;
        sales: number;
        clicks: number;
        commissionRate: number;
        estimatedCommission: number;
        status: string;
        paidAt: string | null;
        holdReason: string | null;
    }>;
    payoutSummary?: {
        hostEstimate: number;
        promoterEstimate: number;
        totalPartnerExposure: number;
        promoterRevenue: number;
        promoterSales: number;
    };
}

interface AttendeeRow {
    id: string;
    attendeeId: string;
    fullName: string;
    email: string;
    phone: string;
    instagram: string;
    ticketTier: string;
    tierId: string;
    quantity: number;
    totalSpend: number;
    source: string;
    status: string;
    purchasedAt: string | null;
    checkedInAt: string | null;
    city: string;
    area: string;
    isVip: boolean;
    tags: string[];
    orderId: string;
    orderSummary: string;
}

interface AttendeesResponse {
    attendees: AttendeeRow[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: {
        tierOptions: Array<{ id: string; name: string }>;
        sourceOptions: string[];
        statusOptions: string[];
    };
}

interface AttendeeTrackingTimelineEntry {
    id: string;
    label: string;
    timestamp: string | null;
    kind: string;
}

interface AttendeeTrackedOrder {
    id: string;
    orderIndex: number | null;
    orderNumber: string;
    eventId: string;
    eventName: string;
    eventImage: string;
    customerName: string;
    email: string;
    phone: string;
    amount: number;
    ticketsCount: number;
    createdAt: string;
    confirmedAt: string | null;
    checkedInAt: string | null;
    cancelledAt: string | null;
    updatedAt: string | null;
    status: string;
    source: "ticket" | "rsvp";
    tags: string[];
    promoterCode: string | null;
    note: string | null;
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
    }>;
}

interface AttendeeTrackingResponse {
    attendee: AttendeeRow & {
        orderNumber?: string | null;
        stats: {
            eventsAttended: number;
            lifetimeSpend: number;
        };
        joinedAt: string | null;
    };
    orders: AttendeeTrackedOrder[];
    timeline: AttendeeTrackingTimelineEntry[];
    selectedOrderId: string | null;
}

interface EventInfoDraft {
    title: string;
    shortDescription: string;
    description: string;
    venue: string;
    venueAddress: string;
    city: string;
    timezone: string;
    startDate: string;
    endDate: string;
    coverImage: string;
    capacity: number;
}

interface TicketTierDraft {
    name: string;
    description: string;
    entryType: string;
    price: number;
    quantity: number;
    salesStart: string;
    salesEnd: string;
    minPerOrder: number;
    maxPerOrder: number;
    promoterEnabled: boolean;
    hidden: boolean;
    disabled: boolean;
    soldOut: boolean;
}

const FOUNDATION_EDITABLE = new Set(["draft", "needs_changes"]);

const SECTION_TABS = [
    { label: "Analytics", value: "analytics" },
    { label: "Tickets", value: "tickets" },
    { label: "Revenue", value: "revenue" },
    { label: "Attendees", value: "attendees" },
    { label: "Team", value: "team" },
    { label: "Settings", value: "settings" },
];

const RESTRICTED_SECTION_VALUES = new Set(["tickets", "attendees"]);

const SETTINGS_BLOCK_IDS: SettingsBlockId[] = [
    "eventInfo",
    "checkout",
    "marketing",
    "socialFeatures",
    "privacy",
    "policies",
    "branding",
    "embed",
    "promoters",
];

const EMPTY_SETTINGS: EventSettings = {
    eventInfo: {
        title: "",
        shortDescription: "",
        description: "",
        venue: "",
        venueAddress: "",
        city: "",
        timezone: "Asia/Kolkata",
        startDate: null,
        endDate: null,
        doorsTime: "",
        displayEndTime: false,
        displayMultipleDays: false,
        publicVisibility: true,
    },
    checkout: {
        confirmationMessage: "",
        includeFeesInPrice: false,
        longFormButton: false,
        submitButtonText: "",
        helperText: "",
        customFields: [],
    },
    marketing: {
        thirdPartySiteDisplay: false,
        facebookPixelId: "",
        tiktokPixelId: "",
        gtmId: "",
    },
    socialFeatures: {
        disableGuestlist: false,
        hideNumberAttending: false,
        guestlistDisplayThreshold: 0,
        publicGuestlist: false,
        activityEnabled: true,
    },
    privacy: {
        passwordProtected: false,
        eventPassword: "",
    },
    policies: {
        termsOfService: "",
        refundPolicy: "",
    },
    branding: {
        organizationDisplayName: "",
        organizationDisplayLogo: "",
    },
    embed: {
        enabled: false,
        embedCode: "",
    },
};

const EMPTY_EVENT_INFO_DRAFT: EventInfoDraft = {
    title: "",
    shortDescription: "",
    description: "",
    venue: "",
    venueAddress: "",
    city: "",
    timezone: "Asia/Kolkata",
    startDate: "",
    endDate: "",
    coverImage: "",
    capacity: 0,
};

const ENTRY_TYPE_OPTIONS = [
    { value: "general", label: "General" },
    { value: "stag", label: "Stag" },
    { value: "couple", label: "Couple" },
    { value: "female", label: "Ladies" },
    { value: "vip", label: "VIP" },
    { value: "table", label: "Table" },
    { value: "cover", label: "Cover" },
];

function formatLocalDateTimeInput(value: string | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildTicketTierDraft(tier: TicketTierRow): TicketTierDraft {
    return {
        name: tier.name,
        description: tier.description || "",
        entryType: tier.entryType || "general",
        price: tier.price,
        quantity: tier.quantity,
        salesStart: formatLocalDateTimeInput(tier.startSale),
        salesEnd: formatLocalDateTimeInput(tier.endSale),
        minPerOrder: tier.minPurchaseQuantity || 1,
        maxPerOrder: tier.maxPurchaseQuantity || Math.max(tier.quantity, 1),
        promoterEnabled: Boolean(tier.promoterEnabled),
        hidden: tier.isHidden,
        disabled: tier.isDisabled,
        soldOut: tier.isSoldOut,
    };
}

export default function VenueEventWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const eventId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const { user, profile, actionPermissions } = useDashboardAuth();
    const queryClient = useQueryClient();
    const partnerId = profile?.activeMembership?.partnerId || "";

    const [activeSection, setActiveSection] = useState("analytics");
    const [eventInfoDraft, setEventInfoDraft] = useState<EventInfoDraft>(EMPTY_EVENT_INFO_DRAFT);
    const [settingsDraft, setSettingsDraft] = useState<EventSettings>(EMPTY_SETTINGS);
    const [ticketDrafts, setTicketDrafts] = useState<Record<string, TicketTierDraft>>({});
    const [savingTierId, setSavingTierId] = useState<string | null>(null);
    const [expandedTierId, setExpandedTierId] = useState<string | null>(null);
    const [savingBlockId, setSavingBlockId] = useState<string | null>(null);
    const [activeSettingsBlock, setActiveSettingsBlock] = useState<SettingsBlockId | null>(null);

    const [attendeeSearch, setAttendeeSearch] = useState("");
    const deferredAttendeeSearch = useDeferredValue(attendeeSearch);
    const [attendeeSource, setAttendeeSource] = useState("");
    const [attendeeStatus, setAttendeeStatus] = useState("");
    const [attendeeTierId, setAttendeeTierId] = useState("");
    const [attendeeSort, setAttendeeSort] = useState("newest");
    const [attendeePage, setAttendeePage] = useState(1);
    const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [selectedPromoterIds, setSelectedPromoterIds] = useState<string[]>([]);

    const [ticketsRefreshedAt, setTicketsRefreshedAt] = useState<Date | null>(null);
    const [revenueRefreshedAt, setRevenueRefreshedAt] = useState<Date | null>(null);
    const [attendeesRefreshedAt, setAttendeesRefreshedAt] = useState<Date | null>(null);

    const syncWorkspaceQuery = useCallback(
        (
            updates: Record<string, string | null>,
            options: {
                fallbackSection?: string;
            } = {}
        ) => {
            if (!eventId) return;

            const nextParams = new URLSearchParams(searchParams.toString());

            Object.entries(updates).forEach(([key, value]) => {
                if (value && value.trim()) {
                    nextParams.set(key, value);
                } else {
                    nextParams.delete(key);
                }
            });

            const section = nextParams.get("section");
            if (!section && options.fallbackSection) {
                nextParams.set("section", options.fallbackSection);
            }

            const nextQuery = nextParams.toString();
            router.replace(nextQuery ? `/venue/events/${eventId}?${nextQuery}` : `/venue/events/${eventId}`, {
                scroll: false,
            });
        },
        [eventId, router, searchParams]
    );

    const handleSectionChange = useCallback(
        (nextSection: string) => {
            setActiveSection(nextSection);

            if (nextSection !== "settings") {
                setActiveSettingsBlock(null);
            }

            syncWorkspaceQuery(
                {
                    section: nextSection === "analytics" ? null : nextSection,
                    settings: nextSection === "settings" ? activeSettingsBlock : null,
                }
            );
        },
        [activeSettingsBlock, syncWorkspaceQuery]
    );

    const openSettingsBlock = useCallback(
        (blockId: SettingsBlockId) => {
            setActiveSection("settings");
            setActiveSettingsBlock(blockId);
            syncWorkspaceQuery({
                section: "settings",
                settings: blockId,
            });
        },
        [syncWorkspaceQuery]
    );

    const closeSettingsBlock = useCallback(() => {
        setActiveSettingsBlock(null);
        syncWorkspaceQuery({
            section: "settings",
            settings: null,
        });
    }, [syncWorkspaceQuery]);

    useEffect(() => {
        setAttendeePage(1);
    }, [deferredAttendeeSearch, attendeeSource, attendeeStatus, attendeeTierId, attendeeSort]);

    const authedFetch = useCallback(
        async (url: string, options: RequestInit = {}) => {
            if (!user) throw new Error("Not authenticated");
            const token = await user.getIdToken(true);
            return fetch(url, {
                ...options,
                headers: {
                    ...(options.headers || {}),
                    Authorization: `Bearer ${token}`,
                    ...(partnerId ? { "x-partner-id": partnerId, "x-venue-id": partnerId } : {}),
                },
            });
        },
        [partnerId, user]
    );

    const authedJson = useCallback(
        async (url: string, options: RequestInit = {}) => {
            const response = await authedFetch(url, options);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || "Request failed");
            }
            return payload;
        },
        [authedFetch]
    );

    const eventQuery = useQuery({
        queryKey: ["venue-event", eventId],
        queryFn: async () => {
            const payload = await authedJson(`/api/partners/venues/events/${eventId}`);
            return payload.event as EventDetail;
        },
        enabled: Boolean(eventId && user && partnerId),
    });

    const event = eventQuery.data;
    const isHostManagedEvent = String(event?.creatorRole || event?.eventType || "").toLowerCase() === "host";

    const overviewQuery = useQuery({
        queryKey: ["venue-event-overview", eventId],
        queryFn: async () => {
            return (await authedJson(`/api/partners/venues/events/${eventId}/overview`)) as OverviewData;
        },
        enabled: Boolean(eventId && user && partnerId && !isHostManagedEvent),
        refetchInterval: activeSection === "analytics" ? 15000 : false,
    });

    const ticketsQuery = useQuery({
        queryKey: ["venue-event-tickets", eventId],
        queryFn: async () => {
            return (await authedJson(`/api/partners/venues/events/${eventId}/tickets`)) as TicketsResponse;
        },
        enabled: Boolean(eventId && user && partnerId && activeSection === "tickets"),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const financeQuery = useQuery({
        queryKey: ["venue-event-finance", eventId],
        queryFn: async () => {
            return (await authedJson(`/api/partners/venues/events/${eventId}/finance`)) as FinanceData;
        },
        enabled: Boolean(eventId && user && partnerId && !isHostManagedEvent && activeSection === "revenue"),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const attendeesQuery = useQuery({
        queryKey: [
            "venue-event-attendees",
            eventId,
            deferredAttendeeSearch,
            attendeeSource,
            attendeeStatus,
            attendeeTierId,
            attendeeSort,
            attendeePage,
        ],
        queryFn: async () => {
            const searchParams = new URLSearchParams({
                page: String(attendeePage),
                limit: "25",
                sort: attendeeSort,
            });

            if (deferredAttendeeSearch.trim()) searchParams.set("q", deferredAttendeeSearch.trim());
            if (attendeeSource) searchParams.set("source", attendeeSource);
            if (attendeeStatus) searchParams.set("status", attendeeStatus);
            if (attendeeTierId) searchParams.set("tierId", attendeeTierId);

            return (await authedJson(`/api/partners/venues/events/${eventId}/attendees?${searchParams.toString()}`)) as AttendeesResponse;
        },
        enabled: Boolean(eventId && user && partnerId && activeSection === "attendees"),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const promotersQuery = useQuery({
        queryKey: ["venue-event-promoters", eventId],
        queryFn: async () => {
            return (await authedJson(`/api/partners/venues/events/${eventId}/promoters`)) as EventPromotersResponse;
        },
        enabled: Boolean(eventId && user && partnerId && !isHostManagedEvent &&
            (activeSection === "team" || (activeSection === "settings" && activeSettingsBlock === "promoters"))),
        staleTime: 30_000,
    });

    const attendeeDetailQuery = useQuery({
        queryKey: ["venue-event-attendee-detail", eventId, selectedAttendeeId],
        queryFn: async () => {
            return (await authedJson(`/api/partners/venues/events/${eventId}/attendees/${selectedAttendeeId}`)) as AttendeeTrackingResponse;
        },
        enabled: Boolean(eventId && user && partnerId && selectedAttendeeId && activeSection === "attendees"),
        staleTime: 30_000,
    });

    const saveEventMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
            return authedJson(`/api/partners/venues/events/${eventId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["venue-event", eventId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-overview", eventId] }),
            ]);
        },
    });

    const saveTierMutation = useMutation({
        mutationFn: async (payload: { tierId: string } & TicketTierDraft) => {
            return authedJson(`/api/partners/venues/events/${eventId}/tickets`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["venue-event-tickets", eventId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-overview", eventId] }),
            ]);
        },
    });

    const resendReceiptMutation = useMutation({
        mutationFn: async (orderId: string) => {
            return authedJson(`/api/partners/venues/orders/${orderId}/resend-receipt`, {
                method: "POST",
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["venue-event-attendee-detail", eventId, selectedAttendeeId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-attendees", eventId] }),
            ]);
        },
    });

    const cancelOrderMutation = useMutation({
        mutationFn: async ({ orderId, mode }: { orderId: string; mode: "cancel" | "cancel_and_relist" }) => {
            return authedJson(`/api/partners/venues/orders/${orderId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["venue-event-attendees", eventId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-attendee-detail", eventId, selectedAttendeeId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-tickets", eventId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-overview", eventId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-finance", eventId] }),
            ]);
            setAttendeesRefreshedAt(new Date());
        },
    });

    const savePromotersMutation = useMutation({
        mutationFn: async (payload: { enabled: boolean; allowedPromoterIds: string[] }) => {
            return authedJson(`/api/partners/venues/events/${eventId}/promoters`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["venue-event", eventId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-promoters", eventId] }),
                queryClient.invalidateQueries({ queryKey: ["venue-event-finance", eventId] }),
            ]);
        },
    });

    const visibleSectionTabs = isHostManagedEvent
        ? SECTION_TABS.filter((tab) => RESTRICTED_SECTION_VALUES.has(tab.value))
        : SECTION_TABS;
    const defaultSection = isHostManagedEvent ? "tickets" : "analytics";
    const overview = overviewQuery.data;
    const tickets = ticketsQuery.data;
    const finance = financeQuery.data;
    const attendees = attendeesQuery.data;
    const attendeeDetail = attendeeDetailQuery.data;
    const promotersData = promotersQuery.data;
    const selectedOrder =
        attendeeDetail?.orders.find((order) => order.id === selectedOrderId) ||
        attendeeDetail?.orders[0] ||
        null;
    const canEditFoundation = FOUNDATION_EDITABLE.has(String(event?.lifecycle || "").toLowerCase());
    const canResendReceipt = Boolean(actionPermissions?.["orders_resendReceipt"] ?? true);
    const canCancelOrder = Boolean(actionPermissions?.["orders_refund"] ?? true);
    const canCancelAndRelist = Boolean(actionPermissions?.["orders_refundResell"] ?? true);

    useEffect(() => {
        if (ticketsQuery.data && !ticketsRefreshedAt) setTicketsRefreshedAt(new Date());
    }, [ticketsQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (financeQuery.data && !revenueRefreshedAt) setRevenueRefreshedAt(new Date());
    }, [financeQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (attendeesQuery.data && !attendeesRefreshedAt) setAttendeesRefreshedAt(new Date());
    }, [attendeesQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!attendeeDetailQuery.data) return;
        setSelectedOrderId((current) => current || attendeeDetailQuery.data.selectedOrderId || attendeeDetailQuery.data.orders[0]?.id || null);
    }, [attendeeDetailQuery.data]);

    useEffect(() => {
        const section = searchParams.get("section");
        const settings = searchParams.get("settings");
        const attendeeId = searchParams.get("attendeeId");
        const orderId = searchParams.get("orderId");
        const allowedTabs = isHostManagedEvent
            ? SECTION_TABS.filter((tab) => RESTRICTED_SECTION_VALUES.has(tab.value))
            : SECTION_TABS;
        const normalizedSection = (section && allowedTabs.some((tab) => tab.value === section)) ? section : defaultSection;
        const normalizedSettingsBlock = SETTINGS_BLOCK_IDS.includes(settings as SettingsBlockId)
            ? (settings as SettingsBlockId)
            : null;

        setActiveSection(normalizedSection);
        setActiveSettingsBlock(normalizedSection === "settings" ? normalizedSettingsBlock : null);

        if (attendeeId) {
            setSelectedAttendeeId(attendeeId);
        } else {
            setSelectedAttendeeId(null);
        }

        if (orderId) {
            setSelectedOrderId(orderId);
        } else {
            setSelectedOrderId(null);
        }
    }, [defaultSection, isHostManagedEvent, searchParams]);

    const clearAttendeeProfileSelection = useCallback(() => {
        setSelectedAttendeeId(null);
        setSelectedOrderId(null);

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("attendeeId");
        nextParams.delete("orderId");

        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `/venue/events/${eventId}?${nextQuery}` : `/venue/events/${eventId}`, {
            scroll: false,
        });
    }, [eventId, router, searchParams]);

    const handleCopyEventLink = useCallback(async () => {
        if (!event?.eventUrl) return;
        try {
            await navigator.clipboard.writeText(event.eventUrl);
        } catch (error) {
            console.error("Failed to copy event link", error);
        }
    }, [event?.eventUrl]);

    useEffect(() => {
        if (!event) return;
        setEventInfoDraft(buildEventInfoDraft(event));
        setSettingsDraft(hydrateSettings(event.settings));
    }, [event]);

    useEffect(() => {
        if (promotersData?.promoters) {
            setSelectedPromoterIds(
                promotersData.promoters
                    .filter((promoter) => promoter.isSelected && promoter.promoterId)
                    .map((promoter) => String(promoter.promoterId))
            );
            return;
        }

        if (event?.promoterSettings?.allowedPromoterIds) {
            setSelectedPromoterIds(event.promoterSettings.allowedPromoterIds.map((id) => String(id)));
        }
    }, [event?.promoterSettings?.allowedPromoterIds, promotersData]);

    useEffect(() => {
        if (!tickets?.tiers?.length) return;
        setTicketDrafts(
            tickets.tiers.reduce<Record<string, TicketTierDraft>>((accumulator, tier) => {
                accumulator[tier.id] = buildTicketTierDraft(tier);
                return accumulator;
            }, {})
        );
    }, [tickets]);

    const headerImage = event?.coverImage || event?.image || null;
    const heroLoading = eventQuery.isLoading || overviewQuery.isLoading;
    const heroError = eventQuery.error instanceof Error ? eventQuery.error.message : null;

    const handleSaveEventInfo = useCallback(async () => {
        if (!event) return;
        setSavingBlockId("eventInfo");
        const payload: Record<string, unknown> = {
            shortDescription: eventInfoDraft.shortDescription,
            description: eventInfoDraft.description,
            coverImage: eventInfoDraft.coverImage,
        };

        if (canEditFoundation) {
            payload.title = eventInfoDraft.title;
            payload.venue = eventInfoDraft.venue;
            payload.venueAddress = eventInfoDraft.venueAddress;
            payload.city = eventInfoDraft.city;
            payload.timezone = eventInfoDraft.timezone;
            payload.startDate = parseLocalDateTime(eventInfoDraft.startDate);
            payload.endDate = parseLocalDateTime(eventInfoDraft.endDate);
            payload.capacity = Number(eventInfoDraft.capacity || 0);
        }

        try {
            await saveEventMutation.mutateAsync(payload);
        } finally {
            setSavingBlockId(null);
        }
    }, [canEditFoundation, event, eventInfoDraft, saveEventMutation]);

    const handleSaveSettingsBlock = useCallback(
        async (blockId: SettingsBlockId) => {
            setSavingBlockId(blockId);
            try {
                await saveEventMutation.mutateAsync(buildSettingsPayload(blockId, settingsDraft));
            } finally {
                setSavingBlockId(null);
            }
        },
        [saveEventMutation, settingsDraft]
    );

    const handleSaveTier = useCallback(
        async (tierId: string) => {
            const draft = ticketDrafts[tierId];
            if (!draft) return;
            setSavingTierId(tierId);
            try {
                await saveTierMutation.mutateAsync({
                    tierId,
                    ...draft,
                });
            } finally {
                setSavingTierId(null);
            }
        },
        [saveTierMutation, ticketDrafts]
    );

    const handleTogglePromoter = useCallback((promoterId: string) => {
        setSelectedPromoterIds((current) =>
            current.includes(promoterId)
                ? current.filter((id) => id !== promoterId)
                : [...current, promoterId]
        );
    }, []);

    const handleSavePromoters = useCallback(
        async (mode: "all" | "selected" | "none") => {
            if (!promotersData?.promoters) return;

            setSavingBlockId("promoters");

            const allPromoterIds = promotersData.promoters
                .map((promoter) => promoter.promoterId)
                .filter((promoterId): promoterId is string => Boolean(promoterId))
                .map((promoterId) => String(promoterId));

            const dedupedSelectedIds = [...new Set(selectedPromoterIds.map((promoterId) => String(promoterId)))];
            const payload = {
                enabled: mode !== "none",
                allowedPromoterIds:
                    mode === "all"
                        ? []
                        : mode === "selected"
                            ? dedupedSelectedIds
                            : [],
            };

            try {
                if (mode === "all") {
                    setSelectedPromoterIds(allPromoterIds);
                } else if (mode === "none") {
                    setSelectedPromoterIds([]);
                }

                await savePromotersMutation.mutateAsync(payload);
            } finally {
                setSavingBlockId(null);
            }
        },
        [promotersData?.promoters, savePromotersMutation, selectedPromoterIds]
    );

    const handleDisableSelectedPromoters = useCallback(async () => {
        if (!promotersData?.promoters) return;

        const currentlyEnabledIds = promotersData.promoters
            .filter((promoter) => promoter.isSelected && promoter.promoterId)
            .map((promoter) => String(promoter.promoterId));
        const nextAllowedPromoterIds = currentlyEnabledIds.filter((promoterId) => !selectedPromoterIds.includes(promoterId));

        setSavingBlockId("promoters");
        try {
            setSelectedPromoterIds(nextAllowedPromoterIds);
            await savePromotersMutation.mutateAsync({
                enabled: nextAllowedPromoterIds.length > 0,
                allowedPromoterIds: nextAllowedPromoterIds,
            });
        } finally {
            setSavingBlockId(null);
        }
    }, [promotersData?.promoters, savePromotersMutation, selectedPromoterIds]);

    if (heroLoading) {
        return (
            <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex min-h-[60vh] items-center justify-center rounded-[32px] border border-border-default bg-[var(--v-card)]">
                    <div className="flex items-center gap-3 text-[var(--v-text-secondary)]">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading event workspace...
                    </div>
                </div>
            </div>
        );
    }

    if (!event || heroError) {
        return (
            <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
                <div className="rounded-[32px] border border-border-default bg-[var(--v-card)] p-10 text-center">
                    <p className="text-lg font-semibold text-[var(--v-text-primary)]">Event not found.</p>
                    <p className="mt-2 text-sm text-[var(--v-text-secondary)]">
                        {heroError || "The requested event could not be loaded from the venue workspace."}
                    </p>
                    <Link
                        href="/venue/events"
                        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--v-orange)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Events
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1600px] px-4 pb-6 pt-0 sm:px-6 lg:px-8">
            <div className="space-y-5 pb-16">
                <section
                    className="overflow-hidden rounded-[32px] border border-border-default"
                    style={{
                        background: "#000000",
                        boxShadow: "0 22px 80px rgba(0,0,0,0.28)",
                    }}
                >
                    <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                        <div className="relative min-h-[320px] bg-[#000000]">
                            {headerImage ? (
                                <img
                                    src={headerImage}
                                    alt={event.title}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full min-h-[320px] items-center justify-center bg-[linear-gradient(135deg,rgba(244,74,34,0.2),rgba(52,211,153,0.08))]">
                                    <div className="flex flex-col items-center gap-3 text-center text-[var(--v-text-secondary)]">
                                        <ImageIcon className="h-10 w-10" />
                                        <span className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                                            Poster pending
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(7,8,10,0.72)] via-transparent to-transparent" />
                        </div>

                        <div className="relative flex flex-col gap-5 p-5 sm:p-6">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em]">
                                        <StatusPill status={event.lifecycle} />
                                        <span className="text-[14px] font-semibold tracking-[0.12em] text-white">
                                            {event.startDate ? formatDatetime(event.startDate) : "Date TBD"}
                                        </span>
                                    </div>

                                    <h1 className="mt-3 text-2xl font-black leading-none tracking-tight text-white uppercase sm:text-3xl">
                                        {event.title}
                                    </h1>

                                    {event.tags?.length > 0 && (
                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {event.tags.slice(0, 6).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-[var(--v-text-secondary)]"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 xl:max-w-[320px] xl:justify-end">
                                    {!isHostManagedEvent ? (
                                        <Link
                                            href={`/venue/create?id=${event.id}`}
                                            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.02] px-5 py-3 text-[14px] font-semibold text-[var(--v-text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_24px_rgba(244,74,34,0.08)] transition-all hover:border-white/18 hover:bg-white/[0.05] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_32px_rgba(244,74,34,0.14)]"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                            Edit
                                        </Link>
                                    ) : null}
                                    <a
                                        href={event.eventUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.02] px-5 py-3 text-[14px] font-semibold text-[var(--v-text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_24px_rgba(244,74,34,0.08)] transition-all hover:border-white/18 hover:bg-white/[0.05] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_32px_rgba(244,74,34,0.14)]"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        View
                                    </a>
                                    <a
                                        href={`${process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || ''}/e/${event?.slug || eventId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-white/12 bg-white/[0.02] px-5 py-3 text-[14px] font-semibold text-[var(--v-text-primary)] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_24px_rgba(244,74,34,0.08)] transition-all hover:border-white/18 hover:bg-white/[0.05] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_32px_rgba(244,74,34,0.14)]"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Preview
                                    </a>
                                </div>
                            </div>

                            {!isHostManagedEvent ? (
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    <HeaderStatCard
                                        label="Tickets sold"
                                        value={formatNumber(overview?.ticketsSold || 0)}
                                        icon={Ticket}
                                    />
                                    <HeaderStatCard
                                        label="Page visits"
                                        value={formatNumber(overview?.views || 0)}
                                        icon={Eye}
                                    />
                                    <HeaderStatCard
                                        label="Conversions"
                                        value={formatPercent(overview?.conversionRate || 0, 0)}
                                        icon={TrendingUp}
                                    />
                                </div>
                            ) : (
                                <div className="rounded-[20px] border border-white/10 bg-black/40 px-4 py-4 text-[13px] text-white/72">
                                    This event is hosted by a partner host. Venue access here is limited to tickets and attendees.
                                </div>
                            )}

                            <div className="mt-2">
                                <div className="mb-4 flex flex-wrap items-center gap-3 text-[12px] text-[var(--v-text-secondary)]">
                                    <MetaItem icon={Building2} label={event.venue} />
                                    {event.city ? <MetaItem icon={MapPin} label={event.city} /> : null}
                                    {event.hostName ? <MetaItem icon={Users} label={`Host: ${event.hostName}`} /> : null}
                                </div>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] border border-white/10 bg-black px-3 py-3 sm:px-4">
                                    <div className="flex h-14 min-w-0 items-center overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.02] px-5">
                                        <p className="truncate text-[15px] font-medium leading-none tracking-[-0.02em] text-[var(--v-text-primary)] sm:text-[16px]">
                                            {event.eventUrl}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={event.eventUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-[var(--v-text-primary)] transition-colors hover:bg-white/[0.22]"
                                            aria-label="Open guest event link"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={handleCopyEventLink}
                                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-[var(--v-text-primary)] transition-colors hover:bg-white/[0.22]"
                                            aria-label="Copy guest event link"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="sticky top-0 z-20 -mx-4 bg-transparent px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                    <div className="flex justify-center">
                        <VenueFilterTabs tabs={visibleSectionTabs} active={activeSection} onChange={handleSectionChange} />
                    </div>
                </div>

                {activeSection === "analytics" && (
                    <section className="space-y-6">
                        <EventSectionHeader title="Analytics" />
                        <div className="pt-1">
                            <EventAnalyticsClient role="venue" idParam="venueId" eventId={event.id} embedded />
                        </div>
                    </section>
                )}

                {activeSection === "tickets" && (
                    <section>
                        <div className="space-y-6">
                            <EventSectionHeader
                                title="Ticket Types"
                                actions={!isHostManagedEvent ? (
                                    <Link
                                        href={`/venue/create?id=${event.id}`}
                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/6 bg-[#232427] px-5 text-[13px] font-semibold text-white transition-all hover:border-white/10 hover:bg-[#2A2B2F]"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Ticket Type
                                    </Link>
                                ) : null}
                            />

                            <RefreshBar
                                refreshedAt={ticketsRefreshedAt}
                                isLoading={ticketsQuery.isFetching}
                                onRefresh={() => {
                                    ticketsQuery.refetch();
                                    setTicketsRefreshedAt(new Date());
                                }}
                            />

                            <div className="overflow-hidden rounded-[28px] border border-white/6 bg-[#1C1C1F]">
                                <div className="hidden grid-cols-[minmax(280px,2.2fr)_1fr_0.8fr_1fr_1fr_1fr_120px] gap-4 px-6 py-5 text-[12px] font-semibold text-white/90 lg:grid">
                                    <div>Name</div>
                                    <div>Status</div>
                                    <div>Price</div>
                                    <div>Sold</div>
                                    <div>Open Sale</div>
                                    <div>End Sale</div>
                                    <div />
                                </div>

                                <div className="divide-y divide-white/[0.035]">
                                {(tickets?.tiers || []).map((tier) => {
                                    const draft = ticketDrafts[tier.id] || buildTicketTierDraft(tier);

                                    const dirty =
                                        draft.name !== tier.name ||
                                        draft.description !== tier.description ||
                                        draft.entryType !== tier.entryType ||
                                        draft.price !== tier.price ||
                                        draft.quantity !== tier.quantity ||
                                        draft.salesStart !== formatLocalDateTimeInput(tier.startSale) ||
                                        draft.salesEnd !== formatLocalDateTimeInput(tier.endSale) ||
                                        draft.minPerOrder !== tier.minPurchaseQuantity ||
                                        draft.maxPerOrder !== tier.maxPurchaseQuantity ||
                                        draft.promoterEnabled !== tier.promoterEnabled;

                                    return (
                                        <div
                                            key={tier.id}
                                            className={cn(
                                                "overflow-hidden transition-all",
                                                expandedTierId === tier.id
                                                    ? "bg-[#232326]"
                                                    : "bg-[#262628] hover:bg-[#2A2A2D]"
                                            )}
                                        >
                                            <div className="grid items-center gap-4 px-6 py-5 lg:grid-cols-[minmax(280px,2.2fr)_1fr_0.8fr_1fr_1fr_1fr_120px]">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-3">
                                                        <Menu className="h-5 w-5 shrink-0 text-white/55" />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-[15px] font-medium text-white">
                                                                {tier.name}
                                                            </p>
                                                            {tier.description ? (
                                                                <p className="mt-1 truncate text-[12px] text-white/45">
                                                                    {tier.description}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-[13px] font-medium">
                                                    <span
                                                        className={cn(
                                                            tier.status === "on_sale"
                                                                ? "text-[#41A546]"
                                                                : tier.status === "hidden"
                                                                    ? "text-white/40"
                                                                    : "text-white/65"
                                                        )}
                                                    >
                                                        {humanizeLabel(tier.status)}
                                                    </span>
                                                </div>

                                                <div className="text-[13px] font-medium tabular-nums text-white/88">
                                                    {tier.price > 0 ? formatINR(tier.price) : "FREE"}
                                                </div>

                                                <div className="text-[13px] font-medium tabular-nums text-white/88">
                                                    {formatNumber(tier.sold)} / {formatNumber(tier.quantity)}
                                                </div>

                                                <div className="text-[13px] text-white/65">
                                                    {tier.startSale ? formatDate(tier.startSale) : "No date"}
                                                </div>

                                                <div className="text-[13px] text-white/65">
                                                    {tier.endSale ? formatDate(tier.endSale) : "No date"}
                                                </div>

                                                <div className="flex items-center justify-start gap-3 lg:justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={handleCopyEventLink}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white transition-all hover:bg-black/75"
                                                        aria-label="Copy event link"
                                                    >
                                                        <Link2 className="h-4 w-4" />
                                                    </button>
                                                    {!isHostManagedEvent ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedTierId((current) => (current === tier.id ? null : tier.id))}
                                                            className={cn(
                                                                "inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-all",
                                                                expandedTierId === tier.id
                                                                    ? "bg-[rgba(244,74,34,0.22)] ring-1 ring-[rgba(244,74,34,0.55)]"
                                                                    : "bg-black/55 hover:bg-black/75"
                                                            )}
                                                            aria-label="Edit ticket tier"
                                                        >
                                                            <Edit3 className="h-4 w-4" />
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {!isHostManagedEvent && expandedTierId === tier.id && (
                                                <div className="border-t border-white/[0.05] bg-[#1E1E21] px-6 py-6">
                                                    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                        <div>
                                                            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">
                                                                Edit Ticket Tier
                                                            </p>
                                                            <p className="mt-2 text-sm text-[var(--v-text-secondary)]">
                                                                Update the same fields available in the create-event wizard.
                                                            </p>
                                                        </div>
                                                        <div className="flex items-start justify-end">
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                icon={savingTierId === tier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                                onClick={() => handleSaveTier(tier.id)}
                                                                disabled={!dirty || savingTierId === tier.id}
                                                            >
                                                                Save
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-4 lg:grid-cols-2">
                                                        <Input
                                                            label="Tier Name"
                                                            value={draft.name}
                                                            onChange={(eventTarget) =>
                                                                setTicketDrafts((current) => ({
                                                                    ...current,
                                                                    [tier.id]: { ...draft, name: eventTarget.target.value },
                                                                }))
                                                            }
                                                        />
                                                        <div>
                                                            <label className="input-label mb-2 block">Entry Type</label>
                                                            <select
                                                                value={draft.entryType}
                                                                onChange={(eventTarget) =>
                                                                    setTicketDrafts((current) => ({
                                                                        ...current,
                                                                        [tier.id]: { ...draft, entryType: eventTarget.target.value },
                                                                    }))
                                                                }
                                                                className="w-full rounded-xl border border-border-subtle bg-surface-secondary px-4 py-3 text-[14px] text-text-primary outline-none transition-all focus:border-[var(--v-orange)] focus:bg-surface-base"
                                                            >
                                                                {ENTRY_TYPE_OPTIONS.map((option) => (
                                                                    <option key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <Input
                                                            label="Price"
                                                            type="number"
                                                            min={0}
                                                            value={draft.price}
                                                            onChange={(eventTarget) =>
                                                                setTicketDrafts((current) => ({
                                                                    ...current,
                                                                    [tier.id]: { ...draft, price: Number(eventTarget.target.value || 0) },
                                                                }))
                                                            }
                                                        />
                                                        <div>
                                                            <label className="input-label mb-2 block">Total Inventory</label>
                                                            <input
                                                                type="number"
                                                                min={tier.sold}
                                                                value={draft.quantity}
                                                                onChange={(eventTarget) =>
                                                                    setTicketDrafts((current) => ({
                                                                        ...current,
                                                                        [tier.id]: { ...draft, quantity: Number(eventTarget.target.value || 0) },
                                                                    }))
                                                                }
                                                                className="w-full rounded-xl border border-border-subtle bg-surface-secondary px-4 py-3 text-[14px] text-text-primary outline-none transition-all focus:border-[var(--v-orange)] focus:bg-surface-base"
                                                            />
                                                            <p className="mt-2 text-[12px] text-[var(--v-text-muted)]">
                                                                {formatNumber(tier.remaining)} remaining · {formatPercent(tier.sellThrough, 1)} sell-through
                                                            </p>
                                                        </div>

                                                        <Input
                                                            label="Sale Start"
                                                            type="datetime-local"
                                                            value={draft.salesStart}
                                                            onChange={(eventTarget) =>
                                                                setTicketDrafts((current) => ({
                                                                    ...current,
                                                                    [tier.id]: { ...draft, salesStart: eventTarget.target.value },
                                                                }))
                                                            }
                                                        />
                                                        <Input
                                                            label="Sale End"
                                                            type="datetime-local"
                                                            value={draft.salesEnd}
                                                            onChange={(eventTarget) =>
                                                                setTicketDrafts((current) => ({
                                                                    ...current,
                                                                    [tier.id]: { ...draft, salesEnd: eventTarget.target.value },
                                                                }))
                                                            }
                                                        />

                                                        <Input
                                                            label="Min Per Order"
                                                            type="number"
                                                            min={1}
                                                            value={draft.minPerOrder}
                                                            onChange={(eventTarget) =>
                                                                setTicketDrafts((current) => ({
                                                                    ...current,
                                                                    [tier.id]: { ...draft, minPerOrder: Math.max(Number(eventTarget.target.value || 1), 1) },
                                                                }))
                                                            }
                                                        />
                                                        <Input
                                                            label="Max Per Order"
                                                            type="number"
                                                            min={1}
                                                            value={draft.maxPerOrder}
                                                            onChange={(eventTarget) =>
                                                                setTicketDrafts((current) => ({
                                                                    ...current,
                                                                    [tier.id]: { ...draft, maxPerOrder: Math.max(Number(eventTarget.target.value || 1), 1) },
                                                                }))
                                                            }
                                                        />

                                                        <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div>
                                                                    <p className="text-[12px] font-semibold text-[var(--v-text-primary)]">Available via promoters</p>
                                                                    <p className="mt-1 text-[12px] text-[var(--v-text-muted)]">Matches the create wizard ticket setting.</p>
                                                                </div>
                                                                <Toggle
                                                                    checked={draft.promoterEnabled}
                                                                    onChange={(value) =>
                                                                        setTicketDrafts((current) => ({
                                                                            ...current,
                                                                            [tier.id]: { ...draft, promoterEnabled: value },
                                                                        }))
                                                                    }
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="lg:col-span-2">
                                                            <TextArea
                                                                label="Description"
                                                                rows={4}
                                                                value={draft.description}
                                                                onChange={(eventTarget) =>
                                                                    setTicketDrafts((current) => ({
                                                                        ...current,
                                                                        [tier.id]: { ...draft, description: eventTarget.target.value },
                                                                    }))
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {!tickets?.tiers?.length && (
                                    <div className="overflow-hidden bg-[#262628]">
                                        <EmptyPanelCopy copy="No ticket tiers found for this event yet." />
                                    </div>
                                )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === "revenue" && (
                    <section className="space-y-6">
                        <EventSectionHeader title="Revenue" />

                        <RefreshBar
                            refreshedAt={revenueRefreshedAt}
                            isLoading={financeQuery.isFetching}
                            onRefresh={() => {
                                financeQuery.refetch();
                                setRevenueRefreshedAt(new Date());
                            }}
                        />

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <FinanceHighlightCard
                                label="Gross Collected"
                                value={formatINR(finance?.gross || 0)}
                                note="Total paid revenue captured for this event."
                                tone="positive"
                            />
                            <FinanceHighlightCard
                                label="Venue Retained"
                                value={formatINR(finance?.venueCommission || 0)}
                                note={`${Math.round((finance?.venueCommissionRate || 0) * 100)}% venue share kept at settlement.`}
                                tone="positive"
                            />
                            <FinanceHighlightCard
                                label={finance?.hostPayout ? "Host Payout Est." : "Organizer Net"}
                                value={formatINR(finance?.hostPayout?.estimate ?? finance?.net ?? 0)}
                                note={
                                    finance?.hostPayout?.paidAt
                                        ? `Paid ${formatRelativeDate(finance.hostPayout.paidAt)}`
                                        : finance?.hostPayout
                                            ? `${humanizeLabel(finance.hostPayout.status)} settlement`
                                            : "Net after platform fee, venue share, and refunds."
                                }
                                tone={(finance?.hostPayout?.estimate ?? finance?.net ?? 0) > 0 ? "positive" : "neutral"}
                            />
                            <FinanceHighlightCard
                                label="Partner Exposure"
                                value={formatINR(finance?.payoutSummary?.totalPartnerExposure || 0)}
                                note="Combined host and promoter payout responsibility."
                                tone={(finance?.payoutSummary?.totalPartnerExposure || 0) > 0 ? "warning" : "neutral"}
                            />
                        </div>

                        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                            <div className="space-y-6">
                                <SettlementFlowPanel
                                    settlementStatus={finance?.settlementStatus || "pending"}
                                    paidAt={finance?.paidAt || null}
                                    hostPayout={finance?.hostPayout || null}
                                    promoterTotal={finance?.payoutSummary?.promoterEstimate || 0}
                                    rows={[
                                        {
                                            label: "Gross revenue",
                                            value: formatINR(finance?.gross || 0),
                                            tone: "positive",
                                            detail: "All paid orders confirmed for this event.",
                                        },
                                        {
                                            label: "Platform fee",
                                            value: `− ${formatINR(finance?.platformFee || 0)}`,
                                            tone: "deduction",
                                            detail: "Processing and platform cost.",
                                        },
                                        {
                                            label: `Venue retained (${Math.round((finance?.venueCommissionRate || 0) * 100)}%)`,
                                            value: `− ${formatINR(finance?.venueCommission || 0)}`,
                                            tone: "positive",
                                            detail: "Venue-side commission held before organizer settlement.",
                                        },
                                        {
                                            label: "Refunds",
                                            value: `− ${formatINR(finance?.refundAmount || 0)}`,
                                            tone: "deduction",
                                            detail: "Returned to buyers.",
                                        },
                                        {
                                            label: finance?.hostPayout ? "Host payout estimate" : "Organizer net",
                                            value: formatINR(finance?.hostPayout?.estimate ?? finance?.net ?? 0),
                                            tone: "neutral",
                                            detail: finance?.hostPayout?.hostName
                                                ? `Projected payable to ${finance.hostPayout.hostName}.`
                                                : "Remaining organizer-side balance after deductions.",
                                            strong: true,
                                        },
                                        {
                                            label: "Promoter payout exposure",
                                            value: `− ${formatINR(finance?.payoutSummary?.promoterEstimate || 0)}`,
                                            tone: "deduction",
                                            detail: "Tracked separately from promoter-driven sales.",
                                        },
                                    ]}
                                />

                                <div className="grid gap-4 md:grid-cols-2">
                                    <MiniPanel
                                        title="Online"
                                        value={formatINR(finance?.onlineRevenue || 0)}
                                        note={`${formatNumber(finance?.onlineOrders || 0)} orders`}
                                    />
                                    <MiniPanel
                                        title="Walk-ins"
                                        value={formatINR(finance?.walkInRevenue || 0)}
                                        note={`${formatNumber(finance?.walkInOrders || 0)} orders`}
                                    />
                                </div>

                                <div className="grid gap-6 lg:grid-cols-2">
                                    <DataListPanel
                                        title="Revenue channels"
                                        subtitle="How money came in for this event."
                                        emptyCopy="No intake channel data available yet."
                                        rows={(finance?.intakeChannels || []).map((channel) => ({
                                            key: channel.label,
                                            label: channel.label,
                                            value: formatINRCompact(channel.amount),
                                            meta: `${formatNumber(channel.orders)} orders`,
                                        }))}
                                    />

                                    <DataListPanel
                                        title="Tier revenue"
                                        subtitle="Highest earning ticket tiers."
                                        emptyCopy="No tier revenue recorded yet."
                                        rows={(finance?.ticketMix || []).map((tier) => ({
                                            key: tier.tierId,
                                            label: tier.tierName,
                                            value: formatINRCompact(tier.revenue),
                                            meta: `${formatNumber(tier.sold)} sold`,
                                        }))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <PartnerPayoutPanel
                                    hostPayout={finance?.hostPayout || null}
                                    promoterPayouts={finance?.promoterPayouts || []}
                                />

                                <DataListPanel
                                    title="Payment sources"
                                    subtitle="Where paid orders cleared through."
                                    emptyCopy="No payment methods recorded yet."
                                    rows={(finance?.paymentSources || []).map((source) => ({
                                        key: source.label,
                                        label: source.label,
                                        value: formatINRCompact(source.amount),
                                        meta: `${formatNumber(source.orders)} orders`,
                                    }))}
                                />
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === "attendees" && (
                    <section className="space-y-6">
                        <EventSectionHeader title="Attendees" />

                        <RefreshBar
                            refreshedAt={attendeesRefreshedAt}
                            isLoading={attendeesQuery.isFetching}
                            onRefresh={() => {
                                attendeesQuery.refetch();
                                setAttendeesRefreshedAt(new Date());
                            }}
                        />

                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--v-text-secondary)]" />
                                <input
                                    value={attendeeSearch}
                                    onChange={(eventTarget) => setAttendeeSearch(eventTarget.target.value)}
                                    placeholder="Search by name, email or phone"
                                    className="h-12 w-full rounded-full border border-white/[0.05] bg-[#090A0C] pl-11 pr-5 text-[15px] text-white outline-none ring-0 placeholder:text-white/35"
                                />
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#161719]">
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/[0.04] bg-[#1D1E21] text-left text-[12px] font-semibold text-white/88">
                                            <th className="w-12 px-5 py-4" />
                                            <th className="px-5 py-4">Name</th>
                                            <th className="px-5 py-4">Tickets</th>
                                            <th className="px-5 py-4">Total Spend</th>
                                            <th className="px-5 py-4">Contact</th>
                                            <th className="px-5 py-4">Tags</th>
                                            <th className="px-5 py-4">Last Activity</th>
                                            <th className="w-12 px-5 py-4" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(attendees?.attendees || []).map((attendee) => {
                                            const tagItems = [
                                                ...(attendee.tags || []).slice(0, 2),
                                                attendee.isVip ? "VIP" : "",
                                                attendee.source ? humanizeLabel(attendee.source) : "",
                                            ].filter(Boolean).slice(0, 2);

                                            return (
                                                <tr
                                                    key={attendee.id}
                                                    className="cursor-pointer border-t border-white/[0.035] bg-[#232326] transition-colors hover:bg-[#29292D]"
                                                    onClick={() => {
                                                        setSelectedAttendeeId(attendee.attendeeId || attendee.id);
                                                        setSelectedOrderId(attendee.orderId || null);
                                                    }}
                                                >
                                                    <td className="px-5 py-4 align-middle">
                                                        <span className="block h-6 w-6 rounded-full border border-white/25 bg-[#111214]" />
                                                    </td>
                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[12px] font-bold text-white">
                                                                {attendee.fullName?.slice(0, 1).toUpperCase() || "A"}
                                                            </div>
                                                            <div>
                                                                <div className="text-[14px] font-medium text-white">{attendee.fullName}</div>
                                                                <div className="text-[12px] text-white/45">{attendee.ticketTier}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 align-middle text-[14px] tabular-nums text-white/88">
                                                        {formatNumber(attendee.quantity)}
                                                    </td>
                                                    <td className="px-5 py-4 align-middle text-[14px] tabular-nums text-white/88">
                                                        {formatINR(attendee.totalSpend)}
                                                    </td>
                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center gap-2 text-white">
                                                            {attendee.instagram ? (
                                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
                                                                    <Instagram className="h-4 w-4" />
                                                                </span>
                                                            ) : null}
                                                            {attendee.email ? (
                                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
                                                                    <Mail className="h-4 w-4" />
                                                                </span>
                                                            ) : null}
                                                            {attendee.phone ? (
                                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
                                                                    <Phone className="h-4 w-4" />
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center gap-2">
                                                            {tagItems.length > 0 ? (
                                                                tagItems.map((tag) => (
                                                                    <span
                                                                        key={`${attendee.id}-${tag}`}
                                                                        className="rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/88"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
                                                                    +
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 align-middle text-[14px] text-white/78">
                                                        {attendee.checkedInAt
                                                            ? formatDate(attendee.checkedInAt)
                                                            : attendee.purchasedAt
                                                                ? formatDate(attendee.purchasedAt)
                                                                : "No date"}
                                                    </td>
                                                    <td className="px-5 py-4 align-middle">
                                                        <button
                                                            type="button"
                                                            onClick={(eventTarget) => {
                                                                eventTarget.stopPropagation();
                                                                const thisId = attendee.attendeeId || attendee.id;
                                                                if (selectedAttendeeId === thisId) {
                                                                    clearAttendeeProfileSelection();
                                                                } else {
                                                                    setSelectedAttendeeId(thisId);
                                                                    setSelectedOrderId(attendee.orderId || null);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors",
                                                                selectedAttendeeId === (attendee.attendeeId || attendee.id)
                                                                    ? "bg-white text-black hover:bg-white/90"
                                                                    : "bg-black/45 hover:bg-black/65"
                                                            )}
                                                            aria-label="View attendee"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {attendeesQuery.isLoading && (
                                <div className="flex items-center justify-center gap-3 px-6 py-10 text-sm text-[var(--v-text-secondary)]">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading attendees...
                                </div>
                            )}

                            {!attendeesQuery.isLoading && !attendees?.attendees?.length && (
                                <EmptyPanelCopy copy="No attendees matched the current filters." />
                            )}
                        </div>

                        <div className="flex items-center justify-center gap-5 py-2">
                            <button
                                type="button"
                                onClick={() => setAttendeePage((current) => Math.max(current - 1, 1))}
                                disabled={(attendees?.pagination.page || 1) <= 1}
                                className="inline-flex h-[27px] w-[27px] items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-[var(--v-text-primary)] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label="Previous attendees page"
                            >
                                <ArrowLeft className="h-[10px] w-[10px]" />
                            </button>

                            <div className="min-w-[12px] text-center text-[15px] font-semibold leading-none tracking-[-0.05em] text-white">
                                {attendees?.pagination.page || 1}
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setAttendeePage((current) =>
                                        Math.min(current + 1, attendees?.pagination.totalPages || current)
                                    )
                                }
                                disabled={(attendees?.pagination.page || 1) >= (attendees?.pagination.totalPages || 1)}
                                className="inline-flex h-[27px] w-[27px] items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-[var(--v-text-primary)] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label="Next attendees page"
                            >
                                <ArrowLeft className="h-[10px] w-[10px] rotate-180" />
                            </button>
                        </div>

                        {(selectedAttendeeId || attendeeDetailQuery.isFetching) && (
                            <AttendeeTrackingPanel
                                attendeeDetail={attendeeDetail}
                                selectedOrder={selectedOrder}
                                selectedOrderId={selectedOrderId}
                                onSelectOrder={setSelectedOrderId}
                                onClose={clearAttendeeProfileSelection}
                                isLoading={attendeeDetailQuery.isFetching}
                                isSendingReceipt={resendReceiptMutation.isPending}
                                isUpdatingOrder={cancelOrderMutation.isPending}
                                canResendReceipt={canResendReceipt}
                                canCancelOrder={canCancelOrder}
                                canCancelAndRelist={canCancelAndRelist}
                                onResendReceipt={(orderId) => resendReceiptMutation.mutate(orderId)}
                                onCancelOrder={(orderId, mode) => cancelOrderMutation.mutate({ orderId, mode })}
                            />
                        )}
                    </section>
                )}

                {activeSection === "team" && eventId && (
                    <EventTeamTab
                        eventId={eventId}
                        promoters={promotersData?.promoters || []}
                        summary={promotersData?.summary}
                        isLoading={promotersQuery.isLoading}
                        onSave={savePromotersMutation.mutateAsync}
                    />
                )}

                {activeSection === "settings" && !activeSettingsBlock && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Settings Header */}
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-white/5 pb-8">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-[26px] font-bold tracking-tight text-white">
                                        Settings
                                    </h2>
                                </div>
                            </div>
                            <Button 
                                variant="secondary" 
                                className="bg-[#1A1A1A] border-white/5 hover:bg-[#222] text-[13px] font-bold h-11 px-6 rounded-xl transition-all"
                                icon={<ExternalLink className="h-4 w-4 text-white/40" />}
                            >
                                Export Event Report
                            </Button>
                        </div>

                        {/* Settings Grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <SettingsNavCard
                                icon={Info}
                                title="Event Info"
                                description="Event Name, Start & End Time, Description, Venue Info"
                                onClick={() => openSettingsBlock("eventInfo")}
                            />
                            <SettingsNavCard
                                icon={ShoppingCart}
                                title="Checkout"
                                description="Checkout Flow, Custom Checkout Fields, Event Fees, Buttons"
                                onClick={() => openSettingsBlock("checkout")}
                            />
                            <SettingsNavCard
                                icon={Megaphone}
                                title="Marketing"
                                description="Facebook Pixel, Tiktok Pixel, Third-party Marketplaces"
                                onClick={() => openSettingsBlock("marketing")}
                            />
                            <SettingsNavCard
                                icon={TrendingUp}
                                title="Promoters"
                                description="Track promoter links, tickets sold, revenue, and control access"
                                onClick={() => openSettingsBlock("promoters")}
                            />
                            <SettingsNavCard
                                icon={Users}
                                title="Social Features"
                                description="Configure social features layout and display threshold"
                                onClick={() => openSettingsBlock("socialFeatures")}
                            />
                            <SettingsNavCard
                                icon={Lock}
                                title="Privacy"
                                description="Password protect the event page for added privacy"
                                onClick={() => openSettingsBlock("privacy")}
                            />
                            <SettingsNavCard
                                icon={ShieldCheck}
                                title="Policies"
                                description="Terms of Service & Refund Policy"
                                onClick={() => openSettingsBlock("policies")}
                            />
                            <SettingsNavCard
                                icon={Palette}
                                title="Branding"
                                description="Change the display name of your organization"
                                onClick={() => openSettingsBlock("branding")}
                            />
                            <SettingsNavCard
                                icon={Code2}
                                title="Embed"
                                description="Embed checkout for this event on another website"
                                onClick={() => openSettingsBlock("embed")}
                            />
                        </div>
                    </div>
                )}

                {activeSection === "settings" && activeSettingsBlock && (
                    <section className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <button 
                                onClick={closeSettingsBlock}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                {humanizeLabel(activeSettingsBlock)}
                            </h2>
                        </div>

                        <div className="grid gap-6">
                            {activeSettingsBlock === "eventInfo" && (
                                <SettingsBlock
                                    icon={Info}
                                    title="Event Info"
                                    description={
                                        canEditFoundation
                                            ? "Update event identity, schedule, venue details, capacity, and poster."
                                            : "Published events keep title, schedule, venue, and capacity locked. Description and artwork remain editable."
                                    }
                                    action={
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={savingBlockId === "eventInfo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            onClick={handleSaveEventInfo}
                                            disabled={savingBlockId === "eventInfo"}
                                        >
                                            Save Event Info
                                        </Button>
                                    }
                                >
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Input
                                            label="Event title"
                                            value={eventInfoDraft.title}
                                            onChange={(eventTarget) => setEventInfoDraft((current) => ({ ...current, title: eventTarget.target.value }))}
                                            disabled={!canEditFoundation}
                                        />
                                        <Input
                                            label="Cover image URL"
                                            value={eventInfoDraft.coverImage}
                                            onChange={(eventTarget) => setEventInfoDraft((current) => ({ ...current, coverImage: eventTarget.target.value }))}
                                        />
                                        <div className="md:col-span-2">
                                            <TextArea
                                                label="Short description"
                                                value={eventInfoDraft.shortDescription}
                                                onChange={(eventTarget) =>
                                                    setEventInfoDraft((current) => ({ ...current, shortDescription: eventTarget.target.value }))
                                                }
                                                rows={3}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <TextArea
                                                label="Full description"
                                                value={eventInfoDraft.description}
                                                onChange={(eventTarget) =>
                                                    setEventInfoDraft((current) => ({ ...current, description: eventTarget.target.value }))
                                                }
                                                rows={5}
                                            />
                                        </div>
                                        <Input
                                            label="Venue name"
                                            value={eventInfoDraft.venue}
                                            onChange={(eventTarget) => setEventInfoDraft((current) => ({ ...current, venue: eventTarget.target.value }))}
                                            disabled={!canEditFoundation}
                                        />
                                        <Input
                                            label="Venue address"
                                            value={eventInfoDraft.venueAddress}
                                            onChange={(eventTarget) =>
                                                setEventInfoDraft((current) => ({ ...current, venueAddress: eventTarget.target.value }))
                                            }
                                            disabled={!canEditFoundation}
                                        />
                                        <Input
                                            label="City"
                                            value={eventInfoDraft.city}
                                            onChange={(eventTarget) => setEventInfoDraft((current) => ({ ...current, city: eventTarget.target.value }))}
                                            disabled={!canEditFoundation}
                                        />
                                        <Input
                                            label="Timezone"
                                            value={eventInfoDraft.timezone}
                                            onChange={(eventTarget) => setEventInfoDraft((current) => ({ ...current, timezone: eventTarget.target.value }))}
                                            disabled={!canEditFoundation}
                                        />
                                        <Input
                                            label="Start date"
                                            type="datetime-local"
                                            value={eventInfoDraft.startDate}
                                            onChange={(eventTarget) =>
                                                setEventInfoDraft((current) => ({ ...current, startDate: eventTarget.target.value }))
                                            }
                                            disabled={!canEditFoundation}
                                        />
                                        <Input
                                            label="End date"
                                            type="datetime-local"
                                            value={eventInfoDraft.endDate}
                                            onChange={(eventTarget) =>
                                                setEventInfoDraft((current) => ({ ...current, endDate: eventTarget.target.value }))
                                            }
                                            disabled={!canEditFoundation}
                                        />
                                        <Input
                                            label="Capacity"
                                            type="number"
                                            value={String(eventInfoDraft.capacity)}
                                            onChange={(eventTarget) =>
                                                setEventInfoDraft((current) => ({ ...current, capacity: Number(eventTarget.target.value || 0) }))
                                            }
                                            disabled={!canEditFoundation}
                                        />
                                    </div>
                                </SettingsBlock>
                            )}

                            {activeSettingsBlock === "checkout" && (
                                <SettingsBlock
                                    icon={ShoppingCart}
                                    title="Checkout"
                                    description="Confirmation copy and checkout surface controls."
                                    action={buildBlockAction("checkout", savingBlockId, handleSaveSettingsBlock)}
                                >
                                    <div className="grid gap-4">
                                        <TextArea
                                            label="Confirmation message"
                                            value={settingsDraft.checkout.confirmationMessage}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    checkout: { ...current.checkout, confirmationMessage: eventTarget.target.value },
                                                }))
                                            }
                                            rows={3}
                                        />
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <Input
                                                label="Submit button text"
                                                value={settingsDraft.checkout.submitButtonText}
                                                onChange={(eventTarget) =>
                                                    setSettingsDraft((current) => ({
                                                        ...current,
                                                        checkout: { ...current.checkout, submitButtonText: eventTarget.target.value },
                                                    }))
                                                }
                                            />
                                            <Input
                                                label="Helper text"
                                                value={settingsDraft.checkout.helperText}
                                                onChange={(eventTarget) =>
                                                    setSettingsDraft((current) => ({
                                                        ...current,
                                                        checkout: { ...current.checkout, helperText: eventTarget.target.value },
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <ToggleRow
                                                label="Include fees in ticket price"
                                                description="Display all-in pricing during checkout."
                                                checked={settingsDraft.checkout.includeFeesInPrice}
                                                onChange={(value) =>
                                                    setSettingsDraft((current) => ({
                                                        ...current,
                                                        checkout: { ...current.checkout, includeFeesInPrice: value },
                                                    }))
                                                }
                                            />
                                            <ToggleRow
                                                label="Use long-form CTA button"
                                                description="Longer add-to-cart button treatment."
                                                checked={settingsDraft.checkout.longFormButton}
                                                onChange={(value) =>
                                                    setSettingsDraft((current) => ({
                                                        ...current,
                                                        checkout: { ...current.checkout, longFormButton: value },
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>
                                </SettingsBlock>
                            )}

                            {activeSettingsBlock === "marketing" && (
                                <SettingsBlock
                                    icon={Megaphone}
                                    title="Marketing"
                                    description="Pixels, external distribution, and tracking configuration."
                                    action={buildBlockAction("marketing", savingBlockId, handleSaveSettingsBlock)}
                                >
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <ToggleRow
                                            label="Third-party site display"
                                            description="Allow the event to appear on connected marketplaces."
                                            checked={settingsDraft.marketing.thirdPartySiteDisplay}
                                            onChange={(value) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    marketing: { ...current.marketing, thirdPartySiteDisplay: value },
                                                }))
                                            }
                                        />
                                        <div />
                                        <Input
                                            label="Facebook Pixel ID"
                                            value={settingsDraft.marketing.facebookPixelId}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    marketing: { ...current.marketing, facebookPixelId: eventTarget.target.value },
                                                }))
                                            }
                                        />
                                        <Input
                                            label="TikTok Pixel ID"
                                            value={settingsDraft.marketing.tiktokPixelId}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    marketing: { ...current.marketing, tiktokPixelId: eventTarget.target.value },
                                                }))
                                            }
                                        />
                                        <Input
                                            label="Google Tag Manager ID"
                                            value={settingsDraft.marketing.gtmId}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    marketing: { ...current.marketing, gtmId: eventTarget.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                </SettingsBlock>
                            )}

                            {activeSettingsBlock === "promoters" && (
                                <PromotersSettingsPanel
                                    promoters={promotersData?.promoters || []}
                                    summary={promotersData?.summary}
                                    promoterSettings={promotersData?.promoterSettings || {
                                        enabled: Boolean(event?.promoterSettings?.enabled),
                                        allowedPromoterIds: event?.promoterSettings?.allowedPromoterIds || [],
                                        mode: event?.promoterSettings?.enabled
                                            ? ((event?.promoterSettings?.allowedPromoterIds || []).length > 0 ? "selected" : "all")
                                            : "none",
                                    }}
                                    selectedPromoterIds={selectedPromoterIds}
                                    isLoading={promotersQuery.isLoading}
                                    isSaving={savingBlockId === "promoters"}
                                    onTogglePromoter={handleTogglePromoter}
                                    onEnableAll={() => handleSavePromoters("all")}
                                    onEnableSelected={() => handleSavePromoters("selected")}
                                    onDisableSelected={handleDisableSelectedPromoters}
                                    onDisableAll={() => handleSavePromoters("none")}
                                />
                            )}

                            {activeSettingsBlock === "socialFeatures" && (
                                <SettingsBlock
                                    icon={Users}
                                    title="Social Features"
                                    description="Guestlist presentation and social activity controls."
                                    action={buildBlockAction("socialFeatures", savingBlockId, handleSaveSettingsBlock)}
                                >
                                    <div className="grid gap-3">
                                        <ToggleRow
                                            label="Public guestlist"
                                            description="Show attendee list visibility on the event page."
                                            checked={settingsDraft.socialFeatures.publicGuestlist}
                                            onChange={(value) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    socialFeatures: { ...current.socialFeatures, publicGuestlist: value },
                                                }))
                                            }
                                        />
                                        <ToggleRow
                                            label="Disable guestlist"
                                            description="Hide guestlist entirely, even for approved visitors."
                                            checked={settingsDraft.socialFeatures.disableGuestlist}
                                            onChange={(value) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    socialFeatures: { ...current.socialFeatures, disableGuestlist: value },
                                                }))
                                            }
                                        />
                                        <ToggleRow
                                            label="Hide number attending"
                                            description="Suppress the visible attendance count."
                                            checked={settingsDraft.socialFeatures.hideNumberAttending}
                                            onChange={(value) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    socialFeatures: { ...current.socialFeatures, hideNumberAttending: value },
                                                }))
                                            }
                                        />
                                        <ToggleRow
                                            label="Activity enabled"
                                            description="Let new guest actions appear on the event activity feed."
                                            checked={settingsDraft.socialFeatures.activityEnabled}
                                            onChange={(value) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    socialFeatures: { ...current.socialFeatures, activityEnabled: value },
                                                }))
                                            }
                                        />
                                        <Input
                                            label="Guestlist display threshold"
                                            type="number"
                                            value={String(settingsDraft.socialFeatures.guestlistDisplayThreshold)}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    socialFeatures: {
                                                        ...current.socialFeatures,
                                                        guestlistDisplayThreshold: Number(eventTarget.target.value || 0),
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                </SettingsBlock>
                            )}

                            {activeSettingsBlock === "privacy" && (
                                <SettingsBlock
                                    icon={Lock}
                                    title="Privacy"
                                    description="Password-protect the page when stricter access is required."
                                    action={buildBlockAction("privacy", savingBlockId, handleSaveSettingsBlock)}
                                >
                                    <div className="grid gap-4">
                                        <ToggleRow
                                            label="Password protection"
                                            description="Require a password before visitors can access the event page."
                                            checked={settingsDraft.privacy.passwordProtected}
                                            onChange={(value) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    privacy: { ...current.privacy, passwordProtected: value },
                                                }))
                                            }
                                        />
                                        <Input
                                            label="Event password"
                                            value={settingsDraft.privacy.eventPassword}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    privacy: { ...current.privacy, eventPassword: eventTarget.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                </SettingsBlock>
                            )}

                            {activeSettingsBlock === "policies" && (
                                <SettingsBlock
                                    icon={ShieldCheck}
                                    title="Policies"
                                    description="Terms and refund language shown with the event."
                                    action={buildBlockAction("policies", savingBlockId, handleSaveSettingsBlock)}
                                >
                                    <div className="grid gap-4">
                                        <TextArea
                                            label="Terms of service"
                                            value={settingsDraft.policies.termsOfService}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    policies: { ...current.policies, termsOfService: eventTarget.target.value },
                                                }))
                                            }
                                            rows={4}
                                        />
                                        <TextArea
                                            label="Refund policy"
                                            value={settingsDraft.policies.refundPolicy}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    policies: { ...current.policies, refundPolicy: eventTarget.target.value },
                                                }))
                                            }
                                            rows={4}
                                        />
                                    </div>
                                </SettingsBlock>
                            )}

                            {activeSettingsBlock === "branding" && (
                                <SettingsBlock
                                    icon={Palette}
                                    title="Branding"
                                    description="Organization name and visual identity presented with the event."
                                    action={buildBlockAction("branding", savingBlockId, handleSaveSettingsBlock)}
                                >
                                    <div className="grid gap-4">
                                        <Input
                                            label="Organization display name"
                                            value={settingsDraft.branding.organizationDisplayName}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    branding: { ...current.branding, organizationDisplayName: eventTarget.target.value },
                                                }))
                                            }
                                        />
                                        <Input
                                            label="Organization logo URL"
                                            value={settingsDraft.branding.organizationDisplayLogo}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    branding: { ...current.branding, organizationDisplayLogo: eventTarget.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                </SettingsBlock>
                            )}

                            {activeSettingsBlock === "embed" && (
                                <SettingsBlock
                                    icon={Code2}
                                    title="Embed"
                                    description="Surface this event checkout on external pages."
                                    action={buildBlockAction("embed", savingBlockId, handleSaveSettingsBlock)}
                                >
                                    <div className="grid gap-4">
                                        <ToggleRow
                                            label="Embed enabled"
                                            description="Allow third-party sites to display the event checkout."
                                            checked={settingsDraft.embed.enabled}
                                            onChange={(value) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    embed: { ...current.embed, enabled: value },
                                                }))
                                            }
                                        />
                                        <TextArea
                                            label="Embed code"
                                            value={settingsDraft.embed.embedCode}
                                            onChange={(eventTarget) =>
                                                setSettingsDraft((current) => ({
                                                    ...current,
                                                    embed: { ...current.embed, embedCode: eventTarget.target.value },
                                                }))
                                            }
                                            rows={5}
                                        />
                                    </div>
                                </SettingsBlock>
                            )}

                        </div>
                    </section>
                )}
            </div>

        </div>
    );
}

function buildEventInfoDraft(event: EventDetail): EventInfoDraft {
    return {
        title: event.title || "",
        shortDescription: event.shortDescription || "",
        description: event.description || "",
        venue: event.venue || "",
        venueAddress: event.venueAddress || "",
        city: event.city || "",
        timezone: event.settings?.eventInfo?.timezone || "Asia/Kolkata",
        startDate: toLocalDateTimeInput(event.startDate),
        endDate: toLocalDateTimeInput(event.endDate),
        coverImage: event.coverImage || event.image || "",
        capacity: Number(event.capacity || 0),
    };
}

function hydrateSettings(settings?: Partial<EventSettings>): EventSettings {
    return {
        ...EMPTY_SETTINGS,
        ...(settings || {}),
        eventInfo: { ...EMPTY_SETTINGS.eventInfo, ...(settings?.eventInfo || {}) },
        checkout: { ...EMPTY_SETTINGS.checkout, ...(settings?.checkout || {}) },
        marketing: { ...EMPTY_SETTINGS.marketing, ...(settings?.marketing || {}) },
        socialFeatures: { ...EMPTY_SETTINGS.socialFeatures, ...(settings?.socialFeatures || {}) },
        privacy: { ...EMPTY_SETTINGS.privacy, ...(settings?.privacy || {}) },
        policies: { ...EMPTY_SETTINGS.policies, ...(settings?.policies || {}) },
        branding: { ...EMPTY_SETTINGS.branding, ...(settings?.branding || {}) },
        embed: { ...EMPTY_SETTINGS.embed, ...(settings?.embed || {}) },
    };
}

function buildSettingsPayload(blockId: SettingsBlockId, settings: EventSettings) {
    switch (blockId) {
        case "checkout":
            return {
                confirmationMessage: settings.checkout.confirmationMessage,
                includeFeesInPrice: settings.checkout.includeFeesInPrice,
                longFormAddToCartButton: settings.checkout.longFormButton,
                checkoutSubmitButtonText: settings.checkout.submitButtonText,
                checkoutHelperText: settings.checkout.helperText,
            };
        case "marketing":
            return {
                thirdPartySiteDisplay: settings.marketing.thirdPartySiteDisplay,
                facebookPixelId: settings.marketing.facebookPixelId,
                tiktokPixelId: settings.marketing.tiktokPixelId,
                gtmId: settings.marketing.gtmId,
            };
        case "socialFeatures":
            return {
                disableGuestlist: settings.socialFeatures.disableGuestlist,
                hideNumberAttending: settings.socialFeatures.hideNumberAttending,
                guestlistDisplayThreshold: settings.socialFeatures.guestlistDisplayThreshold,
                publicGuestlist: settings.socialFeatures.publicGuestlist,
                activityEnabled: settings.socialFeatures.activityEnabled,
            };
        case "privacy":
            return {
                passwordProtected: settings.privacy.passwordProtected,
                eventPassword: settings.privacy.eventPassword,
            };
        case "policies":
            return {
                termsOfService: settings.policies.termsOfService,
                refundPolicy: settings.policies.refundPolicy,
            };
        case "branding":
            return {
                organizationDisplayName: settings.branding.organizationDisplayName,
                organizationDisplayLogo: settings.branding.organizationDisplayLogo,
            };
        case "embed":
            return {
                embedEnabled: settings.embed.enabled,
                embedCode: settings.embed.embedCode,
            };
        default:
            return {};
    }
}

function buildBlockAction(
    blockId: SettingsBlockId,
    savingBlockId: string | null,
    onSave: (blockId: SettingsBlockId) => Promise<void>
) {
    return (
        <Button
            variant="secondary"
            size="sm"
            icon={savingBlockId === blockId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            onClick={() => onSave(blockId)}
            disabled={savingBlockId === blockId}
        >
            Save
        </Button>
    );
}

function SectionShell({
    title,
    description,
    icon: Icon,
    actions,
    children,
}: {
    title: string;
    description: string;
    icon: React.ElementType;
    actions?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-6">
            <div className="flex flex-col gap-4 rounded-[28px] border border-border-default bg-[var(--v-card)] p-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(244,74,34,0.12)] text-[var(--v-orange)]">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-[var(--v-text-primary)]">{title}</h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--v-text-secondary)]">{description}</p>
                    </div>
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
            {children}
        </section>
    );
}

function EventSectionHeader({
    title,
    actions,
}: {
    title: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-5 border-b border-white/5 pb-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-[26px] font-bold tracking-tight text-white">
                        {title}
                    </h2>
                </div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
    );
}

function HeaderStatCard({
    label,
    value,
    subtext,
    icon: Icon,
}: {
    label: string;
    value: string;
    subtext?: string;
    icon: React.ElementType;
}) {
    return (
        <div className="rounded-[22px] bg-white/[0.045] p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">{label}</p>
                <Icon className="h-4 w-4 text-[var(--v-orange)]" />
            </div>
            <p className="mt-3 text-2xl font-black tracking-tight text-[var(--v-text-primary)]">{value}</p>
            {subtext ? <p className="mt-2 text-[12px] text-[var(--v-text-secondary)]">{subtext}</p> : null}
        </div>
    );
}

function MetricTile({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="rounded-[24px] border border-border-default bg-[var(--v-card)] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-[var(--v-text-primary)]">{value}</p>
            <p className="mt-2 text-sm text-[var(--v-text-secondary)]">{note}</p>
        </div>
    );
}

function FinanceHighlightCard({
    label,
    value,
    note,
    tone,
}: {
    label: string;
    value: string;
    note: string;
    tone: "positive" | "warning" | "neutral";
}) {
    const palette = {
        positive: {
            border: "rgba(52, 211, 153, 0.18)",
            background: "linear-gradient(180deg, rgba(8,32,21,0.96), rgba(10,16,13,0.96))",
            glow: "0 18px 44px rgba(16,185,129,0.12)",
            value: "#86efac",
        },
        warning: {
            border: "rgba(248, 113, 113, 0.18)",
            background: "linear-gradient(180deg, rgba(39,13,13,0.96), rgba(17,11,11,0.96))",
            glow: "0 18px 44px rgba(239,68,68,0.12)",
            value: "#fca5a5",
        },
        neutral: {
            border: "rgba(255,255,255,0.08)",
            background: "var(--v-card)",
            glow: "none",
            value: "var(--v-text-primary)",
        },
    } as const;

    return (
        <div
            className="rounded-[24px] border p-5"
            style={{
                borderColor: palette[tone].border,
                background: palette[tone].background,
                boxShadow: palette[tone].glow,
            }}
        >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">{label}</p>
            <p className="mt-3 text-[28px] font-semibold tracking-tight" style={{ color: palette[tone].value }}>
                {value}
            </p>
            <p className="mt-2 text-sm text-[var(--v-text-secondary)]">{note}</p>
        </div>
    );
}

function TicketSummaryTile({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note: string;
}) {
    return (
        <div className="rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))] px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">{label}</p>
            <p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-white">{value}</p>
            <p className="mt-2 text-sm text-[var(--v-text-secondary)]">{note}</p>
        </div>
    );
}

function TicketMetric({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note?: string;
}) {
    return (
        <div className="rounded-[22px] border border-white/6 bg-black/20 px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--v-text-secondary)]">{label}</p>
            <p className="mt-3 text-[22px] font-semibold leading-none tracking-tight tabular-nums text-white">{value}</p>
            {note ? <p className="mt-2 text-[12px] text-[var(--v-text-muted)]">{note}</p> : null}
        </div>
    );
}

function ChartPanel({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-[28px] border border-border-default bg-[var(--v-card)] p-6">
            <div className="mb-5">
                <h3 className="text-lg font-semibold text-[var(--v-text-primary)]">{title}</h3>
                <p className="mt-1 text-sm text-[var(--v-text-secondary)]">{description}</p>
            </div>
            {children}
        </div>
    );
}

function DataListPanel({
    title,
    subtitle,
    rows,
    emptyCopy,
}: {
    title: string;
    subtitle: string;
    rows: Array<{ key: string; label: string; value: string; meta?: string }>;
    emptyCopy?: string;
}) {
    return (
        <div className="rounded-[28px] border border-border-default bg-[var(--v-card)] p-6">
            <div>
                <h3 className="text-lg font-semibold text-[var(--v-text-primary)]">{title}</h3>
                <p className="mt-1 text-sm text-[var(--v-text-secondary)]">{subtitle}</p>
            </div>
            <div className="mt-5 space-y-3">
                {rows.length > 0 ? (
                    rows.map((row) => (
                        <div
                            key={row.key}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--v-text-primary)]">{row.label}</p>
                                {row.meta ? (
                                    <p className="mt-1 text-[12px] text-[var(--v-text-secondary)]">{row.meta}</p>
                                ) : null}
                            </div>
                            <div className="text-right text-sm font-semibold text-[var(--v-text-primary)]">{row.value}</div>
                        </div>
                    ))
                ) : (
                    <EmptyPanelCopy copy={emptyCopy || "No data available yet."} compact />
                )}
            </div>
        </div>
    );
}

function BreakdownRow({
    label,
    value,
    tone,
    detail,
    strong = false,
}: {
    label: string;
    value: string;
    tone?: "positive" | "deduction" | "neutral";
    detail?: string;
    strong?: boolean;
}) {
    return (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
                <span className="text-sm text-[var(--v-text-secondary)]">{label}</span>
                {detail ? <p className="mt-1 text-[12px] text-[var(--v-text-muted)]">{detail}</p> : null}
            </div>
            <span
                className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    strong ? "text-[var(--v-text-primary)] text-base" : "text-[var(--v-text-secondary)]",
                    tone === "positive" && "text-emerald-300",
                    tone === "deduction" && "text-rose-400",
                    tone === "neutral" && "text-[var(--v-text-primary)]"
                )}
            >
                {value}
            </span>
        </div>
    );
}

function SettlementFlowPanel({
    settlementStatus,
    paidAt,
    hostPayout,
    promoterTotal,
    rows,
}: {
    settlementStatus: string;
    paidAt: string | null;
    hostPayout: FinanceData["hostPayout"];
    promoterTotal: number;
    rows: Array<{
        label: string;
        value: string;
        tone?: "positive" | "deduction" | "neutral";
        detail?: string;
        strong?: boolean;
    }>;
}) {
    return (
        <div className="rounded-[28px] border border-border-default bg-[var(--v-card)] p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-[var(--v-text-primary)]">Payout understanding</h3>
                    <p className="mt-1 text-sm text-[var(--v-text-secondary)]">
                        Clear read on what the venue keeps and what still needs to move out.
                    </p>
                </div>
                <StatusPill status={settlementStatus} compact />
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-2">
                <PayoutCallout
                    title="Host side"
                    value={formatINR(hostPayout?.estimate || 0)}
                    note={
                        hostPayout?.hostName
                            ? `${hostPayout.hostName} · ${humanizeLabel(hostPayout.status)}`
                            : "No host settlement attached to this event."
                    }
                    tone={hostPayout ? "positive" : "neutral"}
                />
                <PayoutCallout
                    title="Promoter side"
                    value={formatINR(promoterTotal)}
                    note={promoterTotal > 0 ? "Commission exposure across assigned promoters." : "No promoter payout exposure yet."}
                    tone={promoterTotal > 0 ? "warning" : "neutral"}
                />
            </div>

            <div className="space-y-2">
                {rows.map((row) => (
                    <BreakdownRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        tone={row.tone}
                        detail={row.detail}
                        strong={row.strong}
                    />
                ))}
            </div>

            <p className="mt-5 text-[12px] text-[var(--v-text-muted)]">
                {paidAt
                    ? `Settlement last moved ${formatRelativeDate(paidAt)}.`
                    : "No completed settlement recorded yet for this event."}
            </p>
        </div>
    );
}

function PayoutCallout({
    title,
    value,
    note,
    tone,
}: {
    title: string;
    value: string;
    note: string;
    tone: "positive" | "warning" | "neutral";
}) {
    const styles = {
        positive: "border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-300",
        warning: "border-rose-500/15 bg-rose-500/[0.08] text-rose-300",
        neutral: "border-white/8 bg-white/[0.03] text-[var(--v-text-primary)]",
    };

    return (
        <div className={cn("rounded-[22px] border px-4 py-4", styles[tone])}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">{title}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
            <p className="mt-2 text-sm text-[var(--v-text-secondary)]">{note}</p>
        </div>
    );
}

function PartnerPayoutPanel({
    hostPayout,
    promoterPayouts,
}: {
    hostPayout: FinanceData["hostPayout"];
    promoterPayouts: NonNullable<FinanceData["promoterPayouts"]>;
}) {
    return (
        <div className="rounded-[28px] border border-border-default bg-[var(--v-card)] p-6">
            <div>
                <h3 className="text-lg font-semibold text-[var(--v-text-primary)]">Partner payouts</h3>
                <p className="mt-1 text-sm text-[var(--v-text-secondary)]">
                    Host and promoter settlement context for this event.
                </p>
            </div>

            <div className="mt-5 space-y-3">
                {hostPayout ? (
                    <PartnerPayoutRow
                        label={hostPayout.hostName || "Host"}
                        value={formatINR(hostPayout.estimate)}
                        meta={`Host payout · ${humanizeLabel(hostPayout.status)}`}
                        status={hostPayout.status}
                    />
                ) : null}

                {promoterPayouts.map((promoter) => (
                    <PartnerPayoutRow
                        key={promoter.assignmentId}
                        label={promoter.promoterName}
                        value={formatINR(promoter.estimatedCommission)}
                        meta={`${promoter.commissionRate}% of ${formatINRCompact(promoter.revenue)} · ${formatNumber(promoter.sales)} sales`}
                        status={promoter.status}
                    />
                ))}

                {!hostPayout && promoterPayouts.length === 0 ? (
                    <EmptyPanelCopy copy="No host or promoter payouts are linked to this event yet." compact />
                ) : null}
            </div>
        </div>
    );
}

function PartnerPayoutRow({
    label,
    value,
    meta,
    status,
}: {
    label: string;
    value: string;
    meta: string;
    status: string;
}) {
    const isPositive = ["paid", "settled", "completed"].includes(String(status || "").toLowerCase());

    return (
        <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--v-text-primary)]">{label}</p>
                    <p className="mt-1 text-[12px] text-[var(--v-text-secondary)]">{meta}</p>
                </div>
                <div className="text-right">
                    <p className={cn("text-sm font-semibold tabular-nums", isPositive ? "text-emerald-300" : "text-rose-300")}>
                        {value}
                    </p>
                    <div className="mt-2">
                        <StatusPill status={status} compact />
                    </div>
                </div>
            </div>
        </div>
    );
}

function MiniPanel({ title, value, note }: { title: string; value: string; note: string }) {
    return (
        <div className="rounded-[22px] border border-[var(--v-border)] bg-[var(--v-card)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">{title}</p>
            <p className="mt-3 text-xl font-semibold text-[var(--v-text-primary)]">{value}</p>
            <p className="mt-2 text-sm text-[var(--v-text-secondary)]">{note}</p>
        </div>
    );
}

function PromotersSettingsPanel({
    promoters,
    summary,
    promoterSettings,
    selectedPromoterIds,
    isLoading,
    isSaving,
    onTogglePromoter,
    onEnableAll,
    onEnableSelected,
    onDisableSelected,
    onDisableAll,
}: {
    promoters: EventPromoterRow[];
    summary?: EventPromotersResponse["summary"];
    promoterSettings: EventPromotersResponse["promoterSettings"];
    selectedPromoterIds: string[];
    isLoading: boolean;
    isSaving: boolean;
    onTogglePromoter: (promoterId: string) => void;
    onEnableAll: () => void;
    onEnableSelected: () => void;
    onDisableSelected: () => void;
    onDisableAll: () => void;
}) {
    const selectedCount = selectedPromoterIds.length;
    const activeCount = promoters.filter((promoter) => promoter.isSelected).length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-[var(--v-text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading promoter performance...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-white/6 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <PromoterSignalPill label="Revenue" value={formatINR(summary?.revenue || 0)} />
                    <PromoterSignalPill label="Active" value={String(summary?.activePromoters ?? activeCount)} />
                    <PromoterSignalPill label="Traffic" value={formatNumber(summary?.clicks || 0)} />
                    <PromoterSignalPill label="Selected" value={String(selectedCount)} />
                    <StatusPill status={promoterSettings.mode === "none" ? "disabled" : promoterSettings.mode} compact />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onEnableAll}
                        disabled={isSaving}
                    >
                        Enable All
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onEnableSelected}
                        disabled={isSaving || selectedCount === 0}
                    >
                        Enable Selected
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onDisableSelected}
                        disabled={isSaving || selectedCount === 0}
                    >
                        Disable Selected
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onDisableAll}
                        disabled={isSaving}
                        icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    >
                        Disable All
                    </Button>
                </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white/6 bg-[#131316]">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead className="bg-white/[0.02]">
                            <tr className="text-left">
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Select</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Promoter</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Code</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Tickets</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Revenue</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Clicks</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Commission</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promoters.map((promoter) => {
                                const promoterId = promoter.promoterId ? String(promoter.promoterId) : "";
                                const isChecked = promoterId ? selectedPromoterIds.includes(promoterId) : false;

                                return (
                                    <tr
                                        key={promoter.assignmentId || promoter.id}
                                        className={cn(
                                            "border-t border-white/6 transition-colors",
                                            isChecked ? "bg-[#EBB440]/[0.06]" : "bg-transparent hover:bg-white/[0.02]"
                                        )}
                                    >
                                        <td className="px-4 py-3 align-middle">
                                            <button
                                                type="button"
                                                disabled={!promoterId || isSaving}
                                                onClick={() => promoterId && onTogglePromoter(promoterId)}
                                                className={cn(
                                                    "inline-flex h-5 w-5 items-center justify-center rounded border transition-colors",
                                                    isChecked
                                                        ? "border-[#EBB440] bg-[#EBB440] text-black"
                                                        : "border-white/14 bg-transparent text-transparent",
                                                    (!promoterId || isSaving) && "cursor-not-allowed opacity-45"
                                                )}
                                                aria-label={`Toggle ${promoter.promoterName}`}
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/[0.05]">
                                                    {promoter.avatar ? (
                                                        <img src={promoter.avatar} alt={promoter.promoterName} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-semibold text-white/72">
                                                            {promoter.promoterName.slice(0, 1).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-white">{promoter.promoterName}</p>
                                                    <p className="truncate text-xs text-white/40">{promoter.assignedAt ? formatRelativeDate(promoter.assignedAt) : "No assignment date"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white/68">{promoter.shortCode || "—"}</td>
                                        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-white">{formatNumber(promoter.sales || 0)}</td>
                                        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-white">{formatINRCompact(promoter.revenue || 0)}</td>
                                        <td className="px-4 py-3 text-sm tabular-nums text-white/68">{formatNumber(promoter.clicks || 0)}</td>
                                        <td className="px-4 py-3 text-sm text-white/68">{promoter.commissionRate}%</td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={promoter.status || (promoter.isSelected ? "active" : "disabled")} compact />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {promoters.length === 0 ? (
                    <EmptyPanelCopy copy="No promoters have generated or been assigned links for this event yet." compact />
                ) : null}
            </div>
        </div>
    );
}

function PromoterSignalPill({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">{label}</span>
            <span className="ml-3 text-sm font-semibold text-white">{value}</span>
        </div>
    );
}

function ToggleRow({
    label,
    description,
    checked,
    onChange,
    disabled = false,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 rounded-[22px] border border-[var(--v-border)] bg-[var(--v-card)] px-4 py-3">
            <div className="flex-1">
                <div className="text-[13px] font-medium text-[var(--v-text-primary)]">{label}</div>
                <div className="text-[11px] text-[var(--v-text-secondary)]">{description}</div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className={cn(
                    "relative h-[22px] w-10 shrink-0 rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40",
                    checked ? "bg-[var(--v-orange)]" : "bg-[var(--v-elevated)]"
                )}
            >
                <span
                    className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        checked ? "translate-x-5" : "translate-x-0.5"
                    )}
                />
            </button>
        </div>
    );
}

function SettingsBlock({
    icon: Icon,
    title,
    description,
    action,
    children,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    action: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-[28px] border border-border-default bg-[var(--v-card)] p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[var(--v-orange)]">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--v-text-primary)]">{title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--v-text-secondary)]">{description}</p>
                    </div>
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

function EmptyPanelCopy({ copy, compact = false }: { copy: string; compact?: boolean }) {
    return (
        <div className={cn("flex items-center justify-center px-6 text-center text-sm text-[var(--v-text-secondary)]", compact ? "py-8" : "py-12")}>
            {copy}
        </div>
    );
}

function AttendeeTrackingPanel({
    attendeeDetail,
    selectedOrder,
    selectedOrderId,
    onSelectOrder,
    onClose,
    isLoading,
    isSendingReceipt,
    isUpdatingOrder,
    canResendReceipt,
    canCancelOrder,
    canCancelAndRelist,
    onResendReceipt,
    onCancelOrder,
}: {
    attendeeDetail?: AttendeeTrackingResponse;
    selectedOrder?: AttendeeTrackedOrder | null;
    selectedOrderId: string | null;
    onSelectOrder: (orderId: string | null) => void;
    onClose: () => void;
    isLoading: boolean;
    isSendingReceipt: boolean;
    isUpdatingOrder: boolean;
    canResendReceipt: boolean;
    canCancelOrder: boolean;
    canCancelAndRelist: boolean;
    onResendReceipt: (orderId: string) => void;
    onCancelOrder: (orderId: string, mode: "cancel" | "cancel_and_relist") => void;
}) {
    const [cancelIntent, setCancelIntent] = useState<{ orderId: string; mode: "cancel" | "cancel_and_relist" } | null>(null);

    if (isLoading && !attendeeDetail) {
        return (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-3 text-sm text-[var(--v-text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading attendee profile...
                </div>
            </div>
        );
    }

    if (!attendeeDetail) return null;

    const attendee = attendeeDetail.attendee;
    const orders = attendeeDetail.orders || [];
    const cancellingSelectedOrder = Boolean(selectedOrder && cancelIntent?.orderId === selectedOrder.id);

    return (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-white/10 bg-[#0E0E10] p-6">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white">
                            {attendee.fullName?.slice(0, 1).toUpperCase() || "A"}
                        </div>
                        <div>
                            <h3 className="text-[24px] font-semibold tracking-tight text-white">{attendee.fullName}</h3>
                            <p className="text-sm text-[var(--v-text-secondary)]">
                                {attendee.joinedAt ? `Joined ${formatDate(attendee.joinedAt)}` : "Event attendee"}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
                        aria-label="Close attendee panel"
                    >
                        <Plus className="h-4 w-4 rotate-45" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">
                            Group Statistics
                        </div>
                        <div className="space-y-2 rounded-[20px] bg-white/[0.04] p-4">
                            <div className="flex items-center justify-between text-sm text-white">
                                <span>Events Attended</span>
                                <span>{formatNumber(attendee.stats.eventsAttended)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-white">
                                <span>Lifetime Spend</span>
                                <span>{formatINR(attendee.stats.lifetimeSpend)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--v-text-secondary)]">
                            Contact Info
                        </div>
                        <div className="space-y-2 rounded-[20px] bg-white/[0.04] p-4 text-sm text-white/90">
                            <ContactLine icon={Mail} value={attendee.email} />
                            <ContactLine icon={Phone} value={attendee.phone} />
                            <ContactLine icon={Instagram} value={attendee.instagram} />
                            <ContactLine icon={MapPin} value={[attendee.area, attendee.city].filter(Boolean).join(", ")} />
                        </div>
                    </div>
                </div>
            </aside>

            <div className="space-y-5">
                <div className="rounded-[28px] border border-white/10 bg-[#0E0E10] p-6">
                    <div className="mb-4">
                        <h3 className="text-[20px] font-semibold text-white">Orders</h3>
                        <p className="text-sm text-[var(--v-text-secondary)]">Each order is linked to a persistent database order index.</p>
                    </div>

                    <div className="overflow-hidden rounded-[22px] border border-white/8">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="bg-white/[0.04] text-left text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--v-text-secondary)]">
                                    <th className="px-4 py-3">Order</th>
                                    <th className="px-4 py-3">Event</th>
                                    <th className="px-4 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr
                                        key={order.id}
                                        onClick={() => onSelectOrder(order.id)}
                                        className={cn(
                                            "cursor-pointer border-t border-white/[0.05] transition-colors hover:bg-white/[0.04]",
                                            selectedOrderId === order.id && "bg-white/[0.06]"
                                        )}
                                    >
                                        <td className="px-4 py-4 align-top">
                                            <div className="text-[15px] font-medium text-sky-300">{order.orderNumber}</div>
                                            <div className="text-sm text-white/80">{formatINR(order.amount)}</div>
                                        </td>
                                        <td className="px-4 py-4 align-top">
                                            <div className="text-sm text-white">{order.eventName}</div>
                                            {order.promoterCode ? (
                                                <span className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
                                                    {order.promoterCode}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-4 align-top text-sm text-white/80">{formatDatetime(order.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="rounded-[28px] border border-white/10 bg-[#0E0E10] p-6">
                        {selectedOrder ? (
                            <div className="space-y-5">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-white/10">
                                        {selectedOrder.eventImage ? (
                                            <img src={selectedOrder.eventImage} alt={selectedOrder.eventName} className="h-full w-full object-cover" />
                                        ) : (
                                            <Ticket className="h-8 w-8 text-white/60" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--v-text-secondary)]">{selectedOrder.eventName}</p>
                                        <h3 className="text-[34px] leading-none tracking-tight text-white">{selectedOrder.orderNumber}</h3>
                                        <div className="mt-2">
                                            <StatusPill status={selectedOrder.status} compact />
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-[22px] border border-white/10">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr className="bg-white/[0.04] text-left text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--v-text-secondary)]">
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3">Quantity</th>
                                                <th className="px-4 py-3 text-right">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedOrder.items.map((item) => (
                                                <tr key={item.id} className="border-t border-white/[0.05]">
                                                    <td className="px-4 py-4 text-white">
                                                        <div>{item.name}</div>
                                                        <div className="text-sm text-white/70">{formatINR(item.price)}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-white">x{item.quantity}</td>
                                                    <td className="px-4 py-4 text-right text-white">{formatINR(item.price * item.quantity)}</td>
                                                </tr>
                                            ))}
                                            <tr className="border-t border-white/[0.08] bg-white/[0.03]">
                                                <td colSpan={2} className="px-4 py-3 text-right text-white/70">Subtotal</td>
                                                <td className="px-4 py-3 text-right text-white">{formatINR(selectedOrder.amount)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={2} className="px-4 pb-4 text-right text-[28px] font-semibold text-white">Total</td>
                                                <td className="px-4 pb-4 text-right text-[28px] font-semibold text-white">{formatINR(selectedOrder.amount)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        disabled={!canResendReceipt || !selectedOrder.email || isSendingReceipt}
                                        onClick={() => onResendReceipt(selectedOrder.id)}
                                        className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSendingReceipt ? "Sending..." : "Resend Receipt"}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canCancelOrder || isUpdatingOrder || ["cancelled", "refunded"].includes(selectedOrder.status)}
                                        onClick={() => setCancelIntent({ orderId: selectedOrder.id, mode: "cancel" })}
                                        className="rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isUpdatingOrder ? "Updating..." : "Cancel"}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canCancelAndRelist || isUpdatingOrder || ["cancelled", "refunded"].includes(selectedOrder.status)}
                                        onClick={() => setCancelIntent({ orderId: selectedOrder.id, mode: "cancel_and_relist" })}
                                        className="rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isUpdatingOrder ? "Updating..." : "Cancel & Relist"}
                                    </button>
                                </div>

                                {cancellingSelectedOrder ? (
                                    <div className="rounded-[22px] border border-amber-500/25 bg-amber-500/10 p-5 text-white">
                                        <div className="flex items-start gap-3">
                                            <Info className="mt-0.5 h-5 w-5 text-amber-300" />
                                            <div className="space-y-3">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-white">
                                                        {cancelIntent?.mode === "cancel_and_relist" ? "Cancel and relist this order?" : "Cancel this order?"}
                                                    </h4>
                                                    <p className="mt-1 text-sm text-white/78">
                                                        {cancelIntent?.mode === "cancel_and_relist"
                                                            ? "This will mark the order as cancelled, revoke its entitlements, and return its ticket quantity back to inventory."
                                                            : "This will mark the order as cancelled and revoke its entitlements. Inventory is not relisted in this mode."}
                                                    </p>
                                                </div>
                                                <p className="text-xs uppercase tracking-[0.14em] text-amber-200/90">
                                                    {selectedOrder.orderNumber} · {selectedOrder.eventName}
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCancelIntent(null)}
                                                        disabled={isUpdatingOrder}
                                                        className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Keep Order
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!cancelIntent) return;
                                                            onCancelOrder(cancelIntent.orderId, cancelIntent.mode);
                                                            setCancelIntent(null);
                                                        }}
                                                        disabled={isUpdatingOrder}
                                                        className="rounded-full bg-[#F97316] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {isUpdatingOrder ? "Updating..." : (cancelIntent?.mode === "cancel_and_relist" ? "Confirm Cancel & Relist" : "Confirm Cancel")}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <EmptyPanelCopy copy="Select an order to inspect line items and run operational actions." />
                        )}
                    </div>

                    <div className="rounded-[28px] border border-white/10 bg-[#0E0E10] p-6">
                        <div className="mb-4">
                            <h3 className="text-[20px] font-semibold text-white">Timeline</h3>
                        </div>
                        <div className="space-y-5">
                            {attendeeDetail.timeline.map((entry, index) => (
                                <div key={entry.id} className="relative pl-9">
                                    {index < attendeeDetail.timeline.length - 1 ? (
                                        <span className="absolute left-[11px] top-7 h-[calc(100%+10px)] w-px bg-[#5D4C15]" />
                                    ) : null}
                                    <span className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[#7A6420] bg-[#221B07]" />
                                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#C9B06B]">
                                        {entry.timestamp ? formatDate(entry.timestamp) : "No date"}
                                    </div>
                                    <div className="mt-1 text-sm text-white/90">{entry.label}</div>
                                    <div className="mt-1 text-sm text-white/60">
                                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : ""}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetaItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="inline-flex items-center gap-2 text-sm">
            <Icon className="h-4 w-4 text-[var(--v-orange)]" />
            <span>{label}</span>
        </div>
    );
}

function ContactLine({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-[var(--v-text-muted)]" />
            <span className="truncate">{value}</span>
        </div>
    );
}

function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
    const normalized = String(status || "draft").toLowerCase().replace(/\s+/g, "_");
    const tone =
        normalized.includes("live") || normalized.includes("on_sale") || normalized.includes("checked_in")
            ? "emerald"
            : normalized.includes("pending") || normalized.includes("submitted")
                ? "amber"
                : normalized.includes("cancel") || normalized.includes("denied") || normalized.includes("disabled")
                    ? "rose"
                    : normalized.includes("hidden") || normalized.includes("sold_out")
                        ? "slate"
                        : "indigo";

    const palette = {
        emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
        rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
        slate: "border-white/10 bg-white/[0.05] text-[var(--v-text-secondary)]",
        indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
    };

    return (
        <span
            className={cn(
                "inline-flex w-fit items-center rounded-full border font-bold uppercase tracking-[0.14em]",
                compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
                palette[tone]
            )}
        >
            {humanizeLabel(status)}
        </span>
    );
}

function toLocalDateTimeInput(value: string | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (segment: number) => String(segment).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(value: string) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function humanizeLabel(value: string) {
    return String(value || "")
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatSaleWindow(startSale: string | null, endSale: string | null) {
    if (!startSale && !endSale) return "No date limits";
    if (startSale && endSale) return `${formatDate(startSale)} → ${formatDate(endSale)}`;
    if (startSale) return `Starts ${formatDate(startSale)}`;
    return `Ends ${formatDate(endSale)}`;
}

function SettingsNavCard({
    icon: Icon,
    title,
    description,
    onClick,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="group relative flex flex-col items-start gap-4 rounded-[24px] bg-[#111] p-6 border border-white/[0.03] transition-all hover:bg-[#161616] hover:border-white/[0.08] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] text-left h-full"
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] text-white/50 transition-all group-hover:scale-110 group-hover:text-white group-hover:bg-white/10">
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <h3 className="text-[17px] font-bold text-white tracking-tight mb-1 transition-colors group-hover:text-[#EBB440]">
                    {title}
                </h3>
                <p className="text-[13px] leading-relaxed text-white/40 font-medium">
                    {description}
                </p>
            </div>
        </button>
    );
}

const selectClassName =
    "w-full rounded-xl border border-border-default bg-[var(--v-card)] px-3 py-2.5 text-sm text-[var(--v-text-primary)] outline-none transition-colors focus:border-[var(--v-orange)]";

function RefreshBar({
    refreshedAt,
    isLoading,
    onRefresh,
}: {
    refreshedAt: Date | null;
    isLoading: boolean;
    onRefresh: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 px-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--v-text-secondary)]">
                {refreshedAt
                    ? `Last updated ${refreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                    : "Tap refresh to load data"}
            </span>
            <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-all disabled:opacity-50 hover:opacity-80"
                style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)", color: "var(--v-text-secondary)" }}
            >
                <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                Refresh
            </button>
        </div>
    );
}
