"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const CreateEventWizardV2 = dynamic(
    () => import("@/components/wizard/CreateEventWizardV2").then(mod => mod.CreateEventWizardV2),
    { ssr: false, loading: () => <div className="py-40 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-slate-300" /></div> }
);

export default function HostCreateEventPage() {
    return (
        <div className="pb-20">
            <CreateEventWizardV2 role="host" />
        </div>
    );
}
