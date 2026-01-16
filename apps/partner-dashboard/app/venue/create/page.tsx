"use client";

import { CreateEventWizardV2 } from "@/components/wizard/CreateEventWizardV2";

export default function VenueCreateEventPage() {
    return (
        <div className="pb-20">
            <CreateEventWizardV2 role="venue" />
        </div>
    );
}
