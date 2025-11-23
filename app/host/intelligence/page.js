"use client";

import {
    Zap,
    Users,
    TrendingUp,
    MapPin,
    Activity,
    BrainCircuit
} from "lucide-react";
import {
    StudioCard,
    MetricCard,
    DemographicsChart,
    GenderChart,
    GeoList,
    RealtimeTicker
} from "../../../components/host/StudioComponents";
import {
    CrowdPredictionChart,
    AICrowdInsight
} from "../../../components/host/AdvancedStudioComponents";

export default function IntelligencePage() {
    return (
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-2 flex items-center gap-3">
                        <BrainCircuit className="w-8 h-8 text-iris" />
                        Nightlife Intelligence
                    </h1>
                    <p className="text-white/40 text-sm">AI-powered insights to predict and optimize your nights.</p>
                </div>
                <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10">
                    <RealtimeTicker />
                </div>
            </div>

            {/* AI Predictions Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StudioCard className="lg:col-span-2" delay={0.1}>
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                Crowd Prediction Model
                            </h3>
                            <p className="text-xs text-white/40 uppercase tracking-wider">Forecast for Tonight</p>
                        </div>
                    </div>
                    <CrowdPredictionChart />
                    <AICrowdInsight />
                </StudioCard>

                <div className="space-y-6">
                    <MetricCard
                        title="Peak Time"
                        value="12:30 AM"
                        change="High Capacity"
                        icon={Activity}
                        delay={0.2}
                    />
                    <MetricCard
                        title="Expected Footfall"
                        value="~850"
                        change="+12% vs Last Week"
                        icon={Users}
                        delay={0.3}
                    />
                </div>
            </div>

            {/* Deep Demographics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StudioCard className="lg:col-span-1" delay={0.4}>
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-white">Gender Ratio</h3>
                        <p className="text-xs text-white/40 uppercase tracking-wider">Live Balance</p>
                    </div>
                    <div className="flex items-center justify-center h-48">
                        <GenderChart />
                    </div>
                </StudioCard>

                <StudioCard className="lg:col-span-1" delay={0.5}>
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-white">Age Groups</h3>
                        <p className="text-xs text-white/40 uppercase tracking-wider">Target Audience</p>
                    </div>
                    <DemographicsChart />
                </StudioCard>

                <StudioCard className="lg:col-span-1" delay={0.6}>
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-white">Top Locations</h3>
                        <p className="text-xs text-white/40 uppercase tracking-wider">Where they come from</p>
                    </div>
                    <GeoList />
                </StudioCard>
            </div>
        </div>
    );
}
