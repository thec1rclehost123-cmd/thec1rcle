import { redirect } from "next/navigation";

export default function AnalyticsRedirect() {
    redirect("/venue/analytics/overview");
}
