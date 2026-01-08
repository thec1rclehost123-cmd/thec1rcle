"use client";

import { OperatingCalendar } from "@/components/calendar/OperatingCalendar";

export default function HostDashboardHome() {
    return (
        <div className="h-full min-h-[calc(100vh-120px)]">
            <OperatingCalendar />
        </div>
    );
}
