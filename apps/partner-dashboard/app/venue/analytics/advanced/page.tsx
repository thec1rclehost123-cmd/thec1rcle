import OverviewClient from "../overview/OverviewClient";

export const metadata = {
    title: "Advanced Analytics — Pro | Partner Dashboard",
    description: "Revenue intelligence, audience cohorts, operational integrity, and predictive insights.",
};

export default function AdvancedAnalyticsPage() {
    return <OverviewClient mode="advanced" />;
}
