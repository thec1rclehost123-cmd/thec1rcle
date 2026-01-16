"use client";

import { OperatingCalendar } from "@/components/calendar/OperatingCalendar";

export default function CalendarWrapper() {
    return (
        <div className="h-full min-h-[calc(100vh-100px)]">
            <OperatingCalendar />
        </div>
    );
}
