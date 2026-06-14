"use client";

import { CalendarDays } from "lucide-react";

export function PromoterActiveEventsRail({ assignments }: { assignments?: any[] }) {
    if (!assignments || assignments.length === 0) {
        return (
            <div className="w-full bg-surface-elevated rounded-2xl border border-border-subtle p-8 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-surface-tertiary flex items-center justify-center mb-4 text-emerald-500">
                    <CalendarDays className="h-6 w-6" />
                </div>
                <h3 className="text-text-primary font-bold mb-1">No Active Assignments</h3>
                <p className="text-sm text-text-tertiary">When a Host assigns you an event, it will appear here.</p>
            </div>
        );
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {assignments.map((assignment: any) => (
                <div key={assignment.id} className="min-w-[300px] bg-surface-base border border-border-subtle p-5 rounded-2xl flex-shrink-0">
                    <h3 className="font-bold text-text-primary truncate">{assignment.event?.name || "Loading..."}</h3>
                    <p className="text-sm text-text-secondary mt-1">{assignment.event?.date ?? "—"}</p>
                </div>
            ))}
        </div>
    );
}
