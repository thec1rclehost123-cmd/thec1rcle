import { TrendingUp, Calendar, Zap, Users } from "lucide-react";
import { KPITile, KPIGrid } from "@/components/ui/KPITile";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useVenueOverviewSummary } from "@/lib/hooks/useVenueQueries";
import { formatINRCompact, formatNumberCompact } from "@/lib/utils/format";

export default function KPIGridModule({ range }: { range?: string }) {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const { data: summary } = useVenueOverviewSummary(venueId, range);

    return (
        <KPIGrid columns={4}>
            <KPITile
                label="Revenue"
                value={formatINRCompact(summary?.weekendRevenue || 0)}
                trend={summary?.revenueTrend && summary.weekendRevenue > 0 ? {
                    value: summary.revenueTrend,
                    direction: summary.revenueTrendDirection || "up"
                } : undefined}
                icon={<TrendingUp className="w-6 h-6" />}
                state="accent"
                currency="none"
            />
            <KPITile
                label="Upcoming Events"
                value={summary?.activeEventsCount || 0}
                subtext="Next 7 days"
                icon={<Calendar className="w-6 h-6" />}
                state="info"
            />
            <KPITile
                label="Entry Rate"
                value={summary?.avgEntryVelocity || "0/hr"}
                subtext="Last session peak"
                icon={<Zap className="w-6 h-6" />}
                state="warning"
            />
            <KPITile
                label="Guest Profiles"
                value={formatNumberCompact(summary?.totalGuestProfiles || 0)}
                trend={summary?.newGuestsThisWeek ? {
                    value: `+${summary.newGuestsThisWeek}`,
                    direction: "up"
                } : undefined}
                icon={<Users className="w-6 h-6" />}
                state="success"
            />
        </KPIGrid>
    );
}
