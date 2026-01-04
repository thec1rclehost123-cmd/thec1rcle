"use client";

import { CreateEventWizard } from "@/components/wizard/CreateEventWizard";

export default function HostCreateEventPage() {
    return (
        <div className="pb-20">
            <CreateEventWizard role="host" />
        </div>
    );
}
