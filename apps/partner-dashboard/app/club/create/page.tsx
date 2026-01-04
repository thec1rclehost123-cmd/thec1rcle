"use client";

import { CreateEventWizard } from "@/components/wizard/CreateEventWizard";

export default function ClubCreateEventPage() {
    return (
        <div className="space-y-10 pb-20">
            <div className="border-b border-slate-200 pb-10">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Venue Productions</h1>
                <p className="text-slate-500 text-lg font-medium mt-2">Create and manage in-house events or residencies.</p>
            </div>

            <CreateEventWizard role="club" />
        </div>
    );
}
