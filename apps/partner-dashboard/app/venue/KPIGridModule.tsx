import { TrendingUp, Calendar, Zap, Users } from "lucide-react";
import { KPITile, KPIGrid } from "@/components/ui/KPITile";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useVenueOverviewSummary } from "@/lib/hooks/useVenueQueries";

export default function KPIGridModule() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const { data: summary } = useVenueOverviewSummary(venueId);

    const formatRevenue = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount}`;
    };

    return (
        <KPIGrid columns={4}>
            <KPITile
                label="Weekend Revenue"
                value={formatRevenue(summary?.weekendRevenue || 0)}
                trend={{ value: "12.4%", direction: "up" }}
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
                value="2.4K"
                trend={{ value: "180 new", direction: "up" }}
                icon={<Users className="w-6 h-6" />}
                state="success"
            />
        </KPIGrid>
    );
}
