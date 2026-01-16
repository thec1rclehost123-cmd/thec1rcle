"use client";

import { CreateEventWizardV2 } from "@/components/wizard/CreateEventWizardV2";

export default function HostCreateEventPage() {
    return (
        <div className="pb-20">
            <CreateEventWizardV2 role="host" />
        </div>
    );
}
