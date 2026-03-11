import { Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProgressStat } from "@/components/ui/KPITile";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useTonightEvent } from "@/lib/hooks/useVenueQueries";
import { motion } from "framer-motion";

export default function TonightOpsModule() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const { tonight } = useTonightEvent(venueId);

    const formatRevenue = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount}`;
    };

    return (
        <div className="card p-8 min-h-[400px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-headline-sm text-text-primary mb-1">Tonight</h2>
                    <p className="text-body-sm text-text-tertiary">Real-time venue operations</p>
                </div>
                {tonight ? (
                    <div className="badge badge-success">
                        <span className="status-dot status-dot-success status-dot-pulse" />
                        Live: {tonight.checkedIn} Guests In
                    </div>
                ) : (
                    <div className="badge badge-neutral">No Event Tonight</div>
                )}
            </div>

            {tonight ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-6">
                        <div>
                            <p className="text-label-sm text-text-tertiary mb-2">Expected</p>
                            <p className="text-stat-lg text-text-primary">{tonight.expected}</p>
                            <p className="text-caption text-text-tertiary">Total Guestlist</p>
                        </div>
                        <ProgressStat
                            label="Turnout Rate"
                            value={tonight.checkedIn}
                            max={tonight.expected}
                            displayValue={`${tonight.checkedIn} arrived`}
                            color="success"
                        />
                    </div>
                    <div className="space-y-6">
                        <div>
                            <p className="text-label-sm text-text-tertiary mb-2">Live Revenue</p>
                            <p className="text-stat-lg text-text-primary">
                                {formatRevenue(tonight.revenue)}
                            </p>
                            <p className="text-caption text-text-tertiary">Tonight's sales</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <Link
                            href={`/venue/events/${tonight.id}`}
                            className="group flex items-center justify-between p-4 rounded-2xl bg-surface-secondary border border-border-subtle hover:border-accent-primary hover:bg-accent-glow transition-all"
                        >
                            <div>
                                <p className="text-label-sm text-text-tertiary mb-0.5">Control Panel</p>
                                <p className="text-title-sm text-text-primary">Guest Entry</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-accent-primary group-hover:translate-x-1 transition-all" />
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="py-16 text-center border-2 border-dashed border-border-subtle rounded-2xl">
                    <Clock className="mx-auto mb-4 text-text-placeholder" size={48} />
                    <p className="text-body text-text-tertiary">Your venue is quiet tonight.</p>
                </div>
            )}
        </div>
    );
}
